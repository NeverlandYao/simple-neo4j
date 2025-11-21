const { useState, useEffect, useRef } = React;

function App() {
  const [q, setQ] = useState('');
  const [depth, setDepth] = useState(2);
  const [limit, setLimit] = useState(200);
  const [hier, setHier] = useState(false);
  const [anim, setAnim] = useState(true);
  const [threeLayer, setThreeLayer] = useState(false);
  const [status, setStatus] = useState('');
  const [selectedInfo, setSelectedInfo] = useState('');
  const [availableLabels, setAvailableLabels] = useState([]);
  const [availableRelTypes, setAvailableRelTypes] = useState([]);
  const [filterLabels, setFilterLabels] = useState([]);
  const [filterRelTypes, setFilterRelTypes] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selNodeId, setSelNodeId] = useState('');
  const [selEdgeId, setSelEdgeId] = useState('');
  const [lastMode, setLastMode] = useState('query');
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [pendingRelFromId, setPendingRelFromId] = useState('');
  const graphRef = useRef(null);

  function labelForNode(n){
    const name=n.properties&& (n.properties.name||n.properties.title||n.properties.id);
    const labels=(n.labels&&n.labels.join('\n'))||'';
    return name? String(name): labels|| String(n.id);
  }
  function isStage(ls){
    const s=['Stage','Grade','Level','SchoolStage','学段','小学','初中','高中','大学','学前','幼儿园'];
    return (ls||[]).some(l=>s.includes(l));
  }
  function levelForLabels(labels){
    const ls=labels||[];
    if(ls.includes('Competency')) return 1;
    if(ls.includes('Skill')) return 2;
    if(ls.includes('Concept')) return 3;
    if(isStage(ls)) return 4;
    return 2;
  }
  function groupForLabels(labels){
    const ls=labels||[];
    if(ls.includes('Competency')) return 'Competency';
    if(ls.includes('Skill')) return 'Skill';
    if(ls.includes('Concept')) return 'Concept';
    if(isStage(ls)) return 'Stage';
    return (ls[0]||'Node');
  }
  function palette(i){
    const colors=['#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd','#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf'];
    return colors[i%colors.length];
  }
  function hasAnyLabel(labels, set){return set.length===0 || (labels||[]).some(l=>set.includes(l))}
  function idOf(x){ return x && (x.elementId ?? (x.identity && (typeof x.identity.toString==='function'?x.identity.toString():String(x.identity)))); }
  function toNum(x){ return x && typeof x.toNumber==='function' ? x.toNumber() : x; }

  async function loadConfig(){
    const res=await fetch('neo4j-link.txt');
    const text=await res.text();
    const out={};
    text.split(/\r?\n/).forEach(line=>{
      const i=line.indexOf('=');
      if(i>0){ const k=line.slice(0,i).trim(); const v=line.slice(i+1).trim(); if(k) out[k]=v; }
    });
    return out;
  }

  function mapRecord(record){
    const n=record.get('n');
    const r=record.get('r');
    const m=record.get('m');
    return {
      n: n ? { id:idOf(n), labels:n.labels, properties:n.properties } : null,
      r: r ? { id:idOf(r), type:r.type, start:r.startNodeElementId ?? toNum(r.start), end:r.endNodeElementId ?? toNum(r.end), properties:r.properties } : null,
      m: m ? { id:idOf(m), labels:m.labels, properties:m.properties } : null
    };
  }

  function buildGraphFromRecords(recs){
    const nodeMap=new Map();
    const edgeMap=new Map();
    const labelFilter=filterLabels;
    const typeFilter=filterRelTypes;
    recs.forEach(({n,r,m})=>{
      if(!n) return;
      const gN=groupForLabels(n.labels);
      const nOK=hasAnyLabel(n.labels,labelFilter);
      if(!r){
        if(labelFilter.length===0 || nOK){ if(!nodeMap.has(n.id)) nodeMap.set(n.id,{id:String(n.id),label:labelForNode(n),group:gN,labels:n.labels,status:(n.properties&&n.properties.status)}); }
        return;
      }
      const gM=groupForLabels(m?m.labels:[]);
      const mOK=m?hasAnyLabel(m.labels,labelFilter):false;
      const from=String(r.start);
      const to=String(r.end);
      const eid=String(r.id||`${from}-${to}-${r.type||''}`);
      const tOK=(typeFilter.length===0 || typeFilter.includes(r.type));
      if(tOK && (labelFilter.length===0 || nOK || mOK)){
        if(!nodeMap.has(n.id)) nodeMap.set(n.id,{id:String(n.id),label:labelForNode(n),group:gN,labels:n.labels,status:(n.properties&&n.properties.status)});
        if(m && !nodeMap.has(m.id)) nodeMap.set(m.id,{id:String(m.id),label:labelForNode(m),group:gM,labels:m.labels,status:(m.properties&&m.properties.status)});
        if(!edgeMap.has(eid)) edgeMap.set(eid,{id:eid,from,to,label:r.type});
      }
    });
    return {nodes:[...nodeMap.values()],edges:[...edgeMap.values()]};
  }

  function buildFromPaths(records){
    const nodeMap=new Map();
    const edgeMap=new Map();
    const labelFilter=filterLabels;
    const typeFilter=filterRelTypes;
    records.forEach(rec=>{
      const ns=rec.get('ns');
      const rs=rec.get('rs');
      ns.forEach(n=>{
        const id=n.elementId ?? (n.identity && (typeof n.identity.toString==='function'?n.identity.toString():String(n.identity)));
        const g=groupForLabels(n.labels);
        const nOK=hasAnyLabel(n.labels,labelFilter);
        const st=(n.properties&&n.properties.status);
        if((labelFilter.length===0 || nOK) && !nodeMap.has(id)) nodeMap.set(id,{id:String(id),label:labelForNode({id,labels:n.labels,properties:n.properties}),group:g,labels:n.labels,status:st});
      });
      rs.forEach(r=>{
        const id=r.elementId ?? (r.identity && (typeof r.identity.toString==='function'?r.identity.toString():String(r.identity)));
        const from=String(r.startNodeElementId ?? (r.start && (typeof r.start.toString==='function'?r.start.toString():String(r.start))));
        const to=String(r.endNodeElementId ?? (r.end && (typeof r.end.toString==='function'?r.end.toString():String(r.end))));
        const eid=String(id||`${from}-${to}-${r.type||''}`);
        const tOK=(typeFilter.length===0 || typeFilter.includes(r.type));
        if(tOK && !edgeMap.has(eid)) edgeMap.set(eid,{id:eid,from,to,label:r.type});
      });
    });
    return {nodes:[...nodeMap.values()],edges:[...edgeMap.values()]};
  }

  async function detectLocalLlm(){
    const ports=[3000,5000,8001,8080,8888];
    for(const p of ports){
      const url=`http://127.0.0.1:${p}/llm`;
      try{ const r=await fetch(url,{method:'OPTIONS'}); if(r.ok) return url; }catch(_){ }
    }
    return '';
  }

  useEffect(()=>{
    initMeta();
    runQuery();
  },[]);

  async function initMeta(){
    try{
      const cfg=await loadConfig();
      const driver=neo4j.driver(cfg.url, neo4j.auth.basic(cfg.user||'neo4j', cfg.password));
      const session=driver.session({database:cfg.database});
      const resL=await session.run('MATCH (n) UNWIND labels(n) AS l RETURN DISTINCT l LIMIT 100');
      const labels=resL.records.map(r=>r.get('l'));
      const resT=await session.run('MATCH ()-[r]-() RETURN DISTINCT type(r) AS t LIMIT 100');
      const types=resT.records.map(r=>r.get('t'));
      await session.close();
      await driver.close();
      setAvailableLabels(labels);
      setAvailableRelTypes(types);
    }catch(e){}
  }

  async function runQuery(){
    const container=graphRef.current;
    if(container) container.textContent='加载中…';
    try{
      setLastMode('query');
      const cfg=await loadConfig();
      const uri=cfg.url;
      const user=cfg.user || 'neo4j';
      const password=cfg.password;
      const database=cfg.database;
      const driver=neo4j.driver(uri, neo4j.auth.basic(user, password));
      const session=driver.session({ database });
      const limitVal=Math.max(1, Math.floor(parseFloat(limit)||200));
      const result=await session.run('MATCH (n) WITH n LIMIT $limit OPTIONAL MATCH (n)-[r]-(m) RETURN n, r, m',{limit: neo4j.int(limitVal)});
      const data=result.records.map(mapRecord);
      const g=buildGraphFromRecords(data);
      setNodes(g.nodes);
      setEdges(g.edges);
      await session.close();
      await driver.close();
    }catch(e){ if(container) container.textContent=String(e); }
  }

  async function runExpand(){
    const container=graphRef.current;
    if(container) container.textContent='加载中…';
    try{
      setLastMode('expand');
      const cfg=await loadConfig();
      const uri=cfg.url;
      const user=cfg.user || 'neo4j';
      const password=cfg.password;
      const database=cfg.database;
      const driver=neo4j.driver(uri, neo4j.auth.basic(user, password));
      const session=driver.session({ database });
      const depthVal=Math.max(1, Math.floor(parseFloat(depth)||2));
      const limitVal=Math.max(1, Math.floor(parseFloat(limit)||200));
      const cypher=`MATCH (n) WHERE any(prop IN [n.name, n.title, n.id] WHERE toLower(toString(coalesce(prop,''))) CONTAINS toLower($q)) WITH n LIMIT 1 MATCH p=(n)-[r*1..${depthVal}]-(m) WITH nodes(p) AS ns, relationships(p) AS rs RETURN ns, rs LIMIT $limit`;
      const result=await session.run(cypher,{q,limit: neo4j.int(limitVal)});
      const visData=buildFromPaths(result.records);
      setNodes(visData.nodes);
      setEdges(visData.edges);
      await session.close();
      await driver.close();
    }catch(e){ if(container) container.textContent=String(e); }
  }

  useEffect(()=>{
    const container=graphRef.current;
    if(!container) return;
    const hierOpt=hier;
    const animOpt=anim;
    const options={
      physics:{enabled:animOpt, stabilization:animOpt?false:true, solver:'barnesHut'},
      interaction:{hover:true},
      nodes:{shape:'dot',size:18},
      edges:{smooth:true, arrows:{to:true}},
      groups:{},
      manipulation:{
        enabled:true,
        addEdge:(data,callback)=>{
          const from=String(data.from||'');
          const to=String(data.to||'');
          if(from && to && from!==to){
            setWizardMode('rel');
            setRelStart(from);
            setRelEnd(to);
            setWizardOpen(true);
            setPendingRelFromId('');
          }
          if(typeof callback==='function') callback(null);
        }
      }
    };
    if(hierOpt){ options.layout={hierarchical:{enabled:true,direction:'UD',sortMethod:'hubsize'}} }
    const labels=[...new Set(nodes.map(n=>n.group))];
    const fixed={Competency:'#d62728',Skill:'#1f77b4',Concept:'#2ca02c',Stage:'#9467bd'};
    labels.forEach((lb,i)=>{const col=fixed[lb]||palette(i); options.groups[lb]={color:{background:col, border:'#333'},font:{color:'#111'}}});
    const three=threeLayer;
    const localNodes=nodes.map(n=>({ ...n }));
    localNodes.forEach(n=>{ const s=n.status; if(s===2){ n.color={background:'#4caf50',border:'#333'}; n.borderWidth=1; } else if(s===1){ n.color={background:'#ffeb3b',border:'#333'}; n.borderWidth=3; } else if(s===0){ n.color={background:'#9e9e9e',border:'#333'}; n.borderWidth=1; } });
    if(three){ localNodes.forEach(n=>{ n.level=levelForLabels(n.labels||[]) }); options.layout={hierarchical:{enabled:true,direction:'UD',sortMethod:'hubsize',levelSeparation:140,nodeSpacing:90}}; options.physics={enabled:false} }
    const network=new vis.Network(container,{nodes:new vis.DataSet(localNodes),edges:new vis.DataSet(edges)},options);
    network.on('selectNode',e=>{
      const id=e.nodes[0]||'';
      setSelNodeId(id);
      setStatus(id?('选中节点: '+id):'');
      setSelectedInfo(id);
      if(pendingRelFromId && id && pendingRelFromId!==id){
        if(wizardOpen && wizardMode==='rel'){
          setRelEnd(id);
          setPendingRelFromId('');
        }else{
          openRelWizard(pendingRelFromId, id);
          setPendingRelFromId('');
        }
      }
    });
    network.on('selectEdge',e=>{
      const id=e.edges[0]||'';
      setSelEdgeId(id);
      setStatus(id?('选中关系: '+id):'');
      setSelectedInfo(id);
    });
    if(!animOpt) network.stabilize();
    return ()=>{ network.destroy(); };
  },[nodes, edges, hier, anim, threeLayer, pendingRelFromId]);

  function toggleSelectedNode(id){
    setSelectedNodeIds(prev=>{
      const idx=prev.indexOf(id);
      const next=[...prev];
      if(idx>=0) next.splice(idx,1); else next.push(id);
      setStatus('已选择: '+next.join(', '));
      if(wizardOpen && wizardMode==='rel' && relStart && !relEnd && id!==relStart){
        setRelEnd(id);
        setStatus('起点 '+relStart+' → 终点 '+id);
      }else if(next.length===2){
        openRelWizard(next[0], next[1]);
      }
      return next;
    });
  }

  async function searchNodes(){
    try{
      const cfg=await loadConfig();
      const driver=neo4j.driver(cfg.url, neo4j.auth.basic(cfg.user||'neo4j', cfg.password));
      const session=driver.session({database:cfg.database});
      const res=await session.run('MATCH (n) WHERE toLower(toString(coalesce(n.name,n.title,n.id,""))) CONTAINS toLower($q) RETURN elementId(n) AS id, labels(n) AS labels, n AS n LIMIT $limit',{q,limit:neo4j.int(50)});
      const list=res.records.map(r=>({id:r.get('id'),labels:r.get('labels'),n:r.get('n')}));
      await session.close(); await driver.close();
      setSearchResults(list);
    }catch(e){ setStatus(String(e)); }
  }

  const [searchResults, setSearchResults] = useState([]);

  function openRelWizard(aid,bid){
    setWizardMode('rel');
    setRelStart(aid);
    setRelEnd(bid);
    setWizardOpen(true);
  }

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState('');
  const [relStart, setRelStart] = useState('');
  const [relEnd, setRelEnd] = useState('');
  const [manageNodeId, setManageNodeId] = useState('');
  const [wizNodeTpl, setWizNodeTpl] = useState('Concept');
  const [wizNodeName, setWizNodeName] = useState('');
  const [wizRelType, setWizRelType] = useState('');
  const [wizRelName, setWizRelName] = useState('');
  const [tutorTab, setTutorTab] = useState('qa');
  const [qaQ, setQaQ] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');
  const [skillQ, setSkillQ] = useState('');
  const [skillResults, setSkillResults] = useState([]);
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [skillPlan, setSkillPlan] = useState('');
  const [compQ, setCompQ] = useState('');
  const [compResults, setCompResults] = useState([]);
  const [selectedCompId, setSelectedCompId] = useState('');
  const [compGuide, setCompGuide] = useState('');

  const [exerciseOpen, setExerciseOpen] = useState(false);
  const [exerciseModuleName, setExerciseModuleName] = useState('');
  const [exerciseQuestion, setExerciseQuestion] = useState(null);
  const [exerciseOptions, setExerciseOptions] = useState([]);
  const [exerciseAnswer, setExerciseAnswer] = useState('');
  const [exerciseSelected, setExerciseSelected] = useState('');
  const [exerciseResult, setExerciseResult] = useState('');
  const [exerciseType, setExerciseType] = useState('');
  const [exerciseDifficulty, setExerciseDifficulty] = useState('');
  const [exerciseStats, setExerciseStats] = useState({total:0, mastered:0, pending:0});

  async function openExercise(){
    try{
      const id=(selNodeId||selectedNodeIds[0]||'').trim();
      if(!id){ setStatus('未选择节点'); return; }
      const cfg=await loadConfig();
      const driver=neo4j.driver(cfg.url, neo4j.auth.basic(cfg.user||'neo4j', cfg.password));
      const session=driver.session({database:cfg.database});
      const r=await session.run('MATCH (n) WHERE elementId(n)=$id RETURN coalesce(n.name,n.title,n.id,"") AS nm',{id});
      await session.close(); await driver.close();
      const nm=(r.records[0]?.get('nm')||'').trim();
      if(!nm){ setStatus('该节点无名称'); return; }
      setExerciseModuleName(nm);
      setExerciseSelected('');
      setExerciseResult('');
      setExerciseOpen(true);
      await loadExerciseQuestion(nm);
      await loadExerciseStats(nm);
    }catch(e){ setStatus(String(e)); }
  }

  async function loadExerciseQuestion(nm){
    try{
      let url='http://127.0.0.1:8001/question?module_name='+encodeURIComponent(nm)+'&include_answer=true';
      if(exerciseType) url += '&type='+encodeURIComponent(exerciseType);
      if(exerciseDifficulty) url += '&difficulty='+encodeURIComponent(exerciseDifficulty);
      const resp=await fetch(url);
      const data=await resp.json();
      const q=data?.question||null;
      if(!q){ setExerciseQuestion(null); setExerciseOptions([]); setExerciseAnswer(''); setStatus('暂无题目'); return; }
      const optsStr=String(q.options||'');
      const parts=optsStr.split(';').map(s=>s.trim()).filter(s=>s);
      const opts=parts.map((s,i)=>{
        const m=s.match(/^([A-Z])\./i); const key=m?(m[1].toUpperCase()):String.fromCharCode(65+i);
        return {key, text:s.replace(/^([A-Z])\./i,'').trim()||s};
      });
      setExerciseQuestion(q);
      setExerciseOptions(opts);
      setExerciseAnswer(String(q.answer||'').trim().toUpperCase());
      setExerciseSelected('');
      setExerciseResult('');
    }catch(e){ setStatus(String(e)); }
  }

  async function loadExerciseStats(nm){
    try{
      const url='http://127.0.0.1:8001/question_stats?module_name='+encodeURIComponent(nm);
      const resp=await fetch(url);
      const j=await resp.json();
      const t=parseInt(j.total||0), m=parseInt(j.mastered||0); const p=parseInt(j.pending||Math.max(0,t-m));
      setExerciseStats({total:t, mastered:m, pending:p});
    }catch(e){ }
  }

  async function submitExercise(){
    try{
      if(!exerciseQuestion){ setStatus('无题目'); return; }
      if(!exerciseSelected){ setStatus('请选择一个选项'); return; }
      const correct=exerciseSelected===exerciseAnswer;
      const body={question_id:String(exerciseQuestion.id||''), is_correct:correct};
      const resp=await fetch('http://127.0.0.1:8001/submit_answer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      await resp.json();
      setExerciseResult(correct?('回答正确'):('回答错误'));
      setStatus(correct?('回答正确'):('回答错误'));
      if(correct){
        const nodeId=(selNodeId||selectedNodeIds[0]||'').trim();
        if(nodeId){
          try{
            const r=await fetch('http://127.0.0.1:8001/zpd_update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({node_id:nodeId})});
            const j=await r.json();
            const unlocked=(j.unlocked||[]).map(String);
            setNodes(prev=> prev.map(n=>{
              if(String(n.id)===nodeId) return {...n, status:2};
              if(unlocked.includes(String(n.id))) return {...n, status:1};
              return n;
            }));
          }catch(_){ }
        }
        if(exerciseModuleName){ await loadExerciseStats(exerciseModuleName); }
      }
    }catch(e){ setStatus(String(e)); }
  }

  function closeExercise(){
    setExerciseOpen(false);
  }

  function openNodeWizard(){
    setWizardMode('node');
    setWizNodeTpl('Concept');
    setWizNodeName('');
    setWizardOpen(true);
  }

  async function openNodeManage(id){
    setManageNodeId(id);
    setWizardMode('nodeManage');
    const cfg=await loadConfig();
    const driver=neo4j.driver(cfg.url, neo4j.auth.basic(cfg.user||'neo4j', cfg.password));
    const session=driver.session({database:cfg.database});
    const res=await session.run('MATCH (n) WHERE elementId(n)=$id RETURN coalesce(n.name,n.title,n.id,"") AS nm',{id});
    await session.close(); await driver.close();
    setWizNodeName(res.records[0]?.get('nm')||'');
    setWizardOpen(true);
  }

  async function submitNodeWizard(){
    try{
      const tpl=wizNodeTpl;
      const name=(wizNodeName||'').trim();
      if(!tpl||!name){ setStatus('请选择模板并填写名称'); return; }
      const cfg=await loadConfig();
      const driver=neo4j.driver(cfg.url, neo4j.auth.basic(cfg.user||'neo4j', cfg.password));
      const session=driver.session({database:cfg.database});
      const cypher=`CREATE (n:${tpl}) SET n.name=$name RETURN elementId(n) AS id`;
      const res=await session.run(cypher,{name});
      setStatus('创建节点: '+(res.records[0]?.get('id')||''));
      await session.close(); await driver.close();
      setWizardOpen(false);
      if(lastMode==='expand') runExpand(); else runQuery();
    }catch(e){ setStatus(String(e)); }
  }

  async function submitNodeRename(){
    try{
      const nm=(wizNodeName||'').trim();
      if(!manageNodeId||!nm){ setStatus('缺少ID或名称'); return; }
      const cfg=await loadConfig();
      const driver=neo4j.driver(cfg.url, neo4j.auth.basic(cfg.user||'neo4j', cfg.password));
      const session=driver.session({database:cfg.database});
      const res=await session.run('MATCH (n) WHERE elementId(n)=$id SET n.name=$nm RETURN elementId(n) AS id',{id:manageNodeId,nm});
      await session.close(); await driver.close();
      setStatus('重命名成功: '+(res.records[0]?.get('id')||''));
      setWizardOpen(false);
      if(lastMode==='expand') runExpand(); else runQuery();
    }catch(e){ setStatus(String(e)); }
  }

  async function submitNodeDelete(){
    try{
      if(!manageNodeId){ setStatus('缺少节点ID'); return; }
      const cfg=await loadConfig();
      const driver=neo4j.driver(cfg.url, neo4j.auth.basic(cfg.user||'neo4j', cfg.password));
      const session=driver.session({database:cfg.database});
      await session.run('MATCH (n) WHERE elementId(n)=$id DETACH DELETE n',{id:manageNodeId});
      await session.close(); await driver.close();
      setStatus('已删除节点: '+manageNodeId);
      setWizardOpen(false);
      if(lastMode==='expand') runExpand(); else runQuery();
    }catch(e){ setStatus(String(e)); }
  }

  async function submitRelWizard(){
    try{
      const type=(wizRelType||'').trim();
      if(!type){ setStatus('请选择关系类型'); return; }
      if(!relStart || !relEnd){ setStatus('请选择终点节点'); return; }
      const name=(wizRelName||'').trim();
      const cfg=await loadConfig();
      const driver=neo4j.driver(cfg.url, neo4j.auth.basic(cfg.user||'neo4j', cfg.password));
      const session=driver.session({database:cfg.database});
      const cypher=`MATCH (a) WHERE elementId(a)=$aid MATCH (b) WHERE elementId(b)=$bid CREATE (a)-[r:${type}]->(b) SET r.name=$name RETURN elementId(r) AS id`;
      const res=await session.run(cypher,{aid:relStart,bid:relEnd,name:name||null});
      setStatus('创建关系: '+(res.records[0]?.get('id')||''));
      await session.close(); await driver.close();
      setWizardOpen(false);
      setSelectedNodeIds([]);
      if(lastMode==='expand') runExpand(); else runQuery();
    }catch(e){ setStatus(String(e)); }
  }

  async function deleteSelectedNode(){
    try{
      const id=(selectedNodeIds[0]||selNodeId||'').trim();
      if(!id){ setStatus('未选择节点'); return; }
      const cfg=await loadConfig();
      const driver=neo4j.driver(cfg.url, neo4j.auth.basic(cfg.user||'neo4j', cfg.password));
      const session=driver.session({database:cfg.database});
      await session.run('MATCH (n) WHERE elementId(n)=$id DETACH DELETE n',{id});
      await session.close(); await driver.close();
      setStatus('删除节点: '+id);
      setSelectedNodeIds([]);
      setSelNodeId('');
      if(lastMode==='expand') runExpand(); else runQuery();
    }catch(e){ setStatus(String(e)); }
  }

  async function deleteSelectedRel(){
    try{
      const id=(selEdgeId||'').trim();
      if(!id){ setStatus('未选择关系'); return; }
      const cfg=await loadConfig();
      const driver=neo4j.driver(cfg.url, neo4j.auth.basic(cfg.user||'neo4j', cfg.password));
      const session=driver.session({database:cfg.database});
      await session.run('MATCH ()-[r]->() WHERE elementId(r)=$id DELETE r',{id});
      await session.close(); await driver.close();
      setStatus('删除关系: '+id);
      setSelEdgeId('');
      if(lastMode==='expand') runExpand(); else runQuery();
    }catch(e){ setStatus(String(e)); }
  }

  async function qaFromGraph(){
    try{
      const cfg=await loadConfig();
      const driver=neo4j.driver(cfg.url, neo4j.auth.basic(cfg.user||'neo4j', cfg.password));
      const session=driver.session({database:cfg.database});
      const cypher='MATCH (n) WHERE any(prop IN [n.name, n.title, n.id] WHERE toLower(toString(coalesce(prop,""))) CONTAINS toLower($q))\nWITH n LIMIT 3\nOPTIONAL MATCH (n)-[r]-(m)\nWITH elementId(n) AS nid, n, collect(DISTINCT m)[0..20] AS neighbors, collect(DISTINCT type(r))[0..20] AS relTypes, collect({mid: elementId(m), mname: toString(coalesce(m.name,m.title,m.id,"")), type: type(r), dir: CASE WHEN elementId(startNode(r))=elementId(n) THEN "out" ELSE "in" END, rid: elementId(r)})[0..30] AS rels\nOPTIONAL MATCH (n)-[]-(c:Concept)\nOPTIONAL MATCH (n)-[]-(s:Skill)\nOPTIONAL MATCH (n)-[]-(t:Task)\nOPTIONAL MATCH (n)-[]-(p:Competency)\nRETURN nid, n AS focus, neighbors, relTypes, rels, collect(distinct c)[0..5] AS concepts, collect(distinct s)[0..5] AS skills, collect(distinct t)[0..5] AS tasks, collect(distinct p)[0..5] AS competencies';
      const res=await session.run(cypher,{q:qaQ});
      await session.close(); await driver.close();
      const evidences=res.records.map(r=>{
        const f=r.get('focus');
        const nid=r.get('nid');
        const focusName=(f?.properties&& (f.properties.name||f.properties.title||f.properties.id))||'';
        const neighbors=(r.get('neighbors')||[]).map(x=> (x.properties&& (x.properties.name||x.properties.title||x.properties.id))||'').filter(x=>x);
        const relTypes=(r.get('relTypes')||[]).filter(x=>x);
        const rels=(r.get('rels')||[]).map(x=>({neighborId:String(x.mid||''),neighborName:String(x.mname||''),type:String(x.type||''),dir:String(x.dir||''),relId:String(x.rid||'')}));
        const concepts=(r.get('concepts')||[]).map(x=> (x.properties&& (x.properties.name||x.properties.title||x.properties.id))||'');
        const skills=(r.get('skills')||[]).map(x=> (x.properties&& (x.properties.name||x.properties.title||x.properties.id))||'');
        const tasks=(r.get('tasks')||[]).map(x=> (x.properties&& (x.properties.name||x.properties.title||x.properties.id))||'');
        const comps=(r.get('competencies')||[]).map(x=> (x.properties&& (x.properties.name||x.properties.title||x.properties.id))||'');
        return {focusId:String(nid||''), focus:focusName, neighbors, relations:relTypes, links:rels, concepts, skills, tasks, competencies:comps};
      });
      let ep=(cfg.llm_endpoint||'').trim();
      const key=(cfg.llm_api_key||'').trim();
      const model=(cfg.llm_model||'Qwen/Qwen3-32B').trim();
      const evidenceText=evidences.map(e=>{
        const a=['主题: '+e.focus];
        if(e.neighbors && e.neighbors.length) a.push('关联节点: '+e.neighbors.join(', '));
        if(e.links && e.links.length){
          const linkStr=e.links.map(l=> `${l.type}:${l.dir} → ${l.neighborName} [${l.neighborId}]`).join(' | ');
          a.push('关联链接: '+linkStr);
        }
        if(e.relations && e.relations.length) a.push('关联关系: '+e.relations.join(', '));
        if(e.concepts.length) a.push('相关知识: '+e.concepts.join(', '));
        if(e.skills.length) a.push('关联能力: '+e.skills.join(', '));
        if(e.tasks.length) a.push('训练任务: '+e.tasks.join(', '));
        if(e.competencies.length) a.push('涉及素养: '+e.competencies.join(', '));
        return a.join('\n');
      }).join('\n\n');

      if(!ep){ ep=await detectLocalLlm(); }
      if(!ep){ ep='http://127.0.0.1:8001/llm'; }
      if(ep){
        const isOpenAIStyle=/modelscope\.cn|openai|\/v1\/?$/i.test(ep);
        try{
          if(isOpenAIStyle){
            const url=ep.replace(/\/$/,'')+'/chat/completions';
            const headers={'Content-Type':'application/json'}; if(key) headers['Authorization']='Bearer '+key;
            const body={model, messages:[
              {role:'system',content:'你是一名基于知识图谱的导师。仅根据提供的证据回答，不要臆造。输出简洁并包含建议。证据为空，给出常识解释。'},
              {role:'user',content:`问题：${qaQ}\n\n证据：\n${evidenceText}`}
            ], temperature:0.3, top_p:0.9};
            const resp=await fetch(url,{method:'POST',headers,body:JSON.stringify(body)});
            const j=await resp.json();
            const a=j?.choices?.[0]?.message?.content || j?.answer || j?.data || JSON.stringify(j);
            setQaAnswer(String(a||''));
          }else{
            const headers={'Content-Type':'application/json'}; if(key) headers['Authorization']='Bearer '+key;
            const body={question:qaQ,evidence:evidences};
            const resp=await fetch(ep,{method:'POST',headers,body:JSON.stringify(body)});
            const ct=(resp.headers.get('content-type')||'').toLowerCase();
            if(ct.includes('application/json')){ const j=await resp.json(); setQaAnswer(String(j.answer||j.data||JSON.stringify(j)||'')); }
            else { const t=await resp.text(); setQaAnswer(String(t||'')); }
          }
        }catch(err){ setQaAnswer(String(err||'LLM 请求失败')); }
      }
    }catch(e){ setQaAnswer(String(e)); }
  }

  async function searchSkills(){
    try{
      const cfg=await loadConfig();
      const driver=neo4j.driver(cfg.url, neo4j.auth.basic(cfg.user||'neo4j', cfg.password));
      const session=driver.session({database:cfg.database});
      const res=await session.run('MATCH (s:Skill) WHERE toLower(toString(coalesce(s.name,s.title,s.id,""))) CONTAINS toLower($q) RETURN elementId(s) AS id, labels(s) AS labels, s AS s LIMIT $limit',{q:skillQ,limit:neo4j.int(50)});
      const list=res.records.map(r=>({id:r.get('id'),labels:r.get('labels'),n:r.get('s')}));
      await session.close(); await driver.close();
      setSkillResults(list);
    }catch(e){ setStatus(String(e)); }
  }

  async function loadSkillPlan(){
    try{
      if(!selectedSkillId){ setSkillPlan('请先选择能力'); return; }
      const cfg=await loadConfig();
      const driver=neo4j.driver(cfg.url, neo4j.auth.basic(cfg.user||'neo4j', cfg.password));
      const session=driver.session({database:cfg.database});
      const res=await session.run('MATCH (s) WHERE elementId(s)=$id OPTIONAL MATCH (s)-[]-(t:Task) OPTIONAL MATCH (s)-[]-(c:Concept) RETURN s, collect(distinct t)[0..10] AS tasks, collect(distinct c)[0..10] AS concepts',{id:selectedSkillId});
      await session.close(); await driver.close();
      const rec=res.records[0];
      if(!rec){ setSkillPlan('未找到该能力的关联'); return; }
      const tasks=(rec.get('tasks')||[]).map(x=> (x.properties&& (x.properties.name||x.properties.title||x.properties.id))||'');
      const concepts=(rec.get('concepts')||[]).map(x=> (x.properties&& (x.properties.name||x.properties.title||x.properties.id))||'');
      const a=[]; if(concepts.length) a.push('建议先掌握知识: '+concepts.join(', ')); if(tasks.length) a.push('训练任务: '+tasks.join(', ')); setSkillPlan(a.join('\n')||'暂无建议');
    }catch(e){ setSkillPlan(String(e)); }
  }

  async function searchComps(){
    try{
      const cfg=await loadConfig();
      const driver=neo4j.driver(cfg.url, neo4j.auth.basic(cfg.user||'neo4j', cfg.password));
      const session=driver.session({database:cfg.database});
      const res=await session.run('MATCH (c:Competency) WHERE toLower(toString(coalesce(c.name,c.title,c.id,""))) CONTAINS toLower($q) RETURN elementId(c) AS id, labels(c) AS labels, c AS c LIMIT $limit',{q:compQ,limit:neo4j.int(50)});
      const list=res.records.map(r=>({id:r.get('id'),labels:r.get('labels'),n:r.get('c')}));
      await session.close(); await driver.close();
      setCompResults(list);
    }catch(e){ setStatus(String(e)); }
  }

  async function loadCompGuide(){
    try{
      if(!selectedCompId){ setCompGuide('请先选择素养'); return; }
      const cfg=await loadConfig();
      const driver=neo4j.driver(cfg.url, neo4j.auth.basic(cfg.user||'neo4j', cfg.password));
      const session=driver.session({database:cfg.database});
      const res=await session.run('MATCH (c) WHERE elementId(c)=$id OPTIONAL MATCH (c)-[]-(i:Indicator) OPTIONAL MATCH (c)-[]-(b:Behavior) RETURN c, collect(distinct i)[0..10] AS indicators, collect(distinct b)[0..10] AS behaviors',{id:selectedCompId});
      await session.close(); await driver.close();
      const rec=res.records[0];
      if(!rec){ setCompGuide('未找到该素养的关联'); return; }
      const inds=(rec.get('indicators')||[]).map(x=> (x.properties&& (x.properties.name||x.properties.title||x.properties.id))||'');
      const behs=(rec.get('behaviors')||[]).map(x=> (x.properties&& (x.properties.name||x.properties.title||x.properties.id))||'');
      const a=[]; if(inds.length) a.push('观察指标: '+inds.join(', ')); if(behs.length) a.push('行为建议: '+behs.join(', ')); setCompGuide(a.join('\n')||'暂无建议');
    }catch(e){ setCompGuide(String(e)); }
  }

  function Filters(){
    return React.createElement('div',{className:'flex flex-wrap items-center gap-3 w-full'},
      React.createElement('div',{className:'flex items-center gap-2'},
        React.createElement('span',{className:'text-sm text-neutral-600'},'筛选标签'),
        React.createElement('div',{className:'flex flex-wrap gap-2'},
          availableLabels.map(lb=>
            React.createElement('label',{key:lb,className:'inline-flex items-center gap-2 px-2 py-1 rounded-md border'},
              React.createElement('input',{type:'checkbox',className:'h-4 w-4 rounded border',value:lb,checked:filterLabels.includes(lb),onChange:e=>{
                const checked=e.target.checked; setFilterLabels(prev=> checked? [...prev, lb] : prev.filter(x=>x!==lb));
              }}),
              React.createElement('span',{className:'text-sm'},lb)
            )
          )
        )
      ),
      React.createElement('div',{className:'flex items-center gap-2'},
        React.createElement('span',{className:'text-sm text-neutral-600'},'筛选关系类型'),
        React.createElement('div',{className:'flex flex-wrap gap-2'},
          availableRelTypes.map(t=>
            React.createElement('label',{key:t,className:'inline-flex items-center gap-2 px-2 py-1 rounded-md border'},
              React.createElement('input',{type:'checkbox',className:'h-4 w-4 rounded border',value:t,checked:filterRelTypes.includes(t),onChange:e=>{
                const checked=e.target.checked; setFilterRelTypes(prev=> checked? [...prev, t] : prev.filter(x=>x!==t));
              }}),
              React.createElement('span',{className:'text-sm'},t)
            )
          )
        )
      ),
      React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm',onClick:()=>{ setFilterLabels([]); setFilterRelTypes([]); if(lastMode==='expand') runExpand(); else runQuery(); }},'清空筛选')
    );
  }

  function Wizard(){
    if(!wizardOpen) return null;
    const title = wizardMode==='node' ? '新建节点' : (wizardMode==='rel' ? '新建关系' : '管理节点');
    const relTypeOptions = availableRelTypes.map(t=> React.createElement('option',{key:t,value:t},t));
    const showDelete = wizardMode==='nodeManage';
    const content = wizardMode==='node' ? (
      React.createElement(React.Fragment,null,
        React.createElement('select',{className:'w-full px-3 py-2 text-sm rounded-md border',value:wizNodeTpl,onChange:e=>setWizNodeTpl(e.target.value)},
          ['Concept','Skill','Competency','Task','Indicator','Behavior'].map(x=> React.createElement('option',{key:x,value:x},x))
        ),
        React.createElement('input',{className:'w-full px-3 py-2 text-sm rounded-md border',placeholder:'名称',value:wizNodeName,onChange:e=>setWizNodeName(e.target.value)})
      )
    ) : wizardMode==='rel' ? (
      React.createElement(React.Fragment,null,
        React.createElement('div',{className:'text-xs text-neutral-600'},`起点 ${relStart} → 终点 ${relEnd}`),
        React.createElement('input',{className:'w-full px-3 py-2 text-sm rounded-md border',placeholder:'搜索关系类型',onChange:e=>{ const q=e.target.value.toLowerCase(); const first=availableRelTypes.find(t=>t.toLowerCase().includes(q)); setWizRelType(first||''); }}),
        React.createElement('select',{className:'w-full px-3 py-2 text-sm rounded-md border',value:wizRelType,onChange:e=>setWizRelType(e.target.value)}, relTypeOptions),
        React.createElement('input',{className:'w-full px-3 py-2 text-sm rounded-md border',placeholder:'名称(可选)',value:wizRelName,onChange:e=>setWizRelName(e.target.value)})
      )
    ) : (
      React.createElement('input',{className:'w-full px-3 py-2 text-sm rounded-md border',placeholder:'名称',value:wizNodeName,onChange:e=>setWizNodeName(e.target.value)})
    );
    const onSubmit = wizardMode==='node' ? submitNodeWizard : (wizardMode==='rel' ? submitRelWizard : submitNodeRename);
    return React.createElement('div',{className:'fixed inset-0 z-50'},
      React.createElement('div',{className:'absolute inset-0 bg-black/30'}),
      React.createElement('div',{className:'relative mx-auto max-w-md mt-20 rounded-xl border bg-white shadow p-4'},
        React.createElement('div',{className:'text-lg font-semibold'},title),
        React.createElement('div',{className:'mt-2 space-y-3'},content),
        React.createElement('div',{className:'mt-4 flex justify-end gap-2'},
          React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm',onClick:()=>setWizardOpen(false)},'取消'),
          showDelete ? React.createElement('button',{className:'rounded-md bg-red-600 text-white px-3 py-2 text-sm',onClick:submitNodeDelete},'删除') : null,
          React.createElement('button',{className:'rounded-md bg-neutral-900 text-white px-3 py-2 text-sm',onClick:onSubmit},'提交')
        )
      )
    );
  }

  function SearchList(){
    return React.createElement('div',{className:'grid grid-cols-1 md:grid-cols-2 gap-2'},
      searchResults.map(item=> React.createElement('div',{key:item.id,className:'rounded-md border p-2 flex items-center justify-between'},
        React.createElement('div',{className:'flex flex-col'},
          React.createElement('div',{className:'text-sm font-medium'},(item.n.properties.name||item.n.properties.title||item.id||'')),
          React.createElement('div',{className:'text-xs text-neutral-500'},(item.labels||[]).join(','))
        ),
        React.createElement('div',{className:'flex gap-2'},
          React.createElement('button',{className:'rounded-md border px-2 py-1 text-xs',onClick:()=>toggleSelectedNode(item.id)},'选择'),
          React.createElement('button',{className:'rounded-md border px-2 py-1 text-xs',onClick:()=>openNodeManage(item.id)},'管理')
        )
      ))
    );
  }

  return React.createElement('div',{className:'mx-auto max-w-6xl px-4 py-6'},
    React.createElement('div',{className:'mb-6'},
      React.createElement('h1',{className:'text-2xl font-semibold tracking-tight text-neutral-900'},'Neo4j 图谱查询'),
      React.createElement('p',{className:'text-sm text-neutral-500'},'可视化关系网络，支持分层与起点展开')
    ),
    React.createElement('div',{className:'rounded-xl border bg-white/70 backdrop-blur shadow-sm p-4 flex flex-wrap gap-3 items-center'},
      React.createElement('input',{placeholder:'起点关键词',className:'flex-1 md:flex-none md:w-48 px-3 py-2 text-sm rounded-md border focus:outline-none focus:ring-2 focus:ring-neutral-300',value:q,onChange:e=>setQ(e.target.value)}),
      React.createElement('div',{className:'flex items-center gap-2'},
        React.createElement('span',{className:'text-sm text-neutral-600'},'层级深度'),
        React.createElement('input',{type:'number',min:1,max:6,step:1,className:'w-20 px-3 py-2 text-sm rounded-md border focus:outline-none focus:ring-2 focus:ring-neutral-300',value:depth,onChange:e=>setDepth(parseInt(e.target.value||'1'))})
      ),
      React.createElement('div',{className:'flex items-center gap-2'},
        React.createElement('span',{className:'text-sm text-neutral-600'},'限制节点数'),
        React.createElement('input',{type:'number',min:10,max:2000,step:1,className:'w-24 px-3 py-2 text-sm rounded-md border focus:outline-none focus:ring-2 focus:ring-neutral-300',value:limit,onChange:e=>setLimit(parseInt(e.target.value||'200'))})
      ),
      React.createElement('label',{className:'inline-flex items-center gap-2 text-sm text-neutral-700 select-none'},
        React.createElement('input',{type:'checkbox',className:'h-4 w-4 rounded border',checked:hier,onChange:e=>setHier(e.target.checked)}),'分层布局'
      ),
      React.createElement('label',{className:'inline-flex items-center gap-2 text-sm text-neutral-700 select-none'},
        React.createElement('input',{type:'checkbox',className:'h-4 w-4 rounded border',checked:anim,onChange:e=>setAnim(e.target.checked)}),'动画'
      ),
      React.createElement('label',{className:'inline-flex items-center gap-2 text-sm text-neutral-700 select-none'},
        React.createElement('input',{type:'checkbox',className:'h-4 w-4 rounded border',checked:threeLayer,onChange:e=>setThreeLayer(e.target.checked)}),'分层布局（素养-能力-知识-学段）'
      ),
      React.createElement('div',{className:'ml-auto flex gap-2'},
        React.createElement('button',{className:'inline-flex items-center rounded-md bg-neutral-900 text-white hover:bg-neutral-800 px-4 py-2 text-sm font-medium shadow-sm',onClick:runQuery},'全图查询'),
        React.createElement('button',{className:'inline-flex items-center rounded-md bg-neutral-900 text-white hover:bg-neutral-800 px-4 py-2 text-sm font-medium shadow-sm',onClick:runExpand},'从起点展开'),
        React.createElement('button',{className:'inline-flex items-center rounded-md border bg-white hover:bg-neutral-50 px-4 py-2 text-sm font-medium shadow-sm',onClick:runQuery},'重置布局')
      ),
      React.createElement('div',{className:'w-full h-px bg-neutral-200'}),
      React.createElement(Filters)
    ),
    React.createElement('div',{ref:graphRef,id:'graph',className:'rounded-xl border bg-white shadow-sm mt-4',style:{height:'600px'}}),
    React.createElement('div',{className:'rounded-xl border bg-white shadow-sm mt-4 p-4'},
      React.createElement('div',{className:'flex items-center justify-between mb-2'},
        React.createElement('div',{className:'text-sm font-medium text-neutral-900'},'三步向导'),
      React.createElement('div',{className:'flex gap-2'},
        React.createElement('button',{className:'rounded-md bg-neutral-900 text-white px-3 py-2 text-sm',onClick:openNodeWizard},'新建节点'),
        React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm',onClick:deleteSelectedNode},'删除选中节点'),
        React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm',onClick:()=>{const id=(selNodeId||selectedNodeIds[0]||'').trim(); if(id) openNodeManage(id);}},'管理选中节点'),
        React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm',onClick:()=>{const id=(selNodeId||selectedNodeIds[0]||'').trim(); if(!id){ setStatus('请先在图上选择一个节点'); return; } setPendingRelFromId(id); setWizardMode('rel'); setRelStart(id); setRelEnd(''); setWizardOpen(true); setStatus('从该节点建立关系：请选择另一个节点并设置关系');}},'与另一节点建关系'),
        React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm',onClick:deleteSelectedRel},'删除选中关系'),
        React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm',onClick:openExercise},'开始练习'),
        React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm',onClick:()=>{ setSelectedNodeIds([]); setStatus('已清空选择'); }},'清空选择')
      )
      ),
      React.createElement('div',{className:'text-xs text-neutral-600 mb-2'},'当前选中：', React.createElement('span',null,selectedInfo)),
      React.createElement('div',{className:'text-xs text-neutral-500'},'在下方搜索并选择两个节点后将自动弹出关系表单'),
      React.createElement('div',{className:'text-sm font-medium text-neutral-900 mt-4'},'快速搜索'),
      React.createElement('div',{className:'flex gap-2 items-center mb-2'},
        React.createElement('input',{placeholder:'输入名称/标题/ID关键词',className:'flex-1 px-3 py-2 text-sm rounded-md border',value:q,onChange:e=>setQ(e.target.value)}),
        React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm',onClick:searchNodes},'搜索节点')
      ),
      React.createElement(SearchList),
    React.createElement('div',{className:'text-sm text-neutral-600 mt-2'},status)
    ),
    React.createElement('div',{className:'rounded-xl border bg-white shadow-sm mt-4 p-4'},
      React.createElement('div',{className:'flex items-center justify-between mb-2'},
        React.createElement('div',{className:'text-sm font-medium text-neutral-900'},'AI导师'),
        React.createElement('div',{className:'flex gap-2'},
          React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm'+(tutorTab==='qa'?' bg-neutral-900 text-white':''),onClick:()=>setTutorTab('qa')},'知识问答'),
          React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm'+(tutorTab==='skill'?' bg-neutral-900 text-white':''),onClick:()=>setTutorTab('skill')},'能力训练'),
          React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm'+(tutorTab==='comp'?' bg-neutral-900 text-white':''),onClick:()=>setTutorTab('comp')},'素养引导'),
          React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm',onClick:openExercise},'开始练习')
        )
      ),
      tutorTab==='qa' ? React.createElement('div',null,
        React.createElement('div',{className:'flex gap-2 items-center mb-2'},
          React.createElement('input',{placeholder:'提出你的问题',className:'flex-1 px-3 py-2 text-sm rounded-md border',value:qaQ,onChange:e=>setQaQ(e.target.value)}),
          React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm',onClick:qaFromGraph},'基于图谱回答')
        ),
        React.createElement('pre',{className:'text-sm'},qaAnswer||'')
      ) : tutorTab==='skill' ? React.createElement('div',null,
        React.createElement('div',{className:'flex gap-2 items-center mb-2'},
          React.createElement('input',{placeholder:'搜索能力',className:'flex-1 px-3 py-2 text-sm rounded-md border',value:skillQ,onChange:e=>setSkillQ(e.target.value)}),
          React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm',onClick:searchSkills},'搜索能力')
        ),
        React.createElement('div',{className:'grid grid-cols-1 md:grid-cols-2 gap-2'},
          skillResults.map(item=> React.createElement('div',{key:item.id,className:'rounded-md border p-2 flex items-center justify-between'+(selectedSkillId===item.id?' ring-2 ring-neutral-400':'')},
            React.createElement('div',{className:'flex flex-col'},
              React.createElement('div',{className:'text-sm font-medium'},(item.n.properties.name||item.n.properties.title||item.id||'')),
              React.createElement('div',{className:'text-xs text-neutral-500'},(item.labels||[]).join(','))
            ),
            React.createElement('div',{className:'flex gap-2'},
              React.createElement('button',{className:'rounded-md border px-2 py-1 text-xs',onClick:()=>setSelectedSkillId(item.id)},'选择')
            )
          ))
        ),
        React.createElement('div',{className:'mt-2 flex gap-2'},
          React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm',onClick:loadSkillPlan},'生成训练计划')
        ),
        React.createElement('pre',{className:'text-sm mt-2'},skillPlan||'')
      ) : React.createElement('div',null,
        React.createElement('div',{className:'flex gap-2 items-center mb-2'},
          React.createElement('input',{placeholder:'搜索素养',className:'flex-1 px-3 py-2 text-sm rounded-md border',value:compQ,onChange:e=>setCompQ(e.target.value)}),
          React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm',onClick:searchComps},'搜索素养')
        ),
        React.createElement('div',{className:'grid grid-cols-1 md:grid-cols-2 gap-2'},
          compResults.map(item=> React.createElement('div',{key:item.id,className:'rounded-md border p-2 flex items-center justify-between'+(selectedCompId===item.id?' ring-2 ring-neutral-400':'')},
            React.createElement('div',{className:'flex flex-col'},
              React.createElement('div',{className:'text-sm font-medium'},(item.n.properties.name||item.n.properties.title||item.id||'')),
              React.createElement('div',{className:'text-xs text-neutral-500'},(item.labels||[]).join(','))
            ),
            React.createElement('div',{className:'flex gap-2'},
              React.createElement('button',{className:'rounded-md border px-2 py-1 text-xs',onClick:()=>setSelectedCompId(item.id)},'选择')
            )
          ))
        ),
        React.createElement('div',{className:'mt-2 flex gap-2'},
          React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm',onClick:loadCompGuide},'生成引导建议')
        ),
        React.createElement('pre',{className:'text-sm mt-2'},compGuide||'')
      )
    ),
    React.createElement(Wizard)
    , exerciseOpen && React.createElement('div',{className:'fixed inset-0 z-50 flex items-center justify-center bg-black/30'},
      React.createElement('div',{className:'rounded-xl border bg-white shadow-lg p-6 w-full max-w-xl'},
        React.createElement('div',{className:'text-lg font-medium mb-3 flex items-center justify-between'},
          React.createElement('span',null, exerciseModuleName?('练习: '+exerciseModuleName):'练习'),
          React.createElement('div',{className:'flex items-center gap-2'},
            React.createElement('select',{className:'px-2 py-1 text-sm rounded-md border',value:exerciseType,onChange:e=>setExerciseType(e.target.value)},
              React.createElement('option',{value:''},'全部'),
              React.createElement('option',{value:'单选题'},'单选题'),
              React.createElement('option',{value:'判断题'},'判断题')
            ),
            React.createElement('select',{className:'px-2 py-1 text-sm rounded-md border',value:exerciseDifficulty,onChange:e=>setExerciseDifficulty(e.target.value)},
              React.createElement('option',{value:''},'全部难度'),
              React.createElement('option',{value:'易'},'易'),
              React.createElement('option',{value:'中'},'中'),
              React.createElement('option',{value:'难'},'难')
            ),
            React.createElement('button',{className:'rounded-md border px-2 py-1 text-sm',onClick:()=>{ if(exerciseModuleName){ loadExerciseQuestion(exerciseModuleName); } }},'筛选'),
            React.createElement('div',{className:'text-xs text-neutral-600'},`进度 ${exerciseStats.mastered}/${exerciseStats.pending}/${exerciseStats.total}`),
            React.createElement('button',{className:'rounded-md border px-2 py-1 text-sm',onClick:()=>{ if(exerciseModuleName && exerciseQuestion){ let u='http://127.0.0.1:8001/question?module_name='+encodeURIComponent(exerciseModuleName)+'&include_answer=true'; if(exerciseType) u+='&type='+encodeURIComponent(exerciseType); if(exerciseDifficulty) u+='&difficulty='+encodeURIComponent(exerciseDifficulty); u+='&exclude_id='+encodeURIComponent(String(exerciseQuestion.id||'')); fetch(u).then(r=>r.json()).then(d=>{ const q=d?.question||null; if(q){ const optsStr=String(q.options||''); const parts=optsStr.split(';').map(s=>s.trim()).filter(s=>s); const opts=parts.map((s,i)=>{ const m=s.match(/^([A-Z])\./i); const key=m?(m[1].toUpperCase()):String.fromCharCode(65+i); return {key, text:s.replace(/^([A-Z])\./i,'').trim()||s}; }); setExerciseQuestion(q); setExerciseOptions(opts); setExerciseAnswer(String(q.answer||'').trim().toUpperCase()); setExerciseSelected(''); setExerciseResult(''); } else { setStatus('没有更多题目'); } }).catch(e=>setStatus(String(e))); } }},'换一题')
          )
        ),
        exerciseQuestion ? React.createElement('div',{},
          React.createElement('div',{className:'text-sm mb-3'}, String(exerciseQuestion.content||'')),
          React.createElement('div',{className:'space-y-2'},
            ...exerciseOptions.map(opt=>React.createElement('label',{key:opt.key,className:'flex items-center gap-2 text-sm'},
              React.createElement('input',{type:'radio',name:'exercise',checked:exerciseSelected===opt.key,onChange:()=>setExerciseSelected(opt.key)}),
              React.createElement('span',{}, opt.key+'. '+opt.text)
            ))
          ),
          React.createElement('div',{className:'mt-4 flex gap-2'},
            React.createElement('button',{className:'rounded-md bg-neutral-900 text-white px-3 py-2 text-sm',onClick:submitExercise},'提交答案'),
            React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm',onClick:closeExercise},'关闭')
          ),
          exerciseResult && React.createElement('div',{className:'mt-3 text-sm'}, exerciseResult + (exerciseQuestion.analysis?('，解析：'+exerciseQuestion.analysis):''))
        ) : React.createElement('div',{},
          React.createElement('div',{className:'text-sm text-neutral-600'},'暂无题目'),
          React.createElement('div',{className:'mt-4 flex gap-2'},
            React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm',onClick:closeExercise},'关闭')
          )
        )
      )
    )
  );
}

export default App;
