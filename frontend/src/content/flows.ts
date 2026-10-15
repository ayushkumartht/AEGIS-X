import type { FlowEdge, FlowLane, FlowNode } from '@/components/visuals/FlowDiagram'

export type FlowSpec = {
  nodes: FlowNode[]
  edges: FlowEdge[]
  lanes?: FlowLane[]
  height: number
  ariaLabel: string
}

/** Whole-system architecture, mirroring the real repo layout (api/, core/engine/, domains/). */
export const architectureFlow: FlowSpec = {
  height: 640,
  ariaLabel: 'AEGIS-X system architecture: interface, API, domain-agnostic core engine, domain modules and data inputs',
  lanes: [
    { label: 'Interface', y: 16, h: 100 },
    { label: 'API layer · FastAPI', y: 132, h: 100 },
    { label: 'Core engine · domain-agnostic', y: 248, h: 162 },
    { label: 'Domain modules', y: 426, h: 100 },
    { label: 'Inputs', y: 542, h: 84 },
  ],
  nodes: [
    { id: 'dash', label: 'Decision dashboard', detail: 'React · map · charts', x: 430, y: 66, w: 200 },
    { id: 'officer', label: 'Authorized officer', detail: 'final decision', x: 840, y: 66, w: 180, tone: 'solid' },
    { id: 'api', label: 'FastAPI', detail: '/flood/* endpoints', x: 500, y: 188, w: 200 },
    { id: 'groq', label: 'LLM narrator', detail: 'explains, never decides', x: 820, y: 188, w: 200, tone: 'muted' },
    { id: 'compare', label: 'Plan compare', detail: 'compare.py', x: 120, y: 306, w: 150 },
    { id: 'redteam', label: 'Red Team', detail: 'redteam.py', x: 310, y: 306, w: 150 },
    { id: 'sens', label: 'Sensitivity', detail: 'sensitivity.py', x: 500, y: 306, w: 150 },
    { id: 'voi', label: 'Value of info', detail: 'voi.py', x: 690, y: 306, w: 150 },
    { id: 'opt', label: 'Optimizer', detail: 'optimizer.py', x: 880, y: 306, w: 150 },
    { id: 'mc', label: 'Monte Carlo runner', detail: 'montecarlo.py · seeded, reproducible', x: 500, y: 378, w: 320, tone: 'solid' },
    { id: 'fire', label: 'Urban fire', detail: 'interface ready', x: 250, y: 484, w: 170, tone: 'muted' },
    { id: 'flood', label: 'Flood evacuation', detail: 'simulate()', x: 500, y: 484, w: 200, tone: 'solid' },
    { id: 'crowd', label: 'Crowd security', detail: 'interface ready', x: 750, y: 484, w: 170, tone: 'muted' },
    { id: 'inputs', label: 'Forecasts · elevation · road network · field reports', detail: 'IMD · CWC · DEM · OSM', x: 500, y: 590, w: 520, tone: 'muted' },
  ],
  edges: [
    { from: 'officer', to: 'dash', label: 'accept · edit · reject' },
    { from: 'dash', to: 'api', route: 'v' },
    { from: 'api', to: 'groq', label: 'findings' },
    { from: 'api', to: 'compare', route: 'v' },
    { from: 'api', to: 'redteam', route: 'v' },
    { from: 'api', to: 'sens', route: 'v' },
    { from: 'api', to: 'voi', route: 'v' },
    { from: 'api', to: 'opt', route: 'v' },
    { from: 'compare', to: 'mc', route: 'v' },
    { from: 'redteam', to: 'mc', route: 'v' },
    { from: 'voi', to: 'mc', route: 'v' },
    { from: 'opt', to: 'mc', route: 'v' },
    { from: 'mc', to: 'flood', route: 'v', label: 'simulate() × N' },
    { from: 'mc', to: 'fire', route: 'v', dashed: true },
    { from: 'mc', to: 'crowd', route: 'v', dashed: true },
    { from: 'inputs', to: 'flood', route: 'v' },
  ],
}

/** What happens between "officer drags a slider" and "chart updates". */
export const requestFlow: FlowSpec = {
  height: 330,
  ariaLabel: 'Request lifecycle from a slider change to an updated outcome chart',
  nodes: [
    { id: '1', label: 'Officer moves a slider', detail: 'rainfall · resources · comms', x: 100, y: 90, w: 170 },
    { id: '2', label: 'Dashboard', detail: 'TanStack Query mutation', x: 300, y: 90, w: 170 },
    { id: '3', label: 'POST /flood/monte-carlo', detail: 'point_conditions ±10%', x: 500, y: 90, w: 190 },
    { id: '4', label: 'run_monte_carlo()', detail: 'core/engine', x: 700, y: 90, w: 170 },
    { id: '5', label: 'FloodModel.simulate()', detail: '× 300 futures', x: 900, y: 90, w: 170, tone: 'solid' },
    { id: '6', label: 'Summary', detail: 'p10 · p50 · p90 · worst', x: 900, y: 240, w: 170 },
    { id: '7', label: 'Resilience', detail: 'mean of worst 10%', x: 700, y: 240, w: 170 },
    { id: '8', label: 'JSON response', detail: '≈ seconds, not hours', x: 500, y: 240, w: 170 },
    { id: '9', label: 'Charts + map update', detail: 'Zustand store', x: 300, y: 240, w: 170 },
    { id: '10', label: 'Officer decides', detail: 'human in the loop', x: 100, y: 240, w: 170, tone: 'solid' },
  ],
  edges: [
    { from: '1', to: '2' },
    { from: '2', to: '3' },
    { from: '3', to: '4' },
    { from: '4', to: '5' },
    { from: '5', to: '6' },
    { from: '6', to: '7' },
    { from: '7', to: '8' },
    { from: '8', to: '9' },
    { from: '9', to: '10' },
  ],
}

export const monteCarloFlow: FlowSpec = {
  height: 300,
  ariaLabel: 'Monte Carlo pipeline from uncertain inputs to resilience score',
  nodes: [
    { id: 'in', label: 'Uncertain inputs', detail: 'ranges, not points', x: 110, y: 80, w: 180 },
    { id: 'sample', label: 'Sample N futures', detail: 'seeded RNG', x: 370, y: 80, w: 180 },
    { id: 'sim', label: 'simulate() per future', detail: 'same plan, every future', x: 630, y: 80, w: 190, tone: 'solid' },
    { id: 'metrics', label: 'Metrics per run', detail: 'evacuated % · stranded · time', x: 890, y: 80, w: 190 },
    { id: 'agg', label: 'Distribution', detail: 'mean · p10 · p50 · p90', x: 630, y: 220, w: 190 },
    { id: 'res', label: 'Resilience', detail: 'mean of the worst 10%', x: 370, y: 220, w: 180, tone: 'solid' },
    { id: 'out', label: 'Shown as a range', detail: 'never a single number', x: 110, y: 220, w: 180, tone: 'muted' },
  ],
  edges: [
    { from: 'in', to: 'sample' },
    { from: 'sample', to: 'sim' },
    { from: 'sim', to: 'metrics' },
    { from: 'metrics', to: 'agg', route: 'v' },
    { from: 'agg', to: 'res' },
    { from: 'res', to: 'out' },
  ],
}

export const redTeamFlow: FlowSpec = {
  height: 380,
  ariaLabel: 'Red Team flow: worst-case attribution and knockout tests feeding computed findings',
  nodes: [
    { id: 'plan', label: 'Plan + scenario', x: 100, y: 190, w: 160, tone: 'solid' },
    { id: 'batch', label: 'Monte Carlo batch', detail: 'hundreds of futures', x: 320, y: 90, w: 180 },
    { id: 'worst', label: 'Worst 5 futures', detail: 'lowest evacuated %', x: 540, y: 90, w: 170 },
    { id: 'attr', label: 'Z-score attribution', detail: 'which inputs were extreme?', x: 760, y: 90, w: 190 },
    { id: 'ko', label: 'Knock out one element', detail: 'each bridge · each shelter', x: 320, y: 290, w: 180 },
    { id: 'rerun', label: 'Re-run, same futures', detail: 'nominal conditions', x: 540, y: 290, w: 170 },
    { id: 'rank', label: 'Rank by outcome drop', detail: 'single points of failure', x: 760, y: 290, w: 190 },
    { id: 'find', label: 'Findings', detail: 'computed', x: 930, y: 190, w: 120, tone: 'solid' },
  ],
  edges: [
    { from: 'plan', to: 'batch', route: 'v' },
    { from: 'batch', to: 'worst' },
    { from: 'worst', to: 'attr' },
    { from: 'plan', to: 'ko', route: 'v' },
    { from: 'ko', to: 'rerun' },
    { from: 'rerun', to: 'rank' },
    { from: 'attr', to: 'find', route: 'h' },
    { from: 'rank', to: 'find', route: 'h' },
  ],
}

export const voiFlow: FlowSpec = {
  height: 320,
  ariaLabel: 'Value of information flow: how AEGIS-X decides which missing information is worth gathering first',
  nodes: [
    { id: 'plans', label: 'Candidate plans', detail: 'A, B, C…', x: 110, y: 85, w: 170 },
    { id: 'shared', label: 'Shared futures', detail: 'same samples for every plan', x: 370, y: 85, w: 200 },
    { id: 'eval', label: 'Evaluate every plan', detail: 'on every future', x: 630, y: 85, w: 180 },
    { id: 'base', label: 'Baseline', detail: 'best single plan, no new info', x: 890, y: 85, w: 190 },
    { id: 'bin', label: 'Bin futures by variable X', detail: 'e.g. bridge status', x: 890, y: 235, w: 200 },
    { id: 'adapt', label: 'Best plan per bin', detail: 'as if X were known', x: 630, y: 235, w: 180 },
    { id: 'voi', label: 'VOI = adaptive − baseline', detail: 'per variable', x: 370, y: 235, w: 200, tone: 'solid' },
    { id: 'rank', label: 'Check this first', detail: 'ranked list', x: 110, y: 235, w: 170, tone: 'muted' },
  ],
  edges: [
    { from: 'plans', to: 'shared' },
    { from: 'shared', to: 'eval' },
    { from: 'eval', to: 'base' },
    { from: 'base', to: 'bin', route: 'v' },
    { from: 'bin', to: 'adapt' },
    { from: 'adapt', to: 'voi' },
    { from: 'voi', to: 'rank' },
  ],
}

/** Internals of domains/flood/model.py → FloodModel.simulate(). */
export const floodSimFlow: FlowSpec = {
  height: 320,
  ariaLabel: 'Inside the flood simulation: from rainfall to evacuation metrics',
  nodes: [
    { id: 'rain', label: 'Rainfall (mm)', detail: 'sampled condition', x: 110, y: 85, w: 160 },
    { id: 'level', label: 'Water level', detail: 'rainfall ÷ 50 m', x: 340, y: 85, w: 160 },
    { id: 'flooded', label: 'Flooded cells', detail: 'elevation < level − reinforcement', x: 600, y: 85, w: 230 },
    { id: 'pass', label: 'Passable roads', detail: 'roads ∧ ¬flooded', x: 880, y: 85, w: 170 },
    { id: 'bfs', label: 'BFS from each shelter', detail: 'true shortest paths', x: 880, y: 235, w: 190 },
    { id: 'assign', label: 'Assign clusters', detail: 'nearest reachable · else stranded', x: 620, y: 235, w: 220 },
    { id: 'tick', label: 'Tick loop', detail: 'boats × resources × comms', x: 360, y: 235, w: 190, tone: 'solid' },
    { id: 'out', label: 'Metrics', detail: 'evacuated % · stranded · time', x: 110, y: 235, w: 180, tone: 'muted' },
  ],
  edges: [
    { from: 'rain', to: 'level' },
    { from: 'level', to: 'flooded' },
    { from: 'flooded', to: 'pass' },
    { from: 'pass', to: 'bfs', route: 'v' },
    { from: 'bfs', to: 'assign' },
    { from: 'assign', to: 'tick' },
    { from: 'tick', to: 'out' },
  ],
}
