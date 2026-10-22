import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { fmtPct } from '@/lib/formatters'
import { canWrite, useAuth } from '@/state/authStore'
import { useConsole } from '@/state/consoleStore'

type Action = 'accept' | 'edit' | 'reject'

export function DecisionBar() {
  const { district, plan, sim, narration, compare, redteam, voi, whatIf } = useConsole()
  const user = useAuth((s) => s.user)
  const location = useLocation()
  const [note, setNote] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const qc = useQueryClient()

  const save = useMutation({
    mutationFn: (action: Action) =>
      api.addDecision({ district, action, plan: plan ?? {}, run_id: sim?.run_id ?? null, explanation: narration?.text ?? '', note, evidence: captureEvidence() }),
    onSuccess: (r, action) => {
      setDone(`Decision #${r.id} recorded: ${action}.`)
      setNote('')
      qc.invalidateQueries({ queryKey: ['decisions'] })
    },
  })
  /** What the officer was looking at: kept with the decision so it can be reviewed later. */
  const captureEvidence = () => ({
    kind: 'console_plan_decision',
    what_if: whatIf,
    forecast: sim?.forecast ?? null,
    result: sim ? { n_samples: sim.n_samples, summary: sim.summary, resilience_worst_10pct: sim.resilience_worst_10pct, metric_means: sim.metric_means } : null,
    comparison: compare ? Object.fromEntries(Object.entries(compare.plans).map(([k, v]) => [k, v.summary])) : null,
    red_team: redteam
      ? { failure_rate: redteam.failure_rate, fail_below: redteam.fail_below, single_points_of_failure: redteam.single_points_of_failure.slice(0, 3), failure_boxes: redteam.failure_boxes.slice(0, 2).map((b) => b.description) }
      : null,
    check_next: voi ? voi.check_next.slice(0, 3) : null,
  })
  const allowed = canWrite(user)
  const disabled = !sim || save.isPending || !allowed
  const decide = (a: Action) => {
    setDone(null)
    save.mutate(a)
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-t bg-card px-4 py-3 text-sm">
      <div className="min-w-48 flex-1">
        {sim ? (
          <span>
            Current plan: <strong>{fmtPct(sim.summary.mean, 0)}</strong> on average, <strong>{fmtPct(sim.resilience_worst_10pct, 0)}</strong> on a bad day.
          </span>
        ) : (
          <span className="text-muted-foreground">Test a plan to decide on it. Nothing is applied without your decision.</span>
        )}
        {done && <div className="text-safe" role="status">{done}</div>}
        {save.isError && <div className="text-risk" role="alert">{String(save.error)}</div>}
      </div>
      {allowed ? (
        <>
          <span className="text-muted-foreground">Signed as <strong className="text-foreground">{user?.name}</strong></span>
          <input className="w-56 rounded-lg border bg-background px-2 py-1.5" aria-label="Note for the log" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </>
      ) : (
        <span className="text-muted-foreground">
          <Link className="font-medium text-foreground underline" to={`/login?next=${encodeURIComponent(location.pathname)}`}>Sign in</Link> as an officer to record a decision.
        </span>
      )}
      <div className="flex gap-2">
        <Button onClick={() => decide('accept')} disabled={disabled}>Accept</Button>
        <Button variant="outline" onClick={() => decide('edit')} disabled={disabled}>Edit and accept</Button>
        <Button variant="outline" onClick={() => decide('reject')} disabled={disabled}>Reject</Button>
      </div>
    </div>
  )
}
