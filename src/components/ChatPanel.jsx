import React, { useState } from 'react';

export function ChatPanel({ 
  messages, 
  loading, 
  onSendMessage, 
  inputValue, 
  setInputValue 
}) {
  return (
    <aside className="flex flex-col w-[30%] min-w-[300px] max-w-[500px] border-r border-white/10 bg-[#15231b] relative z-20 h-full">
      {/* Breadcrumbs / Section Header */}
      <div className="px-6 py-4 border-b border-white/5 bg-background-dark/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
          <span>信息技术</span>
          <span className="material-symbols-outlined text-[12px]">chevron_right</span>
          <span>核心素养</span>
        </div>
        <h3 className="text-white text-xl font-bold leading-tight flex items-center gap-2">
          学科素养助手
          <span className="px-2 py-0.5 rounded text-xs bg-primary/20 text-primary font-medium border border-primary/20">在线</span>
        </h3>
      </div>
      
      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scrollbar-hide">
        {/* Date Separator */}
        <div className="flex justify-center">
          <span className="text-xs font-medium text-gray-500 bg-white/5 px-3 py-1 rounded-full">今天</span>
        </div>

        {/* Static Intro Message */}
        {messages.length === 0 && (
          <div className="flex items-end gap-3">
            <div 
              className="bg-center bg-no-repeat aspect-square bg-cover rounded-full w-10 h-10 shrink-0 border border-primary/30 shadow-[0_0_10px_rgba(56,224,123,0.2)]" 
              style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCxeZdTSqs32r_V4LGi_0SbulJNugMM0R2Hn0sQPQwlABHYQDgOf9P9ONu78LbbiP_JDFeuwm7IYGTlmuxrNJnDgWGewAhE5n54VfN0ta5FdixGUPvTnl5osXtv8ahEnQuSLJuztCDRFjUUB2KmeFJCHSRSBB9vboPgsDPMxP-scONVTayOyAgtDyR_SYmrAMjga0V0AaG16BUTdbo1v-qOiS5Qvtkwoy2dntj5aSLX6MNqoCqXTaf2CK7Nx-b-9egBSZKb0-Xkxw")'}}
            ></div>
            <div className="flex flex-col gap-1 items-start max-w-[85%]">
              <div className="flex items-center gap-2">
                <span className="text-primary text-xs font-semibold">Nova AI</span>
                <span className="text-gray-500 text-[10px]">系统消息</span>
              </div>
              <div className="p-4 rounded-2xl rounded-tl-none bg-[#1e3427] border border-white/5 text-gray-100 shadow-sm">
                <p className="leading-relaxed">
                  你好！我是你的信息技术学科助手。
                </p>
                <p className="mt-2 leading-relaxed">
                  我们可以一起探讨 <strong className="text-node-gold">信息意识</strong>、<strong className="text-node-gold">计算思维</strong>、<strong className="text-node-gold">数字化学习与创新</strong> 以及 <strong className="text-node-gold">信息社会责任</strong> 等核心素养话题。
                </p>
                <p className="mt-2 text-sm text-gray-400">
                  试着问我："什么是计算思维？" 或 "如何培养数字化学习能力？"
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Messages */}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex items-end gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div 
              className={`bg-center bg-no-repeat aspect-square bg-cover rounded-full w-10 h-10 shrink-0 border ${msg.role === 'user' ? 'border-white/10' : 'border-primary/30 shadow-[0_0_10px_rgba(56,224,123,0.2)]'}`}
              style={{
                backgroundImage: msg.role === 'user' 
                  ? 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDQ7rc1M_VkH_jMcYhUdDqhdRBnzbsz7OMVXfe9JgO8EabEbFB6dB3NpTzayCwR9ehOsUyokpjJO-4p1Z9lZJrKqGcveN11Ag6X6N53oXZAeDL50FvB9U2-ZLddS3yIk61m7tNiOSZvdh_2lWhkWKg5eE97g0LRru4IXSdNi1ZRBc9LziFLKAmizzgklGCVUi9jS7HuXPRWg-wfEbVfQhvrqIL9DDH8f58o5w05xZmNzneBoDv3a5fFFiOmnFXUScweZ-oWO4b7iA")'
                  : 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCxeZdTSqs32r_V4LGi_0SbulJNugMM0R2Hn0sQPQwlABHYQDgOf9P9ONu78LbbiP_JDFeuwm7IYGTlmuxrNJnDgWGewAhE5n54VfN0ta5FdixGUPvTnl5osXtv8ahEnQuSLJuztCDRFjUUB2KmeFJCHSRSBB9vboPgsDPMxP-scONVTayOyAgtDyR_SYmrAMjga0V0AaG16BUTdbo1v-qOiS5Qvtkwoy2dntj5aSLX6MNqoCqXTaf2CK7Nx-b-9egBSZKb0-Xkxw")'
              }}
            ></div>
            <div className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[85%]`}>
              <div className={`p-4 rounded-2xl border text-gray-100 shadow-sm ${msg.role === 'user' ? 'bg-[#2a4a3b] border-white/10 rounded-tr-none' : 'bg-[#1e3427] border-white/5 rounded-tl-none'}`}>
                <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex items-end gap-3">
             <div 
              className="bg-center bg-no-repeat aspect-square bg-cover rounded-full w-10 h-10 shrink-0 border border-primary/30 shadow-[0_0_10px_rgba(56,224,123,0.2)]" 
              style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCxeZdTSqs32r_V4LGi_0SbulJNugMM0R2Hn0sQPQwlABHYQDgOf9P9ONu78LbbiP_JDFeuwm7IYGTlmuxrNJnDgWGewAhE5n54VfN0ta5FdixGUPvTnl5osXtv8ahEnQuSLJuztCDRFjUUB2KmeFJCHSRSBB9vboPgsDPMxP-scONVTayOyAgtDyR_SYmrAMjga0V0AaG16BUTdbo1v-qOiS5Qvtkwoy2dntj5aSLX6MNqoCqXTaf2CK7Nx-b-9egBSZKb0-Xkxw")'}}
            ></div>
            <div className="flex flex-col gap-1 items-start">
               <div className="p-4 rounded-2xl rounded-tl-none bg-[#1e3427] border border-white/5 text-gray-100 shadow-sm">
                 <div className="flex gap-1">
                   <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce"></span>
                   <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce delay-75"></span>
                   <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce delay-150"></span>
                 </div>
               </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/5 bg-background-dark/80 backdrop-blur-md shrink-0">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            if(inputValue.trim()) onSendMessage(inputValue);
          }}
          className="relative"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="输入问题，探索信息技术核心素养..."
            className="w-full bg-[#0B1210] border border-white/10 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
          />
          <button 
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
