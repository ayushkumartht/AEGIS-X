import { useMutation } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '@/api/client'
import type { Histogram, SimResult } from '@/api/types'
import { Button } from '@/components/ui/button'
import { fmtPct } from '@/lib/formatters'
import { useConsole } from '@/state/consoleStore'

const baselineName = 'Baseline plan'

function histData(h: Histogram) {
  return h.counts.map((c, i) => ({ x: ((h.edges[i] + h.edges[i + 1]) / 2) * 100, count: c }))
}

function Big({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: 'risk' | 'safe' | 'warn' }) {
  const color = tone === 'risk' ? 'text-risk' : tone === 'safe' ? 'text-safe' : tone === 'warn' ? 'text-warn' : ''
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </div>
  )
}

function Chart({ sim }: { sim: SimResult }) {
  return (
    <div className="h-44" role="img" aria-label="Histogram of the share of people evacuated across all futures">
      <ResponsiveContainer>
        <BarChart data={histData(sim.histogram)} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="x" type="number" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} fontSize={11} />
          <YAxis allowDecimals={false} fontSize={11} />
          <Tooltip formatter={(v) => [`${v} futures`, '']} labelFormatter={(l) => `${Number(l).toFixed(0)}% evacuated`} />
          <ReferenceLine x={sim.resilience_worst_10pct * 100} stroke="var(--risk)" strokeDasharray="4 3" />
          <ReferenceLine x={sim.summary.mean * 100} stroke="var(--primary)" />
          <Bar dataKey="count" fill="var(--flood)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

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

  if (!sim) return <p className="text-sm text-muted-foreground">Test a plan to see how it holds up across hundreds of possible futures.</p>
  const worst = sim.resilience_worst_10pct
  const m = sim.metric_means

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-3 gap-2">
        <Big label="On average" value={fmtPct(sim.summary.mean, 0)} hint="of people at risk reach safety in time" />
        <Big label="Worst 10% of futures" value={fmtPct(worst, 0)} hint="the bad-day outcome" tone={worst < 0.4 ? 'risk' : worst < 0.65 ? 'warn' : 'safe'} />
        <Big label="Likely range" value={`${fmtPct(sim.summary.p10, 0)} to ${fmtPct(sim.summary.p90, 0)}`} hint="10th to 90th percentile" />
      </div>
      <Chart sim={sim} />
      <p className="text-xs text-muted-foreground">
        {sim.n_samples} futures. Solid line: average. Dashed red line: worst 10%. Run {sim.run_id}, same seed gives the same result.
      </p>

      <table className="w-full">
        <tbody className="divide-y">
          {[
            ['People still at risk at the end', `${m.people_at_risk_end?.toFixed(0)}`],
            ['Rescued, but more than 6 h after the water arrived', `${m.rescued_late?.toFixed(0)}`],
            ['Moved although their area never flooded', `${m.unneeded_evacuations?.toFixed(0)}`],
            ['Shelter overflow', `${m.shelter_overflow?.toFixed(0)}`],
            ['Boat capacity used', fmtPct(m.boat_utilisation ?? 0, 0)],
            ['Share of areas that flood', fmtPct(m.flooded_cluster_share ?? 0, 0)],
            ['Average time to finish an area', `${m.avg_evac_time_h?.toFixed(1)} h`],
          ].map(([k, v]) => (
            <tr key={k}><td className="py-1.5 text-muted-foreground">{k}</td><td className="py-1.5 text-right tabular-nums">{v}</td></tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-2 rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Your plan against the baseline</h3>
          <Button size="sm" variant="outline" onClick={() => doCompare.mutate()} disabled={doCompare.isPending}>
            {doCompare.isPending ? 'Comparing' : 'Compare'}
          </Button>
        </div>
        {doCompare.isError && <p className="text-risk">{String(doCompare.error)}</p>}
        {compare && (
          <table className="w-full">
            <thead className="text-left text-muted-foreground"><tr><th className="font-normal">Plan</th><th className="font-normal">Average</th><th className="font-normal">Worst 10%</th><th className="font-normal">Range</th></tr></thead>
            <tbody>
              {Object.entries(compare.plans).map(([name, p]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td className="tabular-nums">{fmtPct(p.summary.mean, 0)}</td>
                  <td className="tabular-nums">{fmtPct(p.summary.resilience ?? 0, 0)}</td>
                  <td className="tabular-nums text-muted-foreground">{fmtPct(p.summary.p10, 0)} to {fmtPct(p.summary.p90, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {compare && <p className="text-xs text-muted-foreground">Both plans were tested on the same {compare.n_samples} futures, so the difference comes from the plan.</p>}
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">In plain language</h3>
          <Button size="sm" variant="outline" onClick={() => explain.mutate()} disabled={explain.isPending}>Explain</Button>
        </div>
        {narration && (
          <>
            <p>{narration.text}</p>
            <p className="text-xs text-muted-foreground">Written from the numbers above by {narration.source === 'template' ? 'a fixed template' : `the ${narration.source} language model`}. The model adds no findings of its own.</p>
          </>
        )}
        {explain.isError && <p className="text-risk">{String(explain.error)}</p>}
      </div>
    </div>
  )
}
