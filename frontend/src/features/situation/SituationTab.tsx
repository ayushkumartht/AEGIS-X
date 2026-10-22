import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { Layers, VariableInfo, WhatIf } from '@/api/types'
import { Button } from '@/components/ui/button'
import { canWrite, useAuth } from '@/state/authStore'
import { useConsole } from '@/state/consoleStore'

function rangeText(v: VariableInfo): string {
  const r = (x: number | undefined) => (x === undefined ? '' : Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(2))
  if (v.kind === 'binary') return `open with probability ${((v.p_true ?? 0) * 100).toFixed(0)}%`
  if (v.kind === 'empirical') return `${r(v.low)} to ${r(v.high)} (median ${r(v.median)}, ${v.n} members)`
  return `${r(v.low)} to ${r(v.high)}${v.mode !== undefined ? ` (most likely ${r(v.mode)})` : ''}`
}

const SLIDERS: { key: keyof WhatIf; label: string; min: number; max: number; step: number }[] = [
  { key: 'peak_stage_m', label: 'Peak water level above normal (m)', min: 0, max: 8, step: 0.1 },
  { key: 'local_rain_mm', label: 'Local rain (mm)', min: 0, max: 300, step: 5 },
  { key: 'boat_availability_pct', label: 'Boats actually available', min: 0, max: 1, step: 0.05 },
  { key: 'compliance_pct', label: 'People who obey the order', min: 0, max: 1, step: 0.05 },
  { key: 'comms_degradation_pct', label: 'Network lost', min: 0, max: 1, step: 0.05 },
]

/** Where each input of the model comes from, and which inputs are assumptions still to be replaced. */
function DataSources({ layers }: { layers: Layers }) {
  const meta = layers.metadata
  const text = (k: string) => (typeof meta[k] === 'string' ? (meta[k] as string) : null)
  const shelters = layers.shelters.features
  const assumed = shelters.filter((f) => String(f.properties.kind).startsWith('assumed')).length
  const rows: [string, string, boolean][] = []
  if (meta.synthetic) {
    rows.push(['Everything', 'A made-up demo district for trying the tool offline. Not a real place.', true])
  } else {
    rows.push(['Roads, bridges, river', 'OpenStreetMap', false])
    if (text('elevation_source')) rows.push(['Ground height', text('elevation_source')!, false])
    rows.push(['Rain and river flow', 'Open-Meteo ensemble forecast and GloFAS river discharge', false])
    rows.push([
      'Shelters',
      `${shelters.length - assumed} buildings from OpenStreetMap (capacity estimated by building type)${assumed ? `; ${assumed} assumed assembly points added to cover the population` : ''}`,
      true,
    ])
    if (text('population_note')) rows.push(['People', text('population_note')!, true])
    if (text('resources_note')) rows.push(['Boats and vehicles', text('resources_note')!, true])
  }
  return (
    <section>
      <h3 className="font-semibold">Where this data comes from</h3>
      <ul className="mt-2 divide-y rounded-lg border">
        {rows.map(([what, source, estimate]) => (
          <li key={what} className="flex justify-between gap-3 px-3 py-2">
            <span className="font-medium">{what}</span>
            <span className="text-right text-muted-foreground">
              {estimate && <span className="mr-1 rounded bg-warn/30 px-1.5 py-0.5 text-xs font-medium text-foreground">estimate</span>}
              {source}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function SituationTab({ layers }: { layers: Layers }) {
  const { district, whatIf, setWhatIf } = useConsole()
  const qc = useQueryClient()
  const cond = useQuery({ queryKey: ['conditions', district], queryFn: () => api.conditions(district) })
  const reports = useQuery({ queryKey: ['reports', district], queryFn: () => api.reports(district) })
  const [text, setText] = useState('')
  const [source, setSource] = useState('control_room')
  const writer = canWrite(useAuth((s) => s.user))
  const location = useLocation()

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

  const f = cond.data?.forecast
  return (
    <div className="space-y-5 text-sm">
      <section>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Forecast and ranges</h3>
          <Button size="sm" variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending || district === 'demo'}>
            {refresh.isPending ? 'Refreshing' : 'Refresh forecast'}
          </Button>
        </div>
        {cond.isError && <p className="mt-2 text-risk">{String(cond.error)}</p>}
        {f && (
          <p className="mt-1 text-muted-foreground">
            {f.source}
            {f.forecast_date ? `, issued ${f.forecast_date}` : ''}. Every number below is a range, not a prediction.
          </p>
        )}
        {f?.warning && <p className="mt-1 text-warn">{f.warning}</p>}
        <ul className="mt-3 divide-y rounded-lg border">
          {cond.data?.variables.map((v) => (
            <li key={v.name} className="px-3 py-2">
              <div className="flex justify-between gap-3">
                <span className="font-medium">{v.name.replace('bridge_open:', 'bridge open: ').replace(/_/g, ' ')}</span>
                <span className="text-right text-muted-foreground">{rangeText(v)}</span>
              </div>
              <div className="text-xs text-muted-foreground">Source: {v.source}</div>
            </li>
          ))}
        </ul>
      </section>

      <DataSources layers={layers} />

      <section>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">What if?</h3>
          <Button size="sm" variant="ghost" onClick={() => setWhatIf({})} disabled={!Object.keys(whatIf).length}>
            Reset
          </Button>
        </div>
        <p className="text-muted-foreground">Fix a condition to see how every analysis changes. Unset conditions stay as ranges.</p>
        <div className="mt-3 space-y-3">
          {SLIDERS.map((s) => {
            const value = whatIf[s.key] as number | undefined
            return (
              <div key={s.key}>
                <div className="flex justify-between">
                  <label htmlFor={`wi-${s.key}`}>{s.label}</label>
                  <span className="tabular-nums text-muted-foreground">{value === undefined ? 'range' : value}</span>
                </div>
                <input
                  id={`wi-${s.key}`}
                  type="range"
                  className="w-full accent-primary"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={value ?? (s.min + s.max) / 2}
                  onChange={(e) => setValue(s.key, Number(e.target.value))}
                />
                {value !== undefined && (
                  <button className="text-xs text-muted-foreground underline" onClick={() => setValue(s.key, undefined)}>
                    back to range
                  </button>
                )}
              </div>
            )
          })}
          {layers.bridges.length > 0 && (
            <fieldset>
              <legend className="mb-1">Close a bridge</legend>
              {layers.bridges.map((b) => (
                <label key={b.id} className="mr-4 inline-flex items-center gap-1.5">
                  <input type="checkbox" checked={closed.includes(b.id)} onChange={() => toggleBridge(b.id)} />
                  <button className="underline-offset-2 hover:underline" onClick={() => useConsole.getState().setHighlight({ kind: 'bridge', id: b.id })}>
                    {b.name}
                  </button>
                </label>
              ))}
            </fieldset>
          )}
        </div>
      </section>

      <section>
        <h3 className="font-semibold">Field reports</h3>
        <p className="text-muted-foreground">A report updates how sure we are, weighted by its source and age.</p>
        {writer ? (
          <>
            <textarea
              className="mt-2 w-full rounded-lg border bg-background p-2"
              rows={2}
              maxLength={1000}
              placeholder='For example: "Main bridge is under water" or "We have 6 boats ready"'
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Field report text"
            />
            <div className="mt-2 flex gap-2">
              <select className="rounded-lg border bg-background px-2 py-1.5" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Report source">
                <option value="field_team">Field team</option>
                <option value="official_feed">Official feed</option>
                <option value="control_room">Control room</option>
                <option value="public_call">Public call</option>
                <option value="social_media">Social media</option>
              </select>
              <Button size="sm" onClick={() => submit.mutate()} disabled={text.trim().length < 3 || submit.isPending}>
                Add report
              </Button>
            </div>
            {submit.isError && <p className="mt-1 text-risk">{String(submit.error)}</p>}
          </>
        ) : (
          <p className="mt-2 rounded-md bg-accent px-3 py-2">
            Reports change the picture for everyone, so adding one needs an officer account.{' '}
            <Link className="font-medium underline" to={`/login?next=${encodeURIComponent(location.pathname)}`}>Sign in</Link>
          </p>
        )}
        {cond.data && cond.data.beliefs.length > 0 && (
          <ul className="mt-3 space-y-1">
            {cond.data.beliefs.map((b) => (
              <li key={b.subject} className="rounded-md bg-accent px-3 py-1.5">
                <strong>{b.subject}</strong>:{' '}
                {b.p_open !== undefined ? `${(b.p_open * 100).toFixed(0)}% chance open` : `range ${b.range?.map((x) => x.toFixed(2)).join(' to ')}`} ({b.source})
              </li>
            ))}
          </ul>
        )}
        <ul className="mt-3 space-y-1 text-muted-foreground">
          {reports.data?.slice(0, 5).map((r) => (
            <li key={r.id}>
              {r.source_type.replace('_', ' ')}: "{r.raw_text}" read as {r.parsed.claim.replace('_', ' ')} ({r.parsed.method}){r.author ? `, by ${r.author.split(' <')[0]}` : ''}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
