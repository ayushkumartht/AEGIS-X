import { useMutation } from '@tanstack/react-query'
import {
  Activity, AlertTriangle, BarChart3, Clock, GitCompareArrows, Home, Sparkles, Undo2, Users, Waves, type LucideIcon,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '@/api/client'
import type { Histogram, SimResult } from '@/api/types'
import { ActionButton, Empty, Meter, Panel, Pill, Ring, Stat, type Tone } from '@/components/viz/kit'
import { fmtPct } from '@/lib/formatters'
import { useConsole } from '@/state/consoleStore'

const baselineName = 'Baseline plan'

function histData(h: Histogram) {
  return h.counts.map((c, i) => ({ x: ((h.edges[i] + h.edges[i + 1]) / 2) * 100, count: c }))
}

function Chart({ sim }: { sim: SimResult }) {
  return (
    <div className="h-44" role="img" aria-label="Histogram of the share of people evacuated across all futures">
      <ResponsiveContainer>
        <BarChart data={histData(sim.histogram)} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="x" type="number" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} fontSize={11} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: 'var(--accent)' }} formatter={(v) => [`${v} futures`, '']} labelFormatter={(l) => `${Number(l).toFixed(0)}% evacuated`} />
          <ReferenceLine x={sim.resilience_worst_10pct * 100} stroke="var(--risk)" strokeDasharray="4 3" />
          <ReferenceLine x={sim.summary.mean * 100} stroke="var(--primary)" strokeWidth={2} />
          <Bar dataKey="count" fill="var(--flood)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const toneFor = (worst: number): Tone => (worst < 0.4 ? 'risk' : worst < 0.65 ? 'warn' : 'safe')

export function ResultsTab() {
  const { district, plan, whatIf, sim, compare, setCompare, redteam, narration, setNarration } = useConsole()
  const doCompare = useMutation({
    mutationFn: async () => {
      const base = await api.baselinePlan(district)
      return api.compare({ district, plans: { [baselineName]: base, 'Your plan': plan ?? base }, what_if: whatIf, n_samples: 500, seed: 42 })
    },
    onSuccess: setCompare,
  })
  const explain = useMutation({
    mutationFn: () => api.explain({ summary: sim?.summary, resilience_worst_10pct: sim?.resilience_worst_10pct, single_points_of_failure: redteam?.single_points_of_failure.slice(0, 3), failure_boxes: redteam?.failure_boxes.slice(0, 1) }),
    onSuccess: setNarration,
  })

  if (!sim) {
    return <Empty icon={BarChart3} title="No results yet" body="Test a plan on the Plan tab to see how it holds up across hundreds of possible futures: the average, the bad day, and what goes wrong." />
  }
  const worst = sim.resilience_worst_10pct
  const m = sim.metric_means
  const tiles: { icon: LucideIcon; label: string; value: string; hint: string; tone?: Tone }[] = [
    { icon: Users, label: 'Still at risk', value: `${m.people_at_risk_end?.toFixed(0)}`, hint: 'people not safe at the end', tone: (m.people_at_risk_end ?? 0) > 0 ? 'risk' : 'safe' },
    { icon: Clock, label: 'Rescued late', value: `${m.rescued_late?.toFixed(0)}`, hint: 'more than 6 h after the water came', tone: (m.rescued_late ?? 0) > 0 ? 'warn' : 'safe' },
    { icon: Undo2, label: 'Moved needlessly', value: `${m.unneeded_evacuations?.toFixed(0)}`, hint: 'their area never flooded' },
    { icon: Home, label: 'Shelter overflow', value: `${m.shelter_overflow?.toFixed(0)}`, hint: 'people with no place', tone: (m.shelter_overflow ?? 0) > 0 ? 'risk' : 'safe' },
    { icon: Waves, label: 'Areas that flood', value: fmtPct(m.flooded_cluster_share ?? 0, 0), hint: 'share of all areas' },
    { icon: Clock, label: 'Time per area', value: `${m.avg_evac_time_h?.toFixed(1)} h`, hint: 'to finish an area' },
  ]

  return (
    <div className="space-y-3 text-sm">
      <Panel icon={Activity} title="How the plan holds up" hint={`Tested on ${sim.n_samples} possible futures. Run ${sim.run_id}; the same seed gives the same result.`}>
        <div className="flex items-center justify-around gap-2">
          <Ring value={sim.summary.mean} label="On average" tone="primary" />
          <Ring value={worst} label="Worst 10% of futures" tone={toneFor(worst)} />
          <Ring value={m.boat_utilisation ?? 0} label="Boat capacity used" tone="flood" />
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Likely range <strong className="text-foreground">{fmtPct(sim.summary.p10, 0)} to {fmtPct(sim.summary.p90, 0)}</strong> (10th to 90th percentile)
        </p>
      </Panel>

      <Panel icon={BarChart3} title="Every possible future" hint="Each bar counts futures that ended with that share of people safe.">
        <Chart sim={sim} />
        <div className="mt-1 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><i className="inline-block h-0.5 w-4 bg-primary" />average</span>
          <span className="inline-flex items-center gap-1"><i className="inline-block h-0.5 w-4 border-t-2 border-dashed border-risk" />worst 10%</span>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-2">
        {tiles.map((t) => <Stat key={t.label} icon={t.icon} label={t.label} value={t.value} hint={t.hint} tone={t.tone} />)}
      </div>

      <Panel
        icon={GitCompareArrows}
        title="Your plan against the baseline"
        hint="Both are tested on the same futures, so the difference comes from the plan."
        action={<ActionButton size="sm" variant="soft" busy={doCompare.isPending} busyText="Comparing" onClick={() => doCompare.mutate()}>Compare</ActionButton>}
      >
        {doCompare.isError && <p className="text-xs text-risk">{String(doCompare.error.message)}</p>}
        {!compare && !doCompare.isPending && <p className="text-xs text-muted-foreground">Press Compare to run both plans side by side on {500} shared futures.</p>}
        {compare && (
          <ul className="space-y-3">
            {Object.entries(compare.plans).map(([name, p]) => (
              <li key={name}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-semibold">{name}</span>
                  <span className="text-muted-foreground">range {fmtPct(p.summary.p10, 0)} to {fmtPct(p.summary.p90, 0)}</span>
                </div>
                <Meter value={p.summary.mean} tone="primary" label="Average" right={fmtPct(p.summary.mean, 0)} />
                <Meter value={p.summary.resilience ?? 0} tone={toneFor(p.summary.resilience ?? 0)} label="Worst 10%" right={fmtPct(p.summary.resilience ?? 0, 0)} className="mt-1.5" />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        icon={Sparkles}
        title="In plain language"
        hint="A short written summary of the numbers above."
        action={<ActionButton size="sm" variant="soft" busy={explain.isPending} busyText="Writing" onClick={() => explain.mutate()}>Explain</ActionButton>}
      >
        {!narration && !explain.isPending && <p className="text-xs text-muted-foreground">Press Explain to get the result written out in words.</p>}
        {narration && (
          <>
            <p className="leading-relaxed">{narration.text}</p>
            <div className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <Pill tone={narration.source === 'template' ? 'neutral' : 'safe'}>{narration.source === 'template' ? 'fixed template' : `${narration.source} model`}</Pill>
              <span>Written from the numbers above. The writer adds no findings of its own.</span>
            </div>
          </>
        )}
        {explain.isError && <p className="mt-2 flex items-center gap-1 text-xs text-risk"><AlertTriangle className="size-3.5" aria-hidden />{explain.error.message}</p>}
      </Panel>
    </div>
  )
}
