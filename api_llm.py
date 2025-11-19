import os
import json
import time
import ssl
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import Request, urlopen, build_opener, HTTPSHandler, install_opener
from urllib.error import HTTPError, URLError

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

class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
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
                {"role":"system","content":"你是一名基于知识图谱的导师。仅根据提供的证据回答，不要臆造。输出简洁并包含建议。当证据为空时，给出常识解释。"},
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
                self.send_response(502)
                self._cors()
                self.send_header("Content-Type","application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error":str(ue)}).encode("utf-8"))
                return

        answer=""
        if "json" in ct:
            try:
                j=json.loads(data.decode("utf-8"))
            except Exception:
                j={}
            if isinstance(j, dict) and j.get("error"):
                msg=str(j.get("error",{}).get("message") or "invalid request")
                answer=msg
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