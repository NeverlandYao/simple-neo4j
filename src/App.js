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
        if(labelFilter.length===0 || nOK){ if(!nodeMap.has(n.id)) nodeMap.set(n.id,{id:String(n.id),label:labelForNode(n),group:gN,labels:n.labels}); }
        return;
      }
      const gM=groupForLabels(m?m.labels:[]);
      const mOK=m?hasAnyLabel(m.labels,labelFilter):false;
      const from=String(r.start);
      const to=String(r.end);
      const eid=String(r.id||`${from}-${to}-${r.type||''}`);
      const tOK=(typeFilter.length===0 || typeFilter.includes(r.type));
      if(tOK && (labelFilter.length===0 || nOK || mOK)){
        if(!nodeMap.has(n.id)) nodeMap.set(n.id,{id:String(n.id),label:labelForNode(n),group:gN,labels:n.labels});
        if(m && !nodeMap.has(m.id)) nodeMap.set(m.id,{id:String(m.id),label:labelForNode(m),group:gM,labels:m.labels});
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
        if((labelFilter.length===0 || nOK) && !nodeMap.has(id)) nodeMap.set(id,{id:String(id),label:labelForNode({id,labels:n.labels,properties:n.properties}),group:g,labels:n.labels});
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
      layout: hierOpt? {hierarchical:{enabled:true,direction:'UD',sortMethod:'hubsize'}} : undefined,
      groups:{}
    };
    const labels=[...new Set(nodes.map(n=>n.group))];
    const fixed={Competency:'#d62728',Skill:'#1f77b4',Concept:'#2ca02c',Stage:'#9467bd'};
    labels.forEach((lb,i)=>{const col=fixed[lb]||palette(i); options.groups[lb]={color:{background:col, border:'#333'},font:{color:'#111'}}});
    const three=threeLayer;
    const localNodes=nodes.map(n=>({ ...n }));
    if(three){ localNodes.forEach(n=>{ n.level=levelForLabels(n.labels||[]) }); options.layout={hierarchical:{enabled:true,direction:'UD',sortMethod:'hubsize',levelSeparation:140,nodeSpacing:90}}; options.physics={enabled:false} }
    const network=new vis.Network(container,{nodes:new vis.DataSet(localNodes),edges:new vis.DataSet(edges)},options);
    network.on('selectNode',e=>{
      const id=e.nodes[0]||'';
      setSelNodeId(id);
      setStatus(id?('选中节点: '+id):'');
      setSelectedInfo(id);
      if(pendingRelFromId && id && pendingRelFromId!==id){ openRelWizard(pendingRelFromId, id); setPendingRelFromId(''); }
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
      if(next.length===2) openRelWizard(next[0], next[1]);
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
          React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm',onClick:()=>{const id=(selNodeId||selectedNodeIds[0]||'').trim(); if(!id){ setStatus('请先在图上选择一个节点'); return; } setPendingRelFromId(id); setStatus('从该节点建立关系，请再选择另一个节点');}},'与另一节点建关系'),
          React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm',onClick:deleteSelectedRel},'删除选中关系'),
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
    React.createElement(Wizard)
  );
}

export default App;