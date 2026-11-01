import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import AdminLoginPage from './pages/AdminLoginPage'
import AdminPage from './pages/AdminPage'
import ChatPage from './pages/ChatPage'

function RootRoute() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  if (user === undefined) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#0a0a0a]' : 'bg-[#f8fafc]'}`}>
        <div className={`w-6 h-6 border-2 rounded-full animate-spin ${isDark ? 'border-white/20 border-t-violet-500' : 'border-slate-300 border-t-violet-600'}`} />
      </div>
    )
  }
  if (user === null) {
    return <Navigate to="/login" replace />
  }
  return <LandingPage />
}

function RequireAuth({ children }) {
  const { user } = useAuth()
  if (user === undefined) return null
  if (user === null) return <Navigate to="/login" replace />
  return children
}

function RequireAdmin({ children }) {
  const { user } = useAuth()
  if (user === undefined) return null
  if (user === null) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/chat" replace />
  return children
}

function RequireDemoAdmin({ children }) {
  const { user } = useAuth()
  if (user === undefined) return null
  if (user === null) return <Navigate to="/login" replace />
  if (user.role !== 'demo_admin') return <Navigate to="/chat" replace />
  return children
}

function RequireGuest({ children }) {
  const { user } = useAuth()
  if (user === undefined) return null
  if (user) {
    if (user.role === 'admin') return <Navigate to="/admin-panel" replace />
    if (user.role === 'demo_admin') return <Navigate to="/demo-admin" replace />
    return <Navigate to="/chat" replace />
  }
  return children
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
          {/* Unauthenticated visitors at / see Login; Authenticated visitors see Landing Dashboard */}
          <Route path="/" element={<RootRoute />} />

          {/* Authentication Routes */}
          <Route path="/login" element={<RequireGuest><LoginPage /></RequireGuest>} />
          <Route path="/signup" element={<RequireGuest><SignupPage /></RequireGuest>} />
          <Route path="/admin" element={<RequireGuest><AdminLoginPage /></RequireGuest>} />

          {/* Protected Application Routes */}
          <Route path="/admin-panel" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
          <Route path="/demo-admin" element={<RequireDemoAdmin><AdminPage /></RequireDemoAdmin>} />
          <Route path="/chat" element={<RequireAuth><ChatPage /></RequireAuth>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
