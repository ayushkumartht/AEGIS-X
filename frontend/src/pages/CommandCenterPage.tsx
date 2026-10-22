import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { AccountMenu } from '@/components/site/AccountMenu'
import { Logo } from '@/components/site/Logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertList } from '@/features/ops/AlertList'
import { BriefPanel } from '@/features/ops/BriefPanel'
import { DistrictRisk } from '@/features/ops/DistrictRisk'
import { FeedHealth } from '@/features/ops/FeedHealth'
import { OpsMap } from '@/features/ops/OpsMap'
import { PlaceSearch } from '@/features/ops/PlaceSearch'
import { LEVEL_COLOR, LEVEL_LABEL } from '@/features/ops/levels'
import { canWrite, useAuth } from '@/state/authStore'

const POLL_MS = 60_000
const MODE_KEY = 'aegis.mode'

function loadMode(): string {
  try {
    return localStorage.getItem(MODE_KEY) ?? 'administration'
  } catch {
    return 'administration'
  }
}

export default function CommandCenterPage() {
  const user = useAuth((s) => s.user)
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

  const hazards = useQuery({ queryKey: ['ops-hazards'], queryFn: api.opsHazards, retry: false })
  const modes = useQuery({ queryKey: ['ops-modes'], queryFn: api.opsModes, retry: false })
  const feeds = useQuery({ queryKey: ['ops-feeds'], queryFn: api.opsFeeds, refetchInterval: POLL_MS, retry: false })
  const events = useQuery({ queryKey: ['ops-events', hazard], queryFn: () => api.opsEvents({ hazard, days: 3 }), refetchInterval: POLL_MS, retry: false })
  const districts = useQuery({ queryKey: ['ops-districts'], queryFn: api.opsDistricts, refetchInterval: POLL_MS, retry: false })
  const integrity = useQuery({ queryKey: ['integrity'], queryFn: api.integrity, retry: false })
  const refresh = useMutation({
    mutationFn: () => api.opsRefresh(false),
    onSuccess: () => qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('ops-') }),
  })

  const list = districts.data?.districts ?? []
  const counts = (['severe', 'warning', 'watch', 'normal', 'unknown'] as const).map((l) => [l, list.filter((d) => d.level === l).length] as const)
  const active = hazards.data?.find((h) => h.id === hazard)
  const apiDown = districts.isError && !districts.data

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-4 border-b px-4 py-3 text-sm sm:px-6">
        <Link to="/" aria-label="AEGIS-X home"><Logo /></Link>
        <h1 className="text-lg font-semibold">Command Center</h1>
        <nav className="ml-auto flex flex-wrap items-center gap-4 text-muted-foreground">
          <Link className="hover:text-foreground" to="/console/cachar">Evacuation console</Link>
          <Link className="hover:text-foreground" to="/audit">Decision log</Link>
          <Link className="hover:text-foreground" to="/docs">Documentation</Link>
          <AccountMenu />
        </nav>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6">
        {apiDown && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-risk" role="alert">Cannot reach the AEGIS-X server. It may be waking up; try again in a minute.</p>}

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Working as</span>
            <select className="rounded-lg border bg-background px-2 py-1.5" value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Operating mode">
              {(modes.data ?? [{ id: mode, name: mode, focus: '' }]).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <div className="flex gap-1.5" role="group" aria-label="Hazard">
            {(hazards.data ?? []).map((h) => (
              <button
                key={h.id}
                disabled={!h.enabled}
                onClick={() => setHazard(h.id)}
                aria-pressed={hazard === h.id}
                title={h.enabled ? undefined : h.note}
                className={`rounded-full border px-3 py-1 text-xs ${hazard === h.id ? 'bg-primary text-primary-foreground' : ''} ${h.enabled ? 'hover:bg-accent' : 'cursor-not-allowed opacity-55'}`}
              >
                {h.name}{h.enabled ? '' : ' (later)'}
              </button>
            ))}
          </div>
          <div className="ml-auto w-full sm:w-72"><PlaceSearch onPick={setFocus} /></div>
          {canWrite(user) && (
            <Button size="sm" variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending}>{refresh.isPending ? 'Refreshing' : 'Refresh alerts now'}</Button>
          )}
        </div>

        <FeedHealth feeds={feeds.data?.feeds ?? []} offline={feeds.data?.offline ?? false} />
        {active && !active.enabled && <p className="rounded-lg bg-accent px-3 py-2 text-sm">{active.note}</p>}

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Districts by flood level">
          {counts.map(([level, n]) => (
            <div key={level} className="rounded-xl border bg-card px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="inline-block size-2.5 rounded-full" style={{ background: LEVEL_COLOR[level] }} />{LEVEL_LABEL[level]}</div>
              <div className="text-2xl font-semibold tabular-nums">{n}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="h-[28rem] lg:h-[40rem]">
            <OpsMap districts={list} events={events.data} selectedId={selected} focus={focus} onSelect={setSelected} />
          </div>
          <div className="space-y-4 lg:max-h-[40rem] lg:overflow-y-auto lg:pr-1">
            <div>
              <h2 className="mb-1.5 font-semibold">Watched districts <span className="text-xs font-normal text-muted-foreground">flood level from the river forecast (GloFAS)</span></h2>
              {districts.isPending ? <p className="text-sm text-muted-foreground">Loading</p> : <DistrictRisk districts={list} selectedId={selected} onSelect={setSelected} />}
            </div>
            <div>
              <h2 className="mb-1.5 font-semibold">
                Official alerts <span className="text-xs font-normal text-muted-foreground">NDMA SACHET (IMD, CWC, state SDMAs) and GDACS</span>
              </h2>
              {events.data && (
                <p className="mb-1.5 text-xs text-muted-foreground">
                  {events.data.counts.active} active, {events.data.counts.located} on the map. Alerts received: {events.data.week_over_week.this_week} this week, {events.data.week_over_week.last_week} last week. {events.data.week_over_week.note}
                </p>
              )}
              <AlertList events={events.data?.events ?? []} onlyActive />
            </div>
          </div>
        </section>

        <BriefPanel mode={mode} />

        <footer className="flex flex-wrap items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
          {integrity.data && (
            <Badge variant={integrity.data.status === 'invalid' ? 'destructive' : 'outline'} title={integrity.data.note}>
              Decision log: {integrity.data.status === 'invalid' ? `changed after the fact (decision ${integrity.data.broken.join(', ')})` : `chain intact, ${integrity.data.checked} decisions checked`}
            </Badge>
          )}
          <span>River risk is a global forecast (about 5 km): local drainage and embankment breaches are not in it. Alert positions are as precise as each sender writes them.</span>
        </footer>
      </main>
    </div>
  )
}
