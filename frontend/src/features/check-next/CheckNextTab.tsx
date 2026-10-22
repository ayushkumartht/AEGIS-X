import { useMutation } from '@tanstack/react-query'
import { CircleCheckBig, Lightbulb, Medal, Search, Trophy } from 'lucide-react'
import { api } from '@/api/client'
import { ActionButton, Empty, Meter, Panel, Pill } from '@/components/viz/kit'
import { useConsole } from '@/state/consoleStore'

const MEDAL = ['bg-amber-400 text-amber-950', 'bg-slate-300 text-slate-900', 'bg-orange-300 text-orange-950']

export function CheckNextTab() {
  const { district, plan, whatIf, voi, setVoi } = useConsole()
  const run = useMutation({
    mutationFn: () => api.voi({ district, plan: plan ?? undefined, what_if: whatIf, n_samples: 200, seed: 42 }),
    onSuccess: setVoi,
  })
  const runButton = (
    <ActionButton icon={Search} busy={run.isPending} busyText="Working it out" onClick={() => run.mutate()} disabled={!plan}>
      {voi ? 'Work it out again' : 'What to check next'}
    </ActionButton>
  )

  if (!voi) {
    return (
      <div className="space-y-3">
        {run.isError && <p className="text-sm text-risk" role="alert">{String(run.error.message)}</p>}
        <Empty icon={Lightbulb} title="What should we find out first?" body="Ranks the facts that, if known now, would most improve the choice of plan. Spend scarce time on the check that matters." action={runButton} />
      </div>
    )
  }
  const useful = voi.check_next.filter((c) => c.voi_pct > 0.05).slice(0, 6)
  const top = Math.max(...useful.map((c) => c.voi_pct), 0.01)

  return (
    <div className="space-y-3 text-sm">
      <Panel icon={Trophy} tone="safe" title="Best plan with what we know now" action={runButton}>
        <p className="text-base font-semibold">{voi.best_plan_now}</p>
        <div className="mt-1.5 flex flex-wrap gap-1">{voi.candidate_plans.map((p) => <Pill key={p} tone={p === voi.best_plan_now ? 'safe' : 'neutral'}>{p}</Pill>)}</div>
      </Panel>

      {useful.length > 0 ? (
        <Panel icon={Lightbulb} title="Check these first" hint="Expected gain in the decision score if this were known before choosing.">
          <ol className="space-y-2">
            {useful.map((c, i) => (
              <li key={c.variable} className="rounded-lg border p-2.5">
                <div className="flex items-start gap-2.5">
                  <span className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${MEDAL[i] ?? 'bg-muted text-muted-foreground'}`}>
                    {i < 3 ? <Medal className="size-3.5" aria-hidden /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold leading-snug">{c.action}</span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-safe">+{c.voi_pct.toFixed(1)}%</span>
                    </div>
                    <Meter value={c.voi_pct} max={top} tone="safe" className="mt-1.5" />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      ) : (
        <Panel icon={CircleCheckBig} tone="safe" title="Nothing to wait for">
          <p className="text-xs leading-relaxed">No single piece of information would change the choice: the best plan is best in every case we can foresee.</p>
        </Panel>
      )}
      <p className="px-1 text-[11px] text-muted-foreground">
        Decision score: share of people at risk evacuated in time, minus {voi.false_alarm_weight} times the share of people moved who never needed to move.
      </p>
    </div>
  )
}
