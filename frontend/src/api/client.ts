import { operatorName } from '@/state/operatorStore'
import type {
  Brief,
  Building,
  CompareResult,
  Conditions,
  DecisionRecord,
  DistrictInfo,
  Explanation,
  FeedStatus,
  FloodState,
  Hazard,
  Health,
  Integrity,
  Layers,
  OpsDistricts,
  OpsEvents,
  OpsMode,
  OptionsResult,
  PlaceHit,
  Plan,
  RedTeamResult,
  ReplayResult,
  ReportResult,
  SimResult,
  StoredReport,
  TerrainGrid,
  Trace,
  VoiResult,
  WhatIf,
} from './types'

const ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '')
const BASE = `${ORIGIN}/api/v1`

export class ApiError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, init)
  } catch {
    throw new ApiError(`Cannot reach the AEGIS-X API at ${ORIGIN}. Is the backend running?`)
  }
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* keep the status text */
    }
    throw new ApiError(detail, res.status)
  }
  return (await res.json()) as T
}

const send = <T>(method: string, path: string, body: unknown) =>
  request<T>(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const post = <T>(path: string, body: unknown) => send<T>('POST', path, body)

export interface RunArgs {
  district: string
  plan?: Plan
  what_if?: WhatIf
  n_samples?: number
  seed?: number
}

export const api = {
  health: () => request<Health>('/health'),
  districts: () => request<DistrictInfo[]>('/districts'),
  layers: (d: string) => request<Layers>(`/districts/${d}/layers`),
  terrain: (d: string) => request<TerrainGrid>(`/districts/${d}/terrain`),
  buildings: (d: string) => request<Building[]>(`/districts/${d}/buildings`),
  trace: (a: RunArgs & { pick: 'median' | 'bad_day' }) => post<Trace>('/simulate/trace', a),
  conditions: (d: string) => request<Conditions>(`/districts/${d}/conditions`),
  baselinePlan: (d: string) => request<Plan>(`/districts/${d}/baseline-plan`),
  refreshForecast: (d: string) => post<unknown>(`/districts/${d}/forecast/refresh`, {}),
  floodState: (d: string, level_m: number, closed_bridges: string[]) =>
    post<FloodState>(`/districts/${d}/flood-state`, { level_m, closed_bridges }),
  simulate: (a: RunArgs) => post<SimResult>('/simulate', a),
  compare: (a: Omit<RunArgs, 'plan'> & { plans: Record<string, Plan> }) => post<CompareResult>('/analysis/compare', a),
  redteam: (a: RunArgs) => post<RedTeamResult>('/analysis/redteam', a),
  voi: (a: RunArgs) => post<VoiResult>('/analysis/voi', a),
  optimize: (a: { district: string; what_if?: WhatIf }) => post<OptionsResult>('/analysis/optimize', a),
  explain: (payload: unknown) => post<Explanation>('/explain', { payload }),
  addReport: (district: string, text: string, source_type: string) =>
    post<ReportResult>('/reports', { district, text, source_type, author: operatorName() }),
  reports: (d: string) => request<StoredReport[]>(`/districts/${d}/reports`),
  addDecision: (body: {
    district: string
    action: 'accept' | 'edit' | 'reject'
    plan: Plan
    run_id: number | null
    explanation: string
    note: string
    evidence?: Record<string, unknown>
  }) => post<{ id: number }>('/decisions', { ...body, author: operatorName() }),
  decisions: (district?: string) => request<DecisionRecord[]>(`/decisions${district ? `?district=${district}` : ''}`),
  replay: (event: string) => request<ReplayResult>(`/replay/${event}`),
  integrity: () => request<Integrity>('/audit/integrity'),
  opsHazards: () => request<Hazard[]>('/ops/hazards'),
  opsFeeds: (exercise = false) => request<{ feeds: FeedStatus[]; offline: boolean; exercise: boolean }>(`/ops/feeds?exercise=${exercise}`),
  opsExercise: () => request<{ title: string; notice: string; source: string }>('/ops/exercise'),
  opsEvents: (q: { hazard?: string; days?: number; exercise?: boolean } = {}) => {
    const params = new URLSearchParams()
    if (q.hazard) params.set('hazard', q.hazard)
    if (q.days) params.set('days', String(q.days))
    if (q.exercise) params.set('exercise', 'true')
    return request<OpsEvents>(`/ops/events?${params}`)
  },
  opsDistricts: (exercise = false) => request<OpsDistricts>(`/ops/districts?exercise=${exercise}`),
  opsModes: () => request<OpsMode[]>('/ops/modes'),
  opsRefresh: (risk = false) => post<unknown>(`/ops/refresh?risk=${risk}`, {}),
  opsBrief: (mode: string, exercise = false) => post<Brief>('/ops/brief', { mode, exercise, author: operatorName() }),
  opsBriefs: () => request<Brief[]>('/ops/briefs'),
  opsDecide: (recId: number, action: 'accept' | 'reject', note: string) =>
    post<{ decision_id: number; status: string }>(`/ops/recommendations/${recId}/decision`, { action, note, author: operatorName() }),
  opsSearch: (q: string) => request<PlaceHit[]>(`/ops/search?q=${encodeURIComponent(q)}`),
}

/**
 * Run a simulation over the WebSocket so progress can be shown; resolves with the final result.
 * If the WebSocket cannot connect (some proxies block it), the same run goes over plain HTTP.
 */
export function simulateStream(args: RunArgs, onProgress: (p: number) => void): Promise<SimResult> {
  return streamOverSocket(args, onProgress).catch((err: unknown) => {
    if (err instanceof SocketUnavailable) return api.simulate(args)
    throw err
  })
}

class SocketUnavailable extends Error {}

function streamOverSocket(args: RunArgs, onProgress: (p: number) => void): Promise<SimResult> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${ORIGIN.replace(/^http/, 'ws')}/api/v1/ws/simulate`)
    let finished = false
    let opened = false
    ws.onopen = () => {
      opened = true
      ws.send(JSON.stringify(args))
    }
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data as string)
      if (msg.error) {
        finished = true
        reject(new ApiError(msg.error))
      } else if (msg.done) {
        finished = true
        resolve(msg.result as SimResult)
      } else if (typeof msg.progress === 'number') {
        onProgress(msg.progress)
      }
    }
    ws.onerror = () => {
      if (!finished) {
        finished = true
        reject(opened ? new ApiError('The connection dropped during the simulation.') : new SocketUnavailable())
      }
    }
    ws.onclose = () => {
      if (!finished) {
        finished = true
        reject(opened ? new ApiError('The connection closed before the simulation finished.') : new SocketUnavailable())
      }
    }
  })
}
