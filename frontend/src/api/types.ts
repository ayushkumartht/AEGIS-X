// Response shapes of the AEGIS-X API (backend/aegis/api). Request bodies are in client.ts.

export interface Plan {
  name?: string
  start_hour?: number
  priority?: string[]
  open_shelters?: string[]
  route_avoid?: string[]
  boats_at?: Record<string, number>
  vehicles_at?: Record<string, number>
  protected?: string[]
  warning_channels?: string[]
}

export interface WhatIf {
  peak_stage_m?: number
  local_rain_mm?: number
  boat_availability_pct?: number
  boat_delay_h?: number
  comms_degradation_pct?: number
  compliance_pct?: number
  peak_time_h?: number
  bridge_closed?: string[]
}

export interface Health {
  status: string
  version: string
  offline: boolean
  llm_provider: string
}

export type Role = 'admin' | 'officer' | 'viewer'

export interface AuthUser {
  id: number
  email: string
  name: string
  role: Role
}

export interface Account extends AuthUser {
  created_at: string
  active: boolean
  last_login_at: string | null
}

export interface DistrictStatus extends DistrictInfo {
  forecast: Conditions['forecast'] | null
  error: string | null
  totals?: { population: number; areas: number; shelters: number; shelter_capacity: number; bridges: number; boats: number | null }
  beliefs?: Belief[]
}

export interface Overview {
  system: {
    version: string
    env: string
    offline: boolean
    llm_provider: string
    llm_model: string | null
    rate_limit_per_min: number
    max_heavy_jobs: number
    server_time: string
  }
  counts: { run: number; decision: number; field_report: number; user: number }
  districts: DistrictStatus[]
  activity: { date: string; runs: number; decisions: number; reports: number }[]
  recent_runs: { id: number; created_at: string; district: string; n_samples: number; seed: number | null; summary: Summary }[]
  recent_decisions: { id: number; decided_at: string; district: string; author: string; action: 'accept' | 'edit' | 'reject'; run_id: number | null; note: string }[]
  recent_reports: StoredReport[]
}

export interface DistrictInfo {
  id: string
  name: string
  built: boolean
  synthetic: boolean
}

export interface GeoFeature {
  type: 'Feature'
  geometry: { type: string; coordinates: unknown }
  properties: Record<string, unknown>
}

export interface FeatureCollection {
  type: 'FeatureCollection'
  features: GeoFeature[]
}

export interface Layers {
  roads: FeatureCollection
  river: FeatureCollection
  clusters: FeatureCollection
  shelters: FeatureCollection
  staging: FeatureCollection
  bridges: { id: string; name: string; edges: number[] }[]
  bounds: [number, number, number, number]
  metadata: Record<string, unknown>
  totals: { population: number; clusters: number; shelters: number; edges: number }
}

export interface VariableInfo {
  name: string
  kind: 'continuous' | 'binary' | 'empirical'
  source: string
  low?: number
  high?: number
  mode?: number
  median?: number
  p_true?: number
  n?: number
}

export interface Belief {
  subject: string
  kind: string
  p_open?: number
  range?: number[]
  source: string
}

export interface Conditions {
  forecast: { source?: string; forecast_date?: string | null; warning?: string; [k: string]: unknown }
  variables: VariableInfo[]
  beliefs: Belief[]
  resources: { boats: number | null; vehicles: number | null; note: string }
}

export interface Summary {
  mean: number
  std: number
  p05: number
  p10: number
  p50: number
  p90: number
  p95: number
  worst: number
  best: number
  resilience?: number
}

export interface Histogram {
  counts: number[]
  edges: number[]
}

export interface SimResult {
  plan: Plan
  n_samples: number
  summary: Summary
  resilience_worst_10pct: number
  histogram: Histogram
  metric_means: Record<string, number>
  clusters: { id: string; evacuated_share: number; flooded_probability: number }[]
  forecast: Conditions['forecast']
  run_id: number
}

export interface CompareResult {
  plans: Record<string, { plan: Plan; summary: Summary; histogram: Histogram; metric_means: Record<string, number> }>
  n_samples: number
  same_futures: boolean
}

export interface RedTeamResult {
  fail_below: number
  failure_rate: number
  worst_case_futures: { rank: number; metric_value: number; conditions_summary: Record<string, number>; flagged_variables: string[] }[]
  single_points_of_failure: { element_id: string; baseline_value: number; degraded_value: number; drop_pct: number }[]
  failure_boxes: { limits: Record<string, (number | null)[]>; density: number; coverage: number; support: number; description: string }[]
  adversarial: { found: boolean; baseline_value: number; failing_value: number; shifts: Record<string, { from: number; to: number }> }
  sensitivity: { variable: string; correlation: number; abs_importance: number; s1: number | null; st: number | null }[]
}

export interface VoiResult {
  metric: string
  false_alarm_weight: number
  best_plan_now: string
  candidate_plans: string[]
  check_next: {
    variable: string
    action: string
    voi_pct: number
    voi_absolute: number
    best_plan_by_range: [string, string][]
  }[]
}

export interface Objectives {
  mean_evacuated: number
  worst10_evacuated: number
  boats_used: number
}

export interface OptionsResult {
  baseline: { plan: Plan; objectives: Objectives }
  options: { label: string; plan: Plan; objectives: Objectives }[]
  n_samples: number
}

export interface Explanation {
  text: string
  source: string
}

export interface ReportResult {
  id: number
  parsed: { subject_type: string; subject_name: string; claim: string; value: number | null; method: string }
  beliefs: Belief[]
}

export interface StoredReport {
  id: number
  received_at: string
  district: string
  author: string
  source_type: string
  raw_text: string
  parsed: ReportResult['parsed']
}

export interface DecisionRecord {
  id: number
  decided_at: string
  district: string
  author: string
  action: 'accept' | 'edit' | 'reject'
  plan: Plan
  run_id: number | null
  run: { n_samples: number; seed: number | null; summary: Summary; forecast: Conditions['forecast'] } | null
  explanation: string
  note: string
}

export interface ReplayStep {
  date: string
  observed_discharge: number
  observed_stage_m: number
  predicted_peak_stage_m: { low: number; high: number; range: number[] }
  actual_peak_stage_m: number
  actual_flooded_population_share: number
  options: Record<string, { mean: number; worst10: number; unneeded: number; flooded_share: number }>
  advice_start_hour: number
}

export interface ReplayResult {
  event: { id: string; name: string; facts: { text: string; source: string; verify: boolean }[]; assumptions: Record<string, number> }
  steps: ReplayStep[]
  calibration: { interval_coverage_10_90: number; expected_coverage: number; n_steps: number }
  rating: { q_normal: number; k: number }
  limits: string[]
}

export interface TerrainGrid {
  n: number
  bounds: [number, number, number, number] // lon0, lat0, lon1, lat1
  heights: number[] // metres above the river's normal level, row-major from south to north
  max: number
}

export interface Building {
  ring: number[][] // [lon, lat]
  levels: number | null
  kind: string
}

export interface Trace {
  pick: 'median' | 'bad_day'
  times: number[]
  level: number[] // metres above normal, per hour
  remaining: number[][] // [hour][cluster] people not yet moved
  by_boat: number[][]
  by_land: number[][]
  flood_time_h: (number | null)[]
  start_h: number
  boats_on_h: number
  cluster_ids: string[]
  conditions: Record<string, number>
  metrics: Record<string, number>
  boats_total: number
  staging: Record<string, number>
}

export interface FloodState {
  level_m: number
  cut_edges: number[]
  flooded_clusters: string[]
  flooded_shelters: string[]
  people_in_flooded_clusters: number
}
