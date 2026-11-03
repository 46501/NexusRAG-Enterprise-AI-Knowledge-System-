import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const DEPT_META = {
  hr: {
    name: 'Human Resources',
    color: '#a78bfa',
    bg: 'rgba(139,92,246,0.12)',
    border: 'rgba(139,92,246,0.25)',
    btn: '#7c3aed',
  },
  engineering: {
    name: 'Engineering',
    color: '#38bdf8',
    bg: 'rgba(14,165,233,0.12)',
    border: 'rgba(14,165,233,0.25)',
    btn: '#0284c7',
  },
  finance: {
    name: 'Finance',
    color: '#34d399',
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.25)',
    btn: '#059669',
  },
  admin: {
    name: 'System Admin',
    color: '#fb7185',
    bg: 'rgba(244,63,94,0.12)',
    border: 'rgba(244,63,94,0.25)',
    btn: '#e11d48',
  },
  demo_admin: {
    name: 'Demo Admin',
    color: '#fb7185',
    bg: 'rgba(244,63,94,0.12)',
    border: 'rgba(244,63,94,0.25)',
    btn: '#e11d48',
  },
}

export default function UserProfileMenu({ onOpenCommandPalette = null, onExport = null }) {
  const { user, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  const meta = DEPT_META[user?.role] ?? {
    name: user?.role ?? 'Member',
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.12)',
    border: 'rgba(148,163,184,0.25)',
    btn: '#475569',
  }

  const initial = (user?.email?.[0] || user?.role?.[0] || 'U').toUpperCase()
  const isAdmin = user?.role === 'admin' || user?.role === 'demo_admin'
  const isCurrentlyInAdmin = typeof window !== 'undefined' && window.location.pathname.includes('admin')

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* ── Trigger Button ── */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={`group flex items-center gap-2 px-2 py-1.5 sm:px-2.5 sm:py-1.5 rounded-xl transition-all cursor-pointer border select-none ${
          isOpen
            ? isDark
              ? 'bg-white/10 border-white/20 shadow-md ring-2 ring-purple-500/20'
              : 'bg-slate-100 border-slate-300 shadow-sm ring-2 ring-purple-500/10'
            : isDark
            ? 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 hover:border-white/20'
            : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 shadow-xs'
        }`}
        title={`User account: ${user?.email} (${meta.name})`}
      >
        {/* Avatar with initial & online pulse */}
        <div className="relative flex-shrink-0">
          <div
            className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center font-bold text-[11px] sm:text-xs text-white shadow-xs transition-transform group-hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${meta.btn}, #1e1b4b)`,
              boxShadow: `0 0 10px ${meta.color}40`,
            }}
          >
            {initial}
          </div>
          <span
            className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2"
            style={{
              background: '#10b981',
              borderColor: isDark ? '#0f111a' : '#ffffff',
            }}
            title="Connected"
          />
        </div>

        {/* User email & role preview */}
        <div className="hidden sm:flex flex-col text-left leading-tight pr-0.5">
          <span
            className="text-[11px] font-semibold truncate max-w-[110px] md:max-w-[130px]"
            style={{ color: isDark ? 'rgba(255,255,255,0.90)' : '#1e293b' }}
          >
            {user?.email?.split('@')[0]}
          </span>
          <span
            className="text-[9px] font-medium tracking-wide uppercase"
            style={{ color: meta.color }}
          >
            {user?.role}
          </span>
        </div>

        {/* Chevron Icon */}
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: isDark ? 'rgba(255,255,255,0.40)' : '#94a3b8' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ── Dropdown Popover ── */}
      {isOpen && (
        <div
          className={`absolute right-0 top-full mt-2 w-72 rounded-2xl shadow-2xl z-50 overflow-hidden border backdrop-blur-2xl transition-all animate-in fade-in zoom-in-95 duration-150 ${
            isDark
              ? 'bg-[#12141c]/95 border-white/10 shadow-black/60 text-white'
              : 'bg-white/95 border-slate-200/90 shadow-slate-300/50 text-slate-900'
          }`}
          style={{
            boxShadow: isDark
              ? '0 20px 40px -8px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)'
              : '0 20px 40px -8px rgba(15,23,42,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
          }}
        >
          {/* Header: User Profile Summary */}
          <div className="p-3.5 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-sm flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${meta.btn}, #1e1b4b)`,
                  boxShadow: `0 0 12px ${meta.color}40`,
                }}
              >
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate leading-tight" title={user?.email}>
                  {user?.email}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider"
                    style={{
                      background: meta.bg,
                      color: meta.color,
                      border: `1px solid ${meta.border}`,
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
                    {meta.name}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Theme Appearance Segmented Switch */}
          <div className="p-3 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider opacity-50">
                Appearance
              </span>
              <span className="text-[10px] font-medium opacity-40">
                {isDark ? 'Dark mode' : 'Light mode'}
              </span>
            </div>
            <div
              className={`grid grid-cols-2 p-1 rounded-xl border ${
                isDark ? 'bg-black/20 border-white/5' : 'bg-slate-100 border-slate-200/80'
              }`}
            >
              <button
                type="button"
                onClick={() => { if (isDark) toggleTheme() }}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  !isDark
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2" />
                  <path d="M12 20v2" />
                  <path d="m4.93 4.93 1.41 1.41" />
                  <path d="m17.66 17.66 1.41 1.41" />
                  <path d="M2 12h2" />
                  <path d="M20 12h2" />
                  <path d="m6.34 17.66-1.41 1.41" />
                  <path d="m19.07 4.93-1.41 1.41" />
                </svg>
                <span>Light</span>
              </button>

              <button
                type="button"
                onClick={() => { if (!isDark) toggleTheme() }}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isDark
                    ? 'bg-white/10 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
                <span>Dark</span>
              </button>
            </div>
          </div>

          {/* Section: Quick Workspace Actions */}
          <div className="p-1.5 border-b border-black/5 dark:border-white/5 space-y-0.5">
            {isAdmin && !isCurrentlyInAdmin && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  navigate(user?.role === 'demo_admin' ? '/demo-admin' : '/admin-panel')
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-rose-500/15 text-rose-300' : 'hover:bg-rose-50 text-rose-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                  </svg>
                  <span>Admin Console</span>
                </div>
                <span className="text-[10px] font-mono opacity-60">Control</span>
              </button>
            )}

            {isCurrentlyInAdmin && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  navigate('/chat')
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-purple-500/15 text-purple-300' : 'hover:bg-purple-50 text-purple-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>Return to Chat Workspace</span>
                </div>
                <span className="text-[10px] font-mono opacity-60">Chat</span>
              </button>
            )}

            {onOpenCommandPalette && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  onOpenCommandPalette()
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-white/[0.06] text-white/80' : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <span>Command Palette</span>
                </div>
                <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 opacity-70">
                  ⌘K
                </kbd>
              </button>
            )}

            {onExport && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  onExport()
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-white/[0.06] text-white/80' : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  <span>Export & Share</span>
                </div>
                <span className="text-[10px] font-mono opacity-60">PDF/MD</span>
              </button>
            )}
          </div>

          {/* Section: Sign Out Button */}
          <div className="p-1.5">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                logout()
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer text-rose-500 ${
                isDark ? 'hover:bg-rose-500/15' : 'hover:bg-rose-50'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sign Out of NexusRAG</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

