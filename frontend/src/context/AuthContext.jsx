import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getMe, logout as logoutApi } from '../services/auth'

const AuthContext = createContext(null)
const SESSION_USER_KEY = 'nexus_user_session'

function getInitialUser() {
  try {
    const raw = sessionStorage.getItem(SESSION_USER_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && parsed.role) {
        return parsed
      }
    }
  } catch {}
  return undefined
}

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(getInitialUser)

  const setUser = useCallback((nextUser) => {
    setUserState(nextUser)
    try {
      if (nextUser && typeof nextUser === 'object') {
        sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(nextUser))
      } else {
        sessionStorage.removeItem(SESSION_USER_KEY)
      }
    } catch {}
  }, [])

  useEffect(() => {
    let active = true
    getMe()
      .then((data) => {
        if (active) setUser(data)
      })
      .catch((err) => {
        if (active) {
          if (err?.response?.status === 401 || err?.response?.status === 403) {
            setUser(null)
          } else {
            // Keep cached session if offline/cold start, but if no cache set null
            setUserState((prev) => (prev !== undefined ? prev : null))
          }
        }
      })
    return () => {
      active = false
    }
  }, [setUser])

  const logout = useCallback(async () => {
    try {
      await logoutApi()
    } catch {}
    setUser(null)
  }, [setUser])

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

