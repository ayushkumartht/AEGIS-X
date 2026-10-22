import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { AccountMenu } from '@/components/site/AccountMenu'
import { Logo } from '@/components/site/Logo'
import { Badge } from '@/components/ui/badge'
import { fmtPct } from '@/lib/formatters'

export default function AuditPage() {
  const log = useQuery({ queryKey: ['decisions'], queryFn: () => api.decisions(), retry: false })
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-4 border-b px-6 py-3">
        <Link to="/" aria-label="AEGIS-X home"><Logo /></Link>
        <h1 className="text-lg font-semibold">Decision log</h1>
        <nav className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
          <Link to="/console" className="hover:text-foreground">Back to the console</Link>
          <AccountMenu />
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-6">
        <p className="mb-4 text-sm text-muted-foreground">Every decision is stored with who made it, the plan, the analysis it was based on, and the seed that reproduces it.</p>
        {log.isError && <p className="text-risk" role="alert">{String(log.error)}</p>}
        {log.data?.length === 0 && <p className="text-muted-foreground">No decisions recorded yet.</p>}
        <ul className="space-y-3">
          {log.data?.map((d) => (
            <li key={d.id} className="rounded-lg border p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={d.action === 'reject' ? 'destructive' : 'default'}>{d.action}</Badge>
                <strong>#{d.id}</strong>
                <span className="text-muted-foreground">{new Date(d.decided_at).toLocaleString()} by {d.author} for {d.district}</span>
              </div>
              {d.run && (
                <p className="mt-2">
                  Based on run {d.run_id}: {fmtPct(d.run.summary.mean, 0)} on average, {fmtPct(d.run.summary.p10, 0)} at the 10th percentile, {d.run.n_samples} futures, seed {d.run.seed}.
                </p>
              )}
              <p className="mt-1 text-muted-foreground">
                Plan: starts at hour {d.plan.start_hour}, boats {JSON.stringify(d.plan.boats_at ?? {})}, protected {(d.plan.protected ?? []).length}, warned by {(d.plan.warning_channels ?? []).join(', ') || 'none'}.
              </p>
              {d.explanation && <p className="mt-1">Explanation shown: {d.explanation}</p>}
              {d.note && <p className="mt-1">Note: {d.note}</p>}
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
