import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useQuery } from '../hooks/useQuery'
import MessageBubble from '../components/MessageBubble'
import ThinkingIndicator from '../components/ThinkingIndicator'
import Chat from '../components/Chat'
import BackHomeButton from '../components/BackHomeButton'
import ThemeToggle from '../components/ThemeToggle'
import CitationDrawer from '../components/CitationDrawer'
import api from '../services/api'

const DEPT = {
  hr:          { dot: '#a78bfa', text: '#a78bfa', bg: 'rgba(139,92,246,0.10)', btn: '#7c3aed' },
  engineering: { dot: '#38bdf8', text: '#38bdf8', bg: 'rgba(14,165,233,0.10)',  btn: '#0284c7' },
  finance:     { dot: '#34d399', text: '#34d399', bg: 'rgba(16,185,129,0.10)',  btn: '#059669' },
}

const DEPT_NAMES = {
  hr: 'Human Resources',
  engineering: 'Engineering',
  finance: 'Finance',
}

const SUGGESTIONS = {
  hr:          ['What is the vacation and PTO policy?', 'How does the performance review process work?', 'What health benefits are available?'],
  engineering: ['What is the deployment and release process?', 'How are production incidents handled?', 'What are the API design and versioning standards?'],
  finance:     ['What is the expense reimbursement policy?', 'When are quarterly budget reviews scheduled?', 'What does the external audit process look like?'],
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ChatPage() {
  const { user, logout } = useAuth()
  const { isDark } = useTheme()
  const { messages, thinking, sendQuery, clearMessages } = useQuery()
  const bottomRef = useRef(null)
  const messagesRef = useRef(null)
  const [docsOpen, setDocsOpen] = useState(false)
  const [docs, setDocs] = useState([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [activeCitation, setActiveCitation] = useState({ isOpen: false, index: 1, sources: [] })

  const d = DEPT[user?.role]
  const suggestions = SUGGESTIONS[user?.role] ?? []

  useEffect(() => {
    const el = messagesRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 180
    if (nearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, thinking])

  useEffect(() => {
    api.get('/documents')
      .then((res) => setDocs(res.data.documents ?? []))
      .catch(() => setDocs([]))
      .finally(() => setDocsLoading(false))
  }, [])

  return (
    <div
      className="flex h-screen overflow-hidden transition-colors"
      style={{
        background: isDark ? '#0a0a0a' : '#f8fafc',
        color: isDark ? '#fff' : '#0f172a',
        fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif"
      }}
    >

      {/* ── LEFT: Chat column ─────────────────────────────── */}
      <div
        className="flex flex-col min-w-0 overflow-hidden"
        style={{ flex: 1, borderRight: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #e2e8f0' }}
      >
        {/* Header */}
        <header
          className="flex-shrink-0 flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 z-10 transition-colors"
          style={{
            background: isDark ? 'rgba(10,10,10,0.85)' : 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(8px)',
            borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #e2e8f0'
          }}
        >
          <div className="flex items-center gap-3">
            <BackHomeButton />
            {d && (
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: d.dot, boxShadow: `0 0 6px ${d.dot}` }}
                />
                <span className="text-sm font-semibold" style={{ color: isDark ? '#fff' : '#0f172a', letterSpacing: '-0.01em' }}>
                  {DEPT_NAMES[user?.role] ?? user?.role}
                </span>
              </div>
            )}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearMessages}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer hover:opacity-100 opacity-80"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
                  border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #cbd5e1',
                  color: isDark ? 'rgba(255,255,255,0.85)' : '#334155',
                }}
                title="Start a fresh conversation thread"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>New Chat</span>
              </button>
            )}
            {/* Mobile docs toggle */}
            <button
              className="md:hidden ml-2 text-xs px-3 py-1.5 rounded-lg"
              style={{
                color: isDark ? 'rgba(255,255,255,0.45)' : '#475569',
                border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #cbd5e1',
                background: 'none',
                cursor: 'pointer'
              }}
              onClick={() => setDocsOpen((v) => !v)}
            >
              Docs
            </button>
          </div>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="hidden sm:block text-[11px]" style={{ color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.45)' }}>
              {user?.email}
            </span>
            {d && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  background: isDark ? d.bg : d.bg.replace('0.10', '0.12'),
                  color: d.dot,
                  border: `1px solid ${d.dot}40`,
                }}
              >
                {user?.role}
              </span>
            )}
            {/* ThemeToggle placed directly between department badge and Sign Out button */}
            <ThemeToggle />
            <button
              onClick={logout}
              className="text-[11px] transition-colors"
              style={{
                color: isDark ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.55)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Messages */}
        <div ref={messagesRef} className="flex-1 overflow-y-auto px-5 pt-10 pb-6 chat-scroll">
          <div className="max-w-[700px] mx-auto flex flex-col gap-4 min-h-full">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[55vh] text-center">
                {d && (
                  <div
                    className="w-11 h-11 rounded-[14px] flex items-center justify-center mb-3.5"
                    style={{ background: d.btn, boxShadow: `0 0 0 1px ${d.bg.replace('0.10', '0.20')}, 0 4px 20px ${d.bg}` }}
                  >
                    <span className="text-white text-base font-bold uppercase">{user?.role?.[0]}</span>
                  </div>
                )}
                <h2 className={`text-lg font-semibold capitalize mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {user?.role} Knowledge Base
                </h2>
                <p className="text-sm max-w-xs leading-relaxed mb-7" style={{ color: isDark ? 'rgba(255,255,255,0.35)' : '#64748b' }}>
                  Ask anything about your department's documents. Every answer is grounded in your role's knowledge base and cited with sources.
                </p>
                <div className="flex flex-col gap-2 w-full max-w-[420px]">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendQuery(s, true)}
                      className="text-left px-3.5 py-2.5 rounded-xl text-sm transition-colors hover:border-violet-500/50"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                        border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid #e2e8f0',
                        color: isDark ? 'rgba(255,255,255,0.65)' : '#334155',
                        boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.03)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  msg.role === 'assistant' && !msg.content ? null :
                  <MessageBubble
                    key={i}
                    role={msg.role}
                    content={msg.content}
                    userRole={user?.role}
                    sources={msg.sources}
                    streaming={msg.streaming}
                    suggestedQuestions={msg.suggestedQuestions}
                    onOpenCitation={(idx, srcList) => setActiveCitation({ isOpen: true, index: idx, sources: srcList || [] })}
                    onSelectSuggestion={(q) => sendQuery(q, true)}
                  />
                ))}
                {thinking && <ThinkingIndicator />}
                <div ref={bottomRef} />
              </>
            )}
          </div>
        </div>

        {/* Input */}
        <div
          className="flex-shrink-0 px-5 py-3.5 transition-colors"
          style={{
            background: isDark ? 'rgba(10,10,10,0.90)' : 'rgba(255,255,255,0.90)',
            borderTop: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #e2e8f0'
          }}
        >
          <div className="max-w-[700px] mx-auto">
            <Chat onSend={sendQuery} disabled={thinking} userRole={user?.role} />
          </div>
        </div>
      </div>

      {/* ── RIGHT: Documents panel ──────────────────────── */}
      <aside
        className={`flex-col flex-shrink-0 md:w-[260px] transition-colors ${docsOpen ? 'flex fixed inset-0 z-50 w-full md:relative md:inset-auto md:z-auto' : 'hidden md:flex'}`}
        style={{ background: isDark ? '#0f0f0f' : '#ffffff', borderLeft: isDark ? 'none' : '1px solid #e2e8f0' }}
      >
        {/* Panel header */}
        <div className="px-4 py-3.5" style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: isDark ? 'rgba(255,255,255,0.20)' : '#94a3b8' }}>
              Documents
            </p>
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
          <div className="flex items-center gap-1.5">
            {d && <span className="w-1.5 h-1.5 rounded-full" style={{ background: d.dot }} />}
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: d?.text }}>
              {user?.role}
            </span>
            <span className="text-[11px]" style={{ color: isDark ? 'rgba(255,255,255,0.20)' : '#94a3b8' }}>
              · {docs.length} files
            </span>
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
          ) : (
            <ul className="space-y-1">
              {docs.map((doc) => (
                <li key={doc.id}>
                  <button
                    onClick={() => setSelectedDoc(selectedDoc === doc.id ? null : doc.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-[10px] transition-colors ${
                      isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50'
                    }`}
                    style={{
                      background: selectedDoc === doc.id ? d?.bg : undefined,
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      borderLeft: `2px solid ${selectedDoc === doc.id ? (d?.dot ?? 'transparent') : 'transparent'}`,
                    }}
                  >
                    <p
                      className="text-xs font-medium truncate leading-snug mb-0.5"
                      style={{ color: selectedDoc === doc.id ? (isDark ? '#fff' : '#0f172a') : (isDark ? 'rgba(255,255,255,0.60)' : '#334155') }}
                    >
                      {doc.name}
                    </p>
                    <div className="flex gap-2">
                      <span className="text-[10px]" style={{ color: isDark ? 'rgba(255,255,255,0.25)' : '#94a3b8' }}>
                        {doc.chunk_count} chunks
                      </span>
                      <span className="text-[10px]" style={{ color: isDark ? 'rgba(255,255,255,0.20)' : '#cbd5e1' }}>
                        {fmtDate(doc.uploaded_at)}
                      </span>
                    </div>
                  </button>
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
      />

    </div>
  )
}
