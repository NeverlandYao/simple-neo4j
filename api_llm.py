import os
import json
import time
import ssl
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import Request, urlopen, build_opener, HTTPSHandler, install_opener
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse, parse_qs

neo4j = None
try:
    import neo4j as _neo4j
    neo4j = _neo4j
except Exception:
    neo4j = None

def _load_env(path=".env"):
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                s=line.strip()
                if not s or s.startswith("#") or "=" not in s:
                    continue
                k,v=s.split("=",1)
                k=k.strip(); v=v.strip()
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
                k=k.strip(); v=v.strip()
                if k:
                    cfg[k]=v
    except FileNotFoundError:
        pass
    return cfg

def _query_neo4j(fn):
    cfg=_load_cfg()
    uri=cfg.get("url") or "neo4j://127.0.0.1:7687"
    user=cfg.get("user") or "neo4j"
    password=cfg.get("password") or ""
    database=cfg.get("database") or None
    if neo4j is None:
        return None
    driver=neo4j.GraphDatabase.driver(uri, auth=(user, password))
    try:
        with driver.session(database=database) as session:
            return fn(session)
    finally:
        driver.close()

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
        if self.path.startswith("/question"):
            qs=parse_qs(urlparse(self.path).query)
            module_name=(qs.get("module_name") or ["\n"])[0].strip()
            module_id=(qs.get("module_id") or [""])[0].strip()
            include_answer=((qs.get("include_answer") or ["false"]) [0].lower() in ("1","true","yes"))
            def run(session):
                if module_name:
                    cypher=("MATCH (cm:ContentModule {name:$name})<-[:TESTS]-(q:Question) "
                            "WHERE coalesce(q.user_result,'') <> 'true' "
                            "RETURN q ORDER BY q.created_at DESC LIMIT 1")
                    rec=session.run(cypher,{"name":module_name}).single()
                elif module_id:
                    cypher=("MATCH (cm) WHERE elementId(cm)=$id MATCH (cm)<-[:TESTS]-(q:Question) "
                            "WHERE coalesce(q.user_result,'') <> 'true' "
                            "RETURN q ORDER BY q.created_at DESC LIMIT 1")
                    rec=session.run(cypher,{"id":module_id}).single()
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

        _load_env()
        base=os.environ.get("MS_BASE_URL","https://api-inference.modelscope.cn/v1").rstrip("/")
        key=os.environ.get("MS_API_KEY","" ).strip()
        model=os.environ.get("MS_MODEL","Qwen/Qwen3-32B").strip()

        if not key:
            self.send_response(500)
            self._cors()
            self.send_header("Content-Type","application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error":"missing MS_API_KEY"}).encode("utf-8"))
            return

        parts=[]
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
                for l in ls:
                    nn=str((l or {}).get("neighborName") or "").strip()
                    nid=str((l or {}).get("neighborId") or "").strip()
                    tp=str((l or {}).get("type") or "").strip()
                    dr=str((l or {}).get("dir") or "").strip()
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

        self.send_response(200)
        self._cors()
        self.send_header("Content-Type","application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"answer":answer}).encode("utf-8"))

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
