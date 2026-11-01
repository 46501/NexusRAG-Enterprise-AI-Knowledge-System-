import { BrowserRouter, Navigate, Route, Routes, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import AdminLoginPage from './pages/AdminLoginPage'
import AdminPage from './pages/AdminPage'
import ChatPage from './pages/ChatPage'
import AccessDeniedPage from './pages/AccessDeniedPage'

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

function DepartmentRoute() {
  const { user } = useAuth()
  const { department } = useParams()
  const [searchParams] = useSearchParams()
  const location = useLocation()

  // 1. Loading user state
  if (user === undefined) return null

  // 2. Unauthenticated or session expired -> redirect to Login
  if (user === null) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // 3. Extract requested department from route param, query param, state, or path
  const pathDept = location.pathname.replace(/^\/(chat|departments|workspace)\/?/, '').replace(/^\//, '').toLowerCase()
  const target = (
    location.state?.targetDepartment ||
    department ||
    searchParams.get('dept') ||
    searchParams.get('department') ||
    pathDept
  )?.toLowerCase()

  // 4. Admin / demo_admin has global access across all departments
  if (user.role === 'admin' || user.role === 'demo_admin') {
    return <ChatPage targetDepartment={target} />
  }

  // 5. Authenticated but unauthorized user accessing another department -> Show Access Denied
  const validDepartments = ['hr', 'engineering', 'finance', 'admin']
  if (target && validDepartments.includes(target) && target !== user.role.toLowerCase()) {
    return <AccessDeniedPage targetDepartment={target} userRole={user.role} />
  }

  // 6. Authorized user -> access their workspace
  return <ChatPage />
}

function RequireAdmin({ children }) {
  const { user } = useAuth()
  if (user === undefined) return null
  if (user === null) return <Navigate to="/login" replace />
  if (user.role !== 'admin' && user.role !== 'demo_admin') {
    return <AccessDeniedPage targetDepartment="admin" userRole={user.role} />
  }
  return children
}

function RequireDemoAdmin({ children }) {
  const { user } = useAuth()
  if (user === undefined) return null
  if (user === null) return <Navigate to="/login" replace />
  if (user.role !== 'demo_admin' && user.role !== 'admin') {
    return <AccessDeniedPage targetDepartment="admin" userRole={user.role} />
  }
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
            {/* Root: Unauthenticated visitors see Login; Authenticated visitors see Dashboard */}
            <Route path="/" element={<RootRoute />} />

            {/* Authentication Routes */}
            <Route path="/login" element={<RequireGuest><LoginPage /></RequireGuest>} />
            <Route path="/signup" element={<RequireGuest><SignupPage /></RequireGuest>} />
            <Route path="/admin" element={<RequireGuest><AdminLoginPage /></RequireGuest>} />

            {/* Protected Administrative Routes */}
            <Route path="/admin-panel" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
            <Route path="/demo-admin" element={<RequireDemoAdmin><AdminPage /></RequireDemoAdmin>} />

            {/* Department & Chat Workspaces */}
            <Route path="/chat" element={<DepartmentRoute />} />
            <Route path="/chat/:department" element={<DepartmentRoute />} />
            <Route path="/departments/:department" element={<DepartmentRoute />} />
            <Route path="/workspace/:department" element={<DepartmentRoute />} />
            <Route path="/hr" element={<DepartmentRoute />} />
            <Route path="/engineering" element={<DepartmentRoute />} />
            <Route path="/finance" element={<DepartmentRoute />} />

            {/* Standalone Access Denied Screen */}
            <Route path="/access-denied" element={<RequireAuth><AccessDeniedPage /></RequireAuth>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
