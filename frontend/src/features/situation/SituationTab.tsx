import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Ban, CloudRain, Database, Home, Megaphone, Mountain, RefreshCw, Route, Send, Ship, SlidersHorizontal, Timer, Undo2, Users, Waves,
  type LucideIcon,
} from 'lucide-react'
import { api } from '@/api/client'
import type { Layers, VariableInfo, WhatIf } from '@/api/types'
import { ActionButton, Chip, Meter, Panel, Pill, ProbBar, RangeBar, type Tone } from '@/components/viz/kit'
import { Button } from '@/components/ui/button'
import { useConsole } from '@/state/consoleStore'

interface Axis { label: string; min: number; max: number; unit: string; tone: Tone; pct?: boolean; icon: LucideIcon; group: 'river' | 'response' }

/** How each uncertain input is drawn: its scale, unit and colour. */
const AXES: Record<string, Axis> = {
  peak_stage_m: { label: 'Peak water level above normal', min: 0, max: 8, unit: ' m', tone: 'flood', icon: Waves, group: 'river' },
  stage_bias_m: { label: 'Forecast error in water level', min: -1.5, max: 1.5, unit: ' m', tone: 'warn', icon: Waves, group: 'river' },
  peak_time_h: { label: 'Hours until the peak', min: 0, max: 48, unit: ' h', tone: 'primary', icon: Timer, group: 'river' },
  local_rain_mm: { label: 'Local rain', min: 0, max: 300, unit: ' mm', tone: 'flood', icon: CloudRain, group: 'river' },
  boat_availability_pct: { label: 'Boats actually available', min: 0, max: 1, unit: '', tone: 'safe', pct: true, icon: Ship, group: 'response' },
  boat_delay_h: { label: 'Boat arrival delay', min: 0, max: 12, unit: ' h', tone: 'warn', icon: Timer, group: 'response' },
  comms_degradation_pct: { label: 'Network lost', min: 0, max: 1, unit: '', tone: 'risk', pct: true, icon: Megaphone, group: 'response' },
  compliance_pct: { label: 'People who obey the order', min: 0, max: 1, unit: '', tone: 'safe', pct: true, icon: Users, group: 'response' },
}
const pctFmt = (n: number) => `${Math.round(n * 100)}%`

const SLIDERS: { key: keyof WhatIf; label: string; min: number; max: number; step: number; show: (v: number) => string }[] = [
  { key: 'peak_stage_m', label: 'Peak water level above normal', min: 0, max: 8, step: 0.1, show: (v) => `${v.toFixed(1)} m` },
  { key: 'local_rain_mm', label: 'Local rain', min: 0, max: 300, step: 5, show: (v) => `${v} mm` },
  { key: 'boat_availability_pct', label: 'Boats actually available', min: 0, max: 1, step: 0.05, show: pctFmt },
  { key: 'compliance_pct', label: 'People who obey the order', min: 0, max: 1, step: 0.05, show: pctFmt },
  { key: 'comms_degradation_pct', label: 'Network lost', min: 0, max: 1, step: 0.05, show: pctFmt },
]

function Variable({ v, axis }: { v: VariableInfo; axis: Axis }) {
  const fmt = axis.pct ? pctFmt : undefined
  const at = v.mode ?? v.median
  const low = v.low ?? 0
  const high = v.high ?? low
  return (
    <li className="px-3 py-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"><axis.icon className="size-3.5 text-muted-foreground" aria-hidden />{axis.label}</div>
      <RangeBar low={low} high={high} at={at} min={axis.min} max={axis.max} unit={axis.unit} tone={axis.tone} format={fmt} />
      <div className="mt-1 text-[10px] text-muted-foreground">{v.kind === 'empirical' ? `${v.n} forecast members. ` : ''}Source: {v.source}</div>
    </li>
  )
}

function BridgeVariable({ v, name }: { v: VariableInfo; name: string }) {
  return (
    <li className="px-3 py-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"><Route className="size-3.5 text-muted-foreground" aria-hidden />{name}</div>
      <ProbBar p={v.p_true ?? 0.5} />
      <div className="mt-1 text-[10px] text-muted-foreground">Source: {v.source}</div>
    </li>
  )
}

/** Where each input of the model comes from, and which inputs are assumptions still to be replaced. */
function DataSources({ layers }: { layers: Layers }) {
  const meta = layers.metadata
  const text = (k: string) => (typeof meta[k] === 'string' ? (meta[k] as string) : null)
  const kinds = layers.shelters.features.map((f) => String(f.properties.kind))
  const count = (test: (k: string) => boolean) => kinds.filter(test).length
  const camps = count((k) => k === 'relief_camp')
  const campsNear = count((k) => k === 'relief_camp_approx')
  const campsPlaced = count((k) => k === 'assumed_location_relief_camp')
  const assembly = count((k) => k === 'assumed_assembly_point')
  const osmBuildings = kinds.length - camps - campsNear - campsPlaced - assembly
  const rows: { icon: LucideIcon; what: string; source: string; estimate: boolean }[] = []
  if (meta.synthetic) {
    rows.push({ icon: Database, what: 'Everything', source: 'A made-up demo district for trying the tool offline. Not a real place.', estimate: true })
  } else {
    rows.push({ icon: Route, what: 'Roads, bridges, river', source: 'OpenStreetMap', estimate: false })
    if (text('elevation_source')) rows.push({ icon: Mountain, what: 'Ground height', source: text('elevation_source')!, estimate: false })
    rows.push({ icon: CloudRain, what: 'Rain and river flow', source: 'Open-Meteo ensemble forecast and GloFAS river discharge', estimate: false })
    const campTotal = camps + campsNear + campsPlaced
    if (campTotal) {
      rows.push({
        icon: Home, what: 'Relief camps',
        source: `${campTotal} camps the district opened in the 2024 floods (Cachar flood report): ${camps} at their building, ${campsNear} at their neighbourhood, ${campsPlaced} not on any map so placed on high ground. Capacity from the 2024 average of 274 people per camp.`,
        estimate: true,
      })
    }
    if (osmBuildings) rows.push({ icon: Home, what: 'Other shelters', source: `${osmBuildings} public buildings from OpenStreetMap (capacity estimated by type)`, estimate: true })
    if (assembly) rows.push({ icon: Home, what: 'Assembly points', source: `${assembly} assumed high-ground points so shelter space covers half the population`, estimate: true })
    if (text('population_note')) rows.push({ icon: Users, what: 'People', source: text('population_note')!, estimate: true })
    if (text('resources_note')) rows.push({ icon: Ship, what: 'Boats and vehicles', source: text('resources_note')!, estimate: true })
  }
  const real = rows.filter((r) => !r.estimate).length
  return (
    <Panel icon={Database} title="Where this data comes from" hint={`${real} of ${rows.length} inputs are real data; the rest are labelled estimates.`}>
      <ul className="grid gap-2">
        {rows.map((r) => (
          <li key={r.what} className="flex items-start gap-2.5 rounded-lg border p-2.5">
            <r.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">{r.what}<Pill tone={r.estimate ? 'warn' : 'safe'}>{r.estimate ? 'estimate' : 'real data'}</Pill></div>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{r.source}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export function SituationTab({ layers }: { layers: Layers }) {
  const { district, whatIf, setWhatIf } = useConsole()
  const qc = useQueryClient()
  const cond = useQuery({ queryKey: ['conditions', district], queryFn: () => api.conditions(district) })
  const reports = useQuery({ queryKey: ['reports', district], queryFn: () => api.reports(district) })
  const [text, setText] = useState('')
  const [source, setSource] = useState('control_room')

  const refresh = useMutation({
    mutationFn: () => api.refreshForecast(district),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conditions', district] }),
  })
  const submit = useMutation({
    mutationFn: () => api.addReport(district, text, source),
    onSuccess: () => {
      setText('')
      qc.invalidateQueries({ queryKey: ['conditions', district] })
      qc.invalidateQueries({ queryKey: ['reports', district] })
    },
  })

  const setValue = (key: keyof WhatIf, value: number | undefined) => {
    const next = { ...whatIf }
    if (value === undefined) delete next[key]
    else (next as Record<string, unknown>)[key] = value
    setWhatIf(next)
  }
  const closed = whatIf.bridge_closed ?? []
  const toggleBridge = (id: string) =>
    setWhatIf({ ...whatIf, bridge_closed: closed.includes(id) ? closed.filter((b) => b !== id) : [...closed, id] })
  const changed = Object.keys(whatIf).filter((k) => k !== 'bridge_closed').length + (closed.length ? 1 : 0)

  const f = cond.data?.forecast
  const vars = cond.data?.variables ?? []
  const river = vars.filter((v) => AXES[v.name]?.group === 'river')
  const response = vars.filter((v) => AXES[v.name]?.group === 'response')
  const bridges = vars.filter((v) => v.name.startsWith('bridge_open:'))
  const bridgeName = (name: string) => layers.bridges.find((b) => `bridge_open:${b.id}` === name)?.name ?? name.replace('bridge_open:', 'Bridge ')

  return (
    <div className="space-y-3 text-sm">
      <Panel
        icon={Waves}
        tone="flood"
        title="What the next days may bring"
        hint="Every bar is a range of possible values, not a prediction. The line marks the most likely."
        action={
          <ActionButton size="sm" variant="soft" icon={RefreshCw} busy={refresh.isPending} busyText="Refreshing" onClick={() => refresh.mutate()} disabled={district === 'demo'}>
            Refresh
          </ActionButton>
        }
      >
        {cond.isError && <p className="text-risk">{String(cond.error)}</p>}
        {f && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            <Pill tone={f.source?.toString().startsWith('live') ? 'safe' : 'warn'}>{f.source}</Pill>
            {f.forecast_date && <Pill>issued {f.forecast_date}</Pill>}
          </div>
        )}
        {f?.warning && <p className="mb-2 rounded-lg bg-warn/25 px-2.5 py-1.5 text-xs">{f.warning}</p>}
        {river.length > 0 && (
          <>
            <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">River and rain</h4>
            <ul className="mb-3 divide-y rounded-lg border">{river.map((v) => <Variable key={v.name} v={v} axis={AXES[v.name]} />)}</ul>
          </>
        )}
        {response.length > 0 && (
          <>
            <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Response on the day</h4>
            <ul className="mb-3 divide-y rounded-lg border">{response.map((v) => <Variable key={v.name} v={v} axis={AXES[v.name]} />)}</ul>
          </>
        )}
        {bridges.length > 0 && (
          <>
            <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Will the bridges be usable?</h4>
            <ul className="divide-y rounded-lg border">{bridges.map((v) => <BridgeVariable key={v.name} v={v} name={bridgeName(v.name)} />)}</ul>
          </>
        )}
      </Panel>

      <DataSources layers={layers} />

      <Panel
        icon={SlidersHorizontal}
        tone="warn"
        title="What if?"
        hint="Fix a condition to see how every analysis changes. Anything you leave alone stays a range."
        action={
          <Button size="sm" variant="ghost" onClick={() => setWhatIf({})} disabled={!changed}>
            <Undo2 aria-hidden />Reset{changed ? ` (${changed})` : ''}
          </Button>
        }
      >
        <div className="space-y-3.5">
          {SLIDERS.map((s) => {
            const value = whatIf[s.key] as number | undefined
            const set = value !== undefined
            return (
              <div key={s.key}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <label htmlFor={`wi-${s.key}`} className="font-medium">{s.label}</label>
                  {set ? (
                    <button className="inline-flex items-center gap-1 rounded-full bg-warn/30 px-2 py-0.5 font-semibold tabular-nums" onClick={() => setValue(s.key, undefined)} title="Back to the forecast range">
                      {s.show(value)} <Undo2 className="size-3" aria-hidden />
                    </button>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">forecast range</span>
                  )}
                </div>
                <input
                  id={`wi-${s.key}`}
                  type="range"
                  className={`w-full ${set ? 'accent-[var(--warn)]' : 'accent-primary opacity-70'}`}
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={value ?? (s.min + s.max) / 2}
                  onChange={(e) => setValue(s.key, Number(e.target.value))}
                />
              </div>
            )
          })}
          {layers.bridges.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-medium">Close a bridge</div>
              <div className="flex flex-wrap gap-1.5">
                {layers.bridges.map((b) => (
                  <Chip key={b.id} on={closed.includes(b.id)} icon={Ban} onClick={() => toggleBridge(b.id)} title="Closes this bridge in every analysis">
                    {b.name}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      </Panel>

      <Panel icon={Megaphone} title="Field reports" hint="A report changes how sure we are, weighted by its source and age.">
        <textarea
          className="w-full rounded-lg border bg-background p-2.5 text-sm shadow-xs placeholder:text-muted-foreground"
          rows={2}
          maxLength={1000}
          placeholder='For example: "Main bridge is under water" or "We have 6 boats ready"'
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Field report text"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xs" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Report source">
            <option value="field_team">Field team</option>
            <option value="official_feed">Official feed</option>
            <option value="control_room">Control room</option>
            <option value="public_call">Public call</option>
            <option value="social_media">Social media</option>
          </select>
          <ActionButton size="sm" icon={Send} busy={submit.isPending} busyText="Adding" onClick={() => submit.mutate()} disabled={text.trim().length < 3}>
            Add report
          </ActionButton>
        </div>
        {submit.isError && <p className="mt-1.5 text-xs text-risk">{String(submit.error.message)}</p>}

        {cond.data && cond.data.beliefs.length > 0 && (
          <ul className="mt-3 space-y-2">
            {cond.data.beliefs.map((b) => (
              <li key={b.subject} className="rounded-lg border p-2.5">
                <div className="mb-1 text-xs font-semibold">{b.subject}</div>
                {b.p_open !== undefined ? (
                  <ProbBar p={b.p_open} />
                ) : (
                  <Meter value={b.range?.[1] ?? 0} max={Math.max(b.range?.[1] ?? 1, 1) * 1.2} tone="flood" right={`${b.range?.map((x) => x.toFixed(2)).join(' to ')}`} />
                )}
                <div className="mt-1 text-[10px] text-muted-foreground">{b.source}</div>
              </li>
            ))}
          </ul>
        )}
        {reports.data && reports.data.length > 0 && (
          <ol className="mt-3 space-y-1.5 border-l-2 pl-3">
            {reports.data.slice(0, 5).map((r) => (
              <li key={r.id} className="text-xs">
                <span className="font-medium">&ldquo;{r.raw_text}&rdquo;</span>
                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-muted-foreground">
                  <Pill>{r.source_type.replace('_', ' ')}</Pill>
                  <Pill tone="primary">read as {r.parsed.claim.replace('_', ' ')}</Pill>
                  {r.author && <span>by {r.author}</span>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  )
}
