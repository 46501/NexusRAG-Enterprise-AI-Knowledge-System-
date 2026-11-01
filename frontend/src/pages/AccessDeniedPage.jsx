import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import ThemeToggle from '../components/ThemeToggle'

const DEPT_NAMES = {
  hr: 'Human Resources',
  engineering: 'Engineering',
  finance: 'Finance',
  admin: 'Administration',
}

const DEPT_COLORS = {
  hr: '#a78bfa',
  engineering: '#38bdf8',
  finance: '#34d399',
  admin: '#f59e0b',
}

export default function AccessDeniedPage({ targetDepartment: propTargetDept, userRole: propUserRole }) {
  const { user, logout } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  // Determine target department from prop, state, or location pathname
  const stateTargetDept = location.state?.targetDepartment
  const pathDept = location.pathname.replace(/^\/(chat|departments|workspace)\/?/, '').replace('/', '')
  const rawTarget = propTargetDept || stateTargetDept || pathDept || 'this department'
  const targetName = DEPT_NAMES[rawTarget.toLowerCase()] || rawTarget

  const currentUserRole = user?.role || propUserRole || 'Unknown'
  const userDeptName = DEPT_NAMES[currentUserRole.toLowerCase()] || currentUserRole

  function handleBackToWorkspace() {
    if (currentUserRole === 'admin') {
      navigate('/admin-panel', { replace: true })
    } else if (currentUserRole === 'demo_admin') {
      navigate('/demo-admin', { replace: true })
    } else {
      navigate('/chat', { replace: true })
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col justify-between p-6 sm:p-10 transition-colors relative overflow-hidden"
      style={{
        background: isDark ? '#0a0a0a' : '#f8fafc',
        color: isDark ? '#ffffff' : '#0f172a',
        fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Top Header */}
      <header className="flex items-center justify-between w-full max-w-5xl mx-auto z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600/10 border border-violet-500/20 flex items-center justify-center font-bold text-violet-500 text-sm">
            N
          </div>
          <span className="font-semibold text-sm tracking-tight" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
            NexusRAG <span className="opacity-40 font-normal">| Enterprise Access Guard</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={logout}
            className="text-xs transition-colors hover:underline cursor-pointer"
            style={{ color: isDark ? 'rgba(255,255,255,0.45)' : '#64748b' }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Center Access Denied Card */}
      <main className="flex-1 flex items-center justify-center py-12 z-10">
        <div
          className="w-full max-w-lg p-8 sm:p-10 rounded-2xl text-center shadow-2xl transition-colors border"
          style={{
            background: isDark ? '#111216' : '#ffffff',
            borderColor: isDark ? 'rgba(239, 68, 68, 0.20)' : 'rgba(239, 68, 68, 0.25)',
            boxShadow: isDark
              ? '0 20px 40px -15px rgba(0,0,0,0.7), 0 0 30px rgba(239,68,68,0.06)'
              : '0 20px 40px -15px rgba(0,0,0,0.08), 0 0 30px rgba(239,68,68,0.08)',
          }}
        >
          {/* Shield / Access Denied Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 relative">
            <div
              className="absolute inset-0 rounded-2xl animate-pulse"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                filter: 'blur(10px)',
              }}
            />
            <div
              className="relative w-16 h-16 rounded-2xl flex items-center justify-center border"
              style={{
                background: isDark ? 'rgba(239, 68, 68, 0.10)' : '#fef2f2',
                borderColor: isDark ? 'rgba(239, 68, 68, 0.30)' : '#fecaca',
                color: '#ef4444',
              }}
            >
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>

          {/* Heading */}
          <h1
            className="text-2xl font-bold tracking-tight mb-3"
            style={{ color: isDark ? '#ffffff' : '#0f172a' }}
          >
            Access Denied
          </h1>

          {/* Exact Required Message */}
          <p
            className="text-sm leading-relaxed mb-6 max-w-sm mx-auto"
            style={{ color: isDark ? 'rgba(255,255,255,0.70)' : '#475569' }}
          >
            You don't have permission to access this department. Please contact your administrator if you need access.
          </p>

          {/* Department RBAC Context Card */}
          <div
            className="p-3.5 rounded-xl border mb-8 text-xs flex items-center justify-between"
            style={{
              background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
            }}
          >
            <div className="text-left">
              <span className="text-[10px] uppercase font-semibold block tracking-wider opacity-50">
                Attempted Department
              </span>
              <span className="font-semibold text-rose-500 capitalize">
                {targetName}
              </span>
            </div>

            <div className="w-px h-7 bg-slate-200 dark:bg-white/10" />

            <div className="text-right">
              <span className="text-[10px] uppercase font-semibold block tracking-wider opacity-50">
                Your Department
              </span>
              <span
                className="font-semibold capitalize"
                style={{ color: DEPT_COLORS[currentUserRole.toLowerCase()] || '#a78bfa' }}
              >
                {userDeptName}
              </span>
            </div>
          </div>

          {/* Back to My Workspace Button */}
          <button
            onClick={handleBackToWorkspace}
            className="w-full py-3 px-5 rounded-xl text-sm font-semibold text-white transition-all transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-lg"
            style={{
              background: DEPT_COLORS[currentUserRole.toLowerCase()] || '#7c3aed',
              boxShadow: `0 8px 20px -6px ${DEPT_COLORS[currentUserRole.toLowerCase()] || '#7c3aed'}80`,
            }}
          >
            Back to My Workspace
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs opacity-35 max-w-5xl mx-auto w-full z-10">
        NexusRAG Enterprise Security &middot; Role-Based Access Control (RBAC) Enforced
      </footer>
    </div>
  )
}

