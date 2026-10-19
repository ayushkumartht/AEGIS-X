import { useMutation } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { useConsole, type HighlightKind } from '@/state/consoleStore'

const nice = (v: string) => v.replace('bridge_open:', 'bridge open: ').replace(/_/g, ' ')

function highlightFor(element: string): { kind: HighlightKind; id: string } | null {
  const [kind, id] = element.split(':')
  if (kind === 'bridge' || kind === 'shelter' || kind === 'staging') return { kind, id }
  return null
}

export function RedTeamTab() {
  const { district, plan, whatIf, redteam, setRedteam, setHighlight } = useConsole()
  const run = useMutation({
    mutationFn: () => api.redteam({ district, plan: plan ?? undefined, what_if: whatIf, n_samples: 300, seed: 42 }),
    onSuccess: setRedteam,
  })

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">The Red Team tries to break your plan and reports exactly what breaks it.</p>
        <Button onClick={() => run.mutate()} disabled={run.isPending || !plan}>
          {run.isPending ? 'Attacking the plan' : 'Run Red Team'}
        </Button>
      </div>
      {run.isError && <p className="text-risk" role="alert">{String(run.error)}</p>}
      {!redteam && !run.isPending && <p className="text-muted-foreground">No results yet.</p>}

      {redteam && (
        <>
          <section className="rounded-lg border p-3">
            <h3 className="font-semibold">How often it fails</h3>
            <p>
              The plan evacuates fewer than {Math.round(redteam.fail_below * 100)}% of people at risk in{' '}
              <strong>{Math.round(redteam.failure_rate * 100)}%</strong> of futures.
            </p>
          </section>

          <section>
            <h3 className="font-semibold">Single points of failure</h3>
            <p className="text-muted-foreground">Remove one thing and re-run the same futures. Click to find it on the map.</p>
            <ul className="mt-2 divide-y rounded-lg border">
              {redteam.single_points_of_failure.map((s) => {
                const h = highlightFor(s.element_id)
                return (
                  <li key={s.element_id}>
                    <button className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent" onClick={() => h && setHighlight(h)}>
                      <span>{s.element_id.replace(':', ' ')}</span>
                      <span className="tabular-nums text-risk">-{s.drop_pct.toFixed(1)}%</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          {redteam.failure_boxes.length > 0 && (
            <section>
              <h3 className="font-semibold">When the plan fails</h3>
              {redteam.failure_boxes.map((b) => (
                <div key={b.description} className="mt-2 rounded-lg border p-3">
                  <p>{nice(b.description)}</p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(b.density * 100)}% of futures like this fail; the box holds {Math.round(b.coverage * 100)}% of all failures and {Math.round(b.support * 100)}% of futures.
                  </p>
                </div>
              ))}
            </section>
          )}

          {redteam.adversarial.found && Object.keys(redteam.adversarial.shifts).length > 0 && (
            <section>
              <h3 className="font-semibold">Smallest change that breaks it</h3>
              <p className="text-muted-foreground">From a typical future, these shifts are enough to push the result below the failure line.</p>
              <ul className="mt-1">
                {Object.entries(redteam.adversarial.shifts).slice(0, 5).map(([k, v]) => (
                  <li key={k}>{nice(k)}: {v.from.toFixed(2)} to {v.to.toFixed(2)}</li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="font-semibold">What matters most</h3>
            <div className="h-48" role="img" aria-label="Influence of each uncertain input on the outcome">
              <ResponsiveContainer>
                <BarChart layout="vertical" data={redteam.sensitivity.slice(0, 8).map((s) => ({ name: nice(s.variable), v: Math.abs(s.correlation) }))} margin={{ left: 80, right: 8 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 1]} fontSize={11} />
                  <YAxis dataKey="name" type="category" fontSize={11} width={150} />
                  <Tooltip formatter={(v) => [Number(v).toFixed(2), 'influence']} />
                  <Bar dataKey="v" fill="var(--primary)" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section>
            <h3 className="font-semibold">Worst futures</h3>
            {redteam.worst_case_futures.slice(0, 3).map((w) => (
              <p key={w.rank} className="text-muted-foreground">
                #{w.rank}: {Math.round(w.metric_value * 100)}% evacuated. Unusual: {w.flagged_variables.length ? w.flagged_variables.map(nice).join(', ') : 'nothing stands out'}.
              </p>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
