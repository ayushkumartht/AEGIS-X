import type { Layers, Plan } from '@/api/types'
import { Button } from '@/components/ui/button'
import { useConsole } from '@/state/consoleStore'

const CHANNELS = [
  ['siren', 'Siren'],
  ['sms', 'SMS alert'],
  ['loudspeaker', 'Loudspeaker'],
  ['door_to_door', 'Door to door'],
] as const

type Props = { layers: Layers; running: boolean; progress: number; onRun: () => void; error: string | null }

const prop = (f: { properties: Record<string, unknown> }, k: string) => f.properties[k]

export function PlanTab({ layers, running, progress, onRun, error }: Props) {
  const plan = useConsole((s) => s.plan)
  const patch = useConsole((s) => s.patchPlan)
  const setHighlight = useConsole((s) => s.setHighlight)
  if (!plan) return <p className="text-sm text-muted-foreground">Loading the baseline plan.</p>

  const clusters = layers.clusters.features.map((f) => ({ id: String(prop(f, 'id')), name: String(prop(f, 'name')), pop: Number(prop(f, 'population')), hand: Number(prop(f, 'hand')) }))
  const shelters = layers.shelters.features.map((f) => ({ id: String(prop(f, 'id')), name: String(prop(f, 'name')), cap: Number(prop(f, 'capacity')) }))
  const staging = layers.staging.features.map((f) => ({ id: String(prop(f, 'id')), name: String(prop(f, 'name')) }))
  const lowest = [...clusters].sort((a, b) => a.hand - b.hand).slice(0, 5)

  const toggle = (list: string[] | undefined, id: string) => {
    const l = list ?? []
    return l.includes(id) ? l.filter((x) => x !== id) : [...l, id]
  }
  const setNumber = (key: 'boats_at' | 'vehicles_at', id: string, n: number) => patch({ [key]: { ...(plan[key] ?? {}), [id]: Math.max(0, Math.round(n) || 0) } } as Plan)
  const sum = (m?: Record<string, number>) => Object.values(m ?? {}).reduce((a, b) => a + b, 0)
  const sortBy = (cmp: (a: (typeof clusters)[number], b: (typeof clusters)[number]) => number) => patch({ priority: [...clusters].sort(cmp).map((c) => c.id) })

  return (
    <div className="space-y-5 text-sm">
      <section>
        <div className="flex justify-between">
          <label htmlFor="start" className="font-semibold">Start moving people at hour</label>
          <span className="tabular-nums">{plan.start_hour ?? 0} h</span>
        </div>
        <input id="start" type="range" className="w-full accent-primary" min={0} max={36} step={1} value={plan.start_hour ?? 0} onChange={(e) => patch({ start_hour: Number(e.target.value) })} />
        <p className="text-muted-foreground">Too early wastes effort and fills shelters; too late and roads are already cut.</p>
      </section>

      <section>
        <h3 className="font-semibold">Who goes first</h3>
        <div className="mt-1 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => sortBy((a, b) => b.pop - a.pop)}>Largest area first</Button>
          <Button size="sm" variant="outline" onClick={() => sortBy((a, b) => a.hand - b.hand)}>Lowest ground first</Button>
        </div>
        <ol className="mt-2 list-decimal pl-5 text-muted-foreground">
          {(plan.priority ?? []).slice(0, 6).map((id) => (
            <li key={id}>
              <button className="hover:underline" onClick={() => setHighlight({ kind: 'cluster', id })}>
                {clusters.find((c) => c.id === id)?.name ?? id} ({clusters.find((c) => c.id === id)?.pop} people)
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h3 className="font-semibold">Boats and vehicles ({sum(plan.boats_at)} boats, {sum(plan.vehicles_at)} vehicles)</h3>
        <table className="mt-1 w-full">
          <thead className="text-left text-muted-foreground"><tr><th className="font-normal">Base</th><th className="font-normal">Boats</th><th className="font-normal">Vehicles</th></tr></thead>
          <tbody>
            {staging.map((s) => (
              <tr key={s.id}>
                <td><button className="hover:underline" onClick={() => setHighlight({ kind: 'staging', id: s.id })}>{s.name}</button></td>
                {(['boats_at', 'vehicles_at'] as const).map((k) => (
                  <td key={k}>
                    <input type="number" min={0} className="w-16 rounded border bg-background px-1 py-0.5" aria-label={`${k === 'boats_at' ? 'Boats' : 'Vehicles'} at ${s.name}`} value={plan[k]?.[s.id] ?? 0} onChange={(e) => setNumber(k, s.id, Number(e.target.value))} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="font-semibold">Shelters in use</h3>
        <ul className="mt-1 grid grid-cols-1 gap-1">
          {shelters.map((s) => (
            <li key={s.id}>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={(plan.open_shelters ?? []).includes(s.id)} onChange={() => patch({ open_shelters: toggle(plan.open_shelters, s.id) })} />
                <button className="hover:underline" onClick={() => setHighlight({ kind: 'shelter', id: s.id })}>{s.name}</button>
                <span className="text-muted-foreground">capacity {s.cap}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="font-semibold">Protect the lowest areas</h3>
        <p className="text-muted-foreground">Guard or raise these so they flood about a metre later.</p>
        {lowest.map((c) => (
          <label key={c.id} className="mr-4 inline-flex items-center gap-1.5">
            <input type="checkbox" checked={(plan.protected ?? []).includes(`cluster:${c.id}`)} onChange={() => patch({ protected: toggle(plan.protected, `cluster:${c.id}`) })} />
            {c.name}
          </label>
        ))}
      </section>

      {layers.bridges.length > 0 && (
        <section>
          <h3 className="font-semibold">Do not route over</h3>
          {layers.bridges.map((b) => (
            <label key={b.id} className="mr-4 inline-flex items-center gap-1.5">
              <input type="checkbox" checked={(plan.route_avoid ?? []).includes(b.id)} onChange={() => patch({ route_avoid: toggle(plan.route_avoid, b.id) })} />
              {b.name}
            </label>
          ))}
        </section>
      )}

      <section>
        <h3 className="font-semibold">How people are warned</h3>
        {CHANNELS.map(([id, label]) => (
          <label key={id} className="mr-4 inline-flex items-center gap-1.5">
            <input type="checkbox" checked={(plan.warning_channels ?? []).includes(id)} onChange={() => patch({ warning_channels: toggle(plan.warning_channels, id) })} />
            {label}
          </label>
        ))}
      </section>

      <div className="sticky bottom-0 -mx-1 border-t bg-background/95 px-1 py-3 backdrop-blur">
        <Button className="w-full" onClick={onRun} disabled={running}>
          {running ? `Testing on 500 futures ${Math.round(progress * 100)}%` : 'Test this plan on 500 futures'}
        </Button>
        {error && <p className="mt-2 text-risk" role="alert">{error}</p>}
      </div>
    </div>
  )
}
