import React, { useState, useEffect } from 'react';
import { getSession } from '../utils/neo4j';

export function LearningProgress({ currentDb, sessionId }) {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeQuiz, setActiveQuiz] = useState(false); // If true, we are in Quiz mode
    
    // Quiz State
    const [quizQueue, setQuizQueue] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [quizLoading, setQuizLoading] = useState(false);
    const [selectedOption, setSelectedOption] = useState(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [streak, setStreak] = useState(0);

    useEffect(() => {
        if(currentDb && !activeQuiz) fetchQuestions();
    }, [currentDb, activeQuiz]);

    async function fetchQuestions() {
        setLoading(true);
        try {
            const { session, driver } = await getSession(currentDb);
            const res = await session.run(`
                MATCH (q:Question)
                OPTIONAL MATCH (m:Concept)<-[:TESTS]-(q)
                RETURN q, elementId(q) as id, q.user_result as result, m.name as conceptName
                ORDER BY q.created_at DESC
            `);
            
            const qs = res.records.map(r => {
                const props = r.get('q').properties;
                return {
                    ...props,
                    id: r.get('id'),
                    user_result: r.get('result'),
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

    function startPractice(question) {
        setQuizQueue([question]);
        setActiveQuiz(true);
        setStreak(0);
        nextQuestion([question]);
    }

    function nextQuestion(queue = quizQueue) {
        setQuizLoading(true);
        // If queue is empty, we are done
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
        
        // Simulate loading for effect
        setTimeout(() => setQuizLoading(false), 500);
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
                    is_correct: correct,
                    session_id: sessionId
                })
            });
        } catch (err) {
            console.error(err);
        }
    }

    if (activeQuiz) {
        return (
            <div className="flex flex-col h-full bg-space-black text-white p-6 relative overflow-hidden">
                {/* Background Decoration */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0"></div>
                
                {/* Header */}
                <div className="flex justify-between items-center mb-8 max-w-4xl mx-auto w-full z-10">
                    <button 
                        onClick={() => setActiveQuiz(false)}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                        返回列表
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 text-primary text-xs font-bold">
                            <span className="material-symbols-outlined text-sm">local_fire_department</span>
                            {streak} 连对
                        </div>
                    </div>
                </div>

                {/* Quiz Content */}
                <div className="flex-1 flex flex-col items-center justify-center w-full max-w-3xl mx-auto z-10">
                    {quizLoading ? (
                        <div className="animate-pulse text-primary flex flex-col items-center gap-4">
                            <span className="material-symbols-outlined text-4xl animate-spin">cyclone</span>
                            <p>正在加载...</p>
                        </div>
                    ) : !currentQuestion ? (
                        <div className="text-center bg-white/5 p-8 rounded-2xl border border-white/10 max-w-md">
                            <span className="material-symbols-outlined text-6xl text-node-gold mb-4">emoji_events</span>
                            <h2 className="text-2xl font-bold mb-2">练习完成!</h2>
                            <button 
                                onClick={() => setActiveQuiz(false)}
                                className="mt-6 px-6 py-2 bg-primary text-black font-bold rounded-lg hover:bg-primary/90 transition-colors"
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
                                {currentQuestion.conceptName && (
                                    <span className="px-3 py-1 rounded text-xs font-bold bg-node-gold/10 text-node-gold border border-node-gold/20">
                                        {currentQuestion.conceptName}
                                    </span>
                                )}
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
                                            className={itemClass}
                                            disabled={isSubmitted}
                                        >
                                            <span className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                                                isSubmitted && isCorrectAnswer ? 'border-green-400 text-green-400 bg-green-400/10' :
                                                isSubmitted && isSelected && !isCorrectAnswer ? 'border-red-400 text-red-400 bg-red-400/10' :
                                                isSelected ? 'border-primary text-primary bg-primary/10' :
                                                'border-gray-500 text-gray-500'
                                            } font-bold text-sm`}>
                                                {optionLabel}
                                            </span>
                                            <span className="flex-1">{opt.trim().substring(2)}</span> {/* Remove "A. " */}
                                            {isSubmitted && isCorrectAnswer && (
                                                <span className="material-symbols-outlined text-green-400">check_circle</span>
                                            )}
                                            {isSubmitted && isSelected && !isCorrectAnswer && (
                                                <span className="material-symbols-outlined text-red-400">cancel</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Analysis */}
                            {isSubmitted && (
                                <div className={`p-4 rounded-xl mb-6 border ${isCorrect ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                                    <div className="flex items-center gap-2 mb-2 font-bold">
                                        <span className="material-symbols-outlined">
                                            {isCorrect ? 'sentiment_satisfied' : 'sentiment_dissatisfied'}
                                        </span>
                                        {isCorrect ? '回答正确!' : '回答错误'}
                                    </div>
                                    <p className="text-sm text-gray-300 leading-relaxed">
                                        <span className="text-gray-500 font-bold mr-2">解析:</span>
                                        {currentQuestion.analysis || "暂无解析"}
                                    </p>
                                </div>
                            )}

                            {/* Footer Actions */}
                            <div className="flex justify-end">
                                {!isSubmitted ? (
                                    <button 
                                        onClick={handleSubmit}
                                        disabled={!selectedOption}
                                        className={`px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${
                                            selectedOption 
                                                ? 'bg-primary text-black hover:bg-primary/90 shadow-[0_0_20px_rgba(56,224,123,0.4)]' 
                                                : 'bg-white/10 text-gray-500 cursor-not-allowed'
                                        }`}
                                    >
                                        提交答案
                                        <span className="material-symbols-outlined">arrow_forward</span>
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => nextQuestion()}
                                        className="px-8 py-3 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-all flex items-center gap-2"
                                    >
                                        完成练习
                                        <span className="material-symbols-outlined">done_all</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 h-full overflow-y-auto bg-space-black">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-3xl">school</span>
                    学习进度
                </h2>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                    <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></span>
                        已掌握
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-white/10 border border-white/20"></span>
                        未掌握
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <span className="material-symbols-outlined text-4xl animate-spin text-primary">cyclone</span>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {questions.map(q => (
                        <div 
                            key={q.id}
                            className={`p-6 rounded-2xl border transition-all relative group overflow-hidden ${
                                q.user_result === 'true' 
                                    ? 'bg-[#1e3427]/50 border-green-500/30' 
                                    : 'bg-white/5 border-white/10 hover:border-primary/50'
                            }`}
                        >
                            <div className="absolute top-0 right-0 p-4">
                                {q.user_result === 'true' && (
                                    <span className="material-symbols-outlined text-green-500 text-2xl">check_circle</span>
                                )}
                            </div>
                            
                            <div className="mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-0.5 rounded text-xs bg-white/10 border border-white/10 text-gray-300">
                                        {q.type}
                                    </span>
                                    {q.conceptName && (
                                        <span className="px-2 py-0.5 rounded text-xs bg-node-gold/10 text-node-gold border border-node-gold/20">
                                            {q.conceptName}
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 min-h-[3.5rem]">{q.content}</h3>
                            </div>

                            <button 
                                onClick={() => startPractice(q)}
                                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${
                                    q.user_result === 'true'
                                        ? 'bg-white/5 text-gray-400 hover:bg-white/10'
                                        : 'bg-primary text-black hover:bg-primary/90'
                                }`}
                            >
                                <span className="material-symbols-outlined">
                                    {q.user_result === 'true' ? 'replay' : 'play_arrow'}
                                </span>
                                {q.user_result === 'true' ? '复习' : '开始练习'}
                            </button>
                        </div>
                    ))}
                    {questions.length === 0 && (
                        <div className="col-span-full text-center py-20 text-gray-500 opacity-50">
                            <span className="material-symbols-outlined text-6xl mb-4">quiz</span>
                            <p>暂无题目</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
