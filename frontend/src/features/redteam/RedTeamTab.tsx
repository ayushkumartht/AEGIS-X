import { useMutation } from '@tanstack/react-query'
import { Crosshair, Gauge, MapPin, ShieldAlert, Skull, Swords, TrendingDown, Zap } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '@/api/client'
import { ActionButton, Empty, Meter, Panel, Pill, Ring } from '@/components/viz/kit'
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
  const runButton = (
    <ActionButton icon={Swords} busy={run.isPending} busyText="Attacking the plan" onClick={() => run.mutate()} disabled={!plan}>
      {redteam ? 'Run again' : 'Run Red Team'}
    </ActionButton>
  )

  if (!redteam) {
    return (
      <div className="space-y-3">
        {run.isError && <p className="text-sm text-risk" role="alert">{String(run.error.message)}</p>}
        <Empty icon={ShieldAlert} title="Try to break the plan" body="The Red Team searches 300 futures for the conditions and the single bridge, shelter or base whose loss breaks your plan." action={runButton} />
      </div>
    )
  }

  const rate = redteam.failure_rate
  const maxDrop = Math.max(...redteam.single_points_of_failure.map((s) => s.drop_pct), 1)
  return (
    <div className="space-y-3 text-sm">
      <Panel icon={ShieldAlert} tone="risk" title="How often it fails" action={runButton}>
        <div className="flex items-center gap-4">
          <Ring value={rate} tone={rate > 0.3 ? 'risk' : rate > 0.1 ? 'warn' : 'safe'} label="of futures fail" />
          <p className="flex-1 text-sm leading-relaxed">
            The plan saves fewer than <strong>{Math.round(redteam.fail_below * 100)}%</strong> of people at risk in{' '}
            <strong className={rate > 0.3 ? 'text-risk' : ''}>{Math.round(rate * 100)}%</strong> of the possible futures.
          </p>
        </div>
      </Panel>

      <Panel icon={Crosshair} tone="risk" title="Single points of failure" hint="Remove one thing and re-run the same futures. Click one to find it on the map.">
        <ul className="space-y-1.5">
          {redteam.single_points_of_failure.map((s) => {
            const h = highlightFor(s.element_id)
            return (
              <li key={s.element_id}>
                <button className="w-full rounded-lg border px-2.5 py-2 text-left transition-colors hover:border-risk/50 hover:bg-risk/5" onClick={() => h && setHighlight(h)}>
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <MapPin className="size-3.5 text-muted-foreground" aria-hidden />
                    <span className="flex-1 truncate">{s.element_id.replace(':', ' ')}</span>
                    <span className="inline-flex items-center gap-0.5 font-semibold tabular-nums text-risk"><TrendingDown className="size-3.5" aria-hidden />{s.drop_pct.toFixed(1)}%</span>
                  </div>
                  <Meter value={s.drop_pct} max={maxDrop} tone="risk" className="mt-1.5" />
                </button>
              </li>
            )
          })}
        </ul>
      </Panel>

      {redteam.failure_boxes.length > 0 && (
        <Panel icon={Skull} tone="warn" title="When the plan fails" hint="Conditions under which most futures go wrong.">
          <ul className="space-y-2">
            {redteam.failure_boxes.map((b) => (
              <li key={b.description} className="rounded-lg border p-2.5">
                <p className="text-xs font-medium leading-snug">{nice(b.description)}</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
                  <Meter value={b.density} tone="risk" label="fail here" right={`${Math.round(b.density * 100)}%`} />
                  <Meter value={b.coverage} tone="warn" label="of failures" right={`${Math.round(b.coverage * 100)}%`} />
                  <Meter value={b.support} tone="neutral" label="of futures" right={`${Math.round(b.support * 100)}%`} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {redteam.adversarial.found && Object.keys(redteam.adversarial.shifts).length > 0 && (
        <Panel icon={Zap} tone="warn" title="Smallest change that breaks it" hint="From a typical future, these shifts are enough to push the result below the failure line.">
          <ul className="space-y-1.5">
            {Object.entries(redteam.adversarial.shifts).slice(0, 5).map(([k, v]) => (
              <li key={k} className="flex items-center justify-between gap-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs">
                <span className="font-medium">{nice(k)}</span>
                <span className="tabular-nums"><span className="text-muted-foreground">{v.from.toFixed(2)}</span> → <strong className="text-risk">{v.to.toFixed(2)}</strong></span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel icon={Gauge} title="What matters most" hint="How strongly each uncertain input moves the result.">
        <div className="h-52" role="img" aria-label="Influence of each uncertain input on the outcome">
          <ResponsiveContainer>
            <BarChart layout="vertical" data={redteam.sensitivity.slice(0, 8).map((s) => ({ name: nice(s.variable), v: Math.abs(s.correlation) }))} margin={{ left: 8, right: 8 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" domain={[0, 1]} fontSize={10} tickLine={false} axisLine={false} />
              <YAxis dataKey="name" type="category" fontSize={10} width={140} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'var(--accent)' }} formatter={(v) => [Number(v).toFixed(2), 'influence']} />
              <Bar dataKey="v" fill="var(--primary)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel icon={TrendingDown} tone="risk" title="Worst futures">
        <ul className="space-y-1.5">
          {redteam.worst_case_futures.slice(0, 3).map((w) => (
            <li key={w.rank} className="flex items-start gap-2.5 rounded-lg border px-2.5 py-2 text-xs">
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-risk/10 font-bold text-risk">#{w.rank}</span>
              <div>
                <div><strong>{Math.round(w.metric_value * 100)}%</strong> evacuated</div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {w.flagged_variables.length ? w.flagged_variables.map((f) => <Pill key={f} tone="warn">{nice(f)}</Pill>) : <span className="text-muted-foreground">nothing unusual stands out</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
