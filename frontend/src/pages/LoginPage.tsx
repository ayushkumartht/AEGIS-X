import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Logo } from '@/components/site/Logo'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/state/authStore'

/** Only same-site paths are allowed as the place to return to after signing in. */
function safeNext(next: string | null, fallback: string) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback
}

export default function LoginPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const signIn = useAuth((s) => s.signIn)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const login = useMutation({
    mutationFn: () => api.login(email.trim(), password),
    onSuccess: (session) => {
      signIn(session)
      navigate(safeNext(params.get('next'), '/command'), { replace: true })
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    login.mutate()
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b px-6 py-3">
        <Link to="/" aria-label="AEGIS-X home"><Logo /></Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <div>
            <h1 className="text-xl font-semibold">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Officers sign in to record decisions and field reports and to ask the Command Center for a brief. Admins also get the admin page. Exploring districts and testing plans needs no account.
            </p>
          </div>
          <label className="block text-sm">
            <span className="font-medium">Email</span>
            <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Password</span>
            <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {login.isError && <p className="text-sm text-risk" role="alert">{String(login.error.message)}</p>}
          <Button type="submit" className="w-full" disabled={login.isPending}>{login.isPending ? 'Signing in' : 'Sign in'}</Button>
          <p className="text-center text-xs text-muted-foreground">
            Accounts are created by an administrator. <Link className="underline" to="/console/cachar">Continue without signing in</Link>
          </p>
        </form>
      </main>
    </div>
  )
}
