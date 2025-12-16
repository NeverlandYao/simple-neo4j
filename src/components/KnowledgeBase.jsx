import React, { useState, useEffect } from 'react';
import { getSession, createNode, updateNode, deleteNode, createRelation } from '../utils/neo4j';

export function KnowledgeBase({ currentDb, onTaskStart }) {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // UI State
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
        if(currentDb) fetchAllQuestions();
    }, [currentDb]);

    async function fetchAllQuestions() {
        setLoading(true);
        try {
            const { session, driver } = await getSession(currentDb);
            const res = await session.run(`
                MATCH (q:Question)
                OPTIONAL MATCH (m:Concept)<-[:TESTS]-(q)
                RETURN q, elementId(q) as id, m.name as conceptName
                ORDER BY q.created_at DESC
            `);
            const qs = res.records.map(r => {
                const props = r.get('q').properties;
                return { 
                    ...props, 
                    id: r.get('id'),
                    conceptName: r.get('conceptName') 
                };
            });
            setQuestions(qs);
            await session.close();
            await driver.close();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function handleAddQuestion() {
        if(!newQuestion.content) return;
        try {
            // 1. Create Question Node
            const qNode = await createNode('Question', {
                ...newQuestion,
                created_at: new Date().toISOString()
            }, currentDb);
            
            const qId = qNode.elementId || String(qNode.identity);
            
            // 2. Link to Module (Optional, if we had a module selector)
            // For now, we just create it standalone as per request to focus on questions
            
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
        <div className="flex flex-col h-full bg-space-black text-white">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-background-dark/50 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-3xl">quiz</span>
                    <h2 className="text-2xl font-bold">题目管理</h2>
                    <span className="text-sm text-gray-400 ml-2">共 {questions.length} 题</span>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowUploadModal(true)} 
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <span className="material-symbols-outlined text-sm">upload_file</span>
                        导入文档
                    </button>
                    <button 
                        onClick={() => setShowAddQuestion(true)} 
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-black font-bold rounded-lg hover:bg-primary/90 transition-colors shadow-[0_0_15px_rgba(56,224,123,0.3)]"
                    >
                        <span className="material-symbols-outlined text-sm">add_circle</span>
                        添加题目
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {/* Upload Modal */}
                {showUploadModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                        <div className="bg-[#1e3427] p-6 rounded-2xl border border-white/10 w-96 shadow-2xl relative">
                            <button onClick={() => setShowUploadModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                                <span className="material-symbols-outlined">close</span>
                            </button>
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
                                    <p className="text-sm text-gray-300">点击上传或拖拽文件到此处</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Add Question Modal */}
                {showAddQuestion && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                        <div className="bg-[#1e3427] p-8 rounded-2xl border border-white/10 w-[600px] shadow-2xl relative">
                            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">add_circle</span>
                                添加新题目
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">题目内容</label>
                                    <textarea 
                                        value={newQuestion.content}
                                        onChange={e => setNewQuestion({...newQuestion, content: e.target.value})}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:border-primary outline-none transition-colors"
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
                                            className="w-full bg-black/20 border border-white/10 rounded-xl p-2 text-white focus:border-primary outline-none"
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
                                            className="w-full bg-black/20 border border-white/10 rounded-xl p-2 text-white focus:border-primary outline-none"
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
                                        className="w-full bg-black/20 border border-white/10 rounded-xl p-2 text-white focus:border-primary outline-none"
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
                                    <button onClick={() => setShowAddQuestion(false)} className="px-4 py-2 text-gray-400 hover:bg-white/5 rounded-lg transition-colors">取消</button>
                                    <button onClick={handleAddQuestion} className="px-4 py-2 bg-primary text-black rounded-lg font-bold hover:bg-primary/90 transition-colors">保存题目</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Questions Grid/List */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                         <span className="material-symbols-outlined text-4xl animate-spin text-primary">cyclone</span>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {questions.map(q => (
                            <div key={q.id} className="bg-white/5 p-5 rounded-xl border border-white/10 hover:border-primary/50 transition-all relative group hover:shadow-lg hover:shadow-primary/5">
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                    <button onClick={() => handleDeleteQuestion(q.id)} className="p-1 text-red-400 hover:bg-red-400/10 rounded">
                                        <span className="material-symbols-outlined">delete</span>
                                    </button>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary font-bold">
                                        Q
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="px-2 py-0.5 rounded text-xs bg-white/10 border border-white/10 text-gray-300">
                                                {q.type}
                                            </span>
                                            {q.conceptName && (
                                                <span className="px-2 py-0.5 rounded text-xs bg-node-gold/20 border border-node-gold/20 text-node-gold">
                                                    {q.conceptName}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-lg font-medium mb-3 leading-relaxed">{q.content}</p>
                                        <div className="text-sm text-gray-400 bg-black/20 p-3 rounded-lg border border-white/5">
                                            <p><span className="text-gray-500">选项:</span> {q.options || "无"}</p>
                                            <p className="mt-1"><span className="text-gray-500">答案:</span> <span className="text-primary">{q.answer}</span></p>
                                            {q.analysis && <p className="mt-1"><span className="text-gray-500">解析:</span> {q.analysis}</p>}
                                        </div>
                                    </div>
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
                )}
            </div>
        </div>
    );
}
