import { create } from 'zustand'
import type { ConditionOverride, MonteCarloResponse, PlanOverride, RedTeamResponse } from '../api/types'

interface ScenarioState {
  // Live-demo sliders (point conditions)
  conditions: Required<ConditionOverride>
  setConditions: (patch: Partial<ConditionOverride>) => void

  // Plan being tested
  plan: PlanOverride
  setPlan: (patch: Partial<PlanOverride>) => void

  // Latest results from the backend
  monteCarloResult: MonteCarloResponse | null
  setMonteCarloResult: (r: MonteCarloResponse | null) => void

  redTeamResult: RedTeamResponse | null
  setRedTeamResult: (r: RedTeamResponse | null) => void

  narration: string | null
  setNarration: (n: string | null) => void

  // Cross-panel highlight: e.g. "bridge_main" or "shelter_0", set when a
  // Red Team finding is clicked, read by the map panel to draw attention.
  highlightedElement: string | null
  setHighlightedElement: (id: string | null) => void
}

export const useScenarioStore = create<ScenarioState>((set) => ({
  conditions: {
    rainfall_mm: 100,
    resource_availability_pct: 0.8,
    comms_degradation_pct: 0.1,
  },
  setConditions: (patch) =>
    set((state) => ({ conditions: { ...state.conditions, ...patch } })),

  plan: {
    boats_per_shelter: [4, 4, 4],
    evacuation_priority: [0, 1, 2, 3, 4, 5],
    reinforced_cells: [],
  },
  setPlan: (patch) => set((state) => ({ plan: { ...state.plan, ...patch } })),

  monteCarloResult: null,
  setMonteCarloResult: (r) => set({ monteCarloResult: r }),

  redTeamResult: null,
  setRedTeamResult: (r) => set({ redTeamResult: r }),

  narration: null,
  setNarration: (n) => set({ narration: n }),

  highlightedElement: null,
  setHighlightedElement: (id) => set({ highlightedElement: id }),
}))
