
const React = window.React;

export function Filters({
  availableLabels, 
  filterLabels, 
  setFilterLabels, 
  availableRelTypes, 
  filterRelTypes, 
  setFilterRelTypes,
  onReset
}){
  return React.createElement('div',{className:'flex flex-col gap-3 w-full'},
    React.createElement('div',{className:'flex flex-col gap-2 p-3 border rounded-lg bg-white shadow-sm'},
      React.createElement('div',{className:'flex items-center justify-between'},
        React.createElement('span',{className:'text-sm font-medium text-neutral-900'},'筛选标签'),
        filterLabels.length > 0 && React.createElement('button',{className:'text-xs text-neutral-500 hover:text-neutral-900', onClick:()=>setFilterLabels([])}, '清除')
      ),
      React.createElement('div',{className:'flex flex-wrap gap-2'},
        availableLabels.map(lb=>
          React.createElement('label',{key:lb,className:`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs cursor-pointer transition-colors ${filterLabels.includes(lb) ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white hover:bg-neutral-50'}`},
            React.createElement('input',{type:'checkbox',className:'hidden',value:lb,checked:filterLabels.includes(lb),onChange:e=>{
              const checked=e.target.checked; setFilterLabels(prev=> checked? [...prev, lb] : prev.filter(x=>x!==lb));
            }}),
            React.createElement('span',{},lb)
          )
        )
      )
    ),
    React.createElement('div',{className:'flex flex-col gap-2 p-3 border rounded-lg bg-white shadow-sm'},
      React.createElement('div',{className:'flex items-center justify-between'},
        React.createElement('span',{className:'text-sm font-medium text-neutral-900'},'筛选关系'),
        filterRelTypes.length > 0 && React.createElement('button',{className:'text-xs text-neutral-500 hover:text-neutral-900', onClick:()=>setFilterRelTypes([])}, '清除')
      ),
      React.createElement('div',{className:'flex flex-wrap gap-2'},
        availableRelTypes.map(t=>
          React.createElement('label',{key:t,className:`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs cursor-pointer transition-colors ${filterRelTypes.includes(t) ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white hover:bg-neutral-50'}`},
            React.createElement('input',{type:'checkbox',className:'hidden',value:t,checked:filterRelTypes.includes(t),onChange:e=>{
              const checked=e.target.checked; setFilterRelTypes(prev=> checked? [...prev, t] : prev.filter(x=>x!==t));
            }}),
            React.createElement('span',{},t)
          )
        )
      )
    ),
    (filterLabels.length > 0 || filterRelTypes.length > 0) && React.createElement('button',{className:'w-full rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-3 py-2 text-sm font-medium transition-colors',onClick:onReset},'重置所有筛选')
  );
}
