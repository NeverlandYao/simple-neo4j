
const React = window.React;

export function AccordionItem({title, sectionKey, children, expandedSections, toggleSection}){
  const isOpen = expandedSections[sectionKey];
  return React.createElement('div',{className:'border rounded-lg bg-white shadow-sm overflow-hidden'},
    React.createElement('button',{
      className:'w-full flex items-center justify-between p-3 bg-white hover:bg-neutral-50 transition-colors',
      onClick:()=>toggleSection(sectionKey)
    },
      React.createElement('span',{className:'text-sm font-medium text-neutral-900'},title),
      React.createElement('svg',{
        className:`w-4 h-4 text-neutral-500 transition-transform duration-200 ${isOpen?'rotate-180':''}`,
        fill:'none', viewBox:'0 0 24 24', stroke:'currentColor', strokeWidth:2
      }, React.createElement('path',{strokeLinecap:'round', strokeLinejoin:'round', d:'M19 9l-7 7-7-7'}))
    ),
    isOpen && React.createElement('div',{className:'p-3 border-t bg-neutral-50/50 space-y-3'}, children)
  );
}
