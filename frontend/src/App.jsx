import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LandingPage from './pages/LandingPage'
import AdminLoginPage from './pages/AdminLoginPage'
import AdminPage from './pages/AdminPage'
import ChatPage from './pages/ChatPage'

function RequireAuth({ children }) {
  const { user } = useAuth()
  if (user === undefined) return null
  if (user === null) return <Navigate to="/" replace />
  return children
}

function RequireAdmin({ children }) {
  const { user } = useAuth()
  if (user === undefined) return null
  if (user === null) return <Navigate to="/admin" replace />
  if (user.role !== 'admin') return <Navigate to="/chat" replace />
  return children
}

function RequireDemoAdmin({ children }) {
  const { user } = useAuth()
  if (user === undefined) return null
  if (user === null) return <Navigate to="/" replace />
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
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/admin" element={<RequireGuest><AdminLoginPage /></RequireGuest>} />
          <Route path="/admin-panel" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
          <Route path="/demo-admin" element={<RequireDemoAdmin><AdminPage /></RequireDemoAdmin>} />
          <Route path="/chat" element={<RequireAuth><ChatPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
