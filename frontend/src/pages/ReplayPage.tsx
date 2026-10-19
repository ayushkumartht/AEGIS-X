import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '@/api/client'
import { Logo } from '@/components/site/Logo'
import { Badge } from '@/components/ui/badge'
import { fmtPct } from '@/lib/formatters'

export default function ReplayPage() {
  const { eventId = 'silchar_2022' } = useParams()
  const q = useQuery({ queryKey: ['replay', eventId], queryFn: () => api.replay(eventId), retry: false })
  const r = q.data
  const chart = r?.steps.map((s) => ({
    date: s.date.slice(5),
    observed: s.observed_stage_m,
    actual: s.actual_peak_stage_m,
    band: [s.predicted_peak_stage_m.low, s.predicted_peak_stage_m.high],
  }))

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-4 border-b px-6 py-3">
        <Link to="/" aria-label="AEGIS-X home"><Logo /></Link>
        <h1 className="text-lg font-semibold">{r?.event.name ?? 'Replay'}</h1>
        <Link to="/console" className="ml-auto text-sm text-muted-foreground hover:text-foreground">Back to the console</Link>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-6 text-sm">
        {q.isError && <p className="text-risk" role="alert">{String(q.error)}</p>}
        {r && (
          <>
            <section>
              <p>What the system would have advised on each day, using only what was known by then, next to what happened.</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
                {r.limits.map((l) => <li key={l}>{l}</li>)}
              </ul>
            </section>

            <section>
              <h2 className="mb-2 font-semibold">River level over the event</h2>
              <div className="h-72" role="img" aria-label="Observed river level, predicted peak range and actual peak for each day of the event">
                <ResponsiveContainer>
                  <ComposedChart data={chart} margin={{ left: -10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis fontSize={11} unit=" m" />
                    <Tooltip formatter={(v) => (Array.isArray(v) ? `${Number(v[0]).toFixed(1)} to ${Number(v[1]).toFixed(1)} m` : `${Number(v).toFixed(1)} m`)} />
                    <Legend />
                    <Area dataKey="band" name="Predicted peak (10th to 90th)" stroke="none" fill="var(--flood)" fillOpacity={0.35} />
                    <Line dataKey="observed" name="Observed level" stroke="var(--primary)" dot={false} strokeWidth={2} />
                    <Line dataKey="actual" name="Actual peak in next 3 days" stroke="var(--risk)" dot={false} strokeDasharray="4 3" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-muted-foreground">
                The predicted band held the actual peak on {fmtPct(r.calibration.interval_coverage_10_90, 0)} of {r.calibration.n_steps} days (a well-calibrated 10 to 90 band holds about {fmtPct(r.calibration.expected_coverage, 0)}). Rating curve: k = {r.rating.k.toFixed(2)} m, normal flow {r.rating.q_normal.toFixed(0)} m3/s.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-semibold">Advice by day</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem]">
                  <thead className="text-left text-muted-foreground">
                    <tr><th className="font-normal">Day</th><th className="font-normal">Worst 10% if we start now</th><th className="font-normal">in 12 h</th><th className="font-normal">in 24 h</th><th className="font-normal">Advice</th><th className="font-normal">Actually flooded</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {r.steps.map((s) => (
                      <tr key={s.date}>
                        <td className="py-1.5">{s.date}</td>
                        {['0', '12', '24'].map((k) => <td key={k} className="tabular-nums">{fmtPct(s.options[k].worst10, 0)}</td>)}
                        <td><Badge variant={s.advice_start_hour === 0 ? 'default' : 'secondary'}>{s.advice_start_hour === 0 ? 'start now' : `wait ${s.advice_start_hour} h`}</Badge></td>
                        <td className="tabular-nums">{fmtPct(s.actual_flooded_population_share, 0)} of people</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="mb-2 font-semibold">Documented facts used for comparison</h2>
              <ul className="space-y-2">
                {r.event.facts.map((f) => (
                  <li key={f.text} className="rounded-lg border p-3">
                    {f.text}
                    <div className="text-xs text-muted-foreground">{f.source}{f.verify ? ' (verify before quoting)' : ''}</div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
