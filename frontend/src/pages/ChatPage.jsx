import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useQuery } from '../hooks/useQuery'
import MessageBubble from '../components/MessageBubble'
import ThinkingIndicator from '../components/ThinkingIndicator'
import Chat from '../components/Chat'
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
  const { messages, thinking, sendQuery } = useQuery()
  const bottomRef = useRef(null)
  const messagesRef = useRef(null)
  const [docsOpen, setDocsOpen] = useState(false)
  const [docs, setDocs] = useState([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [selectedDoc, setSelectedDoc] = useState(null)

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
    <div className="flex h-screen overflow-hidden" style={{ background: '#0a0a0a', color: '#fff', fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>

      {/* ── LEFT: Chat column ─────────────────────────────── */}
      <div
        className="flex flex-col min-w-0 overflow-hidden"
        style={{ flex: 1, borderRight: '1px solid rgba(255,255,255,0.07)' }}
      >
        {/* Header */}
        <header
          className="flex-shrink-0 flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 z-10"
          style={{ background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-3">
            {d && (
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: d.dot, boxShadow: `0 0 6px ${d.dot}` }}
                />
                <span className="text-sm font-semibold" style={{ color: '#fff', letterSpacing: '-0.01em' }}>
                  {DEPT_NAMES[user?.role] ?? user?.role}
                </span>
              </div>
            )}
            {/* Mobile docs toggle */}
            <button
              className="md:hidden ml-2 text-xs px-3 py-1.5 rounded-lg"
              style={{ color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.12)', background: 'none', cursor: 'pointer' }}
              onClick={() => setDocsOpen((v) => !v)}
            >
              Docs
            </button>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:block text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {user?.email}
            </span>
            <button
              onClick={logout}
              className="text-[11px] transition-colors"
              style={{ color: 'rgba(255,255,255,0.30)', background: 'none', border: 'none', cursor: 'pointer' }}
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
                <h2 className="text-lg font-semibold text-white capitalize mb-1.5">
                  {user?.role} Knowledge Base
                </h2>
                <p className="text-sm max-w-xs leading-relaxed mb-7" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Ask anything about your department's documents. Every answer is grounded in your role's knowledge base and cited with sources.
                </p>
                <div className="flex flex-col gap-2 w-full max-w-[420px]">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendQuery(s, true)}
                      className="text-left px-3.5 py-2.5 rounded-xl text-sm transition-colors"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.09)',
                        color: 'rgba(255,255,255,0.55)',
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
          className="flex-shrink-0 px-5 py-3.5"
          style={{ background: 'rgba(10,10,10,0.90)', borderTop: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="max-w-[700px] mx-auto">
            <Chat onSend={sendQuery} disabled={thinking} userRole={user?.role} />
          </div>
        </div>
      </div>

      {/* ── RIGHT: Documents panel ──────────────────────── */}
      <aside
        className={`flex-col flex-shrink-0 md:w-[260px] ${docsOpen ? 'flex fixed inset-0 z-50 w-full md:relative md:inset-auto md:z-auto' : 'hidden md:flex'}`}
        style={{ background: '#0f0f0f' }}
      >
        {/* Panel header */}
        <div className="px-4 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'rgba(255,255,255,0.20)' }}>
              Documents
            </p>
            <button
              className="md:hidden text-[11px] px-2 py-0.5 rounded"
              style={{ color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.12)', background: 'none', cursor: 'pointer' }}
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
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.20)' }}>
              · {docs.length} files
            </span>
          </div>
        </div>

        {/* Doc list */}
        <div className="flex-1 overflow-y-auto p-2 doc-scroll">
          {docsLoading ? (
            <div className="flex items-center gap-2 px-2 py-3">
              <div className="w-3 h-3 rounded-full border border-white/20 border-t-white/50 animate-spin" />
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Loading…</span>
            </div>
          ) : docs.length === 0 ? (
            <p className="px-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.20)' }}>No documents found.</p>
          ) : (
            <ul className="space-y-1">
              {docs.map((doc) => (
                <li key={doc.id}>
                  <button
                    onClick={() => setSelectedDoc(selectedDoc === doc.id ? null : doc.id)}
                    className="w-full text-left px-2.5 py-2 rounded-[10px] transition-colors hover:bg-white/[0.04]"
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
                      style={{ color: selectedDoc === doc.id ? '#fff' : 'rgba(255,255,255,0.50)' }}
                    >
                      {doc.name}
                    </p>
                    <div className="flex gap-2">
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.20)' }}>
                        {doc.chunk_count} chunks
                      </span>
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>
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
        <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={logout}
            className="text-[11px] transition-colors"
            style={{ color: 'rgba(255,255,255,0.20)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Sign out
          </button>
        </div>
      </aside>

    </div>
  )
}
