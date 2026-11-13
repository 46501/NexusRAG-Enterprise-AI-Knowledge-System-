import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import ThemeToggle from '../components/ThemeToggle'
import { getMe, login } from '../services/auth'

export default function LoginPage() {
  const { setUser } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const savedEmail = localStorage.getItem('nexus_remember_email')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (rememberMe) {
        localStorage.setItem('nexus_remember_email', email.trim())
      } else {
        localStorage.removeItem('nexus_remember_email')
      }

      await login(email.trim(), password)
      const me = await getMe()
      setUser(me)

      if (me.role === 'admin') {
        navigate('/admin-panel', { replace: true })
      } else if (me.role === 'demo_admin') {
        navigate('/demo-admin', { replace: true })
      } else {
        navigate('/chat', { replace: true })
      }
    } catch (err) {
      const status = err.response?.status
      const detail = err.response?.data?.detail
      if (status === 403) {
        setError(detail || 'Your account is inactive or pending administrator approval.')
      } else if (status === 401) {
        setError(detail || 'Invalid email or password. Please try again.')
      } else {
        setError(detail || 'Unable to sign in. Please check your network and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0a0a0a] text-white' : 'bg-[#f8fafc] text-slate-900'} flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden transition-colors`}>
      {/* Theme toggle in top right */}
      <div className="absolute top-5 right-5 z-20">
        <ThemeToggle />
      </div>

      {/* Background ambient glow */}
      <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 ${isDark ? 'bg-violet-600/10' : 'bg-violet-400/15'} rounded-full blur-3xl pointer-events-none`} />
      <div className={`absolute bottom-1/4 right-1/4 w-80 h-80 ${isDark ? 'bg-blue-600/10' : 'bg-sky-400/15'} rounded-full blur-3xl pointer-events-none`} />

      {/* Main card */}
      <div className={`w-full max-w-md ${isDark ? 'bg-[#111318] border-white/10 shadow-2xl' : 'bg-white border-slate-200 shadow-xl shadow-slate-200/50'} border rounded-2xl p-7 sm:p-8 relative z-10 transition-colors`}>
        {/* Brand header */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-500 mb-3 shadow-inner">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>NexusRAG</h1>
          <p className="text-xs uppercase tracking-widest text-violet-500 font-semibold mt-1">Enterprise AI Knowledge System</p>
          <p className={`text-xs ${isDark ? 'text-white/50' : 'text-slate-500'} mt-2`}>Sign in to access your authorized department workspace</p>
        </div>

        {/* Error message banner */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-500 text-xs flex items-start gap-2.5">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-xs font-medium ${isDark ? 'text-white/70' : 'text-slate-700'} mb-1.5`}>Work Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className={`w-full border rounded-xl px-3.5 py-2.5 text-sm transition-all focus:outline-none ${
                isDark
                  ? 'bg-white/[0.04] border-white/10 text-white placeholder-white/25 focus:border-violet-500 focus:bg-white/[0.07]'
                  : 'bg-slate-50/70 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-violet-600 focus:bg-white'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`block text-xs font-medium ${isDark ? 'text-white/70' : 'text-slate-700'}`}>Password</label>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full border rounded-xl px-3.5 py-2.5 text-sm transition-all pr-10 focus:outline-none ${
                  isDark
                    ? 'bg-white/[0.04] border-white/10 text-white placeholder-white/25 focus:border-violet-500 focus:bg-white/[0.07]'
                    : 'bg-slate-50/70 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-violet-600 focus:bg-white'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors focus:outline-none ${
                  isDark ? 'text-white/40 hover:text-white/70' : 'text-slate-400 hover:text-slate-700'
                }`}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268-2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className={`w-4 h-4 rounded text-violet-600 focus:ring-0 focus:ring-offset-0 cursor-pointer ${
                  isDark ? 'border-white/20 bg-white/5' : 'border-slate-300 bg-white'
                }`}
              />
              <span className={`text-xs transition-colors ${isDark ? 'text-white/60 hover:text-white/80' : 'text-slate-600 hover:text-slate-900'}`}>Remember my email</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:from-violet-700 active:to-indigo-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium transition-all shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Signing in…</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        {/* Signup Link */}
        <div className={`mt-6 pt-5 border-t text-center text-xs ${isDark ? 'border-white/[0.08] text-white/50' : 'border-slate-200 text-slate-500'}`}>
          Don't have an account?{' '}
          <Link
            to="/signup"
            className="text-violet-500 hover:text-violet-600 font-medium transition-colors underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </div>
      </div>

      <div className={`mt-8 text-xs ${isDark ? 'text-white/20' : 'text-slate-400'}`}>
        NexusRAG Enterprise AI Platform &bull; Secure Multi-Tenant RBAC
      </div>
    </div>
  )
}
