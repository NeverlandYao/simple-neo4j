import React from 'react';

export function Header({ databases, currentDb, onDbChange, viewMode, onViewChange }) {
  return (
    <header className="flex items-center justify-between whitespace-nowrap border-b border-white/10 bg-background-dark px-6 py-3 shrink-0 z-50">
      <div className="flex items-center gap-4 text-white">
        <div className="size-8 flex items-center justify-center bg-primary/20 rounded-lg text-primary">
          <span className="material-symbols-outlined">hub</span>
        </div>
        <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">知识图谱</h2>
        
        {/* Database Selector */}
        <div className="ml-4 flex items-center gap-2">
            <span className="text-xs text-gray-500">数据库:</span>
            <select 
                value={currentDb} 
                onChange={(e) => onDbChange(e.target.value)}
                className="bg-[#0B1210] border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-primary"
            >
                {databases.map(db => (
                    <option key={db} value={db}>{db}</option>
                ))}
            </select>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-400">
          <button 
            onClick={() => onViewChange('graph')}
            className={`transition-colors ${viewMode === 'graph' ? 'text-primary font-bold' : 'hover:text-primary'}`}
          >
            图谱视图
          </button>
          <button 
            onClick={() => onViewChange('knowledge')}
            className={`transition-colors ${viewMode === 'knowledge' ? 'text-primary font-bold' : 'hover:text-primary'}`}
          >
            知识库管理
          </button>
          <button 
            onClick={() => onViewChange('progress')}
            className={`transition-colors ${viewMode === 'progress' ? 'text-primary font-bold' : 'hover:text-primary'}`}
          >
            学习进度
          </button>
        </nav>
        <div className="h-6 w-px bg-white/10 mx-2"></div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-white leading-none">Yao</p>
            <p className="text-xs text-primary mt-1">Level 12</p>
          </div>
          <div 
            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border-2 border-white/10" 
            style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDQ7rc1M_VkH_jMcYhUdDqhdRBnzbsz7OMVXfe9JgO8EabEbFB6dB3NpTzayCwR9ehOsUyokpjJO-4p1Z9lZJrKqGcveN11Ag6X6N53oXZAeDL50FvB9U2-ZLddS3yIk61m7tNiOSZvdh_2lWhkWKg5eE97g0LRru4IXSdNi1ZRBc9LziFLKAmizzgklGCVUi9jS7HuXPRWg-wfEbVfQhvrqIL9DDH8f58o5w05xZmNzneBoDv3a5fFFiOmnFXUScweZ-oWO4b7iA")'}}
          >
          </div>
        </div>
      </div>
    </header>
  );
}
