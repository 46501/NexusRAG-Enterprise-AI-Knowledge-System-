import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import ThemeToggle from '../components/ThemeToggle'
import { getMe, login } from '../services/auth'

export default function AdminLoginPage() {
  const { setUser } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      const me = await getMe()
      setUser(me)
      navigate(me.role === 'admin' ? '/admin-panel' : '/chat', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0a0a0a] text-white' : 'bg-[#f8fafc] text-slate-900'} flex items-center justify-center px-4 relative transition-colors`}>
      <div className="absolute top-5 right-5 z-20">
        <ThemeToggle />
      </div>

      <div className={`w-full max-w-sm ${isDark ? 'bg-[#111318] border-white/10' : 'bg-white border-slate-200 shadow-xl shadow-slate-200/50'} border rounded-2xl p-8 transition-colors`}>
        <h1 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'} mb-1`}>Admin Login</h1>
        <p className={`text-sm ${isDark ? 'text-white/50' : 'text-slate-500'} mb-6`}>Sign in with your account credentials</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-white/70' : 'text-slate-700'} mb-1`}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-all ${
                isDark
                  ? 'bg-white/[0.04] border-white/10 text-white placeholder-white/25 focus:border-violet-500 focus:bg-white/[0.07]'
                  : 'bg-slate-50/70 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-violet-600 focus:bg-white'
              }`}
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-white/70' : 'text-slate-700'} mb-1`}>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-all ${
                isDark
                  ? 'bg-white/[0.04] border-white/10 text-white placeholder-white/25 focus:border-violet-500 focus:bg-white/[0.07]'
                  : 'bg-slate-50/70 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-violet-600 focus:bg-white'
              }`}
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-rose-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors cursor-pointer shadow-md shadow-violet-600/20"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
