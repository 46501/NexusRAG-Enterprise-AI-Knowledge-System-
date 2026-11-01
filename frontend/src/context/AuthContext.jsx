import { createContext, useContext, useEffect, useState } from 'react'
import { getMe, logout as logoutApi } from '../services/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
  }, [])

  async function logout() {
    try { await logoutApi() } catch {}
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
