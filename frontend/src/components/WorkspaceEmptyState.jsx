import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'

const DEPT_INFO = {
  hr: {
    name: 'Human Resources',
    tagline: 'Company policies, health benefits, PTO rules, and employee guidelines.',
    accent: '#a78bfa',
    bg: 'rgba(139,92,246,0.12)',
    border: 'rgba(139,92,246,0.25)',
    btn: '#7c3aed',
    categories: [
      {
        icon: '🌴',
        title: 'Leave & PTO',
        prompts: [
          'What is the parental leave policy?',
          'How many days of annual PTO do employees get?',
        ],
      },
      {
        icon: '📈',
        title: 'Reviews & Growth',
        prompts: [
          'How does the annual performance review cycle work?',
          'What health and dental benefits are available?',
        ],
      },
      {
        icon: '🛡️',
        title: 'Workplace Conduct',
        prompts: [
          'What is the remote work and equipment policy?',
          'How are employee grievances and reports escalated?',
        ],
      },
    ],
  },
  engineering: {
    name: 'Engineering',
    tagline: 'System architecture, deployment pipelines, runbooks, and incident resolution.',
    accent: '#38bdf8',
    bg: 'rgba(14,165,233,0.12)',
    border: 'rgba(14,165,233,0.25)',
    btn: '#0284c7',
    categories: [
      {
        icon: '🚀',
        title: 'CI/CD & Releases',
        prompts: [
          'What is the deployment and release pipeline?',
          'How does automated canary rollback trigger?',
        ],
      },
      {
        icon: '🚨',
        title: 'Incident Protocols',
        prompts: [
          'How are production P1 incidents handled?',
          'What are the disaster recovery and backup standards?',
        ],
      },
      {
        icon: '🏗️',
        title: 'Architecture & APIs',
        prompts: [
          'What are the API design and versioning standards?',
          'What are our zero-trust infrastructure guidelines?',
        ],
      },
    ],
  },
  finance: {
    name: 'Finance',
    tagline: 'Budget thresholds, travel expenses, vendor procurement, and audit compliance.',
    accent: '#34d399',
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.25)',
    btn: '#059669',
    categories: [
      {
        icon: '💳',
        title: 'Expenses & Travel',
        prompts: [
          'What is the expense reimbursement limit?',
          'What are the per-diem allowances for corporate travel?',
        ],
      },
      {
        icon: '📊',
        title: 'Budget & POs',
        prompts: [
          'When are quarterly budget reviews scheduled?',
          'What is the sign-off threshold for vendor purchase orders?',
        ],
      },
      {
        icon: '📑',
        title: 'Audits & Compliance',
        prompts: [
          'What does the external audit checklist require?',
          'How are quarterly tax compliance reports filed?',
        ],
      },
    ],
  },
}

export default function WorkspaceEmptyState({
  user,
  docs = [],
  onSendPrompt,
  onFocusDoc,
  onOpenComparison,
  onOpenUpload,
  onOpenCommandPalette,
}) {
  const { isDark } = useTheme()
  const role = user?.role || 'hr'
  const dept = DEPT_INFO[role] ?? {
    name: `${role} Workspace`,
    tagline: 'Verified organizational knowledge grounded with semantic citations.',
    accent: '#a78bfa',
    bg: 'rgba(139,92,246,0.12)',
    border: 'rgba(139,92,246,0.25)',
    btn: '#7c3aed',
    categories: [],
  }

  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0)

  // Compute corpus health stats
  const totalChunks = docs.reduce((acc, d) => acc + (d.chunk_count || 0), 0)
  const recentDocs = [...docs]
    .sort((a, b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0))
    .slice(0, 4)

  return (
    <div className="w-full max-w-[680px] mx-auto py-6 sm:py-8 flex flex-col items-center animate-in fade-in duration-300 select-none">
      {/* ── Top Department Hero Pill & Icon ── */}
      <div className="relative mb-3 flex items-center justify-center">
        <div
          className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform hover:scale-105"
          style={{
            background: `linear-gradient(135deg, ${dept.btn}, #1e1b4b)`,
            boxShadow: `0 8px 24px ${dept.accent}40`,
          }}
        >
          <span className="text-white text-xl sm:text-2xl font-bold uppercase tracking-wider">
            {role[0]}
          </span>
        </div>
        <span
          className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2"
          style={{
            background: '#10b981',
            borderColor: isDark ? '#0f111a' : '#ffffff',
          }}
          title="RBAC Knowledge Verified"
        />
      </div>

      {/* ── Title & Tagline ── */}
      <h2 className={`text-xl sm:text-2xl font-bold tracking-tight mb-1 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {dept.name} Knowledge Base
      </h2>
      <p
        className="text-xs sm:text-sm text-center max-w-md leading-relaxed mb-4"
        style={{ color: isDark ? 'rgba(255,255,255,0.55)' : '#64748b' }}
      >
        {dept.tagline}
      </p>

      {/* ── Knowledge Corpus Health Banner ── */}
      <div
        className="flex items-center justify-center gap-3 sm:gap-4 px-3.5 py-1.5 rounded-full border mb-6 text-[11px] font-medium backdrop-blur-md"
        style={{
          background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
          boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <span className="flex items-center gap-1.5" style={{ color: dept.accent }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: dept.accent }} />
          <span>{docs.length} Verified Files</span>
        </span>
        <span className="opacity-25">|</span>
        <span style={{ color: isDark ? 'rgba(255,255,255,0.7)' : '#475569' }}>
          {totalChunks} Chunks Indexed
        </span>
        <span className="opacity-25 hidden sm:inline">|</span>
        <span className="hidden sm:inline text-emerald-500 font-semibold">
          100% Grounded
        </span>
      </div>

      {/* ── Recent Documents Quick-Launch Chips (if docs exist) ── */}
      {recentDocs.length > 0 && (
        <div className="w-full mb-6">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-50">
              Recent Knowledge Files
            </span>
            <span className="text-[10px] opacity-40">
              Click to summarize or focus
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {recentDocs.map((doc) => {
              const icon = doc.name.endsWith('.pdf') ? '📕' : doc.name.endsWith('.md') ? '📝' : '📄'
              return (
                <div
                  key={doc.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all group ${
                    isDark
                      ? 'bg-white/[0.03] hover:bg-white/[0.06] border-white/8 hover:border-white/15'
                      : 'bg-white hover:bg-slate-50 border-slate-200/90 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className="text-sm shrink-0">{icon}</span>
                    <div className="min-w-0">
                      <p
                        className="text-xs font-semibold truncate leading-tight transition-colors group-hover:text-purple-400"
                        title={doc.name}
                      >
                        {doc.name}
                      </p>
                      <p className="text-[10px] opacity-45 font-mono">
                        {doc.chunk_count} chunks
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSendPrompt && onSendPrompt(`Summarize key policies and important points from ${doc.name}.`, true, doc.name)}
                      className="text-[10px] px-2 py-1 rounded-md font-medium transition-all cursor-pointer opacity-70 hover:opacity-100 hover:scale-105"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                        color: isDark ? 'rgba(255,255,255,0.85)' : '#334155',
                      }}
                      title={`Ask assistant to summarize ${doc.name}`}
                    >
                      Summarize
                    </button>
                    <button
                      type="button"
                      onClick={() => onFocusDoc && onFocusDoc(doc)}
                      className="text-[10px] px-1.5 py-1 rounded-md font-medium transition-all cursor-pointer opacity-70 hover:opacity-100 hover:scale-105"
                      style={{
                        background: dept.bg,
                        color: dept.accent,
                        border: `1px solid ${dept.border}`,
                      }}
                      title={`Scope queries specifically to ${doc.name}`}
                    >
                      🎯 Focus
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Categorized Prompt Starters ── */}
      {dept.categories && dept.categories.length > 0 && (
        <div className="w-full mb-6">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-50">
              Suggested Enterprise Inquiries
            </span>
            <div className="flex items-center gap-1">
              {dept.categories.map((cat, idx) => (
                <button
                  key={cat.title}
                  type="button"
                  onClick={() => setActiveCategoryIndex(idx)}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    activeCategoryIndex === idx
                      ? isDark
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        : 'bg-purple-100 text-purple-700 border border-purple-200'
                      : isDark
                      ? 'text-white/40 hover:text-white/70'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span className="hidden sm:inline">{cat.title}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {dept.categories[activeCategoryIndex]?.prompts.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSendPrompt && onSendPrompt(p, true)}
                className={`text-left p-3 rounded-xl text-xs font-medium leading-relaxed transition-all cursor-pointer flex items-start gap-2.5 group border ${
                  isDark
                    ? 'bg-white/[0.03] hover:bg-white/[0.07] border-white/8 hover:border-purple-500/40 text-white/80 hover:text-white'
                    : 'bg-white hover:bg-slate-50 border-slate-200/90 hover:border-purple-300 text-slate-700 hover:text-slate-900 shadow-xs'
                }`}
              >
                <span className="text-purple-400 group-hover:translate-x-0.5 transition-transform mt-0.5 text-xs">
                  →
                </span>
                <span className="flex-1">{p}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Keyboard Ergonomics Bar ── */}
      <div
        className="flex items-center justify-center gap-2 sm:gap-4 flex-wrap text-[10px] opacity-45 pt-1"
      >
        <span className="flex items-center gap-1">
          <kbd className="font-mono px-1 py-0.5 rounded bg-black/10 dark:bg-white/10">⌘K</kbd>
          <span>Commands</span>
        </span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <kbd className="font-mono px-1 py-0.5 rounded bg-black/10 dark:bg-white/10">/</kbd>
          <span>Filter Files</span>
        </span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <kbd className="font-mono px-1 py-0.5 rounded bg-black/10 dark:bg-white/10">⌘M</kbd>
          <span>Compare Matrix</span>
        </span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <kbd className="font-mono px-1 py-0.5 rounded bg-black/10 dark:bg-white/10">⌘U</kbd>
          <span>Ingest Document</span>
        </span>
      </div>
    </div>
  )
}

