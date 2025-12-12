import React, { useEffect, useRef, useState } from 'react';
import { Network } from 'vis-network';

const COLOR_MAP = {
    'Competency': '#A78BFA',
    'Skill': '#38e07b',
    'Concept': '#60A5FA',
    'Person': '#F87171',
    'Event': '#FBBF24',
    'Location': '#34D399'
};

export function GraphPanel({ 
  nodes, 
  edges, 
  onNodeSelect,
  onNodeDoubleClick,
  onAddNode,
  onDeleteNode,
  onUpdateNode,
  onAddRelation
}) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const [layoutMode, setLayoutMode] = useState('standard'); 
  const [selectedNode, setSelectedNode] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeLabel, setNewNodeLabel] = useState('Concept');
  
  // Relation State
  const [isLinking, setIsLinking] = useState(false);
  const [linkStartNode, setLinkStartNode] = useState(null);
  const [showRelModal, setShowRelModal] = useState(false);
  const [relType, setRelType] = useState('RELATED_TO');
  const [linkEndNode, setLinkEndNode] = useState(null);
  const [availableRelTypes, setAvailableRelTypes] = useState(['RELATED_TO', 'INCLUDES', 'REQUIRES', 'LEADS_TO']); // Default types
  const [isCustomRelType, setIsCustomRelType] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const data = { nodes, edges };
    
    let layoutOptions = { randomSeed: 2 };

    if (layoutMode === 'hierarchy') {
        layoutOptions = {
            hierarchical: {
                enabled: true,
                direction: 'UD', 
                sortMethod: 'directed',
                nodeSpacing: 150,
                levelSeparation: 150
            }
        };
    } else if (layoutMode === 'circle') {
        layoutOptions = { randomSeed: 2 };
    }

    const options = {
      nodes: {
        shape: 'dot',
        size: 20,
        font: {
          size: 14,
          color: '#ffffff',
          face: 'Spline Sans',
          strokeWidth: 2,
          strokeColor: '#000000'
        },
        borderWidth: 2,
        shadow: true,
        color: {
            background: '#ffffff', 
            border: '#ffffff',
            highlight: { background: '#ffffff', border: '#FFF' },
            hover: { background: '#ffffff', border: '#FFF' }
        }
      },
      edges: {
        width: 1,
        color: { color: 'rgba(255, 255, 255, 0.2)', highlight: '#ffffff', hover: '#ffffff' },
        smooth: {
          type: 'continuous',
          forceDirection: 'none'
        },
        arrows: {
          to: { enabled: true, scaleFactor: 0.5 }
        }
      },
      physics: {
        enabled: layoutMode !== 'hierarchy',
        stabilization: false, 
        barnesHut: {
          gravitationalConstant: -3000,
          centralGravity: 0.3,
          springLength: 95,
          springConstant: 0.04,
          damping: 0.09,
          avoidOverlap: 0.1
        }
      },
      layout: layoutOptions,
      interaction: {
        hover: true,
        tooltipDelay: 200,
        hideEdgesOnDrag: true,
        zoomView: true,
        dragView: true,
        multiselect: false
      }
    };

    networkRef.current = new Network(containerRef.current, data, options);

    networkRef.current.on('click', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = nodes.find(n => n.id === nodeId);
        
        if (isLinking) {
            // If in linking mode, second click sets the end node
            if (linkStartNode && linkStartNode.id !== nodeId) {
                setLinkEndNode(node);
                setShowRelModal(true);
                setIsLinking(false); // Exit linking mode immediately to open modal
            } else if (linkStartNode && linkStartNode.id === nodeId) {
                // Clicked same node, cancel
                setIsLinking(false);
                setLinkStartNode(null);
            } else {
                // First click in linking mode
                setLinkStartNode(node);
            }
        } else {
            // Normal selection
            setSelectedNode(node);
            if (node && onNodeSelect) onNodeSelect(node);
        }
      } else {
        if(!isLinking) setSelectedNode(null);
      }
    });
    
    networkRef.current.on('doubleClick', (params) => {
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            const node = nodes.find(n => n.id === nodeId);
            if(node && onNodeDoubleClick) onNodeDoubleClick(node);
        }
    });

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
      }
    };
  }, [nodes, edges, layoutMode, isLinking, linkStartNode]);

  const handleEditClick = () => {
    if (selectedNode) {
      setEditName(selectedNode.label || '');
      setShowEditModal(true);
    }
  };

  const handleEditSubmit = () => {
    if (selectedNode && onUpdateNode) {
      onUpdateNode(selectedNode.id, { name: editName });
      setShowEditModal(false);
    }
  };

  const handleDeleteClick = () => {
    if (selectedNode && onDeleteNode) {
      if (window.confirm(`确定要删除节点 "${selectedNode.label}" 吗?`)) {
        onDeleteNode(selectedNode.id);
        setSelectedNode(null);
      }
    }
  };

  const handleAddSubmit = () => {
    if (onAddNode && newNodeName) {
      onAddNode(newNodeLabel, { name: newNodeName });
      setShowAddModal(false);
      setNewNodeName('');
    }
  };

  const startLinking = () => {
      if (selectedNode) {
          setIsLinking(true);
          setLinkStartNode(selectedNode);
      } else {
          alert("请先选择一个起始节点");
      }
  };

  const handleRelSubmit = () => {
      if (onAddRelation && linkStartNode && linkEndNode && relType) {
          onAddRelation(linkStartNode.id, linkEndNode.id, relType);
          if (!availableRelTypes.includes(relType)) {
              setAvailableRelTypes(prev => [...prev, relType]);
          }
          setShowRelModal(false);
          setLinkStartNode(null);
          setLinkEndNode(null);
          setRelType('RELATED_TO'); // Reset to default
          setIsCustomRelType(false);
      }
  };

  return (
    <div className="flex-1 bg-space-black relative overflow-hidden bg-grid-pattern h-full flex flex-col">
       {/* Toolbar */}
       <div className="absolute top-4 left-4 z-10 flex gap-2 bg-background-dark/80 backdrop-blur p-1 rounded-lg border border-white/10">
           <button onClick={() => setLayoutMode('standard')} className={`p-2 rounded hover:bg-white/10 text-white ${layoutMode === 'standard' ? 'bg-primary/20 text-primary' : ''}`} title="标准布局"><span className="material-symbols-outlined text-lg">hub</span></button>
           <button onClick={() => setLayoutMode('hierarchy')} className={`p-2 rounded hover:bg-white/10 text-white ${layoutMode === 'hierarchy' ? 'bg-primary/20 text-primary' : ''}`} title="层级布局"><span className="material-symbols-outlined text-lg">account_tree</span></button>
           <button onClick={() => setLayoutMode('circle')} className={`p-2 rounded hover:bg-white/10 text-white ${layoutMode === 'circle' ? 'bg-primary/20 text-primary' : ''}`} title="环状布局"><span className="material-symbols-outlined text-lg">data_usage</span></button>
           
           <div className="w-px h-6 bg-white/10 mx-1 self-center"></div>
           
           <button onClick={() => setShowAddModal(true)} className="p-2 rounded hover:bg-white/10 text-white" title="添加节点"><span className="material-symbols-outlined text-lg">add_circle</span></button>
           
           {selectedNode && (
             <>
               <button onClick={handleEditClick} className="p-2 rounded hover:bg-white/10 text-white" title="编辑节点"><span className="material-symbols-outlined text-lg">edit</span></button>
               <button onClick={startLinking} className={`p-2 rounded hover:bg-white/10 text-white ${isLinking ? 'bg-node-gold/20 text-node-gold animate-pulse' : ''}`} title="建立关系"><span className="material-symbols-outlined text-lg">link</span></button>
               <button onClick={handleDeleteClick} className="p-2 rounded hover:bg-white/10 text-red-400" title="删除节点"><span className="material-symbols-outlined text-lg">delete</span></button>
             </>
           )}
       </div>
       
       {/* Linking Instruction Overlay */}
       {isLinking && (
           <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-node-gold/90 text-black px-4 py-2 rounded-full font-bold shadow-lg animate-bounce">
               请点击选择目标节点
           </div>
       )}
       
       <div ref={containerRef} className="w-full h-full" />
       
       {/* Legend */}
       <div className="absolute bottom-4 right-4 bg-background-dark/80 backdrop-blur p-3 rounded-lg border border-white/10 text-xs text-gray-400">
         {Object.entries(COLOR_MAP).map(([label, color]) => (
             <div key={label} className="flex items-center gap-2 mb-1">
                 <span className="w-3 h-3 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.2)]" style={{backgroundColor: color}}></span>
                 <span className="text-gray-200">{label}</span>
             </div>
         ))}
         <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
             <span className="w-3 h-3 rounded-full bg-[#94a3b8]"></span>
             <span className="text-gray-200">Other</span>
         </div>
       </div>

       {/* Edit Modal */}
       {showEditModal && (
         <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
           <div className="bg-[#1e3427] p-6 rounded-2xl border border-white/10 w-80 shadow-2xl">
             <h3 className="text-white font-bold mb-4">编辑节点</h3>
             <input 
               value={editName}
               onChange={e => setEditName(e.target.value)}
               className="w-full bg-[#0B1210] border border-white/10 rounded-lg px-3 py-2 text-white mb-4 focus:outline-none focus:border-primary"
               placeholder="节点名称"
             />
             <div className="flex justify-end gap-2">
               <button onClick={() => setShowEditModal(false)} className="px-3 py-1.5 rounded-lg text-gray-400 hover:bg-white/5">取消</button>
               <button onClick={handleEditSubmit} className="px-3 py-1.5 rounded-lg bg-primary text-[#0B1210] font-bold hover:bg-primary/90">保存</button>
             </div>
           </div>
         </div>
       )}

       {/* Add Modal */}
       {showAddModal && (
         <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
           <div className="bg-[#1e3427] p-6 rounded-2xl border border-white/10 w-80 shadow-2xl">
             <h3 className="text-white font-bold mb-4">添加新节点</h3>
             <div className="mb-3">
               <label className="text-xs text-gray-400 block mb-1">类型</label>
               <select 
                 value={newNodeLabel} 
                 onChange={e => setNewNodeLabel(e.target.value)}
                 className="w-full bg-[#0B1210] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
               >
                 <option value="Concept">基础概念</option>
                 <option value="Skill">关键能力</option>
                 <option value="Competency">核心素养</option>
               </select>
             </div>
             <div className="mb-4">
               <label className="text-xs text-gray-400 block mb-1">名称</label>
               <input 
                 value={newNodeName}
                 onChange={e => setNewNodeName(e.target.value)}
                 className="w-full bg-[#0B1210] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                 placeholder="输入节点名称"
               />
             </div>
             <div className="flex justify-end gap-2">
               <button onClick={() => setShowAddModal(false)} className="px-3 py-1.5 rounded-lg text-gray-400 hover:bg-white/5">取消</button>
               <button onClick={handleAddSubmit} className="px-3 py-1.5 rounded-lg bg-primary text-[#0B1210] font-bold hover:bg-primary/90">创建</button>
             </div>
           </div>
         </div>
       )}

       {/* Relation Modal */}
       {showRelModal && (
         <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
           <div className="bg-[#1e3427] p-6 rounded-2xl border border-white/10 w-80 shadow-2xl">
             <h3 className="text-white font-bold mb-4">建立关系</h3>
             <div className="mb-4 text-sm text-gray-400">
               从: <span className="text-white">{linkStartNode?.label}</span> <br/>
               到: <span className="text-white">{linkEndNode?.label}</span>
             </div>
             <div className="mb-4">
               <label className="text-xs text-gray-400 block mb-1">关系类型</label>
               
               {!isCustomRelType ? (
                   <select 
                     value={relType} 
                     onChange={e => {
                         if(e.target.value === '__CUSTOM__') {
                             setIsCustomRelType(true);
                             setRelType('');
                         } else {
                             setRelType(e.target.value);
                         }
                     }}
                     className="w-full bg-[#0B1210] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary mb-2"
                   >
                     {availableRelTypes.map(t => (
                         <option key={t} value={t}>{t}</option>
                     ))}
                     <option value="__CUSTOM__">+ 自定义类型...</option>
                   </select>
               ) : (
                   <div className="flex gap-2">
                       <input 
                         value={relType}
                         onChange={e => setRelType(e.target.value)}
                         className="w-full bg-[#0B1210] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                         placeholder="输入关系类型"
                         autoFocus
                       />
                       <button 
                         onClick={() => {setIsCustomRelType(false); setRelType(availableRelTypes[0]);}}
                         className="px-2 py-1 rounded border border-white/10 text-gray-400 hover:text-white"
                         title="返回选择列表"
                       >
                         ✕
                       </button>
                   </div>
               )}
             </div>
             <div className="flex justify-end gap-2">
               <button onClick={() => {setShowRelModal(false); setIsLinking(false);}} className="px-3 py-1.5 rounded-lg text-gray-400 hover:bg-white/5">取消</button>
               <button onClick={handleRelSubmit} className="px-3 py-1.5 rounded-lg bg-node-gold text-[#0B1210] font-bold hover:bg-node-gold/90">连接</button>
             </div>
           </div>
         </div>
       )}
    </div>
  );
}