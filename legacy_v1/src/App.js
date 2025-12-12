
const { useState, useEffect, useRef } = window.React;

import { loadConfig, detectLocalLlm, getSession } from './utils/neo4j.js';
import { labelForNode, levelForLabels, groupForLabels, palette, mapRecord, buildGraphFromRecords, buildFromPaths } from './utils/helpers.js';
import { AccordionItem } from './components/AccordionItem.js';
import { InspectorPanel } from './components/InspectorPanel.js';
import { Filters } from './components/Filters.js';
import { Wizard } from './components/Wizard.js';
import { ExerciseModal } from './components/ExerciseModal.js';

export default function App() {
  const [q, setQ] = useState('');
  const [depth, setDepth] = useState(2);
  const [limit, setLimit] = useState(200);
  const [layoutMode, setLayoutMode] = useState('network');
  const [anim, setAnim] = useState(true);
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
  const networkRef = useRef(null);

  // Wizard State
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState('');
  const [relStart, setRelStart] = useState('');
  const [relEnd, setRelEnd] = useState('');
  const [manageNodeId, setManageNodeId] = useState('');
  const [wizNodeTpl, setWizNodeTpl] = useState('Concept');
  const [wizNodeName, setWizNodeName] = useState('');
  const [wizRelType, setWizRelType] = useState('');
  const [wizRelName, setWizRelName] = useState('');

  // AI State
  const [tutorTab, setTutorTab] = useState('qa');
  const [qaQ, setQaQ] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');
  const [qaLoading, setQaLoading] = useState(false);
  const [skillQ, setSkillQ] = useState('');
  const [skillResults, setSkillResults] = useState([]);
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [skillPlan, setSkillPlan] = useState('');
  const [compQ, setCompQ] = useState('');
  const [compResults, setCompResults] = useState([]);
  const [selectedCompId, setSelectedCompId] = useState('');
  const [compGuide, setCompGuide] = useState('');

  // Search State
  const [searchResults, setSearchResults] = useState([]);
  const [explorerTab, setExplorerTab] = useState('query');

  // Exercise State
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

  // UI State
  const [expandedSections, setExpandedSections] = useState({query:true, filter:false, manage:false, ai:true});

  function toggleSection(key){
    setExpandedSections(prev=>({...prev, [key]:!prev[key]}));
  }

  useEffect(()=>{
    initMeta();
    runQuery();
  },[]);

  async function initMeta(){
    try{
      const { session, driver } = await getSession();
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
      const { session, driver } = await getSession();
      const limitVal=Math.max(1, Math.floor(parseFloat(limit)||200));
      const result=await session.run('MATCH (n) WITH n LIMIT $limit OPTIONAL MATCH (n)-[r]-(m) RETURN n, r, m',{limit: neo4j.int(limitVal)});
      const data=result.records.map(mapRecord);
      const g=buildGraphFromRecords(data, filterLabels, filterRelTypes);
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
      const { session, driver } = await getSession();
      const depthVal=Math.max(1, Math.floor(parseFloat(depth)||2));
      const limitVal=Math.max(1, Math.floor(parseFloat(limit)||200));
      const cypher=`MATCH (n) WHERE any(prop IN [n.name, n.title, n.id] WHERE toLower(toString(coalesce(prop,''))) CONTAINS toLower($q)) WITH n LIMIT 1 MATCH p=(n)-[r*1..${depthVal}]-(m) WITH nodes(p) AS ns, relationships(p) AS rs RETURN ns, rs LIMIT $limit`;
      const result=await session.run(cypher,{q,limit: neo4j.int(limitVal)});
      const visData=buildFromPaths(result.records, filterLabels, filterRelTypes);
      setNodes(visData.nodes);
      setEdges(visData.edges);
      await session.close();
      await driver.close();
    }catch(e){ if(container) container.textContent=String(e); }
  }

  useEffect(()=>{
    const container=graphRef.current;
    if(!container) return;
    
    const mode = layoutMode; 
    const animOpt = anim;
    
    const options={
      physics:{enabled:animOpt, stabilization:animOpt?false:true, solver:'barnesHut'},
      interaction:{hover:true},
      nodes:{shape:'dot',size:18},
      edges:{smooth:true, arrows:{to:true}},
      groups:{},
      layout:{hierarchical:{enabled:false}},
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

    if(mode==='tree'){
      options.layout = { hierarchical: { enabled:true, direction:'UD', sortMethod:'hubsize' } };
    } else if(mode==='level'){
      options.layout = { hierarchical: { enabled:true, direction:'UD', sortMethod:'hubsize', levelSeparation:140, nodeSpacing:90 } };
      options.physics = { enabled:false };
    } else if(mode==='circle'){
      options.physics = { enabled:false };
    }

    const labels=[...new Set(nodes.map(n=>n.group))];
    const fixed={Competency:'#d62728',Skill:'#1f77b4',Concept:'#2ca02c',Stage:'#9467bd'};
    labels.forEach((lb,i)=>{const col=fixed[lb]||palette(i); options.groups[lb]={color:{background:col, border:'#333'},font:{color:'#111'}}});
    
    const localNodes=nodes.map(n=>({ ...n }));
    localNodes.forEach(n=>{ const s=n.status; if(s===2){ n.color={background:'#4caf50',border:'#333'}; n.borderWidth=1; } else if(s===1){ n.color={background:'#ffeb3b',border:'#333'}; n.borderWidth=3; } else if(s===0){ n.color={background:'#9e9e9e',border:'#333'}; n.borderWidth=1; } });
    
    if(mode==='level'){
       localNodes.forEach(n=>{ n.level=levelForLabels(n.labels||[]) });
    } else if(mode==='circle'){
       const count = localNodes.length;
       const radius = Math.max(300, count * 15);
       localNodes.forEach((n, i) => {
         const angle = (2 * Math.PI * i) / count;
         n.x = radius * Math.cos(angle);
         n.y = radius * Math.sin(angle);
       });
    }

    const network=new vis.Network(container,{nodes:new vis.DataSet(localNodes),edges:new vis.DataSet(edges)},options);
    networkRef.current = network;
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
    
    if(mode==='circle' || mode==='level'){
        network.stabilize();
        network.fit();
    } else if(!animOpt){
        network.stabilize();
    }

    return ()=>{ network.destroy(); };
  },[nodes, edges, layoutMode, anim, pendingRelFromId]);

  function focusNode(id){
    if(networkRef.current){
      networkRef.current.selectNodes([id]);
      networkRef.current.focus(id, {
        scale: 1.2,
        animation: { duration: 800, easingFunction: 'easeInOutQuad' }
      });
      setSelNodeId(id);
      setStatus('选中节点: '+id);
      setSelectedInfo(id);
    }
  }

  function toggleSelectedNode(id){
    focusNode(id);
  }

  async function searchNodes(){
    try{
      const { session, driver } = await getSession();
      const res=await session.run('MATCH (n) WHERE toLower(toString(coalesce(n.name,n.title,n.id,""))) CONTAINS toLower($q) RETURN elementId(n) AS id, labels(n) AS labels, n AS n LIMIT $limit',{q,limit:neo4j.int(50)});
      const list=res.records.map(r=>({id:r.get('id'),labels:r.get('labels'),n:r.get('n')}));
      await session.close(); await driver.close();
      setSearchResults(list);
    }catch(e){ setStatus(String(e)); }
  }

  function openRelWizard(aid,bid){
    setWizardMode('rel');
    setRelStart(aid);
    setRelEnd(bid);
    setWizardOpen(true);
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
    const { session, driver } = await getSession();
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
      const { session, driver } = await getSession();
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
      const { session, driver } = await getSession();
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
      const { session, driver } = await getSession();
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
      const { session, driver } = await getSession();
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
      const { session, driver } = await getSession();
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
      const { session, driver } = await getSession();
      await session.run('MATCH ()-[r]->() WHERE elementId(r)=$id DELETE r',{id});
      await session.close(); await driver.close();
      setStatus('删除关系: '+id);
      setSelEdgeId('');
      if(lastMode==='expand') runExpand(); else runQuery();
    }catch(e){ setStatus(String(e)); }
  }

  async function qaFromGraph(){
    try{
      setQaLoading(true);
      const cfg = await loadConfig();
      const { session, driver } = await getSession();
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
    }catch(e){ setQaAnswer(String(e)); }finally{ setQaLoading(false); }
  }

  async function searchSkills(){
    try{
      const { session, driver } = await getSession();
      const res=await session.run('MATCH (s:Skill) WHERE toLower(toString(coalesce(s.name,s.title,s.id,""))) CONTAINS toLower($q) RETURN elementId(s) AS id, labels(s) AS labels, s AS s LIMIT $limit',{q:skillQ,limit:neo4j.int(50)});
      const list=res.records.map(r=>({id:r.get('id'),labels:r.get('labels'),n:r.get('s')}));
      await session.close(); await driver.close();
      setSkillResults(list);
    }catch(e){ setStatus(String(e)); }
  }

  async function loadSkillPlan(){
    try{
      if(!selectedSkillId){ setSkillPlan('请先选择能力'); return; }
      const { session, driver } = await getSession();
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
      const { session, driver } = await getSession();
      const res=await session.run('MATCH (c:Competency) WHERE toLower(toString(coalesce(c.name,c.title,c.id,""))) CONTAINS toLower($q) RETURN elementId(c) AS id, labels(c) AS labels, c AS c LIMIT $limit',{q:compQ,limit:neo4j.int(50)});
      const list=res.records.map(r=>({id:r.get('id'),labels:r.get('labels'),n:r.get('c')}));
      await session.close(); await driver.close();
      setCompResults(list);
    }catch(e){ setStatus(String(e)); }
  }

  async function loadCompGuide(){
    try{
      if(!selectedCompId){ setCompGuide('请先选择素养'); return; }
      const { session, driver } = await getSession();
      const res=await session.run('MATCH (c) WHERE elementId(c)=$id OPTIONAL MATCH (c)-[]-(i:Indicator) OPTIONAL MATCH (c)-[]-(b:Behavior) RETURN c, collect(distinct i)[0..10] AS indicators, collect(distinct b)[0..10] AS behaviors',{id:selectedCompId});
      await session.close(); await driver.close();
      const rec=res.records[0];
      if(!rec){ setCompGuide('未找到该素养的关联'); return; }
      const inds=(rec.get('indicators')||[]).map(x=> (x.properties&& (x.properties.name||x.properties.title||x.properties.id))||'');
      const behs=(rec.get('behaviors')||[]).map(x=> (x.properties&& (x.properties.name||x.properties.title||x.properties.id))||'');
      const a=[]; if(inds.length) a.push('观察指标: '+inds.join(', ')); if(behs.length) a.push('行为建议: '+behs.join(', ')); setCompGuide(a.join('\n')||'暂无建议');
    }catch(e){ setCompGuide(String(e)); }
  }

  async function openExercise(){
    try{
      const id=(selNodeId||selectedNodeIds[0]||'').trim();
      if(!id){ setStatus('未选择节点'); return; }
      setExerciseOpen(true);
      setExerciseSelected('');
      setExerciseResult('');
      const { session, driver } = await getSession();
      const r=await session.run('MATCH (n) WHERE elementId(n)=$id WITH n, labels(n) AS labs OPTIONAL MATCH (n)-[:TESTS]->(cm:ContentModule) RETURN labs, coalesce(n.name,n.title,n.id,n.content,"") AS nm, coalesce(cm.name,"") AS cmn',{id});
      const labs=(r.records[0]?.get('labs')||[]);
      const nm=(r.records[0]?.get('nm')||'').trim();
      const cmn=(r.records[0]?.get('cmn')||'').trim();
      const moduleName=cmn || nm;
      if(Array.isArray(labs) && labs.includes('Question')){
        const qr=await session.run('MATCH (q) WHERE elementId(q)=$id RETURN q',{id});
        const qrec=qr.records[0];
        if(qrec){
          const qnode=qrec.get('q');
          const props=qnode?.properties||{};
          const qobj={id:String(id), qid:props.qid, content:props.content, type:props.type, options:props.options, answer:props.answer, analysis:props.analysis, difficulty:props.difficulty};
          const optsStr=String(qobj.options||'');
          const parts=optsStr.split(';').map(s=>s.trim()).filter(s=>s);
          const opts=parts.map((s,i)=>{ const m=s.match(/^([A-Z])\./i); const key=m?(m[1].toUpperCase()):String.fromCharCode(65+i); return {key, text:s.replace(/^([A-Z])\./i,'').trim()||s}; });
          setExerciseModuleName(moduleName);
          setExerciseQuestion(qobj);
          setExerciseOptions(opts);
          setExerciseAnswer(String(qobj.answer||'').trim().toUpperCase());
          await loadExerciseStats(moduleName);
          await session.close(); await driver.close();
          return;
        }
      }
      if(!moduleName){ setStatus('该节点无名称'); await session.close(); await driver.close(); return; }
      setExerciseModuleName(moduleName);
      await loadExerciseQuestion(moduleName);
      await loadExerciseStats(moduleName);
      await session.close(); await driver.close();
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

  async function handleNextQuestion() {
    if(exerciseModuleName && exerciseQuestion){
      let u='http://127.0.0.1:8001/question?module_name='+encodeURIComponent(exerciseModuleName)+'&include_answer=true';
      if(exerciseType) u+='&type='+encodeURIComponent(exerciseType);
      if(exerciseDifficulty) u+='&difficulty='+encodeURIComponent(exerciseDifficulty);
      u+='&exclude_id='+encodeURIComponent(String(exerciseQuestion.id||''));
      try {
        const r = await fetch(u);
        const d = await r.json();
        const q=d?.question||null;
        if(q){
          const optsStr=String(q.options||'');
          const parts=optsStr.split(';').map(s=>s.trim()).filter(s=>s);
          const opts=parts.map((s,i)=>{
            const m=s.match(/^([A-Z])\./i);
            const key=m?(m[1].toUpperCase()):String.fromCharCode(65+i);
            return {key, text:s.replace(/^([A-Z])\./i,'').trim()||s};
          });
          setExerciseQuestion(q);
          setExerciseOptions(opts);
          setExerciseAnswer(String(q.answer||'').trim().toUpperCase());
          setExerciseSelected('');
          setExerciseResult('');
        } else {
          setStatus('没有更多题目');
        }
      } catch(e){
        setStatus(String(e));
      }
    }
  }

  function handleAiAsk(node){
    const name = node.properties?.name || node.properties?.title || node.id;
    setQaQ(`请分析节点：${name}`);
    setTutorTab('qa');
    setExpandedSections(prev=>({...prev, ai:true}));
  }

  return React.createElement('div',{className:'flex h-screen w-full overflow-hidden bg-neutral-50'},
    React.createElement('aside',{className:'w-80 flex-shrink-0 flex flex-col border-r bg-white overflow-hidden z-10'},
      React.createElement('div',{className:'p-4 border-b flex-shrink-0'},
        React.createElement('h1',{className:'text-lg font-semibold tracking-tight text-neutral-900'},'Neo4j 图谱查询'),
        React.createElement('p',{className:'text-xs text-neutral-500'},'可视化关系网络与智能助手')
      ),
      React.createElement('div',{className:'flex-1 overflow-y-auto p-4 space-y-4'},
        
        React.createElement(AccordionItem, {title:'图谱探索', sectionKey:'query', expandedSections, toggleSection},
          React.createElement('div',{className:'space-y-3'},
             React.createElement('div',{className:'flex gap-1 w-full border-b pb-2 mb-2'},
                React.createElement('button',{className:'flex-1 py-1 text-xs rounded border '+(explorerTab==='query'?'bg-neutral-900 text-white':'hover:bg-neutral-50'),onClick:()=>setExplorerTab('query')},'查询'),
                React.createElement('button',{className:'flex-1 py-1 text-xs rounded border '+(explorerTab==='search'?'bg-neutral-900 text-white':'hover:bg-neutral-50'),onClick:()=>setExplorerTab('search')},'搜索'),
                React.createElement('button',{className:'flex-1 py-1 text-xs rounded border '+(explorerTab==='filter'?'bg-neutral-900 text-white':'hover:bg-neutral-50'),onClick:()=>setExplorerTab('filter')},'筛选')
             ),
             explorerTab==='query' ? React.createElement('div',{className:'space-y-3'},
                React.createElement('div',{className:'relative'},
                  React.createElement('input',{placeholder:'起点关键词 (为空查询全图)',className:'w-full pl-3 pr-8 py-2 text-sm rounded-md border focus:ring-2 focus:ring-neutral-200 transition-all',value:q,onChange:e=>setQ(e.target.value)}),
                  q && React.createElement('button',{className:'absolute right-2 top-2 text-neutral-400 hover:text-neutral-600',onClick:()=>setQ('')},'✕')
                ),
                React.createElement('div',{className:'bg-neutral-50 rounded-lg p-3 space-y-3 border'},
                    React.createElement('div',{className:'flex items-center justify-between'},
                        React.createElement('span',{className:'text-xs font-medium text-neutral-600'},`扩展深度: ${depth}`),
                        React.createElement('input',{type:'range',min:1,max:6,className:'w-24 accent-neutral-900',value:depth,onChange:e=>setDepth(parseInt(e.target.value||'1'))})
                    ),
                    React.createElement('div',{className:'flex items-center justify-between'},
                        React.createElement('span',{className:'text-xs font-medium text-neutral-600'},`节点限制: ${limit}`),
                        React.createElement('input',{type:'range',min:10,max:2000,step:10,className:'w-24 accent-neutral-900',value:limit,onChange:e=>setLimit(parseInt(e.target.value||'200'))})
                    ),
                    React.createElement('div',{className:'flex gap-2 pt-1'},
                         [{id:'network',l:'网状'},{id:'tree',l:'树状'},{id:'circle',l:'环状'},{id:'level',l:'层次'}].map((m)=>{
                           const active = layoutMode===m.id;
                           return React.createElement('button',{
                             key:m.id,
                             onClick:()=>setLayoutMode(m.id),
                             className:`flex-1 py-1 text-xs rounded border transition-colors ${active?'bg-neutral-800 text-white border-neutral-800':'bg-white text-neutral-600 hover:bg-neutral-100'}`
                           },m.l)
                         })
                    ),
                    React.createElement('div',{className:'flex items-center justify-between pt-1'},
                        React.createElement('span',{className:'text-xs font-medium text-neutral-600'},'物理动画'),
                        React.createElement('label',{className:'relative inline-flex items-center cursor-pointer'},
                            React.createElement('input',{type:'checkbox',className:'sr-only peer',checked:anim,onChange:e=>setAnim(e.target.checked)}),
                            React.createElement('div',{className:`w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-neutral-900`})
                        )
                    )
                ),
                React.createElement('div',{className:'grid grid-cols-2 gap-2'},
                    React.createElement('button',{className:'rounded-md bg-neutral-900 text-white px-3 py-2 text-sm font-medium hover:bg-neutral-800 transition-colors',onClick:runQuery},'全图查询'),
                    React.createElement('button',{className:'rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50 transition-colors',onClick:runExpand},'起点展开')
                )
             ) : explorerTab==='search' ? React.createElement('div',{className:'space-y-2'},
                 React.createElement('div',{className:'flex gap-2'},
                    React.createElement('input',{placeholder:'输入名称搜索...',className:'flex-1 px-3 py-2 text-sm rounded-md border focus:ring-2 focus:ring-neutral-200',value:q,onChange:e=>setQ(e.target.value),onKeyDown:e=>e.key==='Enter'&&searchNodes()}),
                    React.createElement('button',{className:'rounded-md bg-neutral-100 hover:bg-neutral-200 border px-3 py-2 text-sm',onClick:searchNodes},'🔍')
                 ),
                 React.createElement('div',{className:'max-h-[300px] overflow-y-auto space-y-1 pr-1 custom-scrollbar'},
                    searchResults.length===0 ? React.createElement('div',{className:'text-xs text-neutral-400 text-center py-4'},'暂无搜索结果') :
                    searchResults.map(item=>React.createElement('div',{
                        key:item.id,
                        className:'group p-2 border rounded-md hover:border-neutral-400 hover:shadow-sm cursor-pointer transition-all bg-white',
                        onClick:()=>toggleSelectedNode(item.id)
                    },
                        React.createElement('div',{className:'flex justify-between items-center'},
                            React.createElement('span',{className:'font-medium text-sm text-neutral-800 truncate'},item.n.properties.name||item.n.properties.title||item.id),
                            React.createElement('span',{className:'text-[10px] px-1.5 py-0.5 bg-neutral-100 text-neutral-500 rounded'},(item.labels||[])[0]||'Node')
                        )
                    ))
                 )
             ) : React.createElement(Filters,{
               availableLabels, filterLabels, setFilterLabels,
               availableRelTypes, filterRelTypes, setFilterRelTypes,
               onReset: ()=>{ setFilterLabels([]); setFilterRelTypes([]); if(lastMode==='expand') runExpand(); else runQuery(); }
             })
          )
        ),

        React.createElement(AccordionItem, {title:'智能助手', sectionKey:'ai', expandedSections, toggleSection},
          React.createElement('div',{className:'space-y-3'},
            React.createElement('div',{className:'flex items-center justify-between'},
                React.createElement('div',{className:'flex gap-1 w-full'},
                    React.createElement('button',{className:'flex-1 py-1 text-xs rounded border '+(tutorTab==='qa'?'bg-neutral-900 text-white':'hover:bg-neutral-50'),onClick:()=>setTutorTab('qa')},'问答'),
                    React.createElement('button',{className:'flex-1 py-1 text-xs rounded border '+(tutorTab==='skill'?'bg-neutral-900 text-white':'hover:bg-neutral-50'),onClick:()=>setTutorTab('skill')},'技能'),
                    React.createElement('button',{className:'flex-1 py-1 text-xs rounded border '+(tutorTab==='comp'?'bg-neutral-900 text-white':'hover:bg-neutral-50'),onClick:()=>setTutorTab('comp')},'素养')
                )
            ),
            tutorTab==='qa' ? React.createElement('div',{className:'space-y-2'},
                React.createElement('input',{placeholder:'问题...',className:'w-full px-3 py-2 text-sm rounded-md border',value:qaQ,onChange:e=>setQaQ(e.target.value)}),
                React.createElement('button',{className:'w-full rounded-md border px-3 py-2 text-sm',disabled:qaLoading,onClick:qaFromGraph},qaLoading?'思考中...':'AI 回答'),
                React.createElement('pre',{className:'text-xs whitespace-pre-wrap bg-neutral-50 p-2 rounded border max-h-40 overflow-y-auto'},qaAnswer||'暂无回答')
            ) : tutorTab==='skill' ? React.createElement('div',{className:'space-y-2'},
                 React.createElement('div',{className:'flex gap-2'},
                    React.createElement('input',{placeholder:'搜索能力',className:'flex-1 px-2 py-1 text-sm rounded-md border',value:skillQ,onChange:e=>setSkillQ(e.target.value)}),
                    React.createElement('button',{className:'rounded-md border px-2 py-1 text-sm',onClick:searchSkills},'搜')
                 ),
                 React.createElement('div',{className:'max-h-40 overflow-y-auto space-y-1'},
                    skillResults.map(item=>React.createElement('div',{key:item.id,className:'text-xs p-1 border rounded flex justify-between items-center '+(selectedSkillId===item.id?'bg-neutral-100':'')},
                        React.createElement('span',{className:'truncate flex-1'},item.n.properties.name||item.id),
                        React.createElement('button',{className:'text-xs px-1 border rounded',onClick:()=>setSelectedSkillId(item.id)},'选')
                    ))
                 ),
                 React.createElement('button',{className:'w-full rounded-md border px-3 py-2 text-sm',onClick:loadSkillPlan},'生成计划'),
                 React.createElement('pre',{className:'text-xs whitespace-pre-wrap bg-neutral-50 p-2 rounded border max-h-40 overflow-y-auto'},skillPlan||'')
            ) : React.createElement('div',{className:'space-y-2'},
                 React.createElement('div',{className:'flex gap-2'},
                    React.createElement('input',{placeholder:'搜索素养',className:'flex-1 px-2 py-1 text-sm rounded-md border',value:compQ,onChange:e=>setCompQ(e.target.value)}),
                    React.createElement('button',{className:'rounded-md border px-2 py-1 text-sm',onClick:searchComps},'搜')
                 ),
                 React.createElement('div',{className:'max-h-40 overflow-y-auto space-y-1'},
                    compResults.map(item=>React.createElement('div',{key:item.id,className:'text-xs p-1 border rounded flex justify-between items-center '+(selectedCompId===item.id?'bg-neutral-100':'')},
                        React.createElement('span',{className:'truncate flex-1'},item.n.properties.name||item.id),
                        React.createElement('button',{className:'text-xs px-1 border rounded',onClick:()=>setSelectedCompId(item.id)},'选')
                    ))
                 ),
                 React.createElement('button',{className:'w-full rounded-md border px-3 py-2 text-sm',onClick:loadCompGuide},'生成建议'),
                 React.createElement('pre',{className:'text-xs whitespace-pre-wrap bg-neutral-50 p-2 rounded border max-h-40 overflow-y-auto'},compGuide||'')
            )
          )
        ),

        React.createElement('button',{className:'w-full rounded-md bg-neutral-900 text-white px-3 py-2 text-sm shadow-sm hover:bg-neutral-800',onClick:openExercise},'开始练习'),
        React.createElement('div',{className:'text-xs text-neutral-400 pt-2 text-center'},status)
      )
    ),
    React.createElement('main',{className:'flex-1 relative bg-neutral-50 overflow-hidden'},
      React.createElement('div',{ref:graphRef,id:'graph',className:'w-full h-full'}),
      React.createElement('button',{
        className:'absolute top-4 left-4 z-10 flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-full shadow-lg hover:bg-neutral-800 transition-colors',
        onClick:openNodeWizard
      }, 
        React.createElement('svg',{className:'w-4 h-4',fill:'none',viewBox:'0 0 24 24',stroke:'currentColor',strokeWidth:2},React.createElement('path',{strokeLinecap:'round',strokeLinejoin:'round',d:'M12 4v16m8-8H4'})),
        React.createElement('span',{className:'text-sm font-medium'},'新建节点')
      ),
      React.createElement(InspectorPanel,{
        selNodeId: (selNodeId || selectedNodeIds[0] || ''),
        selEdgeId: selEdgeId,
        nodes: nodes,
        edges: edges,
        onClose: ()=>{ setSelNodeId(''); setSelEdgeId(''); setSelectedNodeIds([]); },
        onEditNode: openNodeManage,
        onConnect: (id)=>{ setPendingRelFromId(id); setWizardMode('rel'); setRelStart(id); setRelEnd(''); setWizardOpen(true); setStatus('请选择另一个节点'); },
        onDeleteNode: deleteSelectedNode,
        onDeleteEdge: deleteSelectedRel,
        onAiAsk: handleAiAsk
      }),
      React.createElement('div',{className:'absolute top-4 right-4 bg-white/80 backdrop-blur p-2 rounded border shadow text-xs text-neutral-500'},'滚动缩放 · 拖拽移动')
    ),
    React.createElement(Wizard, {
      open: wizardOpen,
      setOpen: setWizardOpen,
      mode: wizardMode,
      startNode: relStart,
      endNode: relEnd,
      availableRelTypes,
      wizNodeTpl, setWizNodeTpl,
      wizNodeName, setWizNodeName,
      wizRelType, setWizRelType,
      wizRelName, setWizRelName,
      onSubmitNode: submitNodeWizard,
      onSubmitRel: submitRelWizard,
      onSubmitRename: submitNodeRename,
      onDelete: submitNodeDelete
    }),
    React.createElement(ExerciseModal, {
      open: exerciseOpen,
      onClose: ()=>setExerciseOpen(false),
      moduleName: exerciseModuleName,
      type: exerciseType, setType: setExerciseType,
      difficulty: exerciseDifficulty, setDifficulty: setExerciseDifficulty,
      stats: exerciseStats,
      question: exerciseQuestion,
      options: exerciseOptions,
      selected: exerciseSelected, setSelected: setExerciseSelected,
      result: exerciseResult,
      onFilter: ()=>{ if(exerciseModuleName){ loadExerciseQuestion(exerciseModuleName); } },
      onNext: handleNextQuestion,
      onSubmit: submitExercise
    })
  );
}
