import React, { useState, useEffect } from 'react';
import { getSession } from '../utils/neo4j';

export function LearningProgress({ currentDb }) {
    const [modules, setModules] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeModule, setActiveModule] = useState(null); // If set, we are in Quiz mode
    
    // Quiz State
    const [quizQueue, setQuizQueue] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [quizLoading, setQuizLoading] = useState(false);
    const [selectedOption, setSelectedOption] = useState(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [streak, setStreak] = useState(0);
    const [isReviewMode, setIsReviewMode] = useState(false);

    useEffect(() => {
        if(currentDb) fetchModulesAndStats();
    }, [currentDb, activeModule]); // Refresh stats when returning from quiz

    async function fetchModulesAndStats() {
        setLoading(true);
        try {
            const { session, driver } = await getSession(currentDb);
            // Fetch modules
            const res = await session.run(`
                MATCH (m:ContentModule) 
                RETURN m, elementId(m) as id 
                ORDER BY m.created_at DESC
            `);
            
            const mods = [];
            for (const r of res.records) {
                const props = r.get('m').properties;
                const id = r.get('id');
                
                const statsRes = await session.run(`
                    MATCH (m)-[:TESTS]-(q:Question)
                    WHERE elementId(m) = $id
                    RETURN 
                        count(q) as total, 
                        count(CASE WHEN q.user_result = 'true' THEN 1 END) as mastered
                `, { id });
                
                const stats = statsRes.records[0];
                mods.push({
                    ...props,
                    id,
                    total: stats.get('total').toNumber(),
                    mastered: stats.get('mastered').toNumber()
                });
            }
            
            setModules(mods);
            await session.close();
            await driver.close();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function startQuiz(module) {
        console.log("Starting quiz for module:", module);
        setActiveModule(module);
        setStreak(0);
        setQuizLoading(true);
        
        try {
            const { session, driver } = await getSession(currentDb);
            // Fetch all questions for this module
            // Explicitly match node by ID first, then pattern
            const res = await session.run(`
                MATCH (m) WHERE elementId(m) = $id
                MATCH (m)-[:TESTS]-(q:Question)
                RETURN q, elementId(q) as id, q.user_result as result
                ORDER BY q.created_at DESC
            `, { id: module.id });
            
            let allQuestions = res.records.map(r => {
                const props = r.get('q').properties;
                return { 
                    ...props, 
                    id: r.get('id'),
                    user_result: r.get('result')
                };
            });
            
            console.log("All questions found:", allQuestions.length);
            
            await session.close();
            await driver.close();
            
            const isCompleted = module.mastered === module.total && module.total > 0;
            console.log("Is completed:", isCompleted);
            setIsReviewMode(isCompleted);

            // Filter questions based on mode
            // If not completed, prioritize unmastered questions
            // If completed (Review Mode), include all questions
            let queue = [];
            if (!isCompleted) {
                queue = allQuestions.filter(q => q.user_result !== 'true');
                console.log("Unmastered questions:", queue.length);
                // If for some reason all are mastered but stats said otherwise (sync issue), fallback to all
                if (queue.length === 0 && allQuestions.length > 0) {
                    console.log("Fallback to all questions");
                    queue = allQuestions;
                }
            } else {
                queue = allQuestions;
            }

            // Shuffle queue
            queue = queue.sort(() => Math.random() - 0.5);
            console.log("Final queue length:", queue.length);
            
            setQuizQueue(queue);
            
            if (queue.length > 0) {
                fetchNextQuestion(queue);
            } else {
                console.log("Queue empty, setting currentQuestion null");
                setCurrentQuestion(null);
                setQuizLoading(false);
            }
            
        } catch (err) {
            console.error("Failed to start quiz:", err);
            setQuizLoading(false);
        }
    }

    function fetchNextQuestion(queue = quizQueue) {
        setQuizLoading(true);
        // Take next question from queue
        // Note: queue is state, but we might pass it explicitly if it's the first call
        
        // We need to work with a copy if we are mutating, but since we are just reading from the front...
        // Actually, let's just use an index or pop. 
        // Better: store the remaining queue in state.
        
        if (queue.length === 0) {
            setCurrentQuestion(null);
            setQuizLoading(false);
            return;
        }

        const nextQ = queue[0];
        const remaining = queue.slice(1);
        
        setQuizQueue(remaining);
        setCurrentQuestion(nextQ);
        setSelectedOption(null);
        setIsSubmitted(false);
        setIsCorrect(false);
        setQuizLoading(false);
    }

    async function handleSubmit() {
        if (!selectedOption || isSubmitted) return;
        
        const correct = selectedOption === currentQuestion.answer;
        setIsCorrect(correct);
        setIsSubmitted(true);
        if (correct) setStreak(s => s + 1);
        else setStreak(0);

        // Submit result to backend
        try {
            await fetch('/submit_answer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question_id: currentQuestion.id,
                    is_correct: correct
                })
            });
        } catch (err) {
            console.error(err);
        }
    }

    if (activeModule) {
        return (
            <div className="flex flex-col h-full bg-space-black text-white p-6 relative overflow-hidden">
                {/* Background Decoration */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0"></div>
                
                {/* Header */}
                <div className="flex justify-between items-center mb-8 max-w-4xl mx-auto w-full z-10">
                    <button 
                        onClick={() => setActiveModule(null)}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                        返回概览
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                            <span className="text-sm text-gray-400">{activeModule.name}</span>
                            <div className="flex items-center gap-1 text-primary text-xs font-bold">
                                <span className="material-symbols-outlined text-sm">local_fire_department</span>
                                {streak} 连对
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quiz Content */}
                <div className="flex-1 flex flex-col items-center justify-center w-full max-w-3xl mx-auto z-10">
                    {quizLoading ? (
                        <div className="animate-pulse text-primary flex flex-col items-center gap-4">
                            <span className="material-symbols-outlined text-4xl animate-spin">cyclone</span>
                            <p>正在获取题目...</p>
                        </div>
                    ) : !currentQuestion ? (
                        <div className="text-center bg-white/5 p-8 rounded-2xl border border-white/10 max-w-md">
                            <span className="material-symbols-outlined text-6xl text-node-gold mb-4">emoji_events</span>
                            <h2 className="text-2xl font-bold mb-2">恭喜完成!</h2>
                            <p className="text-gray-400 mb-6">该模块下的所有题目你都已经掌握了。</p>
                            <button 
                                onClick={() => setActiveModule(null)}
                                className="px-6 py-2 bg-primary text-black font-bold rounded-lg hover:bg-primary/90 transition-colors"
                            >
                                返回列表
                            </button>
                        </div>
                    ) : (
                        <div className="w-full bg-[#1e3427]/50 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
                            {/* Question Type Badge */}
                            <div className="mb-6 flex justify-between items-start">
                                <span className="px-3 py-1 rounded bg-white/10 text-sm font-bold border border-white/10 text-gray-300">
                                    {currentQuestion.type}
                                </span>
                                <span className={`px-3 py-1 rounded text-xs font-bold border ${
                                    currentQuestion.difficulty === '困难' ? 'bg-red-500/20 text-red-400 border-red-500/20' :
                                    currentQuestion.difficulty === '中等' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20' :
                                    'bg-green-500/20 text-green-400 border-green-500/20'
                                }`}>
                                    {currentQuestion.difficulty || '普通'}
                                </span>
                            </div>

                            {/* Question Body */}
                            <h3 className="text-xl md:text-2xl font-bold mb-8 leading-relaxed">
                                {currentQuestion.content}
                            </h3>

                            {/* Options */}
                            <div className="space-y-3 mb-8">
                                {currentQuestion.options && currentQuestion.options.split(/[;；]/).map((opt, idx) => {
                                    const optionLabel = opt.trim().charAt(0); // Assuming "A. xxx" format
                                    const isSelected = selectedOption === optionLabel;
                                    const isCorrectAnswer = currentQuestion.answer === optionLabel;
                                    
                                    let itemClass = "w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center gap-4 ";
                                    
                                    if (isSubmitted) {
                                        if (isCorrectAnswer) {
                                            itemClass += "bg-green-500/20 border-green-500/50 text-green-100";
                                        } else if (isSelected && !isCorrectAnswer) {
                                            itemClass += "bg-red-500/20 border-red-500/50 text-red-100";
                                        } else {
                                            itemClass += "bg-black/20 border-white/5 opacity-50";
                                        }
                                    } else {
                                        if (isSelected) {
                                            itemClass += "bg-primary/20 border-primary text-white shadow-[0_0_15px_rgba(56,224,123,0.2)]";
                                        } else {
                                            itemClass += "bg-black/20 border-white/10 hover:bg-white/5 hover:border-white/20 text-gray-300";
                                        }
                                    }

                                    return (
                                        <button 
                                            key={idx}
                                            onClick={() => !isSubmitted && setSelectedOption(optionLabel)}
                                            disabled={isSubmitted}
                                            className={itemClass}
                                        >
                                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                                                isSubmitted && isCorrectAnswer ? 'bg-green-500 text-black' :
                                                isSubmitted && isSelected && !isCorrectAnswer ? 'bg-red-500 text-white' :
                                                isSelected ? 'bg-primary text-black' : 'bg-white/10'
                                            }`}>
                                                {optionLabel}
                                            </span>
                                            <span className="flex-1">{opt.trim().substring(2).trim() || opt.trim()}</span>
                                            
                                            {isSubmitted && isCorrectAnswer && <span className="material-symbols-outlined text-green-400">check_circle</span>}
                                            {isSubmitted && isSelected && !isCorrectAnswer && <span className="material-symbols-outlined text-red-400">cancel</span>}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Feedback & Actions */}
                            {isSubmitted ? (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <div className={`p-4 rounded-xl mb-6 border ${isCorrect ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`material-symbols-outlined ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                                                {isCorrect ? 'sentiment_satisfied' : 'sentiment_dissatisfied'}
                                            </span>
                                            <span className={`font-bold ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                                                {isCorrect ? '回答正确！' : '回答错误'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-300 leading-relaxed">
                                            <span className="text-gray-500 font-bold mr-2">解析:</span>
                                            {currentQuestion.analysis || "暂无解析"}
                                        </p>
                                    </div>
                                    <div className="flex justify-end">
                                        <button 
                                            onClick={() => fetchNextQuestion()}
                                            className="bg-white text-black px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors flex items-center gap-2 shadow-lg"
                                        >
                                            下一题 <span className="material-symbols-outlined">arrow_forward</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-end">
                                    <button 
                                        onClick={handleSubmit}
                                        disabled={!selectedOption}
                                        className={`px-8 py-3 rounded-xl font-bold transition-all ${
                                            selectedOption 
                                            ? 'bg-primary text-black hover:bg-primary/90 shadow-lg shadow-primary/20 scale-100' 
                                            : 'bg-white/5 text-gray-500 cursor-not-allowed scale-95'
                                        }`}
                                    >
                                        提交答案
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Dashboard View
    return (
        <div className="flex flex-col h-full bg-space-black text-white p-6 overflow-y-auto">
            <div className="max-w-6xl mx-auto w-full">
                <header className="mb-8">
                    <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-4xl">school</span>
                        学习进度
                    </h2>
                    <p className="text-gray-400">选择一个模块开始练习，提升你的知识掌握度。</p>
                </header>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <span className="material-symbols-outlined text-4xl animate-spin text-gray-600">cyclone</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {modules.map(module => {
                            const progress = module.total > 0 ? Math.round((module.mastered / module.total) * 100) : 0;
                            const isCompleted = progress === 100 && module.total > 0;
                            
                            return (
                                <div 
                                    key={module.id}
                                    className="group bg-[#0B1210] border border-white/10 rounded-2xl p-6 hover:border-primary/50 transition-all hover:shadow-[0_0_20px_rgba(56,224,123,0.1)] relative overflow-hidden"
                                >
                                    {/* Progress Bar Background */}
                                    <div className="absolute bottom-0 left-0 h-1 bg-white/5 w-full">
                                        <div 
                                            className="h-full bg-primary transition-all duration-1000 ease-out"
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    </div>

                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-white/5 rounded-xl group-hover:bg-primary/20 transition-colors">
                                            <span className={`material-symbols-outlined text-2xl ${isCompleted ? 'text-node-gold' : 'text-gray-300 group-hover:text-primary'}`}>
                                                {isCompleted ? 'emoji_events' : 'menu_book'}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold font-mono">{progress}%</div>
                                            <div className="text-xs text-gray-500">掌握度</div>
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors line-clamp-1">{module.name}</h3>
                                    <div className="flex justify-between items-center text-sm text-gray-400 mb-6">
                                        <span>{module.category || '未分类'}</span>
                                        <span>{module.mastered} / {module.total} 题</span>
                                    </div>

                                    <button 
                                        onClick={() => startQuiz(module)}
                                        disabled={module.total === 0}
                                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                                            module.total === 0 
                                            ? 'bg-white/5 text-gray-600 cursor-not-allowed' 
                                            : 'bg-white/10 hover:bg-primary hover:text-black text-white'
                                        }`}
                                    >
                                        {module.total === 0 ? '暂无题目' : isCompleted ? '再次复习' : '开始练习'}
                                        {module.total > 0 && <span className="material-symbols-outlined text-lg">arrow_forward</span>}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
