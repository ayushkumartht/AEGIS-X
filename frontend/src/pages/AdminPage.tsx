import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '@/api/client'
import type { Account, DistrictStatus, Overview, Role } from '@/api/types'
import { AccountMenu } from '@/components/site/AccountMenu'
import { Logo } from '@/components/site/Logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { fmtPct } from '@/lib/formatters'
import { useAuth } from '@/state/authStore'

const REFRESH_MS = 30_000
const count = (n: number) => n.toLocaleString('en-IN')
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : 'never')
const range = (r: unknown, unit: string) =>
  Array.isArray(r) && r.length === 2 ? `${Number(r[0]).toFixed(1)} to ${Number(r[1]).toFixed(1)} ${unit}` : 'not available'

export default function AdminPage() {
  const user = useAuth((s) => s.user)
  const isAdmin = user?.role === 'admin'
  const overview = useQuery({ queryKey: ['overview'], queryFn: api.overview, enabled: isAdmin, refetchInterval: REFRESH_MS, retry: false })
  const o = overview.data

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-4 border-b px-6 py-3 text-sm">
        <Link to="/" aria-label="AEGIS-X home"><Logo /></Link>
        <h1 className="text-lg font-semibold">Admin</h1>
        <nav className="ml-auto flex flex-wrap items-center gap-4 text-muted-foreground">
          <Link className="hover:text-foreground" to="/command">Command Center</Link>
          <Link className="hover:text-foreground" to="/console/cachar">Console</Link>
          <Link className="hover:text-foreground" to="/audit">Decision log</Link>
          <AccountMenu />
        </nav>
      </header>

      {!isAdmin ? (
        <main className="mx-auto max-w-xl px-6 py-16 text-center">
          <p className="text-lg font-medium">The admin page is for administrators.</p>
          <p className="mt-2 text-muted-foreground">{user ? `You are signed in as ${user.role}.` : 'Sign in with an admin account to continue.'}</p>
          {!user && <Button className="mt-6" asChild><Link to="/login?next=/admin">Sign in</Link></Button>}
        </main>
      ) : (
        <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
          {overview.isError && <p className="text-risk" role="alert">{String(overview.error)}</p>}
          {overview.isPending && <p className="text-muted-foreground">Loading live status</p>}
          {o && (
            <>
              <StatTiles o={o} />
              <section className="grid gap-4 lg:grid-cols-2">
                {o.districts.map((d) => <DistrictCard key={d.id} d={d} />)}
              </section>
              <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                <ActivityChart o={o} />
                <SystemCard o={o} />
              </section>
              <RecentRuns o={o} />
              <section className="grid gap-4 lg:grid-cols-2">
                <RecentDecisions o={o} />
                <RecentReports o={o} />
              </section>
              <Accounts selfId={user!.id} />
            </>
          )}
        </main>
      )}
    </div>
  )
}

function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-semibold">{title}</h2>
        <div className="ml-auto">{action}</div>
      </div>
      {children}
    </section>
  )
}

function StatTiles({ o }: { o: Overview }) {
  const tiles: [string, number, string][] = [
    ['Plans tested', o.counts.run, 'Monte Carlo runs stored'],
    ['Decisions', o.counts.decision, 'accept, edit or reject'],
    ['Field reports', o.counts.field_report, 'fused into the forecast'],
    ['Accounts', o.counts.user, 'admins, officers, viewers'],
  ]
  return (
    <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map(([label, value, hint]) => (
        <div key={label} className="rounded-xl border bg-card p-4">
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums">{count(value)}</div>
          <div className="text-xs text-muted-foreground">{hint}</div>
        </div>
      ))}
    </section>
  )
}

function DistrictCard({ d }: { d: DistrictStatus }) {
  const f = d.forecast
  const live = f?.source === 'live forecast ensembles'
  return (
    <Card
      title={d.name}
      action={d.built ? <Link className="text-sm underline" to={`/console/${d.id}`}>Open console</Link> : <Badge variant="secondary">not built</Badge>}
    >
      {d.error && <p className="text-sm text-risk">{d.error}</p>}
      {f && (
        <div className="space-y-1 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={live ? 'default' : 'secondary'}>{d.synthetic ? 'synthetic' : live ? 'live forecast' : 'priors only'}</Badge>
            <span className="text-muted-foreground">{f.source}{f.forecast_date ? `, issued ${f.forecast_date}` : ''}</span>
          </div>
          {f.warning && <p className="text-risk">{f.warning}</p>}
          {!d.synthetic && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
              <dt className="text-muted-foreground">Peak water level (forecast range)</dt>
              <dd className="tabular-nums">{range(f.peak_stage_range_m, 'm above normal')}</dd>
              <dt className="text-muted-foreground">Rain over the forecast</dt>
              <dd className="tabular-nums">{range(f.rain_range_mm, 'mm')}</dd>
            </dl>
          )}
        </div>
      )}
      {d.totals && (
        <dl className="mt-3 grid grid-cols-3 gap-3 border-t pt-3 text-sm">
          {([
            ['People', count(d.totals.population)],
            ['Areas', d.totals.areas],
            ['Shelters', `${d.totals.shelters} (${count(d.totals.shelter_capacity)} places)`],
            ['Bridges', d.totals.bridges],
            ['Boats', d.totals.boats ?? 'unknown'],
          ] as const).map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {d.beliefs && d.beliefs.length > 0 && (
        <ul className="mt-3 space-y-1 border-t pt-3 text-sm">
          {d.beliefs.map((b) => (
            <li key={b.subject}>
              <strong>{b.subject}</strong>: {b.p_open !== undefined ? `${(b.p_open * 100).toFixed(0)}% chance open` : `range ${b.range?.map((x) => x.toFixed(2)).join(' to ')}`} ({b.source})
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function ActivityChart({ o }: { o: Overview }) {
  const data = o.activity.map((a) => ({ ...a, day: a.date.slice(5) }))
  return (
    <Card title="Plans tested per day (last 14 days)">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
            <Tooltip
              cursor={{ fill: 'var(--accent)' }}
              formatter={(v) => [`${v} runs`, '']}
              labelFormatter={(l, p) => {
                const row = p?.[0]?.payload as (typeof data)[number] | undefined
                return row ? `${row.date}: ${row.decisions} decisions, ${row.reports} reports` : String(l)
              }}
            />
            <Bar dataKey="runs" fill="var(--flood)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-muted-foreground">Show as a table</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead className="text-muted-foreground"><tr><th>Date</th><th>Runs</th><th>Decisions</th><th>Reports</th></tr></thead>
          <tbody>{o.activity.map((a) => <tr key={a.date}><td>{a.date}</td><td>{a.runs}</td><td>{a.decisions}</td><td>{a.reports}</td></tr>)}</tbody>
        </table>
      </details>
    </Card>
  )
}

function SystemCard({ o }: { o: Overview }) {
  const s = o.system
  const rows: [string, string][] = [
    ['Version', `${s.version} (${s.env})`],
    ['Language model', s.llm_provider === 'none' ? 'off, templates only' : `${s.llm_provider}${s.llm_model ? ` / ${s.llm_model}` : ''}`],
    ['External data', s.offline ? 'offline, cache only' : 'live'],
    ['Rate limit', s.rate_limit_per_min > 0 ? `${s.rate_limit_per_min} heavy requests per visitor per minute` : 'off'],
    ['Parallel simulations', String(s.max_heavy_jobs)],
    ['Server time', when(s.server_time)],
  ]
  return (
    <Card title="System">
      <dl className="space-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function RecentRuns({ o }: { o: Overview }) {
  return (
    <Card title="Latest plan tests">
      {o.recent_runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No plans tested yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm tabular-nums">
            <thead className="text-muted-foreground">
              <tr><th className="py-1">Run</th><th>When</th><th>District</th><th>Futures</th><th>Evacuated (average)</th><th>Bad day (10th pct)</th><th>Seed</th></tr>
            </thead>
            <tbody>
              {o.recent_runs.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-1.5">#{r.id}</td>
                  <td>{when(r.created_at)}</td>
                  <td>{r.district}</td>
                  <td>{r.n_samples}</td>
                  <td>{fmtPct(r.summary.mean, 0)}</td>
                  <td>{fmtPct(r.summary.p10, 0)}</td>
                  <td>{r.seed ?? 'random'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function RecentDecisions({ o }: { o: Overview }) {
  return (
    <Card title="Latest decisions" action={<Link className="text-sm underline" to="/audit">Full log</Link>}>
      {o.recent_decisions.length === 0 && <p className="text-sm text-muted-foreground">No decisions recorded yet.</p>}
      <ul className="space-y-2 text-sm">
        {o.recent_decisions.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-2">
            <Badge variant={d.action === 'reject' ? 'destructive' : 'default'}>{d.action}</Badge>
            <span>#{d.id} {d.district}{d.run_id ? `, run #${d.run_id}` : ''}</span>
            <span className="text-muted-foreground">{d.author.split(' <')[0]}, {when(d.decided_at)}</span>
            {d.note && <span className="w-full text-muted-foreground">"{d.note}"</span>}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function RecentReports({ o }: { o: Overview }) {
  return (
    <Card title="Latest field reports">
      {o.recent_reports.length === 0 && <p className="text-sm text-muted-foreground">No field reports yet.</p>}
      <ul className="space-y-2 text-sm">
        {o.recent_reports.map((r) => (
          <li key={r.id}>
            <span className="font-medium">"{r.raw_text}"</span>{' '}
            <span className="text-muted-foreground">
              read as {r.parsed.claim.replace('_', ' ')}; {r.source_type.replace('_', ' ')}, {r.district}
              {r.author ? `, ${r.author.split(' <')[0]}` : ''}, {when(r.received_at)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

const ROLES: Role[] = ['admin', 'officer', 'viewer']

function Accounts({ selfId }: { selfId: number }) {
  const qc = useQueryClient()
  const users = useQuery({ queryKey: ['users'], queryFn: api.users })
  const [form, setForm] = useState({ email: '', name: '', role: 'officer' as Role, password: '' })
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['users'] })
    qc.invalidateQueries({ queryKey: ['overview'] })
  }
  const add = useMutation({
    mutationFn: () => api.addUser(form),
    onSuccess: () => {
      setForm({ email: '', name: '', role: 'officer', password: '' })
      refresh()
    },
  })
  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Parameters<typeof api.updateUser>[1] }) => api.updateUser(id, body),
    onSuccess: refresh,
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    add.mutate()
  }
  const resetPassword = (u: Account) => {
    const password = window.prompt(`New password for ${u.email} (at least 8 characters)`)
    if (password) update.mutate({ id: u.id, body: { password } })
  }

  return (
    <Card title="Accounts">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="text-muted-foreground">
            <tr><th className="py-1">Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last sign-in</th><th /></tr>
          </thead>
          <tbody>
            {users.data?.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="py-1.5">{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <select
                    className="rounded-md border bg-background px-1.5 py-1"
                    value={u.role}
                    disabled={u.id === selfId}
                    onChange={(e) => update.mutate({ id: u.id, body: { role: e.target.value as Role } })}
                    aria-label={`Role of ${u.email}`}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td>{u.active ? 'active' : <span className="text-risk">disabled</span>}</td>
                <td>{when(u.last_login_at)}</td>
                <td className="space-x-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => resetPassword(u)}>Reset password</Button>
                  {u.id !== selfId && (
                    <Button size="sm" variant="outline" onClick={() => update.mutate({ id: u.id, body: { active: !u.active } })}>
                      {u.active ? 'Disable' : 'Enable'}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {update.isError && <p className="mt-2 text-sm text-risk" role="alert">{String(update.error.message)}</p>}

      <form onSubmit={submit} className="mt-4 grid gap-2 border-t pt-4 text-sm sm:grid-cols-[1fr_1fr_8rem_1fr_auto]">
        <input className="rounded-lg border bg-background px-2 py-1.5" placeholder="Name" required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Name" />
        <input className="rounded-lg border bg-background px-2 py-1.5" placeholder="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-label="Email" />
        <select className="rounded-lg border bg-background px-2 py-1.5" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} aria-label="Role">
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <input className="rounded-lg border bg-background px-2 py-1.5" placeholder="Password (8+ characters)" type="password" minLength={8} required autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} aria-label="Password" />
        <Button type="submit" size="sm" disabled={add.isPending}>Add account</Button>
      </form>
      {add.isError && <p className="mt-2 text-sm text-risk" role="alert">{String(add.error.message)}</p>}
    </Card>
  )
}
