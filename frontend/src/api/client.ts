import type {
  Building,
  CompareResult,
  Conditions,
  DecisionRecord,
  DistrictInfo,
  Explanation,
  FloodState,
  Health,
  Layers,
  OptionsResult,
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

const ORIGIN = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const BASE = `${ORIGIN}/api/v1`

export class ApiError extends Error {}

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
    throw new ApiError(detail)
  }
  return (await res.json()) as T
}

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

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
    post<ReportResult>('/reports', { district, text, source_type }),
  reports: (d: string) => request<StoredReport[]>(`/districts/${d}/reports`),
  addDecision: (body: {
    district: string
    action: 'accept' | 'edit' | 'reject'
    plan: Plan
    run_id: number | null
    explanation: string
    note: string
    author: string
  }) => post<{ id: number }>('/decisions', body),
  decisions: (district?: string) => request<DecisionRecord[]>(`/decisions${district ? `?district=${district}` : ''}`),
  replay: (event: string) => request<ReplayResult>(`/replay/${event}`),
}

/** Run a simulation over the WebSocket so progress can be shown; resolves with the final result. */
export function simulateStream(args: RunArgs, onProgress: (p: number) => void): Promise<SimResult> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${ORIGIN.replace(/^http/, 'ws')}/api/v1/ws/simulate`)
    let finished = false
    ws.onopen = () => ws.send(JSON.stringify(args))
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
      if (!finished) reject(new ApiError(`Cannot reach the AEGIS-X API at ${ORIGIN}. Is the backend running?`))
    }
    ws.onclose = () => {
      if (!finished) reject(new ApiError('The connection closed before the simulation finished.'))
    }
  })
}
