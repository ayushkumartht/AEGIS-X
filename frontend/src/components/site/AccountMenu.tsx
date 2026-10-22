import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/state/authStore'

/** Header links for the session: sign in, or who is signed in, the Command Center (admins) and sign out. */
export function AccountMenu() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  if (!user) {
    return (
      <Link className="hover:text-foreground" to={`/login?next=${encodeURIComponent(location.pathname)}`}>
        Sign in
      </Link>
    )
  }
  return (
    <span className="flex items-center gap-4">
      {user.role === 'admin' && <Link className="hover:text-foreground" to="/command">Command Center</Link>}
      <span className="text-foreground" title={user.email}>{user.name} ({user.role})</span>
      <button className="hover:text-foreground" onClick={signOut}>Sign out</button>
    </span>
  )
}
