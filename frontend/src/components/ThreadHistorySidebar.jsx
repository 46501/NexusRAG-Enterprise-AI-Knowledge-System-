import { useState, useMemo, useRef, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import {
  formatThreadTime,
  groupThreadsByDate,
  searchThreads,
} from '../services/threads'
import { PanelLeftIcon } from './SidebarToggleIcon'

const DEPT_BADGES = {
  hr: { dot: '#a78bfa', text: '#a78bfa', label: 'HR' },
  engineering: { dot: '#38bdf8', text: '#38bdf8', label: 'ENG' },
  finance: { dot: '#34d399', text: '#34d399', label: 'FIN' },
}

export function PinIcon({ pinned, size = 13 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={pinned ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: pinned ? 'rotate(-45deg)' : 'none',
        transition: 'transform 0.2s ease',
      }}
    >
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  )
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
  isExpanded: isExpandedProp,
  isPinned,
  onToggle,
  onTogglePin,
}) {
  const { isDark } = useTheme()
  const [searchQuery, setSearchQuery] = useState('')
  const [editingThreadId, setEditingThreadId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const editInputRef = useRef(null)

  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    function checkMobile() {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Explicit click-controlled state: no hover expansion or auto-collapse
  const isDesktopExpanded = isExpandedProp !== undefined ? isExpandedProp : (isPinned !== undefined ? isPinned : true)
  const isExpanded = isMobile ? isOpen : isDesktopExpanded

  function handleToggle(e) {
    if (e) e.stopPropagation()
    const fn = onToggle || onTogglePin
    if (fn) {
      fn()
    }
  }

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
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      <aside
        className={`flex flex-col flex-shrink-0 transition-[width] duration-200 ease-in-out select-none overflow-hidden ${
          isMobile
            ? isOpen
              ? 'fixed inset-y-0 left-0 z-50 w-[280px] shadow-2xl'
              : 'w-0 overflow-hidden opacity-0 pointer-events-none hidden'
            : isExpanded
              ? 'w-[280px] relative z-20'
              : 'w-[60px] relative z-20'
        }`}
        style={{
          background: isDark ? 'rgba(12, 14, 20, 0.96)' : 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRight: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
          boxShadow: isMobile && isOpen
            ? (isDark ? '12px 0 32px rgba(0,0,0,0.6)' : '12px 0 32px rgba(15,23,42,0.12)')
            : 'none',
        }}
      >
        {!isExpanded && !isMobile ? (
          /* ── COLLAPSED VIEW (60px) ────────────────────────── */
          <div className="flex flex-col items-center h-full w-[60px] py-3 justify-between select-none">
            {/* Top Navigation & Actions */}
            <div className="flex flex-col items-center gap-2.5 w-full px-2">
              {/* Expand / Toggle Button */}
              <button
                type="button"
                onClick={handleToggle}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all hover:scale-105 cursor-pointer shadow-xs"
                style={{
                  color: isDark ? '#d8b4fe' : '#7e22ce',
                  background: isDark ? 'rgba(168, 85, 247, 0.15)' : '#f3e8ff',
                  border: isDark ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid #d8b4fe',
                }}
                title="Expand Chat Threads (⌘S)"
              >
                <PanelLeftIcon isOpen={false} size={17} />
              </button>

              {/* New Chat Button */}
              <button
                type="button"
                onClick={onNewChat}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all hover:scale-105 cursor-pointer shadow-xs"
                style={{
                  background: isDark ? 'rgba(168, 85, 247, 0.20)' : '#f3e8ff',
                  color: isDark ? '#d8b4fe' : '#7e22ce',
                  border: isDark ? '1px solid rgba(168, 85, 247, 0.35)' : '1px solid #d8b4fe',
                }}
                title="Start fresh conversation (⌘N)"
              >
                +
              </button>

              {/* Search Trigger Button */}
              <button
                type="button"
                onClick={handleToggle}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer opacity-70 hover:opacity-100 hover:scale-105"
                style={{
                  color: isDark ? '#fff' : '#0f172a',
                  background: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                }}
                title="Search threads (Click to expand)"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </button>

              <div className="w-6 h-[1px] my-1" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }} />

              {/* Collapsed Thread Item Icons */}
              <div className="flex flex-col items-center gap-1.5 w-full overflow-y-auto max-h-[calc(100vh-270px)] doc-scroll px-1">
                {threads.slice(0, 15).map((t) => {
                  const isActive = t.id === activeThreadId
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onSelectThread(t.id)}
                      className="w-9 h-9 rounded-xl flex flex-col items-center justify-center text-xs transition-all hover:scale-105 cursor-pointer relative group shrink-0"
                      style={{
                        background: isActive
                          ? (isDark ? 'rgba(168, 85, 247, 0.25)' : '#f3e8ff')
                          : (isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc'),
                        border: isActive
                          ? (isDark ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid #c084fc')
                          : (isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0'),
                        color: isActive ? (isDark ? '#d8b4fe' : '#7e22ce') : (isDark ? 'rgba(255,255,255,0.7)' : '#475569'),
                      }}
                      title={`${t.title || 'Untitled Thread'} (${t.messages?.length || 0} msgs) · Click to switch`}
                    >
                      <span className="text-xs">💬</span>
                      {t.messages?.length > 0 && (
                        <span className="text-[8px] font-mono opacity-60 leading-none mt-0.5">
                          {t.messages.length}
                        </span>
                      )}
                      {isActive && (
                        <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-4 rounded-r bg-purple-500" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Bottom Department Dot */}
            <div className="pt-2 border-t w-full flex justify-center" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}>
              <span
                className="w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold"
                style={{ background: dept.dot, color: '#000' }}
                title={`${dept.label} Workspace (${threads.length} threads)`}
              />
            </div>
          </div>
        ) : (
          /* ── EXPANDED VIEW (280px) ────────────────────────── */
          <div className="flex flex-col h-full w-[280px] shrink-0">
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

                {/* Close / Collapse Sidebar */}
                <button
                  type="button"
                  onClick={() => {
                    if (isMobile) {
                      onClose()
                    } else {
                      handleToggle()
                    }
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors cursor-pointer hover:opacity-100 opacity-70"
                  style={{
                    color: isDark ? '#fff' : '#0f172a',
                    background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #cbd5e1',
                  }}
                  title={isMobile ? "Close drawer" : "Collapse sidebar (⌘S)"}
                >
                  {isMobile ? '✕' : <PanelLeftIcon isOpen={true} size={14} />}
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
                    className="text-xs opacity-50 hover:opacity-100 ml-1 cursor-pointer"
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Threads List Container */}
            <div className="flex-1 overflow-y-auto p-2 space-y-4 doc-scroll">
              {filteredThreads.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <p className="text-xs font-medium opacity-50 mb-1">
                    {searchQuery ? 'No matching threads found' : 'No conversation threads yet'}
                  </p>
                  <p className="text-[10px] opacity-40">
                    {searchQuery ? 'Try a different keyword' : 'Send a message to create your first thread'}
                  </p>
                </div>
              ) : (
                groupedThreads.map((group) => {
                  const threadItems = group.items || group.threads || []
                  return (
                    <div key={group.key || group.title || group.label} className="space-y-1">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider opacity-40">
                        {group.title || group.label}
                      </div>

                      {threadItems.map((thread) => {
                      const isActive = thread.id === activeThreadId
                      const isEditing = editingThreadId === thread.id
                      const isConfirmingDelete = confirmDeleteId === thread.id

                      return (
                        <div
                          key={thread.id}
                          onClick={() => onSelectThread(thread.id)}
                          className={`group relative flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer transition-all border ${
                            isActive
                              ? isDark
                                ? 'bg-purple-500/15 border-purple-500/35 text-white shadow-xs'
                                : 'bg-purple-50 border-purple-200 text-purple-950 shadow-xs'
                              : isDark
                                ? 'border-transparent text-neutral-300 hover:bg-white/[0.04]'
                                : 'border-transparent text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {/* Thread Title or Inline Edit Input */}
                          {isEditing ? (
                            <div className="flex items-center gap-1.5 w-full" onClick={(e) => e.stopPropagation()}>
                              <input
                                ref={editInputRef}
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRename(e, thread.id)
                                  if (e.key === 'Escape') handleCancelRename(e)
                                }}
                                className="w-full text-xs px-2 py-1 rounded bg-black/20 dark:bg-black/40 border border-purple-400 outline-none"
                              />
                              <button
                                type="button"
                                onClick={(e) => handleSaveRename(e, thread.id)}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-purple-600 text-white font-medium"
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelRename}
                                className="text-[10px] px-1.5 py-0.5 rounded opacity-60 hover:opacity-100"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-col min-w-0 pr-2">
                                <span className="font-medium truncate leading-snug">
                                  {thread.title || 'Untitled Thread'}
                                </span>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] opacity-45">
                                  <span>{formatThreadTime(thread.updatedAt || thread.createdAt)}</span>
                                  {thread.messages?.length > 0 && (
                                    <>
                                      <span>·</span>
                                      <span>{thread.messages.length} msgs</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Hover Action Controls */}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                {isConfirmingDelete ? (
                                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={(e) => handleConfirmDelete(e, thread.id)}
                                      className="text-[10px] font-bold text-rose-500 hover:underline px-1"
                                      title="Confirm delete"
                                    >
                                      Delete?
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleCancelDelete}
                                      className="text-[10px] opacity-60 hover:opacity-100 px-1"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => handleStartRename(e, thread)}
                                      className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100"
                                      title="Rename thread"
                                    >
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => handleDeleteClick(e, thread.id)}
                                      className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100 text-rose-400"
                                      title="Delete thread"
                                    >
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                      </svg>
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })
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
          </div>
        )}
      </aside>
    </>
  )
}
