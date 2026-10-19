import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useScenarioStore } from '../../state/scenarioStore'

function resilienceColor(resilience: number): string {
  if (resilience >= 0.6) return '#22c55e' // green
  if (resilience >= 0.35) return '#eab308' // yellow
  return '#ef4444' // red
}

export function OutcomeChart() {
  const result = useScenarioStore((s) => s.monteCarloResult)

  if (!result) {
    return (
      <div className="bg-slate-900 rounded-lg p-3">
        <h2 className="text-sm font-semibold text-slate-200 mb-2">Outcome</h2>
        <p className="text-xs text-slate-500">Run a simulation to see outcomes.</p>
      </div>
    )
  }

  const { summary, resilience_worst_10pct: resilience } = result
  const data = [
    { label: 'p10', value: summary.p10 },
    { label: 'p50', value: summary.p50 },
    { label: 'p90', value: summary.p90 },
  ]

  return (
    <div className="bg-slate-900 rounded-lg p-3 flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-slate-200">Outcome · {result.plan}</h2>

      <div style={{ width: '100%', height: 160 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
            <YAxis domain={[0, 1]} stroke="#94a3b8" fontSize={12} />
            <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(1)}%`} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.label} fill="#38bdf8" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div
        className="rounded px-3 py-2 text-sm font-medium flex justify-between items-center"
        style={{ backgroundColor: `${resilienceColor(resilience)}22`, color: resilienceColor(resilience) }}
      >
        <span>Resilience (worst 10%)</span>
        <span>{(resilience * 100).toFixed(1)}%</span>
      </div>

      <p className="text-xs text-slate-500">
        Mean {(summary.mean * 100).toFixed(1)}% · Best {(summary.best * 100).toFixed(1)}% · Worst{' '}
        {(summary.worst * 100).toFixed(1)}% (n={result.n_samples})
      </p>
    </div>
  )
}
