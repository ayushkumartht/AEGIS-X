import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { Layers } from '@/api/types'
import { Logo } from '@/components/site/Logo'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckNextTab } from '@/features/check-next/CheckNextTab'
import { DecisionBar } from '@/features/decision/DecisionBar'
import { CesiumScene } from '@/features/map/CesiumScene'
import { MapView } from '@/features/map/MapView'
import { Scene3D } from '@/features/map/Scene3D'
import { OptionsTab } from '@/features/options/OptionsTab'
import { PlanTab } from '@/features/plan/PlanTab'
import { RedTeamTab } from '@/features/redteam/RedTeamTab'
import { ResultsTab } from '@/features/results/ResultsTab'
import { useRunSim } from '@/features/results/useRunSim'
import { SituationTab } from '@/features/situation/SituationTab'
import { useConsole, type TabId } from '@/state/consoleStore'

const TABS: [TabId, string][] = [
  ['situation', 'Situation'],
  ['plan', 'Plan'],
  ['results', 'Results'],
  ['redteam', 'Red Team'],
  ['check', 'Check next'],
  ['options', 'Options'],
]

export default function ConsolePage({ initialDistrict: fixed }: { initialDistrict?: string }) {
  const params = useParams()
  const initialDistrict = fixed ?? params.district
  const { district, setDistrict, tab, setTab, plan, setPlan, whatIf, level, setLevel } = useConsole()
  const sim = useRunSim()
  const [view, setView] = useState<'cesium' | '3d' | '2d'>('cesium')

  useEffect(() => {
    if (initialDistrict && initialDistrict !== useConsole.getState().district) setDistrict(initialDistrict)
  }, [initialDistrict, setDistrict])

  const health = useQuery({ queryKey: ['health'], queryFn: api.health, retry: false })
  const districts = useQuery({ queryKey: ['districts'], queryFn: api.districts, retry: false })
  const layers = useQuery({ queryKey: ['layers', district], queryFn: () => api.layers(district), retry: false })
  const terrain = useQuery({ queryKey: ['terrain', district], queryFn: () => api.terrain(district), retry: false, enabled: layers.isSuccess })
  const baseline = useQuery({ queryKey: ['baseline', district], queryFn: () => api.baselinePlan(district), retry: false, enabled: layers.isSuccess })
  const closed = whatIf.bridge_closed ?? []
  const flood = useQuery({
    queryKey: ['flood-state', district, level, closed.join(',')],
    queryFn: () => api.floodState(district, level, closed),
    enabled: layers.isSuccess,
    placeholderData: (prev) => prev,
  })

  useEffect(() => {
    if (baseline.data && !plan) setPlan(baseline.data)
  }, [baseline.data, plan, setPlan])

  const data = layers.data as Layers | undefined
  const maxLevel = data ? Math.ceil(Math.max(...data.clusters.features.map((f) => Number(f.properties.hand))) + 1) : 8
  const apiDown = health.isError

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-2 text-sm">
        <Link to="/" aria-label="AEGIS-X home"><Logo /></Link>
        <select className="rounded-lg border bg-background px-2 py-1.5" value={district} onChange={(e) => setDistrict(e.target.value)} aria-label="District">
          {(districts.data ?? [{ id: district, name: district, built: true, synthetic: false }]).map((d) => (
            <option key={d.id} value={d.id} disabled={!d.built}>{d.name}{d.built ? '' : ' (not built)'}</option>
          ))}
        </select>
        {health.data && (
          <>
            <Badge variant="outline">Language model: {health.data.llm_provider === 'none' ? 'off (templates)' : health.data.llm_provider}</Badge>
            {health.data.offline && <Badge variant="secondary">Offline mode</Badge>}
          </>
        )}
        {data?.metadata.synthetic ? <Badge variant="secondary">Synthetic data</Badge> : null}
        <nav className="ml-auto flex gap-4 text-muted-foreground">
          <Link className="hover:text-foreground" to="/replay/silchar_2022">Replay</Link>
          <Link className="hover:text-foreground" to="/audit">Decision log</Link>
          <Link className="hover:text-foreground" to="/docs">Documentation</Link>
        </nav>
      </header>

      {apiDown && (
        <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-risk" role="alert">
          Cannot reach the AEGIS-X API. Start it with scripts\dev.ps1 (or uvicorn aegis.api.main:app from backend/).
        </div>
      )}
      {layers.isError && !apiDown && <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-risk" role="alert">{String(layers.error)}</div>}

      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_30rem]">
        <section className="relative min-h-[40vh]">
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
            <div className="absolute left-3 top-3 z-10 flex overflow-hidden rounded-lg border bg-card/95 text-xs shadow backdrop-blur" role="group" aria-label="Map view">
              {([['cesium', '3D (real terrain)'], ['3d', '3D (lite)'], ['2d', '2D map']] as const).map(([v, label]) => (
                <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={view === v ? 'bg-primary px-3 py-1.5 font-medium text-primary-foreground' : 'px-3 py-1.5 hover:bg-accent'}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {data && (
            <div className="absolute bottom-3 left-3 w-72 rounded-lg border bg-card/95 p-3 text-xs shadow backdrop-blur">
              <label htmlFor="level" className="flex justify-between font-medium">
                <span>Water level above normal</span>
                <span className="tabular-nums">{level.toFixed(1)} m</span>
              </label>
              <input id="level" type="range" className="w-full accent-primary" min={0} max={maxLevel} step={0.1} value={level} onChange={(e) => setLevel(Number(e.target.value))} />
              <div className="mt-1 text-muted-foreground">
                {flood.data ? `${flood.data.flooded_clusters.length} of ${data.totals.clusters} areas flooded, ${flood.data.people_in_flooded_clusters.toLocaleString()} of ${data.totals.population.toLocaleString()} people.` : ''}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                <span><i className="inline-block size-2 rounded-full bg-[#f59e0b]" /> area</span>
                <span><i className="inline-block size-2 rounded-full bg-[#16a34a]" /> shelter</span>
                <span><i className="inline-block size-2 rounded-full bg-[#7c3aed]" /> boat base</span>
                <span><i className="inline-block h-0.5 w-3 bg-[#2563eb]" /> cut road</span>
              </div>
            </div>
          )}
        </section>

        <aside className="flex min-h-0 flex-col border-l">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="flex min-h-0 flex-1 flex-col gap-0">
            <TabsList className="m-2 grid grid-cols-6">
              {TABS.map(([id, label]) => <TabsTrigger key={id} value={id} className="px-1 text-xs">{label}</TabsTrigger>)}
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              {data && (
                <>
                  <TabsContent value="situation"><SituationTab layers={data} /></TabsContent>
                  <TabsContent value="plan"><PlanTab layers={data} running={sim.running} progress={sim.progress} onRun={sim.run} error={sim.error} /></TabsContent>
                  <TabsContent value="results"><ResultsTab /></TabsContent>
                  <TabsContent value="redteam"><RedTeamTab /></TabsContent>
                  <TabsContent value="check"><CheckNextTab /></TabsContent>
                  <TabsContent value="options"><OptionsTab /></TabsContent>
                </>
              )}
            </div>
          </Tabs>
        </aside>
      </main>
      <DecisionBar />
    </div>
  )
}
