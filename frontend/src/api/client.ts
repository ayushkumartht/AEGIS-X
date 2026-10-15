import type {
  CompareResponse,
  ConditionOverride,
  DemoScenario,
  ExplainResponse,
  FloodStateResponse,
  MonteCarloRequest,
  MonteCarloResponse,
  PlanOverride,
  RedTeamResponse,
} from './types'

const BASE_URL = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`${path} failed (${res.status}): ${detail}`)
  }
  return res.json() as Promise<T>
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) {
    throw new Error(`${path} failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export const api = {
  getDemoScenario: () => getJSON<DemoScenario>('/flood/demo-scenario'),

  getFloodState: (conditions: ConditionOverride) =>
    postJSON<FloodStateResponse>('/flood/flood-state', conditions),

  runMonteCarlo: (req: MonteCarloRequest) =>
    postJSON<MonteCarloResponse>('/flood/monte-carlo', req),

  comparePlans: (planA: PlanOverride, planB: PlanOverride, n_samples = 500, seed = 42) =>
    postJSON<CompareResponse>(
      `/flood/compare?n_samples=${n_samples}&seed=${seed}`,
      { plan_a: planA, plan_b: planB },
    ),

  runRedTeam: (req: MonteCarloRequest) => postJSON<RedTeamResponse>('/flood/redteam', req),

  explainRedTeam: (req: MonteCarloRequest) => postJSON<ExplainResponse>('/flood/explain', req),
}
