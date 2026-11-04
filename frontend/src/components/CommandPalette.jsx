import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'

const DEPT_PROMPTS = {
  hr: [
    { title: 'Parental Leave Policy', query: 'What is the parental leave duration and eligibility?' },
    { title: 'Performance Review Process', query: 'How does the annual performance review process work?' },
    { title: 'Health Insurance Benefits', query: 'What health, dental, and medical plans are available?' },
    { title: 'PTO & Sick Leave Accrual', query: 'What is the vacation PTO and sick leave accrual rate?' },
    { title: 'Remote Work Allowance', query: 'How do I submit an expense for remote home office equipment?' },
  ],
  engineering: [
    { title: 'Deployment & Release Pipeline', query: 'What is the production deployment and release process?' },
    { title: 'Incident Response & Runbook', query: 'How are production incidents and Sev-1 outages escalated?' },
    { title: 'API Design Standards', query: 'What are the REST API design, versioning, and auth standards?' },
    { title: 'CI/CD Review & Merge Gates', query: 'What is the pull request review criteria before merging?' },
    { title: 'Architecture Decision Records', query: 'Where are architecture decision records (ADRs) documented?' },
  ],
  finance: [
    { title: 'Travel & Meal Expense Limits', query: 'What is the daily meal and travel expense reimbursement limit?' },
    { title: 'Quarterly Budget Planning', query: 'When are quarterly budget reviews and fiscal planning scheduled?' },
    { title: 'External Audit Guidelines', query: 'What does the corporate financial audit preparation look like?' },
    { title: 'Purchasing Signing Authority', query: 'What is the purchasing and signing approval threshold by role?' },
    { title: 'Vendor Invoice Processing', query: 'What are the payment terms and vendor invoice approval rules?' },
  ],
}

const DEPT_COLORS = {
  hr: { dot: '#a78bfa', name: 'Human Resources' },
  engineering: { dot: '#38bdf8', name: 'Engineering' },
  finance: { dot: '#34d399', name: 'Finance' },
}

export default function CommandPalette({
  isOpen,
  onClose,
  onSelectPrompt,
  onNewChat,
  onExport,
  onToggleDocs,
  onOpenDocument,
  onFocusDoc,
  onOpenUpload,
  onToggleThreads,
  onSelectThread,
  onOpenComparison,
  onOpenAgentModal,
  user,
  documents = [],
  threads = [],
}) {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const role = user?.role || 'engineering'
  const deptInfo = DEPT_COLORS[role] || DEPT_COLORS.engineering

  // Build the list of actionable items
  const allItems = useMemo(() => {
    const list = []

    // 1. Core Actions
    list.push({
      id: 'new-chat',
      category: 'Actions',
      label: 'New Conversation Thread',
      subtitle: 'Clear memory and start a fresh question thread',
      icon: '💬',
      shortcut: '⌘N',
      action: () => { onNewChat(); onClose() },
    })

    list.push({
      id: 'export',
      category: 'Actions',
      label: 'Corporate Export & Share',
      subtitle: 'Export session as PDF report, Markdown file, or Slack brief',
      icon: '🏛️',
      shortcut: '⌘E',
      action: () => { onExport(); onClose() },
    })

    list.push({
      id: 'theme',
      category: 'Actions',
      label: isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      subtitle: `Currently in ${isDark ? 'dark' : 'light'} appearance`,
      icon: isDark ? '☀️' : '🌙',
      shortcut: '⌘T',
      action: () => { toggleTheme(); onClose() },
    })

    list.push({
      id: 'toggle-docs',
      category: 'Actions',
      label: 'Toggle Department Documents Panel',
      subtitle: 'Show or hide the indexed corporate file drawer',
      icon: '📚',
      shortcut: '⌘D',
      action: () => { onToggleDocs(); onClose() },
    })

    list.push({
      id: 'upload-doc',
      category: 'Actions',
      label: 'Upload New Corporate Document',
      subtitle: 'Index PDF, TXT, or MD into vector and BM25 knowledge base',
      icon: '📂',
      shortcut: '⌘U',
      action: () => { if (onOpenUpload) onOpenUpload(); onClose() },
    })

    list.push({
      id: 'toggle-threads',
      category: 'Actions',
      label: 'Toggle Saved Chat Threads Sidebar',
      subtitle: 'View, search, or resume past conversational sessions',
      icon: '💾',
      shortcut: '⌘S',
      action: () => { if (onToggleThreads) onToggleThreads(); onClose() },
    })

    list.push({
      id: 'compare-docs',
      category: 'Actions',
      label: 'Multi-Document Comparison Matrix',
      subtitle: 'Compare policies, runbooks, and SLAs side-by-side in a structured grid',
      icon: '📊',
      shortcut: '⌘M',
      action: () => { if (onOpenComparison) onOpenComparison(); onClose() },
    })

    list.push({
      id: 'agent-audit',
      category: 'Autonomous Agents (Tier 2)',
      label: 'Policy Compliance Auditor',
      subtitle: 'Audit proposed scenarios & actions for Pass/Warn/Fail policy conformity',
      icon: '🏛️',
      shortcut: '⌘A',
      action: () => { if (onOpenAgentModal) onOpenAgentModal({ persona: 'auditor' }); onClose() },
    })

    list.push({
      id: 'agent-risk',
      category: 'Autonomous Agents (Tier 2)',
      label: 'Legal & Operational Risk Assessor',
      subtitle: 'Identify contractual liabilities, SLA risks, and conflicting clauses',
      icon: '⚖️',
      shortcut: '⌘R',
      action: () => { if (onOpenAgentModal) onOpenAgentModal({ persona: 'risk' }); onClose() },
    })

    list.push({
      id: 'agent-collab',
      category: 'Autonomous Agents (Tier 2)',
      label: 'Multi-Agent Executive Council',
      subtitle: 'Joint consensus evaluation by Compliance Auditor & Risk Assessor',
      icon: '🤝',
      shortcut: '↵',
      action: () => { if (onOpenAgentModal) onOpenAgentModal({ persona: 'collaborative' }); onClose() },
    })

    if (user?.role === 'admin' || user?.role === 'demo_admin') {
      list.push({
        id: 'admin',
        category: 'Navigation',
        label: 'Admin Analytics Dashboard',
        subtitle: 'Observability, response latency, RAGAS scores & feedback queue',
        icon: '📊',
        shortcut: '↵',
        action: () => { navigate('/admin'); onClose() },
      })
    }

    // 2. Saved Chat Threads (Past sessions)
    if (threads && threads.length > 0) {
      threads.slice(0, 8).forEach((t) => {
        list.push({
          id: `saved-thread-${t.id}`,
          category: 'Saved Chat Threads',
          label: t.title || 'Untitled Conversation',
          subtitle: `Resume thread · ${t.messages?.length || 0} msgs`,
          icon: '💬',
          action: () => {
            if (onSelectThread) onSelectThread(t)
            onClose()
          },
        })
      })
    }

    // 3. Department Prompts
    const rolePrompts = DEPT_PROMPTS[role] || []
    rolePrompts.forEach((p, idx) => {
      list.push({
        id: `prompt-${idx}`,
        category: `${deptInfo.name} Prompts`,
        label: p.title,
        subtitle: p.query,
        icon: '✨',
        action: () => { onSelectPrompt(p.query); onClose() },
      })
    })

    // 3. Department Documents
    documents.forEach((doc) => {
      list.push({
        id: `focus-doc-${doc.id}`,
        category: `${deptInfo.name} Documents`,
        label: `Focus Q&A on ${doc.name}`,
        subtitle: `Scope floating chat queries strictly to this file`,
        icon: '🎯',
        shortcut: 'Focus',
        action: () => {
          if (onFocusDoc) onFocusDoc(doc)
          onClose()
        },
      })
      list.push({
        id: `read-doc-${doc.id}`,
        category: `${deptInfo.name} Documents`,
        label: `Read ${doc.name}`,
        subtitle: `Open in In-App Reader · ${doc.chunk_count} vector chunks`,
        icon: '📖',
        shortcut: 'Reader',
        action: () => {
          if (onOpenDocument) onOpenDocument(doc)
          onClose()
        },
      })
      list.push({
        id: `ask-doc-${doc.id}`,
        category: `${deptInfo.name} Documents`,
        label: `Ask about ${doc.name}`,
        subtitle: `Prompt NexusRAG for policies in ${doc.name}`,
        icon: '✨',
        shortcut: 'Ask',
        action: () => {
          onSelectPrompt(`What key information and policies are covered in ${doc.name}?`)
          onClose()
        },
      })
    })

    return list
  }, [role, deptInfo, isDark, user, documents, threads, onNewChat, onExport, toggleTheme, onToggleDocs, onOpenDocument, onFocusDoc, onOpenUpload, onToggleThreads, onSelectThread, onOpenComparison, navigate, onSelectPrompt, onClose])

  // Filter items based on search input
  const filteredItems = useMemo(() => {
    if (!search.trim()) return allItems
    const q = search.toLowerCase()
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    )
  }, [allItems, search])

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (filteredItems.length ? (prev + 1) % filteredItems.length : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (filteredItems.length ? (prev - 1 + filteredItems.length) % filteredItems.length : 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredItems, selectedIndex, onClose])

  // Auto-scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const activeEl = listRef.current.querySelector('[data-selected="true"]')
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  if (!isOpen) return null

  // Group items by category
  const groups = []
  filteredItems.forEach((item, index) => {
    let grp = groups.find((g) => g.category === item.category)
    if (!grp) {
      grp = { category: item.category, items: [] }
      groups.push(grp)
    }
    grp.items.push({ ...item, globalIndex: index })
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="macOS Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col relative"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(20, 23, 34, 0.94) 0%, rgba(14, 16, 25, 0.96) 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(248, 250, 252, 0.98) 100%)',
          backdropFilter: 'blur(28px) saturate(190%)',
          WebkitBackdropFilter: 'blur(28px) saturate(190%)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid rgba(0, 0, 0, 0.12)',
          boxShadow: isDark
            ? '0 30px 70px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
            : '0 25px 60px -12px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.06), inset 0 1px 0 #ffffff',
          maxHeight: '75vh',
          animation: 'scaleIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* ── macOS Titlebar / Search Header ── */}
        <div
          className="flex items-center gap-3 px-4 py-3.5 border-b shrink-0"
          style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }}
        >
          {/* macOS Traffic Lights */}
          <div className="flex items-center gap-1.5 select-none shrink-0 mr-1">
            <span
              onClick={onClose}
              className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] border border-[#e0443e]/80 inline-block cursor-pointer hover:opacity-80"
              title="Close (ESC)"
            />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] border border-[#dea123]/80 inline-block opacity-80" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f] border border-[#1aab29]/80 inline-block opacity-80" />
          </div>

          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 shrink-0">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>

          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${deptInfo.name} documents or type a command...`}
            className="flex-1 bg-transparent text-sm outline-none font-medium placeholder:font-normal"
            style={{
              color: isDark ? '#ffffff' : '#0f172a',
            }}
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="text-xs opacity-40 hover:opacity-100 p-1 rounded-md transition-opacity cursor-pointer"
            >
              ✕
            </button>
          )}

          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider shrink-0"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              color: isDark ? 'rgba(255, 255, 255, 0.5)' : '#64748b',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.06)',
            }}
          >
            <span>ESC</span>
          </div>
        </div>

        {/* ── Results List ── */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-2 space-y-3 doc-scroll"
          style={{ minHeight: 180 }}
        >
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs opacity-40">
              No matching commands or documents found for "{search}"
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.category} className="space-y-1">
                <div
                  className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider opacity-45"
                  style={{ color: isDark ? '#ffffff' : '#475569' }}
                >
                  {group.category}
                </div>

                {group.items.map((item) => {
                  const isSelected = selectedIndex === item.globalIndex
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-selected={isSelected}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(item.globalIndex)}
                      className="w-full text-left flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer"
                      style={{
                        background: isSelected
                          ? isDark
                            ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(139, 92, 246, 0.20) 100%)'
                            : '#ede9fe'
                          : 'transparent',
                        color: isSelected
                          ? isDark ? '#ffffff' : '#4338ca'
                          : isDark ? 'rgba(255, 255, 255, 0.85)' : '#1e293b',
                        border: isSelected
                          ? isDark ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid #c4b5fd'
                          : '1px solid transparent',
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-sm shrink-0">{item.icon}</span>
                        <div className="min-w-0">
                          <p className="font-medium truncate leading-snug">{item.label}</p>
                          <p
                            className="text-[11px] truncate leading-tight opacity-60"
                            style={{ color: isSelected && !isDark ? '#6d28d9' : undefined }}
                          >
                            {item.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.shortcut && (
                          <span
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                            style={{
                              background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                              color: isDark ? 'rgba(255, 255, 255, 0.5)' : '#64748b',
                            }}
                          >
                            {item.shortcut}
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-xs font-semibold opacity-75">↵</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* ── macOS Bottom Controls / Shortcuts Footer ── */}
        <div
          className="flex items-center justify-between px-4 py-2 border-t text-[10px] select-none shrink-0"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
            color: isDark ? 'rgba(255, 255, 255, 0.4)' : '#64748b',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-white/10 dark:bg-white/10 px-1 py-0.5 rounded text-[9px]">↑↓</kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-white/10 dark:bg-white/10 px-1 py-0.5 rounded text-[9px]">↵</kbd>
              <span>Select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-white/10 dark:bg-white/10 px-1 py-0.5 rounded text-[9px]">esc</kbd>
              <span>Close</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: deptInfo.dot }} />
            <span className="capitalize">{user?.role} Workspace</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96) translateY(-8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
      `}</style>
    </div>
  )
}

