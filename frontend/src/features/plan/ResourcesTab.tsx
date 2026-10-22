import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Building2, Home, Info, Ship, Truck } from 'lucide-react'
import { api } from '@/api/client'
import type { Layers } from '@/api/types'
import { Meter, Panel, Ring, Stat } from '@/components/viz/kit'
import { useConsole } from '@/state/consoleStore'

const prop = (f: { properties: Record<string, unknown> }, k: string) => f.properties[k]
const sum = (m?: Record<string, number>) => Object.values(m ?? {}).reduce((a, b) => a + b, 0)

/** What the current plan asks for against what the district has: boats, vehicles and shelter space. */
export function ResourcesTab({ layers }: { layers: Layers }) {
  const { district, plan, whatIf } = useConsole()
  const cond = useQuery({ queryKey: ['conditions', district], queryFn: () => api.conditions(district) })
  if (!plan) return <p className="text-sm text-muted-foreground">Loading the plan.</p>

  const boatsHave = cond.data?.resources.boats ?? null
  const vehiclesHave = cond.data?.resources.vehicles ?? null
  const boatsPlanned = sum(plan.boats_at)
  const vehiclesPlanned = sum(plan.vehicles_at)
  const available = whatIf.boat_availability_pct
  const staging = layers.staging.features.map((f) => ({ id: String(prop(f, 'id')), name: String(prop(f, 'name')) }))
  const shelters = layers.shelters.features.map((f) => ({ id: String(prop(f, 'id')), cap: Number(prop(f, 'capacity')) }))
  const open = new Set(plan.open_shelters ?? shelters.map((s) => s.id))
  const openCap = shelters.filter((s) => open.has(s.id)).reduce((a, s) => a + s.cap, 0)
  const people = layers.totals.population
  const share = openCap / Math.max(people, 1)
  const boatsOver = boatsHave !== null && boatsPlanned > boatsHave
  const vehiclesOver = vehiclesHave !== null && vehiclesPlanned > vehiclesHave

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <Stat icon={Ship} label="Boats" value={<>{boatsPlanned}<span className="text-sm font-normal text-muted-foreground"> / {boatsHave ?? '?'}</span></>} hint={boatsOver ? `${boatsPlanned - boatsHave!} more than the district has` : 'planned / available'} tone={boatsOver ? 'risk' : 'neutral'} />
        <Stat icon={Truck} label="Vehicles" value={<>{vehiclesPlanned}<span className="text-sm font-normal text-muted-foreground"> / {vehiclesHave ?? '?'}</span></>} hint={vehiclesOver ? `${vehiclesPlanned - vehiclesHave!} more than the district has` : 'planned / available'} tone={vehiclesOver ? 'risk' : 'neutral'} />
      </div>
      {available !== undefined && (
        <p className="flex items-center gap-1.5 rounded-lg bg-warn/25 px-3 py-2 text-xs"><AlertTriangle className="size-3.5" aria-hidden />What-if: only {Math.round(available * 100)}% of boats actually turn up.</p>
      )}

      <Panel icon={Building2} title="By boat base" hint="Where the boats and vehicles start from.">
        <ul className="space-y-2.5">
          {staging.map((s) => (
            <li key={s.id}>
              <div className="mb-1 text-xs font-semibold">{s.name}</div>
              <Meter value={plan.boats_at?.[s.id] ?? 0} max={Math.max(boatsHave ?? boatsPlanned, 1)} tone="flood" label={<span className="inline-flex items-center gap-1"><Ship className="size-3" aria-hidden />boats</span>} right={plan.boats_at?.[s.id] ?? 0} />
              <Meter value={plan.vehicles_at?.[s.id] ?? 0} max={Math.max(vehiclesHave ?? vehiclesPlanned, 1)} tone="neutral" label={<span className="inline-flex items-center gap-1"><Truck className="size-3" aria-hidden />vehicles</span>} right={plan.vehicles_at?.[s.id] ?? 0} className="mt-1" />
            </li>
          ))}
        </ul>
      </Panel>

      <Panel icon={Home} tone="safe" title="Shelter space" hint={`${open.size} of ${shelters.length} shelters in use.`}>
        <div className="flex items-center gap-4">
          <Ring value={Math.min(share, 1)} tone={share < 0.5 ? 'risk' : 'safe'} label="of everyone has a place" />
          <dl className="flex-1 space-y-1.5 text-xs">
            <div className="flex justify-between"><dt className="text-muted-foreground">Places</dt><dd className="font-semibold tabular-nums">{openCap.toLocaleString()}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">People in the district</dt><dd className="font-semibold tabular-nums">{people.toLocaleString()}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Short by</dt><dd className={`font-semibold tabular-nums ${openCap < people ? 'text-risk' : 'text-safe'}`}>{Math.max(people - openCap, 0).toLocaleString()}</dd></div>
          </dl>
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
          <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
          Not everyone needs a place: only people in areas that flood. Every capacity is an estimate (the 2024 relief-camp average, a typical size per building type, or an assumed assembly point).
        </p>
      </Panel>

      {cond.data?.resources.note && <p className="px-1 text-[11px] text-muted-foreground">{cond.data.resources.note}</p>}
      <p className="px-1 text-[11px] text-muted-foreground">Models boats, vehicles and shelter space only, not medical teams, personnel rosters or agency equipment.</p>
    </div>
  )
}
