import React, { useState, useEffect } from 'react';
import { getSession, createNode, updateNode, deleteNode, createRelation } from '../utils/neo4j';

export function KnowledgeBase({ currentDb, onTaskStart }) {
    const [modules, setModules] = useState([]);
    const [selectedModule, setSelectedModule] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // UI State
    const [showAddModule, setShowAddModule] = useState(false);
    const [newModuleName, setNewModuleName] = useState('');
    const [newModuleCategory, setNewModuleCategory] = useState('');
    const [showAddQuestion, setShowAddQuestion] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    
    const [newQuestion, setNewQuestion] = useState({
        content: '',
        type: '单选题',
        options: '',
        answer: '',
        analysis: ''
    });

    useEffect(() => {
        if(currentDb) fetchModules();
    }, [currentDb]);

    useEffect(() => {
        if(selectedModule) fetchQuestions(selectedModule.id);
        else setQuestions([]);
    }, [selectedModule]);

    async function fetchModules() {
        setLoading(true);
        try {
            const { session, driver } = await getSession(currentDb);
            const res = await session.run(`
                MATCH (m:ContentModule) 
                RETURN m, elementId(m) as id 
                ORDER BY m.created_at DESC
            `);
            const mods = res.records.map(r => {
                const props = r.get('m').properties;
                return { ...props, id: r.get('id') };
            });
            setModules(mods);
            await session.close();
            await driver.close();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function fetchQuestions(moduleId) {
        try {
            const { session, driver } = await getSession(currentDb);
            const res = await session.run(`
                MATCH (m)-[:TESTS]-(q:Question)
                WHERE elementId(m) = $id
                RETURN q, elementId(q) as id
                ORDER BY q.created_at DESC
            `, { id: moduleId });
            const qs = res.records.map(r => {
                const props = r.get('q').properties;
                return { ...props, id: r.get('id') };
            });
            setQuestions(qs);
            await session.close();
            await driver.close();
        } catch (err) {
            console.error(err);
        }
    }

    async function handleAddModule() {
        if(!newModuleName.trim()) return;
        try {
            const node = await createNode('ContentModule', { 
                name: newModuleName, 
                category: newModuleCategory,
                created_at: new Date().toISOString() 
            }, currentDb);
            const newNode = { 
                ...node.properties, 
                id: node.elementId || String(node.identity) 
            };
            setModules([newNode, ...modules]);
            setNewModuleName('');
            setNewModuleCategory('');
            setShowAddModule(false);
        } catch(err) {
            console.error(err);
            alert("创建失败");
        }
    }

    async function handleAddQuestion() {
        if(!selectedModule || !newQuestion.content) return;
        try {
            // 1. Create Question Node
            const qNode = await createNode('Question', {
                ...newQuestion,
                created_at: new Date().toISOString()
            }, currentDb);
            
            const qId = qNode.elementId || String(qNode.identity);
            
            // 2. Link to Module
            await createRelation(qId, selectedModule.id, 'TESTS', currentDb);
            
            setQuestions([{...newQuestion, id: qId}, ...questions]);
            setNewQuestion({ content: '', type: '单选题', options: '', answer: '', analysis: '' });
            setShowAddQuestion(false);
        } catch(err) {
            console.error(err);
            alert("添加题目失败");
        }
    }
    
    async function handleDeleteQuestion(id) {
        if(!window.confirm("确定删除该题目吗？")) return;
        try {
            await deleteNode(id, currentDb);
            setQuestions(questions.filter(q => q.id !== id));
        } catch(err) {
            console.error(err);
        }
    }
    
    async function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        setUploading(true);
        try {
            // Read file as Base64 for binary support
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64Content = reader.result;
                const res = await fetch('/upload_doc', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        file_base64: base64Content,
                        filename: file.name,
                        db_name: currentDb 
                    })
                });
                const data = await res.json();
                if(data.ok) {
                    onTaskStart && onTaskStart(data.task_id, file.name);
                    alert("文档已提交后台解析，请关注右下角任务进度。");
                    setShowUploadModal(false);
                } else {
                    alert("上传失败: " + data.error);
                }
                setUploading(false);
            };
            reader.onerror = () => {
                alert("文件读取失败");
                setUploading(false);
            };
        } catch(err) {
            console.error(err);
            alert("上传出错");
            setUploading(false);
        }
    }

    return (
        <div className="flex h-full bg-space-black text-white">
            {/* Sidebar List */}
            <div className="w-80 border-r border-white/10 flex flex-col bg-background-dark/50">
                <div className="p-4 border-b border-white/10 flex justify-between items-center">
                   <h3 className="font-bold text-lg">内容模块</h3>
                   <div className="flex gap-2">
                       <button onClick={() => setShowUploadModal(true)} className="text-gray-400 hover:text-white" title="导入文档">
                           <span className="material-symbols-outlined">upload_file</span>
                       </button>
                       <button onClick={() => setShowAddModule(true)} className="text-primary hover:text-white" title="添加模块">
                           <span className="material-symbols-outlined">add_circle</span>
                       </button>
                   </div>
                </div>
                
                {showUploadModal && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="bg-[#1e3427] p-6 rounded-2xl border border-white/10 w-96 shadow-2xl">
                            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">upload_file</span>
                                导入文档构建图谱
                            </h3>
                            <p className="text-sm text-gray-400 mb-4">
                                上传文本 (.txt, .md)、Word (.docx) 或 PDF (.pdf) 文件，系统将自动解析内容并构建图谱。
                            </p>
                            
                            {uploading ? (
                                <div className="flex flex-col items-center justify-center py-4">
                                    <span className="material-symbols-outlined text-4xl animate-spin text-primary mb-2">cyclone</span>
                                    <p className="text-sm text-gray-300">正在解析文档...</p>
                                </div>
                            ) : (
                                <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer relative">
                                    <input 
                                        type="file" 
                                        accept=".txt,.md,.pdf,.docx"
                                        onChange={handleFileUpload}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                    <span className="material-symbols-outlined text-4xl text-gray-500 mb-2">description</span>
                                    <p className="text-sm text-gray-400">点击或拖拽文件到此处</p>
                                </div>
                            )}
                            
                            <div className="flex justify-end mt-4">
                                <button 
                                    onClick={() => setShowUploadModal(false)} 
                                    className="px-3 py-1.5 rounded-lg text-gray-400 hover:bg-white/5"
                                    disabled={uploading}
                                >
                                    关闭
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showAddModule && (
                    <div className="p-4 bg-white/5 border-b border-white/10">
                        <input 
                            value={newModuleName}
                            onChange={e => setNewModuleName(e.target.value)}
                            placeholder="模块名称"
                            className="w-full bg-black/20 border border-white/10 rounded p-2 mb-2 text-white text-sm"
                            autoFocus
                        />
                        <input 
                            value={newModuleCategory}
                            onChange={e => setNewModuleCategory(e.target.value)}
                            placeholder="分类 (可选)"
                            className="w-full bg-black/20 border border-white/10 rounded p-2 mb-2 text-white text-sm"
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowAddModule(false)} className="text-xs text-gray-400 hover:text-white">取消</button>
                            <button onClick={handleAddModule} className="text-xs text-primary font-bold">保存</button>
                        </div>
                    </div>
                )}
                <div className="flex-1 overflow-y-auto">
                    {modules.map(m => (
                        <div 
                            key={m.id} 
                            onClick={() => setSelectedModule(m)}
                            className={`p-4 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${selectedModule?.id === m.id ? 'bg-white/10 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`}
                        >
                            <div className="font-medium">{m.name}</div>
                            {m.category && <div className="text-xs text-gray-500 mt-1">{m.category}</div>}
                        </div>
                    ))}
                    {modules.length === 0 && !loading && (
                         <div className="p-8 text-center text-gray-500 text-sm">
                             暂无模块
                         </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col bg-[#0B1210]">
                {!selectedModule ? (
                    <div className="flex-1 flex items-center justify-center text-gray-500 flex-col gap-2">
                        <span className="material-symbols-outlined text-4xl opacity-50">library_books</span>
                        <p>请选择左侧模块查看详情</p>
                    </div>
                ) : (
                    <>
                        <div className="p-6 border-b border-white/10 flex justify-between items-start bg-background-dark/30">
                            <div>
                                <h2 className="text-2xl font-bold mb-1 text-white">{selectedModule.name}</h2>
                                <p className="text-gray-400 text-sm">{selectedModule.category || '未分类'} • {questions.length} 题目</p>
                            </div>
                            <button 
                                onClick={() => setShowAddQuestion(true)}
                                className="bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary/90 flex items-center gap-2 transition-colors shadow-lg shadow-primary/20"
                            >
                                <span className="material-symbols-outlined text-lg">add</span> 添加题目
                            </button>
                        </div>
                        
                        {showAddQuestion && (
                            <div className="p-6 border-b border-white/10 bg-white/5 animate-in slide-in-from-top-4 duration-200">
                                <h3 className="font-bold mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">edit_note</span>
                                    新题目
                                </h3>
                                <div className="space-y-4 max-w-3xl">
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">题干内容 <span className="text-red-400">*</span></label>
                                        <textarea 
                                            value={newQuestion.content}
                                            onChange={e => setNewQuestion({...newQuestion, content: e.target.value})}
                                            className="w-full bg-black/20 border border-white/10 rounded p-3 text-white focus:border-primary outline-none transition-colors"
                                            rows="3"
                                            placeholder="请输入题目描述..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">题目类型</label>
                                            <select 
                                                value={newQuestion.type}
                                                onChange={e => setNewQuestion({...newQuestion, type: e.target.value})}
                                                className="w-full bg-black/20 border border-white/10 rounded p-2 text-white focus:border-primary outline-none"
                                            >
                                                <option>单选题</option>
                                                <option>多选题</option>
                                                <option>判断题</option>
                                                <option>简答题</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">参考答案</label>
                                            <input 
                                                value={newQuestion.answer}
                                                onChange={e => setNewQuestion({...newQuestion, answer: e.target.value})}
                                                className="w-full bg-black/20 border border-white/10 rounded p-2 text-white focus:border-primary outline-none"
                                                placeholder="例如: B"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">选项 (仅选择题)</label>
                                        <input 
                                            value={newQuestion.options}
                                            onChange={e => setNewQuestion({...newQuestion, options: e.target.value})}
                                            placeholder="A. 选项一; B. 选项二 (使用分号分隔)"
                                            className="w-full bg-black/20 border border-white/10 rounded p-2 text-white focus:border-primary outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">解析说明</label>
                                        <textarea 
                                            value={newQuestion.analysis}
                                            onChange={e => setNewQuestion({...newQuestion, analysis: e.target.value})}
                                            className="w-full bg-black/20 border border-white/10 rounded p-2 text-white focus:border-primary outline-none"
                                            rows="2"
                                            placeholder="题目解析..."
                                        />
                                    </div>
                                    <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/5">
                                        <button onClick={() => setShowAddQuestion(false)} className="px-4 py-2 text-gray-400 hover:bg-white/5 rounded transition-colors">取消</button>
                                        <button onClick={handleAddQuestion} className="px-4 py-2 bg-primary text-black rounded font-bold hover:bg-primary/90 transition-colors">保存题目</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {questions.map(q => (
                                <div key={q.id} className="bg-white/5 p-5 rounded-xl border border-white/10 hover:border-primary/50 transition-all relative group hover:shadow-lg hover:shadow-primary/5">
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                        <button onClick={() => handleDeleteQuestion(q.id)} className="text-gray-400 hover:text-red-400 p-1.5 rounded hover:bg-white/10 transition-colors" title="删除">
                                            <span className="material-symbols-outlined text-lg">delete</span>
                                        </button>
                                    </div>
                                    <div className="flex items-start gap-3 mb-3 pr-8">
                                        <span className={`text-xs px-2 py-0.5 rounded border shrink-0 mt-0.5 font-bold ${
                                            q.type === '判断题' ? 'bg-blue-500/20 text-blue-400 border-blue-500/20' : 
                                            q.type === '多选题' ? 'bg-purple-500/20 text-purple-400 border-purple-500/20' : 
                                            'bg-primary/20 text-primary border-primary/20'
                                        }`}>
                                            {q.type}
                                        </span>
                                        <p className="text-white font-medium text-lg leading-snug">{q.content}</p>
                                    </div>
                                    
                                    {q.options && (
                                        <div className="ml-12 mb-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {q.options.split(/[;；]/).map((opt, i) => (
                                                <div key={i} className="text-sm text-gray-300 bg-black/20 px-3 py-2 rounded border border-white/5">
                                                    {opt.trim()}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    
                                    <div className="ml-12 bg-black/40 p-3 rounded-lg text-sm border border-white/5">
                                        <div className="flex gap-2 items-center mb-1">
                                            <span className="text-gray-500 text-xs uppercase tracking-wider">Answer</span>
                                            <span className="text-primary font-bold font-mono">{q.answer}</span>
                                        </div>
                                        {q.analysis && (
                                            <div className="text-gray-400 text-xs mt-2 pt-2 border-t border-white/5">
                                                <span className="text-gray-500 mr-2">解析:</span>
                                                {q.analysis}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {questions.length === 0 && !showAddQuestion && (
                                <div className="flex flex-col items-center justify-center py-20 text-gray-500 opacity-50">
                                    <span className="material-symbols-outlined text-6xl mb-4">quiz</span>
                                    <p>暂无题目数据</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
