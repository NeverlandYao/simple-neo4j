import os
import json
import time
import ssl
import base64
import io
import pymysql
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import Request, urlopen, build_opener, HTTPSHandler, install_opener
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse, parse_qs

# MySQL Config
def _get_mysql_conn():
    _load_env()
    host = os.environ.get("MYSQL_HOST", "localhost")
    port = int(os.environ.get("MYSQL_PORT", 3306))
    user = os.environ.get("MYSQL_USER", "root")
    password = os.environ.get("MYSQL_PASSWORD", "")
    database = os.environ.get("MYSQL_DATABASE", "it_diathesis_system")
    
    try:
        return pymysql.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=database,
            cursorclass=pymysql.cursors.DictCursor
        )
    except Exception as e:
        print(f"MySQL Connection Error: {e}")
        return None

# LightRAG Integration
lightrag_wrapper = None
try:
    import lightrag_wrapper
except ImportError:
    pass

# PDF/Docx Extraction
try:
    import pypdf
except ImportError:
    pypdf = None

try:
    import docx
except ImportError:
    docx = None

neo4j = None
try:
    import neo4j as _neo4j
    neo4j = _neo4j
except Exception as e:
    neo4j = None
    print(f"DEBUG: neo4j module import failed: {e}")

def _load_env(path=".env"):
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                s=line.strip()
                if not s or s.startswith("#") or "=" not in s:
                    continue
                k,v=s.split("=",1)
                k=k.strip()
                v=v.strip()
                if k and v and k not in os.environ:
                    os.environ[k]=v
    except FileNotFoundError:
        pass

def _load_cfg(path="neo4j-link.txt"):
    cfg={}
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                s=line.strip()
                if not s or "=" not in s:
                    continue
                k,v=s.split("=",1)
                k=k.strip()
                v=v.strip()
                if k:
                    cfg[k]=v
    except FileNotFoundError:
        pass
    return cfg

def _query_neo4j(fn):
    cfg=_load_cfg()
    uri=os.environ.get("NEO4J_URI") or cfg.get("url") or "neo4j://127.0.0.1:7687"
    user=os.environ.get("NEO4J_USER") or cfg.get("user") or "neo4j"
    password=os.environ.get("NEO4J_PASSWORD") or cfg.get("password") or ""
    database=os.environ.get("NEO4J_DATABASE") or cfg.get("database") or None
    if neo4j is None:
        return None
    
    driver=neo4j.GraphDatabase.driver(uri, auth=(user, password))
    try:
        with driver.session(database=database) as session:
            return fn(session)
    finally:
        driver.close()

def _log_dialogue(session_id, role, content, context=None):
    if not session_id: return
    try:
        conn = _get_mysql_conn()
        if not conn: return
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO dialogue_logs (session_id, role, content, context) VALUES (%s, %s, %s, %s)",
                (session_id, role, content, context or "")
            )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"MySQL log error: {e}")

def _log_learning(session_id, question_id, is_correct):
    if not session_id: return
    try:
        conn = _get_mysql_conn()
        if not conn: return
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO learning_logs (session_id, question_id, is_correct) VALUES (%s, %s, %s)",
                (session_id, question_id, is_correct)
            )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"MySQL log error: {e}")

def _search_competency_path(question):
    """
    基于图谱的上下文检索：查找问题中提到的概念，并追溯其所属的核心素养路径。
    这实现了'图谱引导'的生成。
    """
    if not question: return []
    
    def run(session):
        # 查找名称出现在问题中的节点（反向匹配），并向上追溯路径
        # Label 修正：CoreLiteracy, SubDimension, ContentModule
        cypher = """
        MATCH (n) 
        WHERE (n:CoreLiteracy OR n:SubDimension OR n:ContentModule) 
          AND size(n.name) > 1 
          AND $question CONTAINS n.name
        WITH n
        LIMIT 3
        MATCH path = (root:CoreLiteracy)-[:INCLUDES|HAS_DIMENSION|DEVELOPED_BY*1..4]->(n)
        WHERE root.level = '顶层' OR root.level = '核心素养'
        RETURN [node in nodes(path) | node.name] AS path_names
        ORDER BY length(path) ASC
        LIMIT 3
        """
        return session.run(cypher, {"question": question}).data()
    
    try:
        results = _query_neo4j(run)
        paths = []
        if results:
            for r in results:
                names = r.get("path_names", [])
                if names:
                    paths.append(" -> ".join(names))
        # 去重
        return list(set(paths))
    except Exception as e:
        print(f"Graph search error: {e}")
        return []

class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/task_status"):
            query = urlparse(self.path).query
            params = parse_qs(query)
            task_id = params.get("task_id", [None])[0]
            
            if not task_id:
                self.send_response(400)
                self._cors()
                self.end_headers()
                self.wfile.write(b'{"error": "task_id required"}')
                return
            
            if lightrag_wrapper:
                status = lightrag_wrapper.get_task_status(task_id)
                if status:
                    self.send_response(200)
                    self._cors()
                    self.send_header("Content-Type","application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(status).encode("utf-8"))
                else:
                    self.send_response(404)
                    self._cors()
                    self.end_headers()
                    self.wfile.write(b'{"error": "Task not found"}')
            else:
                self.send_response(503)
                self._cors()
                self.end_headers()
                self.wfile.write(b'{"error": "LightRAG not available"}')
            return

        if self.path.startswith("/question"):
            qs=parse_qs(urlparse(self.path).query)
            module_name=(qs.get("module_name") or ["\n"])[0].strip()
            module_id=(qs.get("module_id") or [""])[0].strip()
            include_answer=((qs.get("include_answer") or ["false"]) [0].lower() in ("1","true","yes"))
            qtype=(qs.get("type") or [""])[0].strip()
            difficulty=(qs.get("difficulty") or [""])[0].strip()
            exclude_id=(qs.get("exclude_id") or [""])[0].strip()
            exclude_qid=(qs.get("exclude_qid") or [""])[0].strip()
            def run(session):
                if module_name:
                    cypher=("MATCH (cm:Concept {name:$name})<-[:TESTS]-(q:Question) "
                            "WHERE coalesce(q.user_result,'') <> 'true' "
                            + (" AND q.type = $qtype" if qtype else "")
                            + (" AND q.difficulty = $difficulty" if difficulty else "")
                            + (" AND elementId(q) <> $exclude_id" if exclude_id else "")
                            + (" AND q.qid <> $exclude_qid" if exclude_qid else "")
                            + " RETURN q ORDER BY q.created_at DESC LIMIT 1")
                    params={"name":module_name}
                    if qtype:
                        params["qtype"]=qtype
                    if difficulty:
                        params["difficulty"]=difficulty
                    if exclude_id:
                        params["exclude_id"]=exclude_id
                    if exclude_qid:
                        params["exclude_qid"]=exclude_qid
                    rec=session.run(cypher,params).single()
                elif module_id:
                    cypher=("MATCH (cm) WHERE elementId(cm)=$id MATCH (cm)<-[:TESTS]-(q:Question) "
                            "WHERE coalesce(q.user_result,'') <> 'true' "
                            + (" AND q.type = $qtype" if qtype else "")
                            + (" AND q.difficulty = $difficulty" if difficulty else "")
                            + (" AND elementId(q) <> $exclude_id" if exclude_id else "")
                            + (" AND q.qid <> $exclude_qid" if exclude_qid else "")
                            + " RETURN q ORDER BY q.created_at DESC LIMIT 1")
                    params={"id":module_id}
                    if qtype:
                        params["qtype"]=qtype
                    if difficulty:
                        params["difficulty"]=difficulty
                    if exclude_id:
                        params["exclude_id"]=exclude_id
                    if exclude_qid:
                        params["exclude_qid"]=exclude_qid
                    rec=session.run(cypher,params).single()
                else:
                    return {"error":"missing module_name or module_id"}
                if not rec:
                    return {"question":None}
                q=rec.get("q")
                props=q._properties if hasattr(q,"_properties") else getattr(q,"properties",{})
                out={
                    "id": getattr(q,"element_id", None) or getattr(q,"elementId", None),
                    "qid": props.get("qid"),
                    "content": props.get("content"),
                    "type": props.get("type"),
                    "options": props.get("options"),
                    "difficulty": props.get("difficulty"),
                }
                if include_answer:
                    out["answer"]=props.get("answer")
                    out["analysis"]=props.get("analysis")
                return {"question":out}
            res=_query_neo4j(run)
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type","application/json")
            self.end_headers()
            self.wfile.write(json.dumps(res or {"error":"neo4j unavailable"}).encode("utf-8"))
            return
        if self.path.startswith("/question_stats"):
            qs=parse_qs(urlparse(self.path).query)
            module_name=(qs.get("module_name") or ["\n"])[0].strip()
            module_id=(qs.get("module_id") or [""])[0].strip()
            def run(session):
                if module_name:
                    rec=session.run("MATCH (cm:Concept {name:$name})<-[:TESTS]-(q:Question) RETURN count(q) AS total, count(CASE WHEN q.user_result='true' THEN 1 END) AS mastered", {"name":module_name}).single()
                    rows=session.run("MATCH (cm:Concept {name:$name})<-[:TESTS]-(q:Question) RETURN coalesce(q.difficulty,'') AS d, count(q) AS c", {"name":module_name}).data()
                elif module_id:
                    rec=session.run("MATCH (cm) WHERE elementId(cm)=$id MATCH (cm)<-[:TESTS]-(q:Question) RETURN count(q) AS total, count(CASE WHEN q.user_result='true' THEN 1 END) AS mastered", {"id":module_id}).single()
                    rows=session.run("MATCH (cm) WHERE elementId(cm)=$id MATCH (cm)<-[:TESTS]-(q:Question) RETURN coalesce(q.difficulty,'') AS d, count(q) AS c", {"id":module_id}).data()
                else:
                    return {"error":"missing module_name or module_id"}
                total=int(rec.get("total") or 0)
                mastered=int(rec.get("mastered") or 0)
                pending=max(0,total-mastered)
                by_diff={}
                for r in rows:
                    d=str(r.get("d") or "")
                    c=int(r.get("c") or 0)
                    by_diff[d]=c
                return {"total":total,"mastered":mastered,"pending":pending,"by_difficulty":by_diff}
            out=_query_neo4j(run)
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type","application/json")
            self.end_headers()
            self.wfile.write(json.dumps(out or {"error":"neo4j unavailable"}).encode("utf-8"))
            return
        if self.path.startswith("/health"):
            _load_env()
            base=os.environ.get("MS_BASE_URL","https://api-inference.modelscope.cn/v1").rstrip("/")
            key=os.environ.get("MS_API_KEY","" ).strip()
            model=os.environ.get("MS_MODEL","Qwen/Qwen3-32B").strip()
            res={"ok": True, "ms_key_present": bool(key), "base": base, "model": model}
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type","application/json")
            self.end_headers()
            self.wfile.write(json.dumps(res).encode("utf-8"))
            return
        self.send_response(404)
        self._cors()
        self.end_headers()

    def do_POST(self):
        if self.path == "/cancel_task":
            length=int(self.headers.get("Content-Length") or 0)
            body=self.rfile.read(length) if length>0 else b""
            try:
                payload=json.loads(body.decode("utf-8"))
                task_id = payload.get("task_id")
                if not task_id:
                     raise ValueError("task_id required")
                
                if lightrag_wrapper and lightrag_wrapper.cancel_task(task_id):
                    self.send_response(200)
                    self._cors()
                    self.end_headers()
                    self.wfile.write(b'{"ok": true}')
                else:
                    self.send_response(400)
                    self._cors()
                    self.end_headers()
                    self.wfile.write(b'{"error": "Task not found or cannot be cancelled"}')
            except Exception as e:
                self.send_response(400)
                self._cors()
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        if self.path == "/upload_doc":
            length=int(self.headers.get("Content-Length") or 0)
            body=self.rfile.read(length) if length>0 else b""
            try:
                payload=json.loads(body.decode("utf-8"))
                text = payload.get("text") or ""
                file_base64 = payload.get("file_base64")
                filename = payload.get("filename") or ""
                db_name = payload.get("db_name") or "neo4j"
            except:
                text = body.decode("utf-8", errors="ignore")
                db_name = "neo4j"
                file_base64 = None
                filename = "raw_text"
            
            if not text and not file_base64:
                self.send_response(400)
                self._cors()
                self.end_headers()
                self.wfile.write(b'{"error": "empty text or unsupported file type"}')
                return

            if lightrag_wrapper:
                try:
                    # Async insert
                    if file_base64:
                        task_id = lightrag_wrapper.submit_indexing_task(file_base64, 'binary', filename, db_name)
                    else:
                        task_id = lightrag_wrapper.submit_indexing_task(text, 'text', filename, db_name)

                    self.send_response(200)
                    self._cors()
                    self.send_header("Content-Type","application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"ok": True, "message": "Document queued for indexing", "task_id": task_id}).encode("utf-8"))
                except Exception as e:
                    self.send_response(500)
                    self._cors()
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            else:
                self.send_response(503)
                self._cors()
                self.end_headers()
                self.wfile.write(b'{"error": "LightRAG not available"}')
            return

        if self.path == "/submit_answer":
            length=int(self.headers.get("Content-Length") or 0)
            body=self.rfile.read(length) if length>0 else b""
            try:
                payload=json.loads(body.decode("utf-8") or "{}")
            except Exception:
                payload={}
            question_id=str(payload.get("question_id") or "").strip()
            qid=str(payload.get("qid") or "").strip()
            is_correct=bool(payload.get("is_correct"))
            session_id=str(payload.get("session_id") or "").strip()
            
            # Log learning event
            if session_id:
                _log_learning(session_id, question_id or qid, is_correct)

            def run(session):
                if qid:
                    cypher="MATCH (q:Question {qid:$qid}) SET q.user_result=$res RETURN q"
                    rec=session.run(cypher,{"qid":qid,"res":"true" if is_correct else "false"}).single()
                elif question_id:
                    cypher="MATCH (q) WHERE elementId(q)=$id SET q.user_result=$res RETURN q"
                    rec=session.run(cypher,{"id":question_id,"res":"true" if is_correct else "false"}).single()
                else:
                    return {"error":"missing question_id or qid"}
                ok=bool(rec)
                return {"ok":ok}
            res=_query_neo4j(run)
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type","application/json")
            self.end_headers()
            self.wfile.write(json.dumps(res or {"error":"neo4j unavailable"}).encode("utf-8"))
            return
        if self.path == "/zpd_update":
            length=int(self.headers.get("Content-Length") or 0)
            body=self.rfile.read(length) if length>0 else b""
            try:
                payload=json.loads(body.decode("utf-8") or "{}")
            except Exception:
                payload={}
            node_id=str(payload.get("node_id") or "").strip()
            def run(session):
                if not node_id:
                    return {"error":"missing node_id"}
                cypher=(
                    "MATCH (c) WHERE elementId(c)=$id SET c.status=2 "
                    "WITH c MATCH (c)-[:PREREQUISITE]->(next) "
                    "OPTIONAL MATCH (pre)-[:PREREQUISITE]->(next) "
                    "WITH next, collect(coalesce(pre.status,0)) AS sts "
                    "WHERE size(sts)>0 AND ALL(s IN sts WHERE s=2) "
                    "SET next.status=1 RETURN collect(elementId(next)) AS unlocked"
                )
                rec=session.run(cypher,{"id":node_id}).single()
                unlocked=list(rec.get("unlocked") or [])
                return {"ok":True, "unlocked":unlocked}
            res=_query_neo4j(run)
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type","application/json")
            self.end_headers()
            self.wfile.write(json.dumps(res or {"error":"neo4j unavailable"}).encode("utf-8"))
            return
        if self.path != "/llm":
            self.send_response(404)
            self._cors()
            self.end_headers()
            return
        length=int(self.headers.get("Content-Length") or 0)
        body=b""
        if length>0:
            body=self.rfile.read(length)
        try:
            payload=json.loads(body.decode("utf-8") or "{}")
        except Exception:
            payload={}
        question=str(payload.get("question") or "").strip()
        evidence=list(payload.get("evidence") or [])
        session_id=str(payload.get("session_id") or "").strip()

        # Log User Question
        if session_id and question:
            _log_dialogue(session_id, "user", question)
        
        # 1. Graph-Guided Retrieval (New Feature for Paper)
        # 主动从 Neo4j 检索素养路径，作为高层指导
        graph_paths = _search_competency_path(question)
        graph_context_text = ""
        if graph_paths:
            graph_context_text = "【图谱背景知识】\n本问题关联的学科素养路径：\n" + "\n".join([f"- {p}" for p in graph_paths])
        
        _load_env()
        base=os.environ.get("MS_BASE_URL","https://api-inference.modelscope.cn/v1").rstrip("/")
        key=os.environ.get("MS_API_KEY","" ).strip()
        model=os.environ.get("MS_MODEL","Qwen/Qwen3-32B").strip()

        if not key:
            fallback = "模型不可用，基于已有信息给出简述.\n\n问题:"+question+"\n\n证据:\n"+("\n\n".join(["主题:"+str((e or {}).get("focus") or "") for e in evidence]) or "(无)")
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type","application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"answer": fallback, "degraded": True, "error": "missing MS_API_KEY", "context_path": graph_paths}).encode("utf-8"))
            return

        parts=[]
        # Add Graph Context first if available
        if graph_context_text:
            parts.append(graph_context_text)

        for e in evidence:
            a=[]
            f=str((e or {}).get("focus") or "").strip()
            if f:
                a.append("主题: "+f)
            ns=e.get("neighbors") or []
            if ns:
                a.append("关联节点: "+", ".join([str(x) for x in ns if str(x).strip()]))
            rs=e.get("relations") or []
            if rs:
                a.append("关联关系: "+", ".join([str(x) for x in rs if str(x).strip()]))
            ls=e.get("links") or []
            if ls:
                parts_links=[]
                for link in ls:
                    nn=str((link or {}).get("neighborName") or "").strip()
                    nid=str((link or {}).get("neighborId") or "").strip()
                    tp=str((link or {}).get("type") or "").strip()
                    dr=str((link or {}).get("dir") or "").strip()
                    if nn or nid or tp or dr:
                        s=f"{tp}:{dr} → {nn} [{nid}]"
                        parts_links.append(s)
                if parts_links:
                    a.append("关联链接: "+" | ".join(parts_links))
            cs=e.get("concepts") or []
            if cs:
                a.append("相关知识: "+", ".join([str(x) for x in cs if str(x).strip()]))
            ss=e.get("skills") or []
            if ss:
                a.append("关联能力: "+", ".join([str(x) for x in ss if str(x).strip()]))
            ts=e.get("tasks") or []
            if ts:
                a.append("训练任务: "+", ".join([str(x) for x in ts if str(x).strip()]))
            ps=e.get("competencies") or []
            if ps:
                a.append("涉及素养: "+", ".join([str(x) for x in ps if str(x).strip()]))
            if a:
                parts.append("\n".join(a))
        evidence_text="\n\n".join(parts)

        url=base+"/chat/completions"
        headers={
            "Content-Type":"application/json",
            "Accept":"application/json",
            "Authorization":"Bearer "+key,
            "Connection":"close",
            "User-Agent":"simple-neo4j/1.0"
        }
        body=json.dumps({
            "model": model,
            "messages": [
                {"role":"system","content":"你是一名精通素养图谱、能力图谱与知识图谱的智能问答导师。根据提供的图谱数据与其相连的节点作为证据回答问题，不要臆造。输出简洁并包含建议。当证据为空时，给出常识解释。"},
                {"role":"user","content": f"问题：{question}\n\n证据：\n{evidence_text}"}
            ],
            "temperature": 0.3,
            "top_p": 0.9,
            "enable_thinking": False
        }).encode("utf-8")
        ctx=ssl.create_default_context()
        opener=build_opener(HTTPSHandler(context=ctx))
        install_opener(opener)
        req=Request(url, data=body, headers=headers, method="POST")
        attempt=0
        while True:
            try:
                with urlopen(req, timeout=60) as resp:
                    ct=(resp.headers.get("Content-Type") or "").lower()
                    data=resp.read()
                break
            except HTTPError as he:
                ct=(he.headers.get("Content-Type") or "").lower()
                data=he.read()
                break
            except URLError as ue:
                if attempt<2:
                    attempt+=1
                    time.sleep(0.3)
                    continue
                fallback = "模型不可用，基于已有信息给出简述。\n\n问题："+question+"\n\n证据：\n"+(evidence_text or "(无)")
                self.send_response(200)
                self._cors()
                self.send_header("Content-Type","application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"answer": fallback, "degraded": True, "error": str(ue)}).encode("utf-8"))
                return

        answer=""
        if "json" in ct:
            try:
                j=json.loads(data.decode("utf-8"))
            except Exception:
                j={}
            if isinstance(j, dict) and j.get("error"):
                msg=str(j.get("error",{}).get("message") or "invalid request")
                answer = msg or ("模型不可用，基于已有信息给出简述。\n\n问题："+question+"\n\n证据：\n"+(evidence_text or "(无)"))
            else:
                answer=str((j.get("choices") or [{}])[0].get("message",{}).get("content") or j.get("answer") or j.get("data") or json.dumps(j))
        else:
            answer=data.decode("utf-8",errors="ignore")

        # Log AI Answer
        if session_id and answer:
            _log_dialogue(session_id, "assistant", answer, context=graph_context_text if graph_paths else None)

        self.send_response(200)
        self._cors()
        self.send_header("Content-Type","application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"answer":answer, "context_path": graph_paths}).encode("utf-8"))

def main():
    _load_env()
    port=int(os.environ.get("LLM_PORT","8001"))
    srv=HTTPServer(("127.0.0.1", port), Handler)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass

if __name__=="__main__":
    main()
