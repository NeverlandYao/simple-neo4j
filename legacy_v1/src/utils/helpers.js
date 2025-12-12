
export function labelForNode(n){
  const name=n.properties&& (n.properties.name||n.properties.title||n.properties.id);
  const labels=(n.labels&&n.labels.join('\n'))||'';
  return name? String(name): labels|| String(n.id);
}

export function isStage(ls){
  const s=['Stage','Grade','Level','SchoolStage','学段','小学','初中','高中','大学','学前','幼儿园'];
  return (ls||[]).some(l=>s.includes(l));
}

export function levelForLabels(labels){
  const ls=labels||[];
  if(ls.includes('Competency')) return 1;
  if(ls.includes('Skill')) return 2;
  if(ls.includes('Concept')) return 3;
  if(isStage(ls)) return 4;
  return 2;
}

export function groupForLabels(labels){
  const ls=labels||[];
  if(ls.includes('Competency')) return 'Competency';
  if(ls.includes('Skill')) return 'Skill';
  if(ls.includes('Concept')) return 'Concept';
  if(ls.includes('Stage')) return 'Stage'; // Fixed missing check for Stage explicitly if needed, but isStage handles it logic-wise in App.js, but groupForLabels had explicit check.
  if(isStage(ls)) return 'Stage';
  return (ls[0]||'Node');
}

export function palette(i){
  const colors=['#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd','#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf'];
  return colors[i%colors.length];
}

export function hasAnyLabel(labels, set){return set.length===0 || (labels||[]).some(l=>set.includes(l))}

export function idOf(x){ return x && (x.elementId ?? (x.identity && (typeof x.identity.toString==='function'?x.identity.toString():String(x.identity)))); }

export function toNum(x){ return x && typeof x.toNumber==='function' ? x.toNumber() : x; }

export function mapRecord(record){
  const n=record.get('n');
  const r=record.get('r');
  const m=record.get('m');
  return {
    n: n ? { id:idOf(n), labels:n.labels, properties:n.properties } : null,
    r: r ? { id:idOf(r), type:r.type, start:r.startNodeElementId ?? toNum(r.start), end:r.endNodeElementId ?? toNum(r.end), properties:r.properties } : null,
    m: m ? { id:idOf(m), labels:m.labels, properties:m.properties } : null
  };
}

export function buildGraphFromRecords(recs, filterLabels, filterRelTypes){
  const nodeMap=new Map();
  const edgeMap=new Map();
  const labelFilter=filterLabels||[];
  const typeFilter=filterRelTypes||[];
  
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

export function buildFromPaths(records, filterLabels, filterRelTypes){
  const nodeMap=new Map();
  const edgeMap=new Map();
  const labelFilter=filterLabels||[];
  const typeFilter=filterRelTypes||[];
  
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
