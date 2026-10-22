import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { Layers } from '@/api/types'
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
  const shelters = layers.shelters.features.map((f) => ({ id: String(prop(f, 'id')), name: String(prop(f, 'name')), cap: Number(prop(f, 'capacity')) }))
  const open = new Set(plan.open_shelters ?? shelters.map((s) => s.id))
  const openCap = shelters.filter((s) => open.has(s.id)).reduce((a, s) => a + s.cap, 0)
  const people = layers.totals.population

  const Row = ({ label, planned, have }: { label: string; planned: number; have: number | null }) => {
    const over = have !== null && planned > have
    return (
      <div className="flex justify-between gap-3">
        <span>{label}</span>
        <span className={`tabular-nums ${over ? 'font-semibold text-risk' : ''}`}>
          {planned} planned{have !== null ? ` of ${have} available` : ''}{over ? ` (${planned - have} more than the district has)` : ''}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-5 text-sm">
      <section>
        <h3 className="font-semibold">Boats and vehicles</h3>
        <div className="mt-2 space-y-1 rounded-lg border p-3">
          <Row label="Boats" planned={boatsPlanned} have={boatsHave} />
          <Row label="Vehicles" planned={vehiclesPlanned} have={vehiclesHave} />
          {available !== undefined && <p className="text-xs text-muted-foreground">What-if: only {Math.round(available * 100)}% of boats actually available.</p>}
        </div>
        {cond.data?.resources.note && <p className="mt-1 text-xs text-muted-foreground">{cond.data.resources.note}</p>}
      </section>

      <section>
        <h3 className="font-semibold">By boat base</h3>
        <ul className="mt-2 divide-y rounded-lg border">
          {staging.map((s) => (
            <li key={s.id} className="flex justify-between px-3 py-2">
              <span>{s.name}</span>
              <span className="tabular-nums">{plan.boats_at?.[s.id] ?? 0} boats, {plan.vehicles_at?.[s.id] ?? 0} vehicles</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="font-semibold">Shelter space</h3>
        <div className="mt-2 space-y-1 rounded-lg border p-3">
          <div className="flex justify-between"><span>Shelters in use</span><span className="tabular-nums">{open.size} of {shelters.length}</span></div>
          <div className="flex justify-between"><span>Places in those shelters</span><span className="tabular-nums">{openCap.toLocaleString()}</span></div>
          <div className="flex justify-between"><span>People in the district</span><span className="tabular-nums">{people.toLocaleString()}</span></div>
          <div className={`flex justify-between ${openCap < people * 0.5 ? 'font-semibold text-risk' : ''}`}>
            <span>Space as a share of everyone</span><span className="tabular-nums">{Math.round((openCap / Math.max(people, 1)) * 100)}%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            No official capacity list is published, so every capacity here is an estimate (the 2024 relief-camp average, a typical size per building type, or an assumed assembly point). The Situation tab lists the sources.
          </p>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">This models boats, vehicles and shelter space only. It does not model medical teams, personnel rosters or agency-specific equipment.</p>
    </div>
  )
}
