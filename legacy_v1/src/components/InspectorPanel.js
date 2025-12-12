
const React = window.React;

export function InspectorPanel({ selNodeId, selEdgeId, nodes, edges, onClose, onEditNode, onConnect, onDeleteNode, onDeleteEdge, onAiAsk }) {
  if (!selNodeId && !selEdgeId) return null;

  const isNode = !!selNodeId;
  const data = isNode 
    ? nodes.find(n => String(n.id) === selNodeId) 
    : edges.find(e => String(e.id) === selEdgeId);

  if (!data) return null;
  const name = data.properties?.name || data.properties?.title || data.label || data.id || '-';

  return React.createElement('div', { className: 'absolute top-4 right-4 w-72 bg-white rounded-xl shadow-xl border border-neutral-200 overflow-hidden flex flex-col z-20' },
    React.createElement('div', { className: 'p-4 border-b bg-neutral-50 flex items-center justify-between' },
      React.createElement('h3', { className: 'font-semibold text-neutral-900' }, isNode ? '节点详情' : '关系详情'),
      React.createElement('button', { onClick: onClose, className: 'text-neutral-400 hover:text-neutral-600' },
        React.createElement('svg', { className: 'w-5 h-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
          React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M6 18L18 6M6 6l12 12' })
        )
      )
    ),
    React.createElement('div', { className: 'p-4 space-y-4' },
      React.createElement('div', { className: 'space-y-2' },
        React.createElement('div', { className: 'text-xs text-neutral-500 uppercase tracking-wider' }, '基本信息'),
        React.createElement('div', { className: 'bg-neutral-50 rounded p-2 text-sm space-y-1' },
          React.createElement('div', { className: 'flex justify-between' },
            React.createElement('span', { className: 'text-neutral-500' }, 'ID'),
            React.createElement('span', { className: 'font-mono' }, data.id)
          ),
          isNode && React.createElement('div', { className: 'flex justify-between' },
            React.createElement('span', { className: 'text-neutral-500' }, 'Label'),
            React.createElement('span', { className: 'font-medium' }, (data.labels || []).join(', '))
          ),
          !isNode && React.createElement('div', { className: 'flex justify-between' },
            React.createElement('span', { className: 'text-neutral-500' }, 'Type'),
            React.createElement('span', { className: 'font-medium' }, data.label)
          ),
           React.createElement('div', { className: 'flex justify-between items-center' },
            React.createElement('span', { className: 'text-neutral-500' }, 'Name'),
            React.createElement('span', { className: 'font-medium truncate max-w-[120px]', title: name }, name)
          )
        )
      ),
      React.createElement('div', { className: 'space-y-2' },
        React.createElement('div', { className: 'text-xs text-neutral-500 uppercase tracking-wider' }, '操作'),
        isNode && React.createElement('div', { className: 'grid grid-cols-2 gap-2' },
          React.createElement('button', { onClick: () => onEditNode(selNodeId), className: 'flex items-center justify-center gap-2 px-3 py-2 rounded-md border hover:bg-neutral-50 text-sm font-medium text-neutral-700' },
             '✏️ 编辑'
          ),
          React.createElement('button', { onClick: () => onConnect(selNodeId), className: 'flex items-center justify-center gap-2 px-3 py-2 rounded-md border hover:bg-neutral-50 text-sm font-medium text-neutral-700' },
             '🔗 连线'
          )
        ),
         isNode && React.createElement('button', { onClick: () => onAiAsk(data), className: 'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 text-sm font-medium' },
             '🤖 AI 分析此节点'
          ),
        React.createElement('button', { onClick: isNode ? onDeleteNode : onDeleteEdge, className: 'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-red-50 text-red-700 border border-red-100 hover:bg-red-100 text-sm font-medium' },
           '🗑️ 删除'
        )
      )
    )
  );
}
