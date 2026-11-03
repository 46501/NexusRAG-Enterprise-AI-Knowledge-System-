import { useState, useMemo, useRef, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import {
  formatThreadTime,
  groupThreadsByDate,
  searchThreads,
} from '../services/threads'

const DEPT_BADGES = {
  hr: { dot: '#a78bfa', text: '#a78bfa', label: 'HR' },
  engineering: { dot: '#38bdf8', text: '#38bdf8', label: 'ENG' },
  finance: { dot: '#34d399', text: '#34d399', label: 'FIN' },
}

export default function ThreadHistorySidebar({
  isOpen,
  onClose,
  threads = [],
  activeThreadId,
  onSelectThread,
  onNewChat,
  onRenameThread,
  onDeleteThread,
  onClearAll,
  userRole = 'engineering',
}) {
  const { isDark } = useTheme()
  const [searchQuery, setSearchQuery] = useState('')
  const [editingThreadId, setEditingThreadId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const editInputRef = useRef(null)

  const dept = DEPT_BADGES[userRole] || DEPT_BADGES.engineering

  // Focus rename input on entering edit mode
  useEffect(() => {
    if (editingThreadId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingThreadId])

  // Filter threads based on search
  const filteredThreads = useMemo(() => {
    return searchThreads(threads, searchQuery)
  }, [threads, searchQuery])

  // Group threads by date
  const groupedThreads = useMemo(() => {
    return groupThreadsByDate(filteredThreads)
  }, [filteredThreads])

  function handleStartRename(e, thread) {
    e.stopPropagation()
    setEditingThreadId(thread.id)
    setEditingTitle(thread.title || 'Untitled Thread')
  }

  function handleSaveRename(e, threadId) {
    e.stopPropagation()
    const trimmed = editingTitle.trim()
    if (trimmed && onRenameThread) {
      onRenameThread(threadId, trimmed)
    }
    setEditingThreadId(null)
  }

  function handleCancelRename(e) {
    if (e) e.stopPropagation()
    setEditingThreadId(null)
  }

  function handleDeleteClick(e, threadId) {
    e.stopPropagation()
    setConfirmDeleteId(threadId)
  }

  function handleConfirmDelete(e, threadId) {
    e.stopPropagation()
    if (onDeleteThread) {
      onDeleteThread(threadId)
    }
    setConfirmDeleteId(null)
  }

  function handleCancelDelete(e) {
    e.stopPropagation()
    setConfirmDeleteId(null)
  }

  return (
    <aside
      className={`flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out select-none ${
        isOpen
          ? 'w-[280px] fixed inset-y-0 left-0 z-40 md:relative md:z-auto'
          : 'w-0 overflow-hidden opacity-0 pointer-events-none'
      }`}
      style={{
        background: isDark ? 'rgba(12, 14, 20, 0.96)' : 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRight: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
        boxShadow: isOpen
          ? isDark
            ? '12px 0 32px rgba(0,0,0,0.5)'
            : '12px 0 32px rgba(15,23,42,0.08)'
          : 'none',
      }}
    >
      {/* Sidebar Header */}
      <div
        className="p-3.5 flex items-center justify-between border-b shrink-0"
        style={{
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
          background: isDark ? 'rgba(18, 20, 28, 0.50)' : 'rgba(248, 250, 252, 0.80)',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">💾</span>
          <div>
            <h2 className="text-xs font-bold tracking-tight" style={{ color: isDark ? '#fff' : '#0f172a' }}>
              Chat Threads
            </h2>
            <p className="text-[10px] font-mono opacity-50">
              {threads.length} saved · Local
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* New Chat Button */}
          <button
            type="button"
            onClick={onNewChat}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:scale-105 cursor-pointer shadow-xs"
            style={{
              background: isDark ? 'rgba(168, 85, 247, 0.20)' : '#f3e8ff',
              color: isDark ? '#d8b4fe' : '#7e22ce',
              border: isDark ? '1px solid rgba(168, 85, 247, 0.35)' : '1px solid #d8b4fe',
            }}
            title="Start fresh conversation (⌘N)"
          >
            <span>+</span>
            <span>New</span>
            <kbd className="font-mono text-[9px] opacity-60 ml-0.5">⌘N</kbd>
          </button>

          {/* Close Sidebar (Mobile & Desktop) */}
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors cursor-pointer"
            style={{
              color: isDark ? 'rgba(255,255,255,0.45)' : '#64748b',
              background: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
            }}
            title="Collapse sidebar (⌘S)"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="p-3 border-b shrink-0" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0' }}>
        <div
          className="relative flex items-center rounded-xl overflow-hidden px-2.5 py-1.5 transition-all border"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : '#cbd5e1',
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-45 shrink-0 mr-2"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search threads & messages…"
            className="w-full text-xs bg-transparent outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
            style={{ color: isDark ? '#ffffff' : '#0f172a' }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-[10px] opacity-50 hover:opacity-100 cursor-pointer p-0.5"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Threads List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4 doc-scroll">
        {threads.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <span className="text-3xl opacity-30 block">💬</span>
            <p className="text-xs font-semibold" style={{ color: isDark ? 'rgba(255,255,255,0.60)' : '#475569' }}>
              No Saved Threads Yet
            </p>
            <p className="text-[11px] leading-relaxed" style={{ color: isDark ? 'rgba(255,255,255,0.30)' : '#94a3b8' }}>
              Your conversations are automatically saved here as you ask questions.
            </p>
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <span className="text-2xl opacity-40 block">🔍</span>
            <p className="text-xs font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.50)' : '#64748b' }}>
              No matching conversations
            </p>
            <p className="text-[10px] opacity-40">Try searching a different keyword</p>
          </div>
        ) : (
          groupedThreads.map((group) => (
            <div key={group.key} className="space-y-1">
              {/* Date Group Header */}
              <div className="px-2 pt-1 pb-1">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider opacity-45"
                  style={{ color: isDark ? '#fff' : '#475569' }}
                >
                  {group.title}
                </span>
              </div>

              {/* Thread Cards in this Group */}
              {group.items.map((thread) => {
                const isActive = thread.id === activeThreadId
                const isEditing = thread.id === editingThreadId
                const isConfirmingDelete = thread.id === confirmDeleteId
                const messageCount = thread.messages?.length || 0

                return (
                  <div
                    key={thread.id}
                    onClick={() => {
                      if (!isEditing && !isConfirmingDelete) {
                        onSelectThread(thread)
                      }
                    }}
                    className={`group relative rounded-xl p-2.5 transition-all cursor-pointer border ${
                      isActive
                        ? isDark
                          ? 'bg-purple-500/15 border-purple-500/35 shadow-xs'
                          : 'bg-purple-50 border-purple-300 shadow-xs'
                        : isDark
                        ? 'border-transparent hover:bg-white/[0.04]'
                        : 'border-transparent hover:bg-slate-100'
                    }`}
                    style={{
                      borderLeft: isActive ? `3px solid ${dept.dot}` : undefined,
                    }}
                  >
                    {isEditing ? (
                      /* Inline Rename Form */
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(e, thread.id)
                            if (e.key === 'Escape') handleCancelRename(e)
                          }}
                          className="w-full text-xs px-2 py-1 rounded bg-black/10 dark:bg-white/10 outline-none border border-purple-500"
                        />
                        <button
                          type="button"
                          onClick={(e) => handleSaveRename(e, thread.id)}
                          className="px-2 py-1 rounded bg-purple-600 text-white text-[11px] font-bold"
                          title="Save title (Enter)"
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelRename}
                          className="px-2 py-1 rounded bg-neutral-500/20 text-[11px]"
                          title="Cancel (Esc)"
                        >
                          ✕
                        </button>
                      </div>
                    ) : isConfirmingDelete ? (
                      /* Inline Delete Confirmation */
                      <div className="flex items-center justify-between gap-1 text-[11px] p-1" onClick={(e) => e.stopPropagation()}>
                        <span className="font-semibold text-rose-500">Delete thread?</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleConfirmDelete(e, thread.id)}
                            className="px-2 py-0.5 rounded bg-rose-500 text-white font-bold text-[10px]"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelDelete}
                            className="px-2 py-0.5 rounded bg-neutral-500/20 text-[10px]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Standard Thread Card View */
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <h3
                            className="text-xs font-semibold truncate leading-snug flex-1"
                            style={{
                              color: isActive
                                ? isDark ? '#ffffff' : '#0f172a'
                                : isDark ? 'rgba(255,255,255,0.80)' : '#334155',
                            }}
                            title={thread.title}
                          >
                            {thread.title || 'Untitled Thread'}
                          </h3>

                          {/* Action icons on hover */}
                          <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => handleStartRename(e, thread)}
                              className="p-1 rounded opacity-65 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                              title="Rename thread"
                            >
                              <span className="text-[10px]">✏️</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteClick(e, thread.id)}
                              className="p-1 rounded opacity-65 hover:opacity-100 hover:bg-rose-500/20 transition-colors"
                              title="Delete thread"
                            >
                              <span className="text-[10px]">🗑️</span>
                            </button>
                          </div>
                        </div>

                        {/* Search Result Snippet Highlight */}
                        {thread.matchedSnippet && (
                          <p
                            className="text-[11px] italic mt-1 line-clamp-2 px-1.5 py-0.5 rounded"
                            style={{
                              background: isDark ? 'rgba(168, 85, 247, 0.12)' : '#f3e8ff',
                              color: isDark ? '#d8b4fe' : '#7e22ce',
                            }}
                          >
                            {thread.matchedSnippet}
                          </p>
                        )}

                        {/* Metadata row */}
                        <div className="flex items-center justify-between gap-2 mt-1.5 pt-0.5 text-[10px]">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="font-medium"
                              style={{ color: isDark ? 'rgba(255,255,255,0.35)' : '#94a3b8' }}
                            >
                              {formatThreadTime(thread.updatedAt || thread.createdAt)}
                            </span>
                            <span className="opacity-30">·</span>
                            <span
                              className="font-mono opacity-60"
                              style={{ color: isDark ? '#fff' : '#000' }}
                            >
                              {messageCount} msg{messageCount === 1 ? '' : 's'}
                            </span>
                          </div>

                          {thread.focusDoc && (
                            <span
                              className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.2 rounded-full truncate max-w-[100px]"
                              style={{
                                background: isDark ? 'rgba(168, 85, 247, 0.20)' : '#f3e8ff',
                                color: isDark ? '#d8b4fe' : '#7e22ce',
                              }}
                              title={`Scoped to ${typeof thread.focusDoc === 'string' ? thread.focusDoc : thread.focusDoc.name}`}
                            >
                              🎯 {typeof thread.focusDoc === 'string' ? thread.focusDoc : thread.focusDoc.name}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>

      {/* Sidebar Footer */}
      <div
        className="p-3 border-t shrink-0 flex items-center justify-between text-[11px]"
        style={{
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
          background: isDark ? 'rgba(18, 20, 28, 0.40)' : 'rgba(248, 250, 252, 0.80)',
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: dept.dot }} />
          <span className="font-semibold uppercase tracking-wider text-[10px]" style={{ color: dept.text }}>
            {dept.label} Threads
          </span>
        </div>

        {threads.length > 0 && (
          confirmClearAll ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (onClearAll) onClearAll()
                  setConfirmClearAll(false)
                }}
                className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
              >
                Confirm?
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearAll(false)}
                className="text-[10px] opacity-60 hover:opacity-100 cursor-pointer"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClearAll(true)}
              className="text-[10px] transition-colors opacity-50 hover:opacity-100 hover:text-rose-400 cursor-pointer"
              title="Clear all saved threads for this department"
            >
              Clear All
            </button>
          )
        )}
      </div>
    </aside>
  )
}

