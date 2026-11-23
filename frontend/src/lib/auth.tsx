import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError } from './api'

export type Role = 'OWNER' | 'MANAGER' | 'MECHANIC' | 'DRIVER'
export interface Session {
  user: { id: string; name: string; email: string; role: Role }
  company: { id: string; name: string; isDemo: boolean }
}

interface AuthState {
  session: Session | null
  /** True until the first /auth/me answer, so routes do not flash the login page. */
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (v: { company: string; name: string; email: string; password: string }) => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<Session>('/auth/me')
      .then(setSession)
      .catch((e) => {
        if (!(e instanceof ApiError) || e.status !== 401) console.error(e)
        setSession(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => setSession(await api<Session>('/auth/login', { body: { email, password } })), [])
  const register = useCallback(async (v: { company: string; name: string; email: string; password: string }) => setSession(await api<Session>('/auth/register', { body: v })), [])
  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' })
    setSession(null)
  }, [])

  const value = useMemo(() => ({ session, loading, login, register, logout }), [session, loading, login, register, logout])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth must be used inside AuthProvider')
  return c
}
