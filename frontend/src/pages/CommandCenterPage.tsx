import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell, BookOpen, FlaskConical, Flame, Lock, MapPinned, Radio, RefreshCw, ScrollText, Shield, ShieldCheck, ShieldX, SlidersHorizontal, TriangleAlert,
  Users, Waves, type LucideIcon,
} from 'lucide-react'
import { api } from '@/api/client'
import { Logo } from '@/components/site/Logo'
import { OperatorChip } from '@/components/site/OperatorChip'
import { ActionButton, Panel, Pill } from '@/components/viz/kit'
import { AlertList } from '@/features/ops/AlertList'
import { BriefPanel } from '@/features/ops/BriefPanel'
import { DistrictRisk } from '@/features/ops/DistrictRisk'
import { FeedHealth } from '@/features/ops/FeedHealth'
import { OpsMap } from '@/features/ops/OpsMap'
import { PlaceSearch } from '@/features/ops/PlaceSearch'
import { LEVEL_COLOR, LEVEL_LABEL, SEVERITY_COLOR } from '@/features/ops/levels'

const POLL_MS = 60_000
const MODE_KEY = 'aegis.mode'
const HAZARD_ICON: Record<string, LucideIcon> = { flood: Waves, fire: Flame, crowd: Users }

function loadMode(): string {
  try {
    return localStorage.getItem(MODE_KEY) ?? 'administration'
  } catch {
    return 'administration'
  }
}

export default function CommandCenterPage() {
  const qc = useQueryClient()
  const [mode, setModeState] = useState(loadMode)
  const [selected, setSelected] = useState<string | null>(null)
  const [focus, setFocus] = useState<{ lat: number; lon: number; label: string } | null>(null)
  const [hazard, setHazard] = useState('flood')

  const setMode = (m: string) => {
    setModeState(m)
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {
      /* the choice then lasts until the tab closes */
    }
  }

  // The simulated exercise is chosen per viewer (?exercise=1 in the address) and never mixed with live data.
  const [search, setSearch] = useSearchParams()
  const exercise = search.get('exercise') === '1'
  const setExercise = (on: boolean) => {
    setSelected(null)
    setSearch((prev) => {
      const next = new URLSearchParams(prev)
      if (on) next.set('exercise', '1')
      else next.delete('exercise')
      return next
    }, { replace: true })
  }

  const hazards = useQuery({ queryKey: ['ops-hazards'], queryFn: api.opsHazards, retry: false })
  const modes = useQuery({ queryKey: ['ops-modes'], queryFn: api.opsModes, retry: false })
  const scenario = useQuery({ queryKey: ['ops-exercise'], queryFn: api.opsExercise, retry: false })
  const feeds = useQuery({ queryKey: ['ops-feeds', exercise], queryFn: () => api.opsFeeds(exercise), refetchInterval: POLL_MS, retry: false })
  const events = useQuery({ queryKey: ['ops-events', hazard, exercise], queryFn: () => api.opsEvents({ hazard, days: 3, exercise }), refetchInterval: POLL_MS, retry: false })
  const districts = useQuery({ queryKey: ['ops-districts', exercise], queryFn: () => api.opsDistricts(exercise), refetchInterval: POLL_MS, retry: false })
  const integrity = useQuery({ queryKey: ['integrity'], queryFn: api.integrity, retry: false })
  const refresh = useMutation({
    mutationFn: () => api.opsRefresh(false),
    onSuccess: () => qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('ops-') }),
  })

  const list = districts.data?.districts ?? []
  const counts = (['severe', 'warning', 'watch', 'normal', 'unknown'] as const).map((l) => [l, list.filter((d) => d.level === l).length] as const)
  const active = hazards.data?.find((h) => h.id === hazard)
  const apiDown = districts.isError && !districts.data
  const calm = !exercise && districts.data && list.every((d) => d.level === 'normal' || d.level === 'unknown')
  const sev = events.data?.counts.by_severity ?? {}
  const sevTotal = Object.values(sev).reduce((a, b) => a + b, 0)
  const modeFocus = modes.data?.find((m) => m.id === mode)?.focus

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-card/95 px-4 py-2.5 text-sm backdrop-blur sm:px-6">
        <Link to="/" aria-label="AEGIS-X home"><Logo /></Link>
        <div className="flex items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Radio className="size-4" aria-hidden /></span>
          <div className="leading-tight">
            <h1 className="text-base font-semibold">Command Center</h1>
            <p className="text-[11px] text-muted-foreground">{exercise ? 'Simulated exercise' : 'Live official data'} · refreshes every minute</p>
          </div>
        </div>
        <nav className="ml-auto flex flex-wrap items-center gap-1" aria-label="Pages">
          {([['/console/cachar', 'Evacuation console', MapPinned], ['/audit', 'Decision log', ScrollText], ['/docs', 'Docs', BookOpen]] as const).map(([to, label, Icon]) => (
            <Link key={to} to={to} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <Icon className="size-4" aria-hidden />{label}
            </Link>
          ))}
          <OperatorChip />
        </nav>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6">
        {apiDown && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-risk" role="alert">Cannot reach the AEGIS-X server. It may be waking up; try again in a minute.</p>}

        {exercise && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-amber-500 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 shadow-sm dark:bg-amber-950/40 dark:text-amber-100" role="status">
            <FlaskConical className="size-5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <strong>EXERCISE MODE:</strong> {scenario.data?.title ?? 'simulated scenario'}. {scenario.data?.notice ?? 'Everything on this screen is simulated.'}
            </div>
            <button className="rounded-lg border border-amber-600 px-3 py-1 font-semibold hover:bg-amber-100" onClick={() => setExercise(false)}>Back to live data</button>
          </div>
        )}

        {/* controls */}
        <section className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 shadow-xs" aria-label="Controls">
          <div className="flex rounded-lg border bg-muted/50 p-0.5 text-sm" role="group" aria-label="Data source">
            <button className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${exercise ? 'text-muted-foreground hover:text-foreground' : 'bg-card text-foreground shadow-sm'}`} aria-pressed={!exercise} onClick={() => setExercise(false)}>
              <Radio className="size-4 text-safe" aria-hidden />Live data
            </button>
            <button className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${exercise ? 'bg-amber-500 text-black shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} aria-pressed={exercise} onClick={() => setExercise(true)} title="A simulated flood scenario for drills and demos; clearly labelled, never mixed with live data">
              <FlaskConical className="size-4" aria-hidden />Exercise
            </button>
          </div>
          <label className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1 text-sm" title={modeFocus}>
            <Shield className="size-4 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">Working as</span>
            <select className="bg-transparent py-0.5 font-medium outline-none" value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Operating mode">
              {(modes.data ?? [{ id: mode, name: mode, focus: '' }]).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <div className="flex gap-1.5" role="group" aria-label="Hazard">
            {(hazards.data ?? []).map((h) => {
              const Icon = HAZARD_ICON[h.id] ?? Bell
              return (
                <button
                  key={h.id}
                  disabled={!h.enabled}
                  onClick={() => setHazard(h.id)}
                  aria-pressed={hazard === h.id}
                  title={h.enabled ? undefined : h.note}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${hazard === h.id ? 'border-primary bg-primary text-primary-foreground shadow-sm' : ''} ${h.enabled ? 'hover:border-primary/50' : 'cursor-not-allowed opacity-55'}`}
                >
                  {h.enabled ? <Icon className="size-3.5" aria-hidden /> : <Lock className="size-3" aria-hidden />}
                  {h.name}{h.enabled ? '' : ' · later'}
                </button>
              )
            })}
          </div>
          <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
            <div className="flex-1 sm:w-64"><PlaceSearch onPick={setFocus} /></div>
            {!exercise && (
              <ActionButton size="sm" variant="outline" icon={RefreshCw} busy={refresh.isPending} busyText="Refreshing" onClick={() => refresh.mutate()}>Refresh</ActionButton>
            )}
          </div>
        </section>

        <FeedHealth feeds={feeds.data?.feeds ?? []} offline={feeds.data?.offline ?? false} />
        {active && !active.enabled && <p className="rounded-lg bg-accent px-3 py-2 text-sm">{active.note}</p>}

        {/* districts by level */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Districts by flood level">
          {counts.map(([level, n]) => (
            <div key={level} className="relative overflow-hidden rounded-xl border bg-card p-3 shadow-xs">
              <span className="absolute inset-y-0 left-0 w-1" style={{ background: LEVEL_COLOR[level] }} aria-hidden />
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <span className="inline-block size-2.5 rounded-full" style={{ background: LEVEL_COLOR[level] }} />{LEVEL_LABEL[level]}
              </div>
              <div className="mt-1 text-3xl font-semibold leading-none tabular-nums">{n}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${(n / Math.max(list.length, 1)) * 100}%`, background: LEVEL_COLOR[level] }} />
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">of {list.length} districts</div>
            </div>
          ))}
          <div className="relative overflow-hidden rounded-xl border bg-card p-3 shadow-xs">
            <span className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden />
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"><TriangleAlert className="size-3" aria-hidden />Alerts</div>
            <div className="mt-1 text-3xl font-semibold leading-none tabular-nums">{events.data?.counts.active ?? 0}</div>
            <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted">
              {Object.entries(sev).map(([s, c]) => <div key={s} className="h-full" style={{ width: `${(c / Math.max(sevTotal, 1)) * 100}%`, background: SEVERITY_COLOR[s] ?? SEVERITY_COLOR.Unknown }} title={`${s}: ${c}`} />)}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">active, by severity</div>
          </div>
        </section>

        {calm && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-xs">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-safe/15 text-safe"><ShieldCheck className="size-5" aria-hidden /></span>
            <p className="min-w-0 flex-1"><strong>All watched rivers are calm right now.</strong> <span className="text-muted-foreground">Nothing is at watch level. Open the simulated exercise to see how the Command Center, the brief and the evacuation engine behave in a flood.</span></p>
            <ActionButton size="sm" variant="soft" icon={FlaskConical} onClick={() => setExercise(true)}>Open the exercise</ActionButton>
          </div>
        )}

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="h-[28rem] lg:h-[44rem]">
            <OpsMap districts={list} events={events.data} selectedId={selected} focus={focus} onSelect={setSelected} />
          </div>
          <div className="space-y-4 lg:max-h-[44rem] lg:overflow-y-auto lg:pr-1">
            <Panel icon={SlidersHorizontal} title="Watched districts" hint="Flood level from the river forecast (GloFAS), worst first. Click to find one on the map.">
              {districts.isPending ? <p className="text-sm text-muted-foreground">Loading</p> : <DistrictRisk districts={list} selectedId={selected} onSelect={setSelected} />}
            </Panel>
            <Panel
              icon={Bell}
              tone="warn"
              title="Official alerts"
              hint={exercise ? 'Simulated alerts for the exercise.' : 'NDMA SACHET (IMD, CWC, state SDMAs) and GDACS.'}
              action={events.data ? <Pill tone="primary">{events.data.counts.located} on map</Pill> : undefined}
            >
              {events.data && (
                <p className="mb-2 text-[11px] text-muted-foreground">
                  Received {events.data.week_over_week.this_week} this week, {events.data.week_over_week.last_week} last week. {events.data.week_over_week.note}
                </p>
              )}
              <AlertList events={events.data?.events ?? []} onlyActive />
            </Panel>
          </div>
        </section>

        <BriefPanel mode={mode} exercise={exercise} />

        <footer className="flex flex-wrap items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
          {integrity.data && (
            <Link to="/audit" className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium ${integrity.data.status === 'invalid' ? 'border-risk bg-risk/10 text-risk' : 'bg-card text-foreground'}`} title={integrity.data.note}>
              {integrity.data.status === 'invalid' ? <ShieldX className="size-3.5" aria-hidden /> : <ShieldCheck className="size-3.5 text-safe" aria-hidden />}
              Decision log: {integrity.data.status === 'invalid' ? `changed after the fact (decision ${integrity.data.broken.join(', ')})` : `chain intact, ${integrity.data.checked} decisions checked`}
            </Link>
          )}
          <span>River risk is a global forecast (about 5 km): local drainage and embankment breaches are not in it. Alert positions are as precise as each sender writes them.</span>
        </footer>
      </main>
    </div>
  )
}
