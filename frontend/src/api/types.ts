// Mirrors the Pydantic models / return shapes in api/main.py and
// core/engine/*. Keep in sync with the backend by hand for now (no
// codegen) - this is a small, stable surface.

export interface PopulationCluster {
  pos: [number, number]
  count: number
}

export interface DemoScenario {
  name: string
  grid_size: [number, number]
  shelters: [number, number][]
  bridges: Record<string, [number, number]>
  population_clusters: PopulationCluster[]
  elevation: number[][]
  roads: boolean[][]
}

export interface ConditionOverride {
  rainfall_mm?: number
  resource_availability_pct?: number
  comms_degradation_pct?: number
}

export interface PlanOverride {
  boats_per_shelter?: number[]
  evacuation_priority?: number[]
  reinforced_cells?: [number, number][]
}

export interface MonteCarloRequest {
  n_samples?: number
  seed?: number
  plan?: PlanOverride
  point_conditions?: ConditionOverride
}

export interface MetricSummary {
  mean: number
  std: number
  p10: number
  p50: number
  p90: number
  worst: number
  best: number
}

export interface MonteCarloResponse {
  plan: string
  n_samples: number
  summary: MetricSummary
  resilience_worst_10pct: number
}

export type CompareResponse = Record<string, MetricSummary & { resilience: number }>

export interface WorstCaseFinding {
  rank: number
  metric_value: number
  conditions_summary: Record<string, number>
  flagged_variables: string[]
}

export interface SinglePointOfFailure {
  element_id: string
  baseline_value: number
  degraded_value: number
  drop_pct: number
}

export interface SensitivityResult {
  variable: string
  correlation: number
  abs_importance: number
}

export interface RedTeamResponse {
  plan: string
  worst_case_futures: WorstCaseFinding[]
  single_points_of_failure: SinglePointOfFailure[]
  sensitivity: SensitivityResult[]
}

export interface ExplainResponse {
  narration: string
  based_on: RedTeamResponse
}

export interface FloodStateResponse {
  water_level_m: number
  flooded: boolean[][]
}
