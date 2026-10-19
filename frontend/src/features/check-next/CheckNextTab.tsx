import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { useConsole } from '@/state/consoleStore'

export function CheckNextTab() {
  const { district, plan, whatIf, voi, setVoi } = useConsole()
  const run = useMutation({
    mutationFn: () => api.voi({ district, plan: plan ?? undefined, what_if: whatIf, n_samples: 200, seed: 42 }),
    onSuccess: setVoi,
  })
  const top = Math.max(...(voi?.check_next.map((c) => c.voi_pct) ?? [0]), 0.01)

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground">Which piece of information, if we had it now, would improve the decision the most?</p>
        <Button onClick={() => run.mutate()} disabled={run.isPending || !plan}>{run.isPending ? 'Working it out' : 'What to check next'}</Button>
      </div>
      {run.isError && <p className="text-risk" role="alert">{String(run.error)}</p>}
      {voi && (
        <>
          <p className="rounded-lg bg-accent px-3 py-2">
            With what we know now, the best of the candidate plans is <strong>{voi.best_plan_now}</strong>.
          </p>
          <ol className="space-y-2">
            {voi.check_next.filter((c) => c.voi_pct > 0.05).slice(0, 6).map((c, i) => (
              <li key={c.variable} className="rounded-lg border p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{i + 1}. {c.action}</span>
                  <span className="shrink-0 tabular-nums text-safe">+{c.voi_pct.toFixed(1)}%</span>
                </div>
                <div className="mt-2 h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-safe" style={{ width: `${(c.voi_pct / top) * 100}%` }} /></div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Expected gain in the decision score if this were known before choosing among: {voi.candidate_plans.join(', ')}.
                </p>
              </li>
            ))}
          </ol>
          {voi.check_next.every((c) => c.voi_pct <= 0.05) && (
            <p className="text-muted-foreground">No single piece of information would change that choice: it is the best plan in every case we can foresee, so there is nothing to wait for.</p>
          )}
          <p className="text-xs text-muted-foreground">
            Decision score: share of people at risk evacuated in time, minus {voi.false_alarm_weight} times the share of people moved who never needed to move.
          </p>
        </>
      )}
    </div>
  )
}
