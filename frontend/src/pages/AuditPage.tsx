import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Logo } from '@/components/site/Logo'
import { OperatorChip } from '@/components/site/OperatorChip'
import { Badge } from '@/components/ui/badge'
import { fmtPct } from '@/lib/formatters'

export default function AuditPage() {
  const log = useQuery({ queryKey: ['decisions'], queryFn: () => api.decisions(), retry: false })
  const integrity = useQuery({ queryKey: ['integrity'], queryFn: api.integrity, retry: false })
  const broken = new Set(integrity.data?.broken ?? [])
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-4 border-b px-6 py-3">
        <Link to="/" aria-label="AEGIS-X home"><Logo /></Link>
        <h1 className="text-lg font-semibold">Decision log</h1>
        <nav className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
          <Link to="/command" className="hover:text-foreground">Command Center</Link>
          <Link to="/console" className="hover:text-foreground">Evacuation console</Link>
          <OperatorChip />
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-6">
        <p className="mb-3 text-sm text-muted-foreground">Every decision is stored with who made it, what it was based on, and a fingerprint that includes the decision before it. Editing or removing an old decision breaks the chain and is reported here.</p>
        {integrity.data && (
          <div className={`mb-4 rounded-lg border px-3 py-2 text-sm ${integrity.data.status === 'invalid' ? 'border-risk bg-destructive/10 text-risk' : ''}`} role="status">
            <strong>
              {integrity.data.status === 'invalid'
                ? `Chain broken at decision ${integrity.data.broken.join(', ')}: it was changed or a decision before it was removed.`
                : `Chain intact: ${integrity.data.checked} decisions checked${integrity.data.legacy ? `, ${integrity.data.legacy} older decisions made before fingerprints existed are not covered` : ''}.`}
            </strong>
            <div className="text-xs text-muted-foreground">{integrity.data.note}{integrity.data.head ? ` Latest fingerprint: ${integrity.data.head.slice(0, 16)}...` : ''}</div>
          </div>
        )}
        {log.isError && <p className="text-risk" role="alert">{String(log.error)}</p>}
        {log.data?.length === 0 && <p className="text-muted-foreground">No decisions recorded yet.</p>}
        <ul className="space-y-3">
          {log.data?.map((d) => {
            const fromCommandCenter = d.evidence?.kind === 'command_center_recommendation'
            return (
              <li key={d.id} className={`rounded-lg border p-4 text-sm ${broken.has(d.id) ? 'border-risk' : ''}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={d.action === 'reject' ? 'destructive' : 'default'}>{d.action}</Badge>
                  <strong>#{d.id}</strong>
                  <span className="text-muted-foreground">{new Date(d.decided_at).toLocaleString()} by {d.author} for {d.district}</span>
                  {d.evidence?.exercise === true && <Badge className="bg-amber-500 text-black">simulated exercise</Badge>}
                  {broken.has(d.id) && <Badge variant="destructive">does not verify</Badge>}
                </div>
                {d.run && (
                  <p className="mt-2">
                    Based on run {d.run_id}: {fmtPct(d.run.summary.mean, 0)} on average, {fmtPct(d.run.summary.p10, 0)} at the 10th percentile, {d.run.n_samples} futures, seed {d.run.seed}.
                  </p>
                )}
                {!fromCommandCenter && d.plan.start_hour !== undefined && (
                  <p className="mt-1 text-muted-foreground">
                    Plan: starts at hour {d.plan.start_hour}, boats {JSON.stringify(d.plan.boats_at ?? {})}, protected {(d.plan.protected ?? []).length}, warned by {(d.plan.warning_channels ?? []).join(', ') || 'none'}.
                  </p>
                )}
                {d.explanation && <p className="mt-1">{fromCommandCenter ? '' : 'Explanation shown: '}{d.explanation}</p>}
                {d.note && <p className="mt-1">Note: {d.note}</p>}
                {d.evidence && Object.keys(d.evidence).length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-muted-foreground">Evidence captured with this decision</summary>
                    <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-[11px]">{JSON.stringify(d.evidence, null, 1)}</pre>
                  </details>
                )}
              </li>
            )
          })}
        </ul>
      </main>
    </div>
  )
}
