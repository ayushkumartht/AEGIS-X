import {
  ArrowDownToLine, BadgeCheck, Bell, Building2, DoorOpen, Flag, Home, Megaphone, MessageSquareText, Play, Route, ShieldCheck, Ship, Siren, Truck, Users,
  type LucideIcon,
} from 'lucide-react'
import type { Layers, Plan } from '@/api/types'
import { Button } from '@/components/ui/button'
import { ActionButton, Chip, Meter, Panel, Stepper } from '@/components/viz/kit'
import { useConsole } from '@/state/consoleStore'

const CHANNELS: [string, string, LucideIcon][] = [
  ['siren', 'Siren', Siren],
  ['sms', 'SMS alert', MessageSquareText],
  ['loudspeaker', 'Loudspeaker', Megaphone],
  ['door_to_door', 'Door to door', DoorOpen],
]

type Props = { layers: Layers; running: boolean; progress: number; onRun: () => void; error: string | null }

const prop = (f: { properties: Record<string, unknown> }, k: string) => f.properties[k]

export function PlanTab({ layers, running, progress, onRun, error }: Props) {
  const plan = useConsole((s) => s.plan)
  const patch = useConsole((s) => s.patchPlan)
  const setHighlight = useConsole((s) => s.setHighlight)
  if (!plan) return <p className="text-sm text-muted-foreground">Loading the baseline plan.</p>

  const clusters = layers.clusters.features.map((f) => ({ id: String(prop(f, 'id')), name: String(prop(f, 'name')), pop: Number(prop(f, 'population')), hand: Number(prop(f, 'hand')) }))
  const shelters = layers.shelters.features.map((f) => ({ id: String(prop(f, 'id')), name: String(prop(f, 'name')), cap: Number(prop(f, 'capacity')), kind: String(prop(f, 'kind')) }))
  const staging = layers.staging.features.map((f) => ({ id: String(prop(f, 'id')), name: String(prop(f, 'name')) }))
  const lowest = [...clusters].sort((a, b) => a.hand - b.hand).slice(0, 5)
  const maxPop = Math.max(...clusters.map((c) => c.pop), 1)
  const maxCap = Math.max(...shelters.map((s) => s.cap), 1)

  const toggle = (list: string[] | undefined, id: string) => {
    const l = list ?? []
    return l.includes(id) ? l.filter((x) => x !== id) : [...l, id]
  }
  const setNumber = (key: 'boats_at' | 'vehicles_at', id: string, n: number) => patch({ [key]: { ...(plan[key] ?? {}), [id]: Math.max(0, Math.round(n) || 0) } } as Plan)
  const sum = (m?: Record<string, number>) => Object.values(m ?? {}).reduce((a, b) => a + b, 0)
  const sortBy = (cmp: (a: (typeof clusters)[number], b: (typeof clusters)[number]) => number) => patch({ priority: [...clusters].sort(cmp).map((c) => c.id) })
  const start = plan.start_hour ?? 0
  const openIds = plan.open_shelters ?? []
  const openCap = shelters.filter((s) => openIds.includes(s.id)).reduce((a, s) => a + s.cap, 0)
  const timing = start <= 6 ? 'Early: more effort and fuller shelters, but roads are still open.' : start <= 18 ? 'Balanced: enough warning without moving people too soon.' : 'Late: roads may already be cut by the time people start.'

  return (
    <div className="space-y-3 text-sm">
      <Panel icon={Flag} title="When to start moving people" hint="Too early wastes effort and fills shelters; too late and roads are already cut.">
        <div className="flex items-baseline justify-between">
          <label htmlFor="start" className="text-xs font-medium">Start at hour</label>
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-base font-semibold tabular-nums text-primary">{start} h</span>
        </div>
        <input id="start" type="range" className="mt-1 w-full accent-primary" min={0} max={36} step={1} value={start} onChange={(e) => patch({ start_hour: Number(e.target.value) })} />
        <div className="flex justify-between text-[10px] text-muted-foreground"><span>now</span><span>+12 h</span><span>+24 h</span><span>+36 h</span></div>
        <p className="mt-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs">{timing}</p>
      </Panel>

      <Panel
        icon={Users}
        title="Who goes first"
        hint="The order areas are cleared in. Click an area to find it on the map."
        action={
          <div className="flex gap-1">
            <Button size="xs" variant="soft" onClick={() => sortBy((a, b) => b.pop - a.pop)}>Largest first</Button>
            <Button size="xs" variant="soft" onClick={() => sortBy((a, b) => a.hand - b.hand)}>Lowest ground</Button>
          </div>
        }
      >
        <ol className="space-y-1.5">
          {(plan.priority ?? []).slice(0, 6).map((id, i) => {
            const c = clusters.find((x) => x.id === id)
            return (
              <li key={id}>
                <button className="flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors hover:border-primary/50 hover:bg-accent" onClick={() => setHighlight({ kind: 'cluster', id })}>
                  <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{c?.name ?? id}</span>
                    <Meter value={c?.pop ?? 0} max={maxPop} tone="primary" className="mt-0.5" />
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">{c?.pop.toLocaleString()}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </Panel>

      <Panel icon={Ship} tone="flood" title="Boats and vehicles" hint={`${sum(plan.boats_at)} boats and ${sum(plan.vehicles_at)} vehicles are placed.`}>
        <ul className="space-y-2">
          {staging.map((s) => (
            <li key={s.id} className="rounded-lg border p-2.5">
              <button className="mb-2 flex items-center gap-1.5 text-xs font-semibold hover:underline" onClick={() => setHighlight({ kind: 'staging', id: s.id })}>
                <Building2 className="size-3.5 text-[#7c3aed]" aria-hidden />{s.name}
              </button>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <span className="inline-flex items-center gap-2 text-xs"><Ship className="size-4 text-flood" aria-hidden /><Stepper label={`boats at ${s.name}`} value={plan.boats_at?.[s.id] ?? 0} onChange={(n) => setNumber('boats_at', s.id, n)} /></span>
                <span className="inline-flex items-center gap-2 text-xs"><Truck className="size-4 text-muted-foreground" aria-hidden /><Stepper label={`vehicles at ${s.name}`} value={plan.vehicles_at?.[s.id] ?? 0} onChange={(n) => setNumber('vehicles_at', s.id, n)} /></span>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel icon={Home} tone="safe" title="Shelters in use" hint={`${openIds.length} of ${shelters.length} open, ${openCap.toLocaleString()} places.`}>
        <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
          {shelters.map((s) => {
            const on = openIds.includes(s.id)
            const assumed = s.kind.startsWith('assumed')
            return (
              <li key={s.id} className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 ${on ? 'border-safe/40 bg-safe/5' : 'opacity-70'}`}>
                <input type="checkbox" className="size-4 accent-[var(--safe)]" checked={on} onChange={() => patch({ open_shelters: toggle(plan.open_shelters, s.id) })} aria-label={`Use ${s.name}`} />
                <span className="min-w-0 flex-1">
                  <button className="block max-w-full truncate text-left text-xs font-medium hover:underline" onClick={() => setHighlight({ kind: 'shelter', id: s.id })}>{s.name}</button>
                  <Meter value={s.cap} max={maxCap} tone="safe" className="mt-0.5" />
                </span>
                <span className="text-right text-[11px] leading-tight text-muted-foreground"><span className="tabular-nums">{s.cap}</span>{assumed && <span className="block text-[9px]">assumed</span>}</span>
              </li>
            )
          })}
        </ul>
      </Panel>

      <Panel icon={ShieldCheck} title="Protect the lowest areas" hint="Guard or raise these so they flood about a metre later.">
        <div className="flex flex-wrap gap-1.5">
          {lowest.map((c) => (
            <Chip key={c.id} icon={ArrowDownToLine} on={(plan.protected ?? []).includes(`cluster:${c.id}`)} onClick={() => patch({ protected: toggle(plan.protected, `cluster:${c.id}`) })}>{c.name}</Chip>
          ))}
        </div>
      </Panel>

      {layers.bridges.length > 0 && (
        <Panel icon={Route} title="Do not route over" hint="Keep evacuation traffic off these bridges.">
          <div className="flex flex-wrap gap-1.5">
            {layers.bridges.map((b) => (
              <Chip key={b.id} icon={Route} on={(plan.route_avoid ?? []).includes(b.id)} onClick={() => patch({ route_avoid: toggle(plan.route_avoid, b.id) })}>{b.name}</Chip>
            ))}
          </div>
        </Panel>
      )}

      <Panel icon={Bell} tone="warn" title="How people are warned" hint="More channels reach more people, and reach them sooner.">
        <div className="flex flex-wrap gap-1.5">
          {CHANNELS.map(([id, label, Icon]) => (
            <Chip key={id} icon={Icon} on={(plan.warning_channels ?? []).includes(id)} onClick={() => patch({ warning_channels: toggle(plan.warning_channels, id) })}>{label}</Chip>
          ))}
        </div>
      </Panel>

      <div className="sticky bottom-0 -mx-3 border-t bg-card/95 px-3 py-3 shadow-[0_-6px_14px_-10px_rgb(15_23_42/0.3)] backdrop-blur">
        <ActionButton size="lg" className="w-full" icon={running ? undefined : Play} busy={running} busyText={`Testing on 500 futures ${Math.round(progress * 100)}%`} onClick={onRun}>
          Test this plan on 500 futures
        </ActionButton>
        {running && <Meter value={progress} className="mt-2" />}
        {!running && <p className="mt-1.5 flex items-center justify-center gap-1 text-[11px] text-muted-foreground"><BadgeCheck className="size-3" aria-hidden />About 6 seconds. Same inputs give the same result.</p>}
        {error && <p className="mt-2 text-xs text-risk" role="alert">{error}</p>}
      </div>
    </div>
  )
}
