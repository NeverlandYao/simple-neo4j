
const React = window.React;

export function Wizard({
  open, setOpen, mode,
  startNode, endNode,
  availableRelTypes,
  wizNodeTpl, setWizNodeTpl,
  wizNodeName, setWizNodeName,
  wizRelType, setWizRelType,
  wizRelName, setWizRelName,
  onSubmitNode, onSubmitRel, onSubmitRename, onDelete
}){
  if(!open) return null;
  const title = mode==='node' ? '新建节点' : (mode==='rel' ? '新建关系' : '管理节点');
  const relTypeOptions = availableRelTypes.map(t=> React.createElement('option',{key:t,value:t},t));
  const showDelete = mode==='nodeManage';
  const content = mode==='node' ? (
    React.createElement(React.Fragment,null,
      React.createElement('select',{className:'w-full px-3 py-2 text-sm rounded-md border',value:wizNodeTpl,onChange:e=>setWizNodeTpl(e.target.value)},
        ['Concept','Skill','Competency','Task','Indicator','Behavior'].map(x=> React.createElement('option',{key:x,value:x},x))
      ),
      React.createElement('input',{className:'w-full px-3 py-2 text-sm rounded-md border',placeholder:'名称',value:wizNodeName,onChange:e=>setWizNodeName(e.target.value)})
    )
  ) : mode==='rel' ? (
    React.createElement(React.Fragment,null,
      React.createElement('div',{className:'text-xs text-neutral-600'},`起点 ${startNode} → 终点 ${endNode}`),
      React.createElement('input',{className:'w-full px-3 py-2 text-sm rounded-md border',placeholder:'搜索关系类型',onChange:e=>{ const q=e.target.value.toLowerCase(); const first=availableRelTypes.find(t=>t.toLowerCase().includes(q)); setWizRelType(first||''); }}),
      React.createElement('select',{className:'w-full px-3 py-2 text-sm rounded-md border',value:wizRelType,onChange:e=>setWizRelType(e.target.value)}, relTypeOptions),
      React.createElement('input',{className:'w-full px-3 py-2 text-sm rounded-md border',placeholder:'名称(可选)',value:wizRelName,onChange:e=>setWizRelName(e.target.value)})
    )
  ) : (
    React.createElement('input',{className:'w-full px-3 py-2 text-sm rounded-md border',placeholder:'名称',value:wizNodeName,onChange:e=>setWizNodeName(e.target.value)})
  );
  
  const onSubmit = mode==='node' ? onSubmitNode : (mode==='rel' ? onSubmitRel : onSubmitRename);
  
  return React.createElement('div',{className:'fixed inset-0 z-50'},
    React.createElement('div',{className:'absolute inset-0 bg-black/30'}),
    React.createElement('div',{className:'relative mx-auto max-w-md mt-20 rounded-xl border bg-white shadow p-4'},
      React.createElement('div',{className:'text-lg font-semibold'},title),
      React.createElement('div',{className:'mt-2 space-y-3'},content),
      React.createElement('div',{className:'mt-4 flex justify-end gap-2'},
        React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm',onClick:()=>setOpen(false)},'取消'),
        showDelete ? React.createElement('button',{className:'rounded-md bg-red-600 text-white px-3 py-2 text-sm',onClick:onDelete},'删除') : null,
        React.createElement('button',{className:'rounded-md bg-neutral-900 text-white px-3 py-2 text-sm',onClick:onSubmit},'提交')
      )
    )
  );
}
