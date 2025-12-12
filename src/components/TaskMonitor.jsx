import React, { useState, useEffect } from 'react';

export function TaskMonitor({ tasks, onCancelTask, onClearTask }) {
    if (tasks.length === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 w-80">
            {tasks.map(task => (
                <div 
                    key={task.id} 
                    className="bg-[#1e3427] border border-white/10 rounded-lg shadow-xl p-4 animate-in slide-in-from-right-4 duration-300 backdrop-blur-md"
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            {task.status === 'running' && <span className="material-symbols-outlined text-primary animate-spin text-sm">cyclone</span>}
                            {task.status === 'queued' && <span className="material-symbols-outlined text-gray-400 text-sm">hourglass_empty</span>}
                            {task.status === 'completed' && <span className="material-symbols-outlined text-green-400 text-sm">check_circle</span>}
                            {task.status === 'failed' && <span className="material-symbols-outlined text-red-400 text-sm">error</span>}
                            {task.status === 'cancelling' && <span className="material-symbols-outlined text-yellow-400 text-sm">cancel</span>}
                            {task.status === 'cancelled' && <span className="material-symbols-outlined text-gray-500 text-sm">block</span>}
                            <span className="font-bold text-sm text-white">文档解析任务</span>
                        </div>
                        <button 
                            onClick={() => onClearTask(task.id)} 
                            className="text-gray-500 hover:text-white"
                            title="关闭"
                        >
                            <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                    </div>
                    
                    <p className="text-xs text-gray-300 mb-2 truncate" title={task.filename}>
                        {task.filename || "未知文件"}
                    </p>
                    <p className="text-xs text-gray-400 mb-3">
                        {task.message}
                    </p>

                    {(task.status === 'running' || task.status === 'queued') && (
                        <div className="flex justify-end">
                            <button 
                                onClick={() => onCancelTask(task.id)}
                                className="text-xs bg-white/10 hover:bg-red-500/20 text-gray-300 hover:text-red-400 px-2 py-1 rounded transition-colors border border-white/5 hover:border-red-500/30"
                            >
                                取消任务
                            </button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
