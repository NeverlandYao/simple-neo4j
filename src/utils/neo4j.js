
export async function loadConfig(){
  const res=await fetch('neo4j-link.txt');
  const text=await res.text();
  const out={};
  text.split(/\r?\n/).forEach(line=>{
    const i=line.indexOf('=');
    if(i>0){ const k=line.slice(0,i).trim(); const v=line.slice(i+1).trim(); if(k) out[k]=v; }
  });
  return out;
}

export async function detectLocalLlm(){
  const ports=[3000,5000,8001,8080,8888];
  for(const p of ports){
    const url=`http://127.0.0.1:${p}/llm`;
    try{ const r=await fetch(url,{method:'OPTIONS'}); if(r.ok) return url; }catch(_){ }
  }
  return '';
}

export async function getSession() {
  const cfg = await loadConfig();
  const driver = neo4j.driver(cfg.url, neo4j.auth.basic(cfg.user || 'neo4j', cfg.password));
  const session = driver.session({ database: cfg.database });
  return { session, driver, config: cfg };
}
