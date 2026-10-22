import { create } from 'zustand'
import type { AuthUser } from '@/api/types'

const KEY = 'aegis.session'

interface Session {
  token: string
  user: AuthUser
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  signIn: (s: Session) => void
  signOut: () => void
}

/** The session survives a page reload in this browser only. Storage can be unavailable (private mode). */
function load(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

function save(s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
  } catch {
    /* the session then lasts until the tab closes */
  }
}

const initial = load()

export const useAuth = create<AuthState>((set) => ({
  token: initial?.token ?? null,
  user: initial?.user ?? null,
  signIn: (s) => {
    save(s)
    set({ token: s.token, user: s.user })
  },
  signOut: () => {
    save(null)
    set({ token: null, user: null })
  },
}))

export const canWrite = (user: AuthUser | null) => user?.role === 'admin' || user?.role === 'officer'
