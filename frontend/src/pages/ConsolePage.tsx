import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Activity, BookOpen, Boxes, Cuboid, Droplets, Eye, Layers as LayersIcon, LayoutDashboard, Lightbulb, Map as MapIcon,
  Mountain, ScrollText, ShieldAlert, SlidersHorizontal, Sparkles, Target, Users2, WifiOff,
} from 'lucide-react'
import { api } from '@/api/client'
import type { Layers } from '@/api/types'
import { Logo } from '@/components/site/Logo'
import { OperatorChip } from '@/components/site/OperatorChip'
import { Ring } from '@/components/viz/kit'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckNextTab } from '@/features/check-next/CheckNextTab'
import { DecisionBar } from '@/features/decision/DecisionBar'
import { CesiumScene } from '@/features/map/CesiumScene'
import { MapView } from '@/features/map/MapView'
import { Scene3D } from '@/features/map/Scene3D'
import { OptionsTab } from '@/features/options/OptionsTab'
import { PlanTab } from '@/features/plan/PlanTab'
import { ResourcesTab } from '@/features/plan/ResourcesTab'
import { RedTeamTab } from '@/features/redteam/RedTeamTab'
import { ResultsTab } from '@/features/results/ResultsTab'
import { useRunSim } from '@/features/results/useRunSim'
import { SituationTab } from '@/features/situation/SituationTab'
import { useConsole, type TabId } from '@/state/consoleStore'

const TABS = [
  ['situation', 'Situation', Eye],
  ['plan', 'Plan', SlidersHorizontal],
  ['resources', 'Resources', Boxes],
  ['results', 'Results', Activity],
  ['redteam', 'Red Team', ShieldAlert],
  ['check', 'Check next', Lightbulb],
  ['options', 'Options', Sparkles],
] as const

const VIEWS = [
  ['cesium', 'Real terrain', Mountain],
  ['3d', '3D lite', Cuboid],
  ['2d', '2D map', MapIcon],
] as const

const NAV = [
  ['/command', 'Command Center', LayoutDashboard],
  ['/replay/silchar_2022', 'Replay 2022', Droplets],
  ['/audit', 'Decision log', ScrollText],
  ['/docs', 'Docs', BookOpen],
] as const

export default function ConsolePage({ initialDistrict: fixed }: { initialDistrict?: string }) {
  const params = useParams()
  const initialDistrict = fixed ?? params.district
  const { district, setDistrict, tab, setTab, plan, setPlan, whatIf, level, setLevel, sim: result } = useConsole()
  const sim = useRunSim()
  // the light 2D map first: the 3D globe is heavy on laptops, so it opens only when chosen (and is remembered)
  const [view, setViewState] = useState<'cesium' | '3d' | '2d'>(() => {
    try {
      const v = localStorage.getItem('aegis:console-view')
      return v === 'cesium' || v === '3d' ? v : '2d'
    } catch {
      return '2d'
    }
  })
  const setView = (v: 'cesium' | '3d' | '2d') => {
    setViewState(v)
    try {
      localStorage.setItem('aegis:console-view', v)
    } catch {
      /* storage blocked: the choice just isn't remembered */
    }
  }

  useEffect(() => {
    if (initialDistrict && initialDistrict !== useConsole.getState().district) setDistrict(initialDistrict)
  }, [initialDistrict, setDistrict])

  // The open tab lives in the address (?tab=redteam) so a console view can be linked and bookmarked.
  const [search, setSearch] = useSearchParams()
  useEffect(() => {
    const wanted = search.get('tab')
    if (wanted && TABS.some(([id]) => id === wanted)) setTab(wanted as TabId)
    // read once per district: later tab changes are written to the address by changeTab
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDistrict])
  const changeTab = (v: string) => {
    setTab(v as TabId)
    setSearch((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', v)
      return next
    }, { replace: true })
  }

  const health = useQuery({ queryKey: ['health'], queryFn: api.health, retry: false })
  const districts = useQuery({ queryKey: ['districts'], queryFn: api.districts, retry: false })
  const layers = useQuery({ queryKey: ['layers', district], queryFn: () => api.layers(district), retry: false })
  const terrain = useQuery({ queryKey: ['terrain', district], queryFn: () => api.terrain(district), retry: false, enabled: layers.isSuccess })
  const baseline = useQuery({ queryKey: ['baseline', district], queryFn: () => api.baselinePlan(district), retry: false, enabled: layers.isSuccess })
  const closed = whatIf.bridge_closed ?? []
  // ask the server once the slider settles, not for every 0.1 m step while it is dragged
  const [floodLevel, setFloodLevel] = useState(level)
  useEffect(() => {
    const id = window.setTimeout(() => setFloodLevel(level), 150)
    return () => window.clearTimeout(id)
  }, [level])
  const flood = useQuery({
    queryKey: ['flood-state', district, floodLevel, closed.join(',')],
    queryFn: () => api.floodState(district, floodLevel, closed),
    enabled: layers.isSuccess,
    placeholderData: (prev) => prev,
  })

  useEffect(() => {
    if (baseline.data && !plan) setPlan(baseline.data)
  }, [baseline.data, plan, setPlan])

  const data = layers.data as Layers | undefined
  const maxLevel = data ? Math.ceil(Math.max(...data.clusters.features.map((f) => Number(f.properties.hand))) + 1) : 8
  const apiDown = health.isError
  const llm = health.data?.llm_provider
  const floodedShare = flood.data && data ? flood.data.people_in_flooded_clusters / Math.max(data.totals.population, 1) : 0

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-card px-4 py-2.5 text-sm">
        <Link to="/" aria-label="AEGIS-X home"><Logo /></Link>
        <div className="flex items-center gap-2">
          <MapIcon className="size-4 text-muted-foreground" aria-hidden />
          <select className="rounded-lg border bg-background px-2.5 py-1.5 text-sm font-medium shadow-xs" value={district} onChange={(e) => setDistrict(e.target.value)} aria-label="District">
            {(districts.data ?? [{ id: district, name: district, built: true, synthetic: false }]).map((d) => (
              <option key={d.id} value={d.id} disabled={!d.built}>{d.name}{d.built ? '' : ' (not built)'}</option>
            ))}
          </select>
        </div>
        {health.data && (
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1" title={llm === 'none' ? 'Explanations use fixed templates' : 'Explanations are written by the language model and checked against the numbers'}>
              <span className={`size-2 rounded-full ${llm === 'none' ? 'bg-muted-foreground' : 'bg-safe'}`} aria-hidden />
              AI narration {llm === 'none' ? 'off' : `on (${llm})`}
            </span>
            {health.data.offline && <span className="inline-flex items-center gap-1 rounded-full bg-warn/25 px-2.5 py-1"><WifiOff className="size-3" aria-hidden />Offline mode</span>}
            {data?.metadata.synthetic ? <span className="rounded-full bg-warn/25 px-2.5 py-1">Synthetic data</span> : null}
          </div>
        )}
        <nav className="ml-auto flex flex-wrap items-center gap-1" aria-label="Pages">
          {NAV.map(([to, label, Icon]) => (
            <Link key={to} to={to} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <Icon className="size-4" aria-hidden />{label}
            </Link>
          ))}
          <OperatorChip />
        </nav>
      </header>

      {apiDown && (
        <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-risk" role="alert">
          {import.meta.env.DEV
            ? 'Cannot reach the AEGIS-X API. Start it with scripts\\dev.ps1 (or uvicorn aegis.api.main:app from backend/).'
            : 'Cannot reach the AEGIS-X server. It may be waking up after being idle; try again in a minute.'}
        </div>
      )}
      {layers.isError && !apiDown && <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-risk" role="alert">{String(layers.error)}</div>}

      {/* below lg the map and the panel share the height (panel scrolls inside), so nothing spills over */}
      <main className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,42fr)_minmax(0,58fr)] overflow-hidden lg:grid-cols-[1fr_34rem] lg:grid-rows-1">
        <section className="relative min-h-0">
          {data && view === 'cesium' ? (
            <CesiumScene district={district} layers={data} flood={flood.data} level={level} />
          ) : data && view === '3d' && terrain.data ? (
            <Scene3D layers={data} terrain={terrain.data} flood={flood.data} level={level} />
          ) : data && view === '2d' ? (
            <MapView layers={data} flood={flood.data} />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">{layers.isPending || terrain.isPending ? 'Loading the district' : 'No map'}</div>
          )}
          {data && (
            <div className="absolute left-3 top-3 z-10 flex overflow-hidden rounded-xl border bg-card/95 p-0.5 text-xs shadow-md backdrop-blur" role="group" aria-label="Map view">
              {VIEWS.map(([v, label, Icon]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${view === v ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                >
                  <Icon className="size-3.5" aria-hidden />{label}
                </button>
              ))}
            </div>
          )}
          {data && (
            <div className="absolute bottom-3 left-3 w-80 rounded-xl border bg-card/95 p-3.5 text-xs shadow-lg backdrop-blur">
              <div className="flex items-center gap-2">
                <Droplets className="size-4 text-flood" aria-hidden />
                <label htmlFor="level" className="flex-1 font-semibold">Water above normal</label>
                <span className="rounded-md bg-flood/15 px-2 py-0.5 text-sm font-semibold tabular-nums text-flood">{level.toFixed(1)} m</span>
              </div>
              <input id="level" type="range" className="mt-2 w-full accent-primary" min={0} max={maxLevel} step={0.1} value={level} onChange={(e) => setLevel(Number(e.target.value))} />
              {flood.data && (
                <div className="mt-1.5">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{flood.data.flooded_clusters.length} of {data.totals.clusters} areas flooded</span>
                    <span className="tabular-nums">{flood.data.people_in_flooded_clusters.toLocaleString()} of {data.totals.population.toLocaleString()} people</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-risk transition-all" style={{ width: `${floodedShare * 100}%` }} /></div>
                </div>
              )}
              <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                <span className="inline-flex items-center gap-1"><i className="inline-block size-2 rounded-full bg-[#f59e0b]" />area</span>
                <span className="inline-flex items-center gap-1"><i className="inline-block size-2 rounded-full bg-[#16a34a]" />shelter</span>
                <span className="inline-flex items-center gap-1"><i className="inline-block size-2 rounded-full bg-[#7c3aed]" />boat base</span>
                <span className="inline-flex items-center gap-1"><i className="inline-block h-0.5 w-3 bg-[#2563eb]" />cut road</span>
              </div>
            </div>
          )}
        </section>

        <aside className="flex min-h-0 flex-col border-t bg-muted/30 lg:border-t-0 lg:border-l">
          {/* plan health at a glance: stays in view whichever tab is open */}
          <div className="flex items-center gap-3 border-b bg-card px-4 py-3">
            {result ? (
              <>
                <Ring value={result.summary.mean} label="on average" tone="primary" size={64} />
                <Ring value={result.resilience_worst_10pct} label="bad day" tone={result.resilience_worst_10pct < 0.4 ? 'risk' : result.resilience_worst_10pct < 0.65 ? 'warn' : 'safe'} size={64} />
                <div className="min-w-0 flex-1 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold"><Target className="size-3.5 text-primary" aria-hidden />Current plan</div>
                  <p className="mt-0.5 leading-snug text-muted-foreground">of people at risk reach safety in time, tested on {result.n_samples} futures.</p>
                </div>
              </>
            ) : (
              <>
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Users2 className="size-5" aria-hidden /></span>
                <div className="min-w-0 flex-1 text-xs">
                  <div className="font-semibold">No plan tested yet</div>
                  <p className="mt-0.5 leading-snug text-muted-foreground">Open the Plan tab and test the plan on 500 futures. Its score stays here.</p>
                </div>
              </>
            )}
          </div>
          <Tabs value={tab} onValueChange={changeTab} className="flex min-h-0 flex-1 flex-col gap-0">
            <TabsList className="relative z-10 mx-3 mt-3 grid h-auto w-auto shrink-0 grid-cols-7 gap-0.5 rounded-xl border bg-card p-1 shadow-xs">
              {TABS.map(([id, label, Icon]) => (
                <TabsTrigger key={id} value={id} title={label} className="min-w-0 flex-col gap-1 rounded-lg px-0.5 py-1.5 text-[10px] font-medium leading-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                  <Icon className="size-4" aria-hidden />
                  <span className="max-w-full truncate">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3">
              {data ? (
                <>
                  <TabsContent value="situation"><SituationTab layers={data} /></TabsContent>
                  <TabsContent value="plan"><PlanTab layers={data} running={sim.running} progress={sim.progress} onRun={sim.run} error={sim.error} /></TabsContent>
                  <TabsContent value="resources"><ResourcesTab layers={data} /></TabsContent>
                  <TabsContent value="results"><ResultsTab /></TabsContent>
                  <TabsContent value="redteam"><RedTeamTab /></TabsContent>
                  <TabsContent value="check"><CheckNextTab /></TabsContent>
                  <TabsContent value="options"><OptionsTab /></TabsContent>
                </>
              ) : (
                <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><LayersIcon className="size-4 animate-pulse" aria-hidden />Loading the district</div>
              )}
            </div>
          </Tabs>
        </aside>
      </main>
      <DecisionBar />
    </div>
  )
}
