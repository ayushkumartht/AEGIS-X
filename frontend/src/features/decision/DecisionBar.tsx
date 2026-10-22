import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, CircleCheck, Hand, PencilLine, X } from 'lucide-react'
import { api } from '@/api/client'
import { ActionButton } from '@/components/viz/kit'
import { fmtPct } from '@/lib/formatters'
import { useConsole } from '@/state/consoleStore'

type Action = 'accept' | 'edit' | 'reject'

export function DecisionBar() {
  const { district, plan, sim, narration, compare, redteam, voi, whatIf } = useConsole()
  const [note, setNote] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const qc = useQueryClient()

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

  const save = useMutation({
    mutationFn: (action: Action) =>
      api.addDecision({ district, action, plan: plan ?? {}, run_id: sim?.run_id ?? null, explanation: narration?.text ?? '', note, evidence: captureEvidence() }),
    onSuccess: (r, action) => {
      setDone(`Decision #${r.id} recorded: ${action}.`)
      setNote('')
      qc.invalidateQueries({ queryKey: ['decisions'] })
      qc.invalidateQueries({ queryKey: ['integrity'] })
    },
  })
  const disabled = !sim
  const decide = (a: Action) => {
    setDone(null)
    save.mutate(a)
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t bg-card px-4 py-3 text-sm shadow-[0_-4px_12px_-8px_rgb(15_23_42/0.25)]">
      <div className="flex min-w-60 flex-1 items-center gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Hand className="size-4" aria-hidden /></span>
        <div className="min-w-0">
          {sim ? (
            <div className="leading-tight">
              <span className="font-semibold">{fmtPct(sim.summary.mean, 0)}</span> evacuated on average, <span className="font-semibold">{fmtPct(sim.resilience_worst_10pct, 0)}</span> on a bad day.
              <div className="text-xs text-muted-foreground">Nothing is applied until you decide. Your decision is logged with the evidence.</div>
            </div>
          ) : (
            <div className="leading-tight">
              <span className="font-semibold">Your decision</span>
              <div className="text-xs text-muted-foreground">Test a plan first. Nothing is applied without your decision.</div>
            </div>
          )}
          {done && <div className="mt-0.5 flex items-center gap-1 text-xs font-medium text-safe" role="status"><CircleCheck className="size-3.5" aria-hidden />{done}</div>}
          {save.isError && <div className="text-xs text-risk" role="alert">{String(save.error.message)}</div>}
        </div>
      </div>
      <input
        className="w-56 rounded-lg border bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground"
        aria-label="Note for the log"
        placeholder="Note for the log (optional)"
        value={note}
        maxLength={500}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2">
        <ActionButton variant="success" icon={Check} busy={save.isPending && save.variables === 'accept'} onClick={() => decide('accept')} disabled={disabled || save.isPending}>Accept</ActionButton>
        <ActionButton variant="outline" icon={PencilLine} onClick={() => decide('edit')} disabled={disabled || save.isPending}>Edit and accept</ActionButton>
        <ActionButton variant="danger" icon={X} onClick={() => decide('reject')} disabled={disabled || save.isPending}>Reject</ActionButton>
      </div>
    </div>
  )
}
