import { useState, useRef, useEffect } from 'react'
import BackHomeButton from './BackHomeButton'
import UserProfileMenu from './UserProfileMenu'
import { PanelLeftIcon, PanelRightIcon } from './SidebarToggleIcon'

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

export default function WorkspaceHeader({
  userRole = 'hr',
  isDark = true,
  threadsSidebarOpen,
  docsSidebarOpen,
  threadsSidebarPinned,
  docsSidebarPinned,
  onToggleThreads,
  onToggleDocs,
  onToggleThreadsPin,
  onToggleDocsPin,
  threadsMobileOpen = false,
  docsMobileOpen = false,
  onToggleThreadsMobile,
  onToggleDocsMobile,
  onOpenAgentModal,
  onNewChat,
  onOpenExport,
  onOpenCommandPalette,
  onOpenComparison,
  onOpenUpload,
  isMobile = false,
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreMenuRef = useRef(null)

  const isThreadsActive = threadsSidebarOpen !== undefined ? threadsSidebarOpen : (threadsSidebarPinned !== undefined ? threadsSidebarPinned : true)
  const isDocsActive = docsSidebarOpen !== undefined ? docsSidebarOpen : (docsSidebarPinned !== undefined ? docsSidebarPinned : true)
  const toggleThreads = onToggleThreads || onToggleThreadsPin
  const toggleDocs = onToggleDocs || onToggleDocsPin

  const d = DEPT[userRole] || DEPT.engineering
  const deptName = DEPT_NAMES[userRole] || userRole

  // Close More Menu on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setMoreOpen(false)
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    if (moreOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [moreOpen])

  return (
    <header
      className="w-full flex-shrink-0 flex items-center justify-between px-2.5 sm:px-4 py-2 z-30 transition-colors select-none relative min-w-0"
      style={{
        background: isDark ? 'rgba(15, 17, 26, 0.85)' : 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
      }}
    >
      {/* ── LEFT CLUSTER: macOS Window dots, Sidebar Toggle, Back, Department, Quick ⌘K ── */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
        {/* macOS Window Controls */}
        <div className="hidden sm:flex items-center gap-1.5 mr-0.5 select-none shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] border border-[#e0443e]/80 inline-block shadow-xs" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] border border-[#dea123]/80 inline-block shadow-xs" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f] border border-[#1aab29]/80 inline-block shadow-xs" />
        </div>

        {/* macOS Sidebar Toggle (Threads / History) */}
        <button
          type="button"
          onClick={() => {
            if (isMobile) {
              onToggleThreadsMobile?.()
            } else {
              toggleThreads?.()
            }
          }}
          className="p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center hover:scale-105 shrink-0"
          style={{
            color: isThreadsActive ? (isDark ? '#d8b4fe' : '#7e22ce') : (isDark ? 'rgba(255, 255, 255, 0.65)' : '#64748b'),
            background: isThreadsActive
              ? (isDark ? 'rgba(168, 85, 247, 0.18)' : '#f3e8ff')
              : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9'),
            border: isThreadsActive
              ? (isDark ? '1px solid rgba(168, 85, 247, 0.35)' : '1px solid #d8b4fe')
              : (isDark ? '1px solid rgba(255, 255, 255, 0.10)' : '1px solid #cbd5e1'),
          }}
          title={`Toggle Chat Threads Sidebar (${isThreadsActive ? 'Collapse' : 'Expand'}) (⌘S)`}
        >
          <PanelLeftIcon isOpen={isThreadsActive} size={15} />
        </button>

        <BackHomeButton />

        {/* Department branding & Workspace label */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: d.dot, boxShadow: `0 0 8px ${d.dot}` }}
          />
          <span
            className="text-xs sm:text-sm font-semibold tracking-tight whitespace-nowrap truncate max-w-[110px] sm:max-w-[160px] md:max-w-none"
            style={{ color: isDark ? '#fff' : '#0f172a' }}
          >
            {deptName}
          </span>
          <span className="hidden 2xl:inline text-[11px] font-medium opacity-40 whitespace-nowrap">
            Workspace
          </span>
        </div>

        {/* Quick Command Palette Button next to Workspace (Matching Original Design) */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="hidden 2xl:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-xs font-medium transition-all cursor-pointer opacity-70 hover:opacity-100 shrink-0"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #cbd5e1',
            color: isDark ? 'rgba(255, 255, 255, 0.7)' : '#475569',
          }}
          title="Open Command Palette (⌘K / Ctrl+K)"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <kbd className="font-mono text-[10px] opacity-75">⌘K</kbd>
        </button>
      </div>

      {/* ── CENTER CLUSTER: Prioritized Primary Actions (No Overlap) ── */}
      <div className="hidden xl:flex items-center gap-1.5 sm:gap-2 justify-center min-w-0 flex-shrink mx-1 sm:mx-2">
        {/* Prioritized 1: Agents Auditor */}
        <button
          type="button"
          onClick={onOpenAgentModal}
          className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer hover:scale-105 shadow-xs whitespace-nowrap shrink-0"
          style={{
            background: isDark ? 'rgba(168, 85, 247, 0.20)' : '#f5f3ff',
            color: isDark ? '#d8b4fe' : '#7c3aed',
            border: isDark ? '1px solid rgba(168, 85, 247, 0.40)' : '1px solid #ddd6fe',
          }}
          title="Launch Autonomous Policy Compliance & Risk Auditor (Tier 2)"
        >
          <span className="text-sm leading-none">🤖</span>
          <span className="hidden xs:inline sm:inline">Agents</span>
          <span className="hidden 2xl:inline text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-purple-500/30 text-purple-200">
            Tier 2
          </span>
        </button>

        {/* Prioritized 2: New Chat */}
        <button
          type="button"
          onClick={onNewChat}
          className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer hover:opacity-100 opacity-85 whitespace-nowrap shrink-0"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #cbd5e1',
            color: isDark ? 'rgba(255, 255, 255, 0.90)' : '#334155',
          }}
          title="Start fresh conversation thread (⌘N)"
        >
          <span className="text-sm font-semibold leading-none">+</span>
          <span className="hidden 2xl:inline">New Chat</span>
          <span className="hidden min-[1366px]:inline 2xl:hidden">New</span>
        </button>

        {/* Prioritized 3: Export & Share */}
        <button
          type="button"
          onClick={onOpenExport}
          className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer hover:opacity-100 opacity-85 whitespace-nowrap shrink-0"
          style={{
            background: isDark ? 'rgba(99, 102, 241, 0.14)' : '#eef2ff',
            border: isDark ? '1px solid rgba(99, 102, 241, 0.32)' : '1px solid #c7d2fe',
            color: isDark ? '#c7d2fe' : '#4f46e5',
          }}
          title="Export session as PDF, Markdown, or Slack brief"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span className="hidden 2xl:inline">Export & Share</span>
          <span className="hidden min-[1366px]:inline 2xl:hidden">Export</span>
        </button>
      </div>

      {/* ── RIGHT CLUSTER: More Menu, Docs Toggle, User Profile (ml-auto anchors to right) ── */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
        {/* More Actions Menu (...) */}
        <div className="relative inline-block" ref={moreMenuRef}>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center hover:scale-105 shrink-0"
            style={{
              background: moreOpen
                ? (isDark ? 'rgba(255, 255, 255, 0.14)' : '#e2e8f0')
                : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9'),
              color: isDark ? '#fff' : '#0f172a',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.10)' : '1px solid #cbd5e1',
            }}
            title="More Workspace Actions & Shortcuts (...)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>

          {moreOpen && (
            <div
              className={`absolute right-0 top-full mt-2 w-56 rounded-2xl shadow-2xl z-50 overflow-hidden border backdrop-blur-2xl p-1.5 transition-all animate-in fade-in zoom-in-95 duration-150 ${
                isDark
                  ? 'bg-[#12141c]/95 border-white/10 shadow-black/60 text-white'
                  : 'bg-white/95 border-slate-200/90 shadow-slate-300/50 text-slate-900'
              }`}
            >
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider opacity-40">
                Workspace Actions
              </div>

              {/* Command Palette */}
              <button
                type="button"
                onClick={() => { setMoreOpen(false); onOpenCommandPalette?.(); }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors hover:bg-purple-500/10 cursor-pointer text-left"
              >
                <span className="flex items-center gap-2">
                  <span>🔍</span>
                  <span>Command Palette</span>
                </span>
                <kbd className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 opacity-60">⌘K</kbd>
              </button>

              {/* Compare Documents */}
              <button
                type="button"
                onClick={() => { setMoreOpen(false); onOpenComparison?.(); }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors hover:bg-purple-500/10 cursor-pointer text-left"
              >
                <span className="flex items-center gap-2">
                  <span>📊</span>
                  <span>Compare Matrix</span>
                </span>
                <kbd className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 opacity-60">⌘M</kbd>
              </button>

              {/* Upload Document */}
              <button
                type="button"
                onClick={() => { setMoreOpen(false); onOpenUpload?.(); }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors hover:bg-purple-500/10 cursor-pointer text-left"
              >
                <span className="flex items-center gap-2">
                  <span>📤</span>
                  <span>Upload & Index</span>
                </span>
                <kbd className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 opacity-60">⌘U</kbd>
              </button>

              {/* Agent Auditor */}
              <button
                type="button"
                onClick={() => { setMoreOpen(false); onOpenAgentModal?.(); }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors hover:bg-purple-500/10 cursor-pointer text-left"
              >
                <span className="flex items-center gap-2">
                  <span>🤖</span>
                  <span>Agents Auditor</span>
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300">Tier 2</span>
              </button>

              {/* Export & Share */}
              <button
                type="button"
                onClick={() => { setMoreOpen(false); onOpenExport?.(); }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors hover:bg-purple-500/10 cursor-pointer text-left"
              >
                <span className="flex items-center gap-2">
                  <span>📋</span>
                  <span>Export & Share</span>
                </span>
              </button>

              <div className="my-1 border-t border-black/5 dark:border-white/5" />

              {/* Toggle Chat Threads */}
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false)
                  if (isMobile) onToggleThreadsMobile?.()
                  else toggleThreads?.()
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors hover:bg-purple-500/10 cursor-pointer text-left"
              >
                <span className="flex items-center gap-2">
                  <span>💬</span>
                  <span>Chat Threads</span>
                </span>
                <kbd className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 opacity-60">⌘S</kbd>
              </button>

              {/* Toggle Documents Panel */}
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false)
                  if (isMobile) onToggleDocsMobile?.()
                  else toggleDocs?.()
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors hover:bg-purple-500/10 cursor-pointer text-left"
              >
                <span className="flex items-center gap-2">
                  <span>📄</span>
                  <span>Documents Sidebar</span>
                </span>
                <kbd className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 opacity-60">⌘D</kbd>
              </button>
            </div>
          )}
        </div>

        {/* macOS Documents Toggle (Desktop/Tablet) */}
        <button
          type="button"
          onClick={() => {
            if (isMobile) {
              onToggleDocsMobile?.()
            } else {
              toggleDocs?.()
            }
          }}
          className="hidden md:flex p-1.5 rounded-lg transition-all cursor-pointer items-center justify-center hover:scale-105 shrink-0"
          style={{
            color: isDocsActive ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? 'rgba(255, 255, 255, 0.65)' : '#64748b'),
            background: isDocsActive
              ? (isDark ? 'rgba(56, 189, 248, 0.18)' : '#f0f9ff')
              : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9'),
            border: isDocsActive
              ? (isDark ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid #bae6fd')
              : (isDark ? '1px solid rgba(255, 255, 255, 0.10)' : '1px solid #cbd5e1'),
          }}
          title={`Toggle Documents Sidebar (${isDocsActive ? 'Collapse' : 'Expand'}) (⌘D)`}
        >
          <PanelRightIcon isOpen={isDocsActive} size={15} />
        </button>

        {/* Mobile Docs Drawer Toggle */}
        <button
          type="button"
          className="md:hidden text-xs px-2 py-1 rounded-xl font-medium transition-all shrink-0 cursor-pointer"
          style={{
            color: docsMobileOpen ? (isDark ? '#fff' : '#0f172a') : (isDark ? 'rgba(255,255,255,0.70)' : '#475569'),
            border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #cbd5e1',
            background: docsMobileOpen ? (isDark ? 'rgba(255,255,255,0.10)' : '#e2e8f0') : (isDark ? 'rgba(255,255,255,0.04)' : '#ffffff'),
          }}
          onClick={onToggleDocsMobile}
          title="Toggle Documents Panel"
        >
          📄 Docs
        </button>

        {/* Unified Enterprise User Profile Menu */}
        <UserProfileMenu
          onOpenCommandPalette={onOpenCommandPalette}
          onExport={onOpenExport}
        />
      </div>
    </header>
  )
}

