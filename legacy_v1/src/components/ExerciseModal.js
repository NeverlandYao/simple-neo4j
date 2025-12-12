
const React = window.React;

export function ExerciseModal({
  open, onClose,
  moduleName,
  type, setType,
  difficulty, setDifficulty,
  stats,
  question,
  options,
  selected, setSelected,
  result,
  onFilter,
  onNext,
  onSubmit
}){
  if(!open) return null;
  return React.createElement('div',{className:'fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-6',onClick:onClose},
    React.createElement('div',{className:'w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-2xl p-6',onClick:e=>e.stopPropagation()},
      React.createElement('div',{className:'mb-4 flex items-center justify-between border-b pb-3'},
        React.createElement('div',{className:'text-lg font-medium'}, moduleName?('练习: '+moduleName):'练习'),
        React.createElement('div',{className:'flex items-center gap-2'},
          React.createElement('select',{className:'px-2 py-1 text-sm rounded-md border',value:type,onChange:e=>setType(e.target.value)},
            React.createElement('option',{value:''},'全部'),
            React.createElement('option',{value:'单选题'},'单选题'),
            React.createElement('option',{value:'判断题'},'判断题')
          ),
          React.createElement('select',{className:'px-2 py-1 text-sm rounded-md border',value:difficulty,onChange:e=>setDifficulty(e.target.value)},
            React.createElement('option',{value:''},'全部难度'),
            React.createElement('option',{value:'易'},'易'),
            React.createElement('option',{value:'中'},'中'),
            React.createElement('option',{value:'难'},'难')
          ),
          React.createElement('button',{className:'rounded-md border px-2 py-1 text-sm',onClick:onFilter},'筛选'),
          React.createElement('div',{className:'text-xs text-neutral-600'},`进度 ${stats.mastered}/${stats.pending}/${stats.total}`),
          React.createElement('button',{className:'rounded-md border px-2 py-1 text-sm',onClick:onNext},'换一题'),
          React.createElement('button',{className:'rounded-md border px-2 py-1 text-sm',onClick:onClose},'关闭')
        )
      ),
      question ? React.createElement('div',{},
        React.createElement('div',{className:'text-base leading-relaxed text-neutral-900 mb-4'}, String(question.content||'')),
        React.createElement('div',{className:'space-y-2'},
          ...options.map(opt=>React.createElement('div',{key:opt.key,className:'p-3 border rounded-lg mb-2 hover:bg-neutral-50 transition-colors'},
            React.createElement('label',{className:'flex items-center gap-2 text-sm cursor-pointer w-full'},
              React.createElement('input',{type:'radio',name:'exercise',checked:selected===opt.key,onChange:()=>setSelected(opt.key)}),
              React.createElement('span',{}, opt.key+'. '+opt.text)
            )
          ))
        ),
        React.createElement('div',{className:'mt-4 flex gap-2'},
          React.createElement('button',{className:'rounded-md bg-neutral-900 text-white px-3 py-2 text-sm',onClick:onSubmit},'提交答案'),
          React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm',onClick:onClose},'关闭')
        ),
        result && React.createElement('div',{className:'mt-3 text-sm p-3 bg-neutral-50 rounded border'}, result + (question.analysis?('，解析：'+question.analysis):''))
      ) : React.createElement('div',{},
        React.createElement('div',{className:'text-sm text-neutral-600'},'暂无题目'),
        React.createElement('div',{className:'mt-4 flex gap-2'},
          React.createElement('button',{className:'rounded-md border px-3 py-2 text-sm',onClick:onClose},'关闭')
        )
      )
    )
  );
}
