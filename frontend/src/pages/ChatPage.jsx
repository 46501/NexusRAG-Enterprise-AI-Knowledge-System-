import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useQuery } from '../hooks/useQuery'
import MessageBubble from '../components/MessageBubble'
import ThinkingIndicator from '../components/ThinkingIndicator'
import Chat from '../components/Chat'
import BackHomeButton from '../components/BackHomeButton'
import UserProfileMenu from '../components/UserProfileMenu'
import CitationDrawer from '../components/CitationDrawer'
import ExportModal from '../components/ExportModal'
import CommandPalette from '../components/CommandPalette'
import DocumentReaderModal from '../components/DocumentReaderModal'
import DocumentUploadModal from '../components/DocumentUploadModal'
import DocumentComparisonModal from '../components/DocumentComparisonModal'
import WorkspaceEmptyState from '../components/WorkspaceEmptyState'
import ThreadHistorySidebar from '../components/ThreadHistorySidebar'
import {
  getThreads,
  saveThread,
  deleteThread,
  clearAllThreads,
  getActiveThreadId,
  setActiveThreadId,
  generateThreadTitle,
} from '../services/threads'
import api from '../services/api'

const DEPT = {
  hr: { dot: '#a78bfa', text: '#a78bfa', bg: 'rgba(139,92,246,0.10)', btn: '#7c3aed' },
  engineering: { dot: '#38bdf8', text: '#38bdf8', bg: 'rgba(14,165,233,0.10)', btn: '#0284c7' },
  finance: { dot: '#34d399', text: '#34d399', bg: 'rgba(16,185,129,0.10)', btn: '#059669' },
}

const DEPT_NAMES = {
  hr: 'Human Resources',
  engineering: 'Engineering',
  finance: 'Finance',
}

const SUGGESTIONS = {
  hr: ['What is the vacation and PTO policy?', 'How does the performance review process work?', 'What health benefits are available?'],
  engineering: ['What is the deployment and release process?', 'How are production incidents handled?', 'What are the API design and versioning standards?'],
  finance: ['What is the expense reimbursement policy?', 'When are quarterly budget reviews scheduled?', 'What does the external audit process look like?'],
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ChatPage() {
  const { user, logout } = useAuth()
  const { isDark } = useTheme()
  const { messages, thinking, sendQuery, clearMessages, setMessages } = useQuery()
  const bottomRef = useRef(null)
  const messagesRef = useRef(null)
  const [docsOpen, setDocsOpen] = useState(false)
  const [docs, setDocs] = useState([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [activeCitation, setActiveCitation] = useState({ isOpen: false, index: 1, sources: [] })
  const [exportOpen, setExportOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [focusDoc, setFocusDoc] = useState(null)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [droppedFile, setDroppedFile] = useState(null)
  const [windowDragging, setWindowDragging] = useState(false)
  const [threadsSidebarOpen, setThreadsSidebarOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1280)
  const [threads, setThreads] = useState([])
  const [activeThreadId, setActiveThreadIdState] = useState(() => getActiveThreadId(user?.id, user?.role))
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false)
  const [comparisonDocs, setComparisonDocs] = useState({ docA: null, docB: null })
  const [readerState, setReaderState] = useState({
    isOpen: false,
    docIdOrName: null,
    chunkIndex: null,
    chunkId: null,
    snippet: '',
  })
  const [docSearchQuery, setDocSearchQuery] = useState('')
  const [docTypeFilter, setDocTypeFilter] = useState('all') // 'all' | 'pdf' | 'txt' | 'md'
  const [docSortOrder, setDocSortOrder] = useState('recent') // 'recent' | 'alpha'
  const docSearchInputRef = useRef(null)

  // Document counts by file extension
  const docCounts = useMemo(() => {
    let pdf = 0, txt = 0, md = 0
    docs.forEach((doc) => {
      const lower = (doc.name || '').toLowerCase()
      if (lower.endsWith('.pdf')) pdf++
      else if (lower.endsWith('.md')) md++
      else if (lower.endsWith('.txt')) txt++
    })
    return { all: docs.length, pdf, txt, md }
  }, [docs])

  // Filtered and sorted documents (0 CPU lag via memoization)
  const filteredDocs = useMemo(() => {
    let result = [...docs]

    // 1. Filter by file type
    if (docTypeFilter !== 'all') {
      const ext = `.${docTypeFilter}`
      result = result.filter((d) => (d.name || '').toLowerCase().endsWith(ext))
    }

    // 2. Filter by search query
    const q = docSearchQuery.trim().toLowerCase()
    if (q) {
      result = result.filter((d) => (d.name || '').toLowerCase().includes(q))
    }

    // 3. Sort
    if (docSortOrder === 'alpha') {
      result.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    } else {
      // Default: recent (newest upload first)
      result.sort((a, b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0))
    }

    return result
  }, [docs, docTypeFilter, docSearchQuery, docSortOrder])

  function handleOpenComparison(initialA = null, initialB = null) {
    setComparisonDocs({ docA: initialA, docB: initialB })
    setComparisonModalOpen(true)
  }

  function handleOpenDocumentReader({ docIdOrName, chunkIndex = null, chunkId = null, snippet = '' }) {
    setReaderState({
      isOpen: true,
      docIdOrName,
      chunkIndex,
      chunkId,
      snippet,
    })
  }

  const d = DEPT[user?.role]
  const suggestions = SUGGESTIONS[user?.role] ?? []

  function fetchDocs() {
    setDocsLoading(true)
    api.get('/documents')
      .then((res) => setDocs(res.data.documents ?? []))
      .catch(() => setDocs([]))
      .finally(() => setDocsLoading(false))
  }

  useEffect(() => {
    fetchDocs()
  }, [])

  // Full-window drag & drop listener
  useEffect(() => {
    let dragCounter = 0
    function handleDragEnter(e) {
      e.preventDefault()
      dragCounter++
      if (e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes('Files')) {
        setWindowDragging(true)
      }
    }
    function handleDragLeave(e) {
      e.preventDefault()
      dragCounter--
      if (dragCounter <= 0) {
        dragCounter = 0
        setWindowDragging(false)
      }
    }
    function handleDragOver(e) {
      e.preventDefault()
    }
    function handleDrop(e) {
      e.preventDefault()
      dragCounter = 0
      setWindowDragging(false)
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        setDroppedFile(e.dataTransfer.files[0])
        setUploadModalOpen(true)
      }
    }
    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('drop', handleDrop)
    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('drop', handleDrop)
    }
  }, [])

  // Load threads on initial mount or when user role changes
  useEffect(() => {
    if (!user?.id) return
    const loaded = getThreads(user.id, user.role)
    setThreads(loaded)

    const savedId = getActiveThreadId(user.id, user.role)
    if (savedId) {
      const existing = loaded.find((t) => t.id === savedId)
      if (existing && existing.messages?.length > 0) {
        setActiveThreadIdState(existing.id)
        setMessages(existing.messages)
        if (existing.focusDoc) {
          setFocusDoc(existing.focusDoc)
        }
      } else {
        setActiveThreadIdState(null)
      }
    }
  }, [user?.id, user?.role])

  // Sync active thread when conversation messages update
  useEffect(() => {
    if (!user?.id || messages.length === 0) return

    const lastMsg = messages[messages.length - 1]
    const isStreaming = lastMsg?.streaming || thinking

    // When the first user message is sent, immediately create the thread so it shows up in sidebar
    if (messages.length === 1 && messages[0].role === 'user' && !activeThreadId) {
      const newId = `thread_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      const title = generateThreadTitle(messages[0].content)
      const newThread = {
        id: newId,
        userId: user.id,
        department: user.role,
        title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages,
        focusDoc,
      }
      setActiveThreadIdState(newId)
      setActiveThreadId(user.id, user.role, newId)
      saveThread(user.id, user.role, newThread)
      setThreads(getThreads(user.id, user.role))
      return
    }

    // Do not write intermediate SSE tokens on every render
    if (isStreaming) return

    // Normal finished turn - update thread in storage
    let currentId = activeThreadId
    let currentTitle = 'New Conversation'

    if (!currentId) {
      currentId = `thread_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      const firstUserMsg = messages.find((m) => m.role === 'user')
      currentTitle = generateThreadTitle(firstUserMsg?.content || 'New Conversation')
      setActiveThreadIdState(currentId)
      setActiveThreadId(user.id, user.role, currentId)
    } else {
      const existing = threads.find((t) => t.id === currentId)
      currentTitle = existing?.title || generateThreadTitle(messages[0]?.content || 'New Conversation')
    }

    const threadToSave = {
      id: currentId,
      userId: user.id,
      department: user.role,
      title: currentTitle,
      messages,
      focusDoc,
      updatedAt: new Date().toISOString(),
    }

    saveThread(user.id, user.role, threadToSave)
    setThreads(getThreads(user.id, user.role))
  }, [messages, thinking, user?.id, user?.role])

  function handleSelectThread(thread) {
    if (!thread) return
    setActiveThreadIdState(thread.id)
    setActiveThreadId(user?.id, user?.role, thread.id)
    setMessages(thread.messages || [])
    setFocusDoc(thread.focusDoc || null)
    if (window.innerWidth < 768) {
      setThreadsSidebarOpen(false)
    }
  }

  function handleNewChat() {
    setActiveThreadIdState(null)
    setActiveThreadId(user?.id, user?.role, null)
    clearMessages()
    setFocusDoc(null)
    if (window.innerWidth < 768) {
      setThreadsSidebarOpen(false)
    }
  }

  function handleRenameThread(threadId, newTitle) {
    const existing = threads.find((t) => t.id === threadId)
    if (!existing) return
    const updated = { ...existing, title: newTitle, updatedAt: new Date().toISOString() }
    saveThread(user?.id, user?.role, updated)
    setThreads(getThreads(user?.id, user?.role))
  }

  function handleDeleteThread(threadId) {
    deleteThread(user?.id, user?.role, threadId)
    setThreads(getThreads(user?.id, user?.role))
    if (activeThreadId === threadId) {
      handleNewChat()
    }
  }

  function handleClearAllThreads() {
    clearAllThreads(user?.id, user?.role)
    setThreads([])
    handleNewChat()
  }

  // Global Keyboard Shortcuts (⌘K for palette, ⌘U for upload, ⌘S for threads, ⌘N for new chat)
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandPaletteOpen((prev) => !prev)
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'u') {
        e.preventDefault()
        setUploadModalOpen((prev) => !prev)
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        setThreadsSidebarOpen((prev) => !prev)
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        handleNewChat()
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault()
        setComparisonModalOpen((prev) => !prev)
      } else if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) &&
        !document.activeElement?.isContentEditable
      ) {
        e.preventDefault()
        setDocsOpen(true)
        setTimeout(() => docSearchInputRef.current?.focus(), 50)
      } else if (e.key === 'Escape' && document.activeElement === docSearchInputRef.current) {
        e.preventDefault()
        if (docSearchQuery) {
          setDocSearchQuery('')
        } else {
          docSearchInputRef.current?.blur()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [threads, activeThreadId])

  return (
    <div
      className="flex h-screen overflow-hidden transition-colors"
      style={{
        background: isDark ? '#0a0a0a' : '#f8fafc',
        color: isDark ? '#fff' : '#0f172a',
        fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif"
      }}
    >

      {/* ── LEFT: Thread History Sidebar ──────────────────── */}
      <ThreadHistorySidebar
        isOpen={threadsSidebarOpen}
        onClose={() => setThreadsSidebarOpen(false)}
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={handleSelectThread}
        onNewChat={handleNewChat}
        onRenameThread={handleRenameThread}
        onDeleteThread={handleDeleteThread}
        onClearAll={handleClearAllThreads}
        userRole={user?.role}
      />

      {/* ── CENTER: Chat column ───────────────────────────── */}
      <div
        className="flex flex-col min-w-0 overflow-hidden"
        style={{ flex: 1, borderRight: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #e2e8f0' }}
      >
        {/* Header (macOS Titlebar Style) */}
        <header
          className="flex-shrink-0 flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 z-10 transition-colors"
          style={{
            background: isDark ? 'rgba(15, 17, 26, 0.82)' : 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(16px) saturate(180%)',
            WebkitBackdropFilter: 'blur(16px) saturate(180%)',
            borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0'
          }}
        >
          <div className="flex items-center gap-3">
            {/* macOS Window Controls */}
            <div className="hidden sm:flex items-center gap-1.5 mr-1 select-none">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] border border-[#e0443e]/80 inline-block shadow-xs" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] border border-[#dea123]/80 inline-block shadow-xs" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f] border border-[#1aab29]/80 inline-block shadow-xs" />
            </div>

            {/* macOS Sidebar Toggle (Threads / History) */}
            <button
              type="button"
              onClick={() => setThreadsSidebarOpen((prev) => !prev)}
              className="p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center hover:scale-105"
              style={{
                color: threadsSidebarOpen ? (isDark ? '#d8b4fe' : '#7e22ce') : (isDark ? 'rgba(255, 255, 255, 0.65)' : '#64748b'),
                background: threadsSidebarOpen
                  ? (isDark ? 'rgba(168, 85, 247, 0.18)' : '#f3e8ff')
                  : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9'),
                border: threadsSidebarOpen
                  ? (isDark ? '1px solid rgba(168, 85, 247, 0.35)' : '1px solid #d8b4fe')
                  : (isDark ? '1px solid rgba(255, 255, 255, 0.10)' : '1px solid #cbd5e1'),
              }}
              title={`Toggle Chat Threads Sidebar (${threadsSidebarOpen ? 'Hide' : 'Show'}) (⌘S)`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>

            <BackHomeButton />
            {d && (
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: d.dot, boxShadow: `0 0 8px ${d.dot}` }}
                />
                <span className="text-sm font-semibold tracking-tight" style={{ color: isDark ? '#fff' : '#0f172a' }}>
                  {DEPT_NAMES[user?.role] ?? user?.role}
                </span>
                <span className="hidden md:inline text-[11px] font-medium opacity-40">
                  Workspace
                </span>
              </div>
            )}

            {/* Quick Command Palette Button */}
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer opacity-75 hover:opacity-100"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.10)' : '1px solid #cbd5e1',
                color: isDark ? 'rgba(255, 255, 255, 0.8)' : '#475569',
              }}
              title="Search commands, policies, and actions (⌘K / Ctrl+K)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <span>Commands</span>
              <kbd className="font-mono text-[9px] px-1 py-0.2 rounded bg-black/10 dark:bg-white/10 opacity-70">⌘K</kbd>
            </button>

            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="md:hidden text-[11px] px-2 py-1 rounded-lg font-mono font-semibold"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #cbd5e1',
                color: isDark ? 'rgba(255, 255, 255, 0.75)' : '#475569',
              }}
              title="Command Palette (⌘K)"
            >
              ⌘K
            </button>
            {messages.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer hover:opacity-100 opacity-80"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
                    border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #cbd5e1',
                    color: isDark ? 'rgba(255,255,255,0.85)' : '#334155',
                  }}
                  title="Start a fresh conversation thread (⌘N)"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  <span>New Chat</span>
                </button>

                <button
                  type="button"
                  onClick={() => setExportOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer hover:opacity-100 opacity-80"
                  style={{
                    background: isDark ? 'rgba(99,102,241,0.12)' : '#eef2ff',
                    border: isDark ? '1px solid rgba(99,102,241,0.30)' : '1px solid #c7d2fe',
                    color: isDark ? '#c7d2fe' : '#4f46e5',
                  }}
                  title="Export session as PDF, Markdown, or Slack brief (0 MB RAM)"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  <span>Export & Share</span>
                </button>
              </div>
            )}
            {/* Mobile docs toggle */}
            <button
              className="md:hidden ml-1 text-xs px-2.5 py-1.5 rounded-xl font-medium transition-all"
              style={{
                color: docsOpen ? (isDark ? '#fff' : '#0f172a') : (isDark ? 'rgba(255,255,255,0.70)' : '#475569'),
                border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #cbd5e1',
                background: docsOpen ? (isDark ? 'rgba(255,255,255,0.10)' : '#e2e8f0') : (isDark ? 'rgba(255,255,255,0.04)' : '#ffffff'),
                cursor: 'pointer'
              }}
              onClick={() => setDocsOpen((v) => !v)}
              title="Toggle Documents Panel"
            >
              📄 Docs
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
            {/* Unified Enterprise User Profile Menu */}
            <UserProfileMenu
              onOpenCommandPalette={() => setCommandPaletteOpen(true)}
              onExport={() => setExportOpen(true)}
            />
          </div>
        </header>

        {/* Messages */}
        <div ref={messagesRef} className="flex-1 overflow-y-auto px-5 pt-10 pb-6 chat-scroll">
          <div className="max-w-[700px] mx-auto flex flex-col gap-4 min-h-full">
            {messages.length === 0 ? (
              <WorkspaceEmptyState
                user={user}
                docs={docs}
                onSendPrompt={(prompt, stream, docParam) => sendQuery(prompt, stream, docParam ?? focusDoc?.name ?? focusDoc)}
                onFocusDoc={(doc) => setFocusDoc(doc)}
                onOpenComparison={() => handleOpenComparison()}
                onOpenUpload={() => setUploadModalOpen(true)}
                onOpenCommandPalette={() => setCommandPaletteOpen(true)}
              />
            ) : (
              <>
                {/* Print-Only Corporate Briefing Header */}
                <div className="hidden print-only mb-8 pb-4 border-b-2 border-slate-900">
                  <div className="flex justify-between items-start">
                    <div>
                      <h1 className="text-xl font-bold text-slate-900 tracking-tight">NexusRAG Enterprise Knowledge Briefing</h1>
                      <p className="text-xs text-slate-500 uppercase tracking-widest mt-0.5">Verified Corporate Knowledge Documentation</p>
                    </div>
                    <div className="text-right text-xs text-slate-600">
                      <p className="font-semibold text-slate-900">{DEPT_NAMES[user?.role] || user?.role} Department</p>
                      <p>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      <p className="text-[10px] text-amber-800 font-bold uppercase mt-0.5">CONFIDENTIAL // INTERNAL ONLY</p>
                    </div>
                  </div>
                </div>

                {messages.map((msg, i) => (
                  msg.role === 'assistant' && !msg.content ? null :
                    <MessageBubble
                      key={i}
                      role={msg.role}
                      content={msg.content}
                      userRole={user?.role}
                      sources={msg.sources}
                      confidenceScore={msg.confidenceScore}
                      focusDoc={msg.focusDoc}
                      streaming={msg.streaming}
                      suggestedQuestions={msg.suggestedQuestions}
                      precedingUserQuery={i > 0 && messages[i - 1]?.role === 'user' ? messages[i - 1].content : null}
                      onOpenCitation={(idx, srcList) => setActiveCitation({ isOpen: true, index: idx, sources: srcList || [] })}
                      onSelectSuggestion={(q) => sendQuery(q, true, focusDoc?.name || focusDoc)}
                      onOpenReader={handleOpenDocumentReader}
                    />
                ))}
                {thinking && (
                  <ThinkingIndicator
                    userRole={user?.role}
                    focusDoc={focusDoc}
                  />
                )}
                <div ref={bottomRef} />
              </>
            )}
          </div>
        </div>

        {/* Floating Input Area (macOS Floating Capsule Style) */}
        <div
          className="flex-shrink-0 px-4 sm:px-6 pt-2 pb-5 transition-colors relative z-10"
          style={{
            background: isDark
              ? 'linear-gradient(to top, rgba(10, 10, 10, 0.95) 0%, rgba(10, 10, 10, 0.65) 60%, transparent 100%)'
              : 'linear-gradient(to top, rgba(248, 250, 252, 0.95) 0%, rgba(248, 250, 252, 0.65) 60%, transparent 100%)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <div className="max-w-[720px] mx-auto">
            <Chat
              onSend={(q, stream, docParam) => sendQuery(q, stream, docParam ?? focusDoc?.name ?? focusDoc)}
              disabled={thinking}
              userRole={user?.role}
              focusDoc={focusDoc}
              onClearFocus={() => setFocusDoc(null)}
              documents={docs}
              threads={threads}
              onFocusDoc={(doc) => setFocusDoc(doc)}
            />
          </div>
        </div>
      </div>

      {/* ── RIGHT: Documents panel ──────────────────────── */}
      <aside
        className={`flex-col flex-shrink-0 md:w-[300px] lg:w-[310px] transition-colors ${docsOpen ? 'flex fixed inset-0 z-50 w-full md:relative md:inset-auto md:z-auto' : 'hidden md:flex'}`}
        style={{ background: isDark ? '#0f0f0f' : '#ffffff', borderLeft: isDark ? 'none' : '1px solid #e2e8f0' }}
      >
        {/* Panel header */}
        <div className="px-4 py-3.5" style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: isDark ? 'rgba(255,255,255,0.20)' : '#94a3b8' }}>
              Documents
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleOpenComparison()}
                className="text-[10px] px-2 py-0.5 rounded font-semibold transition-all hover:scale-105 cursor-pointer flex items-center gap-1 shadow-xs"
                style={{
                  background: isDark ? 'rgba(56, 189, 248, 0.18)' : '#f0f9ff',
                  color: isDark ? '#38bdf8' : '#0284c7',
                  border: isDark ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid #bae6fd',
                }}
                title="Compare documents side-by-side in a matrix (⌘M)"
              >
                <span>📊</span>
                <span>Compare</span>
              </button>
              <button
                type="button"
                onClick={() => setUploadModalOpen(true)}
                className="text-[10px] px-2 py-0.5 rounded font-semibold transition-all hover:scale-105 cursor-pointer flex items-center gap-1 shadow-xs"
                style={{
                  background: isDark ? 'rgba(168, 85, 247, 0.20)' : '#f3e8ff',
                  color: isDark ? '#d8b4fe' : '#7e22ce',
                  border: isDark ? '1px solid rgba(168, 85, 247, 0.35)' : '1px solid #d8b4fe',
                }}
                title="Upload & index new corporate file (⌘U)"
              >
                <span>+</span>
                <span>Upload</span>
              </button>
              <button
                className="md:hidden text-[11px] px-2 py-0.5 rounded"
                style={{
                  color: isDark ? 'rgba(255,255,255,0.35)' : '#475569',
                  border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #cbd5e1',
                  background: 'none',
                  cursor: 'pointer'
                }}
                onClick={() => setDocsOpen(false)}
              >
                ✕ Close
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {d && <span className="w-1.5 h-1.5 rounded-full" style={{ background: d.dot }} />}
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: d?.text }}>
              {user?.role}
            </span>
            <span className="text-[11px]" style={{ color: isDark ? 'rgba(255,255,255,0.30)' : '#64748b' }}>
              · {filteredDocs.length !== docs.length ? `${filteredDocs.length} of ${docs.length} files` : `${docs.length} files`}
            </span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div
          className="px-3 py-2 space-y-1.5 border-b select-none"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0' }}
        >
          {/* Search Input Box */}
          <div className="relative flex items-center">
            <svg
              className="absolute left-2.5 w-3.5 h-3.5 pointer-events-none opacity-40"
              style={{ color: isDark ? '#fff' : '#0f172a' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" strokeWidth="2" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              ref={docSearchInputRef}
              type="text"
              value={docSearchQuery}
              onChange={(e) => setDocSearchQuery(e.target.value)}
              placeholder="Filter files... (Press /)"
              className={`w-full text-xs pl-8 pr-7 py-1.5 rounded-lg border outline-none transition-all placeholder:text-[11px] ${isDark
                  ? 'bg-white/[0.04] border-white/10 text-white placeholder:text-white/25 focus:border-purple-400/50 focus:bg-white/[0.06]'
                  : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-purple-500/50 focus:bg-white'
                }`}
            />
            {docSearchQuery ? (
              <button
                type="button"
                onClick={() => setDocSearchQuery('')}
                className="absolute right-2 text-xs opacity-50 hover:opacity-100 cursor-pointer p-0.5"
                title="Clear search (Esc)"
              >
                ✕
              </button>
            ) : (
              <kbd className="absolute right-2 font-mono text-[9px] px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 opacity-40 pointer-events-none select-none">
                /
              </kbd>
            )}
          </div>

          {/* Type Filter Chips & Sort Toggle */}
          <div className="flex items-center justify-between gap-1">
            {/* Type Chips */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {[
                { key: 'all', label: 'All', count: docCounts.all },
                { key: 'pdf', label: 'PDF', count: docCounts.pdf },
                { key: 'txt', label: 'TXT', count: docCounts.txt },
                { key: 'md', label: 'MD', count: docCounts.md },
              ].map(({ key, label, count }) => {
                if (key !== 'all' && count === 0) return null
                const isActive = docTypeFilter === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDocTypeFilter(key)}
                    className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1 ${isActive
                        ? isDark
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-xs'
                          : 'bg-purple-100 text-purple-700 border border-purple-200 shadow-xs'
                        : isDark
                          ? 'text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent'
                      }`}
                  >
                    <span>{label}</span>
                    <span className="text-[9px] opacity-60">({count})</span>
                  </button>
                )
              })}
            </div>

            {/* Sort Toggle Button */}
            <button
              type="button"
              onClick={() => setDocSortOrder((prev) => (prev === 'recent' ? 'alpha' : 'recent'))}
              className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1 shrink-0 ${isDark
                  ? 'text-white/50 hover:text-white hover:bg-white/5 border border-white/10'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                }`}
              title={`Sort: ${docSortOrder === 'recent' ? 'Newest first (Click for A-Z)' : 'Alphabetical (Click for Newest)'}`}
            >
              <span>{docSortOrder === 'recent' ? '🕒 Recent' : '🔤 A–Z'}</span>
            </button>
          </div>
        </div>

        {/* Doc list */}
        <div className="flex-1 overflow-y-auto p-2 doc-scroll">
          {docsLoading ? (
            <div className="flex items-center gap-2 px-2 py-3">
              <div className={`w-3 h-3 rounded-full border border-t-transparent animate-spin ${isDark ? 'border-white/30 border-t-white' : 'border-slate-300 border-t-slate-700'}`} />
              <span className="text-[11px]" style={{ color: isDark ? 'rgba(255,255,255,0.25)' : '#94a3b8' }}>Loading…</span>
            </div>
          ) : docs.length === 0 ? (
            <p className="px-2 text-[11px]" style={{ color: isDark ? 'rgba(255,255,255,0.20)' : '#94a3b8' }}>No documents found.</p>
          ) : filteredDocs.length === 0 ? (
            <div className="px-3 py-8 text-center space-y-2">
              <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.50)' : '#64748b' }}>
                No files match <span className="font-semibold text-purple-400">"{docSearchQuery}"</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  setDocSearchQuery('')
                  setDocTypeFilter('all')
                }}
                className="text-[11px] font-medium text-purple-400 hover:underline cursor-pointer"
              >
                Clear filter
              </button>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {filteredDocs.map((doc) => (
                <li key={doc.id}>
                  <div
                    className={`w-full text-left p-2.5 rounded-[12px] transition-all group border ${selectedDoc === doc.id
                        ? isDark
                          ? 'bg-purple-500/15 border-purple-500/40 shadow-xs'
                          : 'bg-purple-50 border-purple-200 shadow-xs'
                        : isDark
                          ? 'border-transparent hover:bg-white/[0.04]'
                          : 'border-transparent hover:bg-slate-100'
                      }`}
                    style={{
                      borderLeft: `3px solid ${selectedDoc === doc.id ? (d?.dot ?? 'transparent') : 'transparent'}`,
                    }}
                    title={doc.name}
                  >
                    {/* Row 1: Complete Filename with icon (natural wrap, no truncation ellipsis) */}
                    <div
                      onClick={() => {
                        setSelectedDoc(doc.id)
                        handleOpenDocumentReader({ docIdOrName: doc.id })
                      }}
                      className="cursor-pointer mb-2 group/title"
                      title={`${doc.name} (Click to open in reader)`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-sm shrink-0 mt-0.5 select-none">
                          {doc.name.endsWith('.pdf') ? '📕' : doc.name.endsWith('.md') ? '📝' : '📄'}
                        </span>
                        <p
                          className="text-xs font-semibold leading-snug break-words [overflow-wrap:anywhere] transition-colors group-hover/title:text-purple-400"
                          style={{
                            color: selectedDoc === doc.id
                              ? (isDark ? '#fff' : '#0f172a')
                              : (isDark ? 'rgba(255,255,255,0.92)' : '#1e293b'),
                          }}
                        >
                          {doc.name}
                        </p>
                      </div>
                    </div>

                    {/* Row 2: Metadata (left) & Actions (right) */}
                    <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-black/5 dark:border-white/5 select-none">
                      {/* Metadata */}
                      <div className="flex items-center gap-1.5 text-[10px]" style={{ color: isDark ? 'rgba(255,255,255,0.40)' : '#64748b' }}>
                        <span className="font-mono font-medium">{doc.chunk_count} chunks</span>
                        <span className="opacity-40">·</span>
                        <span>{fmtDate(doc.uploaded_at)}</span>
                      </div>

                      {/* Action Controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setFocusDoc(focusDoc?.id === doc.id ? null : doc)
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded font-semibold transition-all cursor-pointer flex items-center gap-1 ${focusDoc?.id === doc.id
                              ? 'ring-1 shadow-xs'
                              : 'hover:scale-105 opacity-80 group-hover:opacity-100'
                            }`}
                          style={{
                            background: focusDoc?.id === doc.id
                              ? (isDark ? 'rgba(168, 85, 247, 0.25)' : '#f3e8ff')
                              : (isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'),
                            color: focusDoc?.id === doc.id
                              ? (isDark ? '#d8b4fe' : '#7e22ce')
                              : (isDark ? 'rgba(255,255,255,0.75)' : '#475569'),
                            borderColor: focusDoc?.id === doc.id
                              ? (isDark ? 'rgba(168, 85, 247, 0.45)' : '#d8b4fe')
                              : 'transparent',
                          }}
                          title={focusDoc?.id === doc.id ? "Clear focus (Search all)" : `Focus queries on ${doc.name}`}
                        >
                          <span>🎯</span>
                          <span>{focusDoc?.id === doc.id ? 'Focused' : 'Focus'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenComparison(doc, null)
                          }}
                          className="text-[10px] px-1.5 py-0.5 rounded font-semibold transition-all cursor-pointer hover:scale-105 opacity-80 group-hover:opacity-100"
                          style={{
                            background: isDark ? 'rgba(56, 189, 248, 0.18)' : '#f0f9ff',
                            color: isDark ? '#38bdf8' : '#0284c7',
                            border: isDark ? '1px solid rgba(56, 189, 248, 0.30)' : '1px solid #bae6fd',
                          }}
                          title={`Compare ${doc.name} side-by-side with another file`}
                        >
                          📊
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedDoc(doc.id)
                            handleOpenDocumentReader({ docIdOrName: doc.id })
                          }}
                          className="text-[10px] px-1.5 py-0.5 rounded font-semibold transition-all cursor-pointer hover:scale-105 opacity-80 group-hover:opacity-100"
                          style={{
                            background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                            color: isDark ? 'rgba(255,255,255,0.75)' : '#475569',
                          }}
                          title={`Open ${doc.name} in Document Reader`}
                        >
                          Read ↗
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3" style={{ borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0' }}>
          <button
            onClick={logout}
            className="text-[11px] transition-colors hover:underline"
            style={{ color: isDark ? 'rgba(255,255,255,0.25)' : '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Interactive Citation Inspector Drawer */}
      <CitationDrawer
        isOpen={activeCitation.isOpen}
        onClose={() => setActiveCitation((prev) => ({ ...prev, isOpen: false }))}
        sources={activeCitation.sources}
        activeIndex={activeCitation.index}
        onOpenDocumentReader={handleOpenDocumentReader}
      />

      {/* Corporate Export & Share Modal (0 MB RAM) */}
      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        messages={messages}
        user={user}
        department={user?.role}
      />

      {/* macOS Command Palette (⌘K / Ctrl+K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onSelectPrompt={(prompt) => sendQuery(prompt, true, focusDoc?.name || focusDoc)}
        onNewChat={handleNewChat}
        onExport={() => setExportOpen(true)}
        onToggleDocs={() => setDocsOpen((v) => !v)}
        onOpenDocument={(doc) => handleOpenDocumentReader({ docIdOrName: doc.id || doc.name })}
        onFocusDoc={(doc) => setFocusDoc(doc)}
        onOpenUpload={() => setUploadModalOpen(true)}
        onToggleThreads={() => setThreadsSidebarOpen((v) => !v)}
        onSelectThread={handleSelectThread}
        onOpenComparison={handleOpenComparison}
        user={user}
        documents={docs}
        threads={threads}
      />

      {/* In-App Document Reader with Highlighted Chunks */}
      <DocumentReaderModal
        isOpen={readerState.isOpen}
        onClose={() => setReaderState((prev) => ({ ...prev, isOpen: false }))}
        docIdOrName={readerState.docIdOrName}
        highlightChunkIndex={readerState.chunkIndex}
        highlightChunkId={readerState.chunkId}
        highlightSnippet={readerState.snippet}
        onAskQuestion={(prompt) => sendQuery(prompt, true, focusDoc?.name || focusDoc)}
        onFocusDoc={(doc) => setFocusDoc(doc)}
        onCompareDoc={(doc) => handleOpenComparison(doc, null)}
      />

      {/* Full-Window Drag & Drop Overlay */}
      {windowDragging && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-8 backdrop-blur-md pointer-events-none transition-all duration-300"
          style={{
            background: isDark ? 'rgba(10, 10, 12, 0.78)' : 'rgba(255, 255, 255, 0.82)',
          }}
        >
          <div
            className="w-full max-w-lg p-10 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center text-center shadow-2xl transition-all transform scale-105"
            style={{
              borderColor: '#a855f7',
              background: isDark ? 'rgba(168, 85, 247, 0.08)' : 'rgba(168, 85, 247, 0.05)',
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)', color: '#fff' }}
            >
              📂
            </div>
            <h3 className="text-xl font-bold mb-1" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
              Drop Corporate Document Here
            </h3>
            <p className="text-xs max-w-xs" style={{ color: isDark ? 'rgba(255,255,255,0.60)' : '#64748b' }}>
              Release file to instantly open the Ingestion Drawer with chunking & vector indexing.
            </p>
          </div>
        </div>
      )}

      {/* Drag & Drop Corporate Document Ingestion Drawer */}
      <DocumentUploadModal
        isOpen={uploadModalOpen}
        onClose={() => {
          setUploadModalOpen(false)
          setDroppedFile(null)
        }}
        user={user}
        initialFile={droppedFile}
        onUploadSuccess={() => {
          fetchDocs()
        }}
        onOpenReader={(doc) => handleOpenDocumentReader({ docIdOrName: doc.docIdOrName || doc.id || doc.filename })}
        onFocusDoc={(doc) => setFocusDoc(doc)}
      />

      {/* Side-by-Side Multi-Document Comparison Matrix Modal */}
      <DocumentComparisonModal
        isOpen={comparisonModalOpen}
        onClose={() => {
          setComparisonModalOpen(false)
          setComparisonDocs({ docA: null, docB: null })
        }}
        documents={docs}
        userRole={user?.role}
        initialDocA={comparisonDocs.docA}
        initialDocB={comparisonDocs.docB}
        onOpenDocumentReader={handleOpenDocumentReader}
        onOpenInChat={(prompt) => {
          handleNewChat()
          sendQuery(prompt, true)
        }}
      />

    </div>
  )
}
