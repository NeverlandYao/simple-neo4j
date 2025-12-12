import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ChatPanel } from './components/ChatPanel';
import { GraphPanel } from './components/GraphPanel';
import { KnowledgeBase } from './components/KnowledgeBase';
import { LearningProgress } from './components/LearningProgress';
import { TaskMonitor } from './components/TaskMonitor';
import { getSession, createNode, deleteNode, updateNode, createRelation, getDatabases, searchGraph } from './utils/neo4j';
import { buildGraphFromRecords, mapRecord } from './utils/helpers';

export default function App() {
  // App State
  const [viewMode, setViewMode] = useState('graph'); // 'graph' | 'knowledge' | 'progress'
  
  // Background Tasks
  const [tasks, setTasks] = useState([]);

  // Poll for task updates
  useEffect(() => {
    if (tasks.length === 0) return;

    const activeTasks = tasks.filter(t => ['queued', 'running', 'cancelling'].includes(t.status));
    if (activeTasks.length === 0) return;

    const interval = setInterval(async () => {
        const updatedTasks = await Promise.all(tasks.map(async (task) => {
            if (['completed', 'failed', 'cancelled'].includes(task.status)) return task;
            
            try {
                const res = await fetch(`/task_status?task_id=${task.id}`);
                if (res.ok) {
                    const status = await res.json();
                    return { ...task, ...status, id: task.id }; // Merge status
                }
            } catch (e) {
                console.error("Poll failed", e);
            }
            return task;
        }));
        setTasks(updatedTasks);
    }, 1000);

    return () => clearInterval(interval);
  }, [tasks]);

  const handleTaskStart = (taskId, filename) => {
      setTasks(prev => [...prev, { id: taskId, filename, status: 'queued', message: 'Starting...' }]);
  };

  const handleCancelTask = async (taskId) => {
      try {
          await fetch('/cancel_task', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ task_id: taskId })
          });
          // Optimistic update
          setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'cancelling' } : t));
      } catch (e) {
          console.error("Cancel failed", e);
      }
  };

  const handleClearTask = (taskId) => {
      setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  // Graph State
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  
  // Database State
  const [databases, setDatabases] = useState([]);
  const [currentDb, setCurrentDb] = useState('');
  
  // Chat State
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);

  // Helper to determine node color based on labels/group
  const getNodeColor = (node) => {
      const labels = node.labels || [];
      if (labels.length === 0) return '#94a3b8'; // Default Gray

      // Simple hash function to generate color from string
      const stringToColor = (str) => {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
              hash = str.charCodeAt(i) + ((hash << 5) - hash);
          }
          const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
          return '#' + "00000".substring(0, 6 - c.length) + c;
      };

      // Use the first label to determine color
      // You can also use a predefined map if you want specific colors for known labels
      const label = labels[0];
      
      // Predefined map for core types (optional, to keep them consistent/pretty)
      const colorMap = {
          'Competency': '#A78BFA',
          'Skill': '#38e07b',
          'Concept': '#60A5FA',
          'Person': '#F87171',
          'Event': '#FBBF24',
          'Location': '#34D399'
      };

      return colorMap[label] || stringToColor(label);
  };

  // Load Databases
  useEffect(() => {
      async function fetchDbs() {
          try {
              const dbs = await getDatabases();
              setDatabases(dbs);
              // Default to 'neo4j' or the first available one if not set
              const { config } = await getSession();
              setCurrentDb(config.database || 'neo4j');
          } catch (err) {
              console.error("Failed to load databases:", err);
          }
      }
      fetchDbs();
  }, []);

  // Load Graph Data when DB changes
  useEffect(() => {
    if (!currentDb) return;

    async function loadGraph() {
      try {
        const { session, driver } = await getSession(currentDb);
        // Updated initial query: Fetch nodes AND their relationships if they exist
        // Prioritize newest nodes (by id) so user sees their changes immediately
        const result = await session.run(`
          MATCH (n)
          OPTIONAL MATCH (n)-[r]-(m)
          RETURN n, r, m
          ORDER BY id(n) DESC
          LIMIT 50
        `);
        
        const mappedRecords = result.records.map(mapRecord);
        const { nodes: gNodes, edges: gEdges } = buildGraphFromRecords(mappedRecords);
        
        console.log(`Graph loaded for ${currentDb}:`, gNodes.length, "nodes");

        const visualNodes = gNodes.map(n => ({
          ...n,
          color: getNodeColor(n),
          font: { color: '#ffffff' }
        }));

        setNodes(visualNodes);
        setEdges(gEdges);
        
        await session.close();
        await driver.close();
      } catch (err) {
        console.error("Failed to load graph:", err);
      }
    }
    loadGraph();
  }, [currentDb]);

  // Handle Double Click to Expand
  const handleNodeDoubleClick = async (node) => {
    try {
      const { session, driver } = await getSession(currentDb);
      // Fetch related nodes (outgoing relationships)
      const result = await session.run(`
        MATCH (n)-[r]-(m) 
        WHERE elementId(n) = $id OR id(n) = $legacyId
        RETURN n, r, m
        LIMIT 20
      `, { id: node.id, legacyId: parseInt(node.id) });
      
      const mappedRecords = result.records.map(mapRecord);
      const { nodes: newNodes, edges: newEdges } = buildGraphFromRecords(mappedRecords);
      
      if (newNodes.length === 0 && newEdges.length === 0) {
          console.log("No more relations found for this node.");
          return;
      }

      // Merge new data with existing state
      setNodes(prev => {
        const existingIds = new Set(prev.map(n => n.id));
        const uniqueNewNodes = newNodes
            .filter(n => !existingIds.has(n.id))
            .map(n => ({
                ...n,
                color: getNodeColor(n),
                font: { color: '#ffffff' }
            }));
        return [...prev, ...uniqueNewNodes];
      });

      setEdges(prev => {
        const existingIds = new Set(prev.map(e => e.id));
        const uniqueNewEdges = newEdges.filter(e => !existingIds.has(e.id));
        return [...prev, ...uniqueNewEdges];
      });

      await session.close();
      await driver.close();
    } catch (err) {
      console.error("Failed to expand node:", err);
    }
  };

  const handleAddNode = async (label, props) => {
    try {
      const newNode = await createNode(label, props, currentDb);
      
      const visualNode = {
        id: newNode.elementId || String(newNode.identity),
        label: props.name,
        group: label,
        labels: [label],
        color: getNodeColor({ labels: [label] }),
        font: { color: '#ffffff' }
      };

      setNodes(prev => [...prev, visualNode]);
    } catch (err) {
      console.error("Failed to add node:", err);
      alert("添加节点失败");
    }
  };

  const handleDeleteNode = async (id) => {
    try {
      await deleteNode(id, currentDb);
      setNodes(prev => prev.filter(n => n.id !== id));
      setEdges(prev => prev.filter(e => e.from !== id && e.to !== id));
    } catch (err) {
      console.error("Failed to delete node:", err);
      alert("删除节点失败");
    }
  };

  const handleUpdateNode = async (id, props) => {
    try {
      const updatedNode = await updateNode(id, props, currentDb);
      setNodes(prev => prev.map(n => 
        n.id === id ? { ...n, label: props.name || n.label } : n
      ));
    } catch (err) {
      console.error("Failed to update node:", err);
      alert("更新节点失败");
    }
  };

  const handleAddRelation = async (fromId, toId, type) => {
    try {
      const newRel = await createRelation(fromId, toId, type, currentDb);
      const visualRel = {
          id: newRel.elementId || String(newRel.identity),
          from: fromId,
          to: toId,
          label: type
      };
      setEdges(prev => [...prev, visualRel]);
    } catch (err) {
      console.error("Failed to add relation:", err);
      alert("添加关系失败");
    }
  };

  const handleSendMessage = async (text) => {
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInputValue("");
    setLoading(true);

    try {
      // 1. Fetch relevant graph data (evidence)
      // Extract keywords (simple split by space)
      const keywords = text.split(/\s+/).filter(k => k.length > 0);
      let evidence = [];
      
      if (keywords.length > 0) {
        evidence = await searchGraph(keywords, currentDb);
        console.log("Retrieved evidence:", evidence);
      }
      
      // 2. Call LLM API
      const response = await fetch('/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          evidence: evidence 
        })
      });
      
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: "抱歉，连接 AI 时出现错误。" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white overflow-hidden">
      <Header 
        databases={databases}
        currentDb={currentDb}
        onDbChange={setCurrentDb}
        viewMode={viewMode}
        onViewChange={setViewMode}
      />
      
      <div className="flex flex-1 overflow-hidden relative">
        <ChatPanel 
          messages={messages}
          loading={loading}
          onSendMessage={handleSendMessage}
          inputValue={inputValue}
          setInputValue={setInputValue}
        />
        
        {viewMode === 'graph' ? (
            <GraphPanel 
              nodes={nodes}
              edges={edges}
              onNodeSelect={(node) => console.log("Selected:", node)}
              onNodeDoubleClick={handleNodeDoubleClick}
              onAddNode={handleAddNode}
              onDeleteNode={handleDeleteNode}
              onUpdateNode={handleUpdateNode}
              onAddRelation={handleAddRelation}
             />
         ) : viewMode === 'knowledge' ? (
             <KnowledgeBase currentDb={currentDb} onTaskStart={handleTaskStart} />
         ) : (
             <LearningProgress currentDb={currentDb} />
         )}

         <TaskMonitor 
            tasks={tasks} 
            onCancelTask={handleCancelTask} 
            onClearTask={handleClearTask} 
         />
      </div>
    </div>
  );
}
