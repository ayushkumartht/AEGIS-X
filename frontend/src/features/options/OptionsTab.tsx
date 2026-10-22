import { useMutation } from '@tanstack/react-query'
import { Feather, FolderInput, ShieldCheck, Sparkles, Star, Wand2, type LucideIcon } from 'lucide-react'
import { api } from '@/api/client'
import type { Plan } from '@/api/types'
import { Button } from '@/components/ui/button'
import { ActionButton, Empty, IconChip, Meter, Pill, type Tone } from '@/components/viz/kit'
import { fmtPct } from '@/lib/formatters'
import { useConsole } from '@/state/consoleStore'

const STYLE: Record<string, { icon: LucideIcon; tone: Tone }> = {
  'Safest on a bad day': { icon: ShieldCheck, tone: 'safe' },
  'Best on average': { icon: Star, tone: 'primary' },
  'Leanest (fewest boats)': { icon: Feather, tone: 'flood' },
}

function summary(p: Plan): string {
  const boats = Object.values(p.boats_at ?? {}).reduce((a, b) => a + b, 0)
  return `starts at hour ${p.start_hour?.toFixed(0)}, ${boats} boats, ${(p.protected ?? []).length} areas protected, warning by ${(p.warning_channels ?? []).join(', ') || 'none'}`
}

export function OptionsTab() {
  const { district, whatIf, options, setOptions, setPlan, setTab } = useConsole()
  const run = useMutation({
    mutationFn: () => api.optimize({ district, what_if: whatIf }),
    onSuccess: setOptions,
  })
  const load = (p: Plan) => {
    setPlan(p)
    setTab('plan')
  }
  const runButton = (
    <ActionButton icon={Wand2} busy={run.isPending} busyText="Searching" onClick={() => run.mutate()}>
      {options ? 'Search again' : 'Suggest plans'}
    </ActionButton>
  )

  if (!options) {
    return (
      <div className="space-y-3">
        {run.isError && <p className="text-sm text-risk" role="alert">{String(run.error.message)}</p>}
        <Empty icon={Sparkles} title="Let the optimiser suggest plans" body="Searches for plans that balance people saved, safety on a bad day and boats used. Each is tested on the same futures." action={runButton} />
      </div>
    )
  }
  const base = options.baseline.objectives
  const maxBoats = Math.max(base.boats_used, ...options.options.map((o) => o.objectives.boats_used), 1)

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Compared with the baseline plan on {options.n_samples} shared futures.</p>
        {runButton}
      </div>
      {options.options.map((o) => {
        const s = STYLE[o.label] ?? { icon: Sparkles, tone: 'primary' as Tone }
        const d = o.objectives.worst10_evacuated - base.worst10_evacuated
        return (
          <section key={o.label} className="rounded-xl border bg-card p-3.5 shadow-xs">
            <div className="flex items-center gap-2.5">
              <IconChip icon={s.icon} tone={s.tone} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{o.label}</div>
                <div className="text-[11px] text-muted-foreground">{summary(o.plan)}</div>
              </div>
              <Pill tone={d >= 0 ? 'safe' : 'risk'}>{d >= 0 ? '+' : ''}{Math.round(d * 100)} pts bad day</Pill>
            </div>
            <div className="mt-3 space-y-1.5">
              <Meter value={o.objectives.mean_evacuated} tone="primary" label="Average" right={`${fmtPct(o.objectives.mean_evacuated, 0)} (baseline ${fmtPct(base.mean_evacuated, 0)})`} />
              <Meter value={o.objectives.worst10_evacuated} tone="safe" label="Worst 10%" right={`${fmtPct(o.objectives.worst10_evacuated, 0)} (baseline ${fmtPct(base.worst10_evacuated, 0)})`} />
              <Meter value={o.objectives.boats_used} max={maxBoats} tone="flood" label="Boats used" right={`${o.objectives.boats_used} (baseline ${base.boats_used})`} />
            </div>
            <Button size="sm" variant="soft" className="mt-3 w-full" onClick={() => load(o.plan)}><FolderInput aria-hidden />Load into the plan editor</Button>
          </section>
        )
      })}
      <p className="px-1 text-[11px] text-muted-foreground">A quick search. Load a plan, adjust it, then test it on 500 futures before deciding.</p>
    </div>
  )
}
