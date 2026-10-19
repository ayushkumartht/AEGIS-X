import { create } from 'zustand'
import type {
  CompareResult,
  Explanation,
  OptionsResult,
  Plan,
  RedTeamResult,
  SimResult,
  VoiResult,
  WhatIf,
} from '@/api/types'

export type TabId = 'situation' | 'plan' | 'results' | 'redteam' | 'check' | 'options'
export type HighlightKind = 'bridge' | 'shelter' | 'cluster' | 'staging'
export interface Highlight {
  kind: HighlightKind
  id: string
}

interface ConsoleState {
  district: string
  tab: TabId
  plan: Plan | null
  whatIf: WhatIf
  level: number
  highlight: Highlight | null
  sim: SimResult | null
  compare: CompareResult | null
  redteam: RedTeamResult | null
  voi: VoiResult | null
  options: OptionsResult | null
  narration: Explanation | null
  setDistrict: (d: string) => void
  setTab: (t: TabId) => void
  setPlan: (p: Plan | null) => void
  patchPlan: (p: Plan) => void
  setWhatIf: (w: WhatIf) => void
  setLevel: (l: number) => void
  setHighlight: (h: Highlight | null) => void
  setSim: (s: SimResult | null) => void
  setCompare: (c: CompareResult | null) => void
  setRedteam: (r: RedTeamResult | null) => void
  setVoi: (v: VoiResult | null) => void
  setOptions: (o: OptionsResult | null) => void
  setNarration: (n: Explanation | null) => void
}

const cleared = {
  plan: null,
  whatIf: {},
  level: 0,
  highlight: null,
  sim: null,
  compare: null,
  redteam: null,
  voi: null,
  options: null,
  narration: null,
}

export const useConsole = create<ConsoleState>((set) => ({
  district: 'demo',
  tab: 'situation',
  ...cleared,
  setDistrict: (district) => set({ district, ...cleared, tab: 'situation' }),
  setTab: (tab) => set({ tab }),
  setPlan: (plan) => set({ plan }),
  patchPlan: (p) => set((s) => ({ plan: { ...(s.plan ?? {}), ...p } })),
  setWhatIf: (whatIf) => set({ whatIf }),
  setLevel: (level) => set({ level }),
  setHighlight: (highlight) => set({ highlight }),
  setSim: (sim) => set({ sim }),
  setCompare: (compare) => set({ compare }),
  setRedteam: (redteam) => set({ redteam }),
  setVoi: (voi) => set({ voi }),
  setOptions: (options) => set({ options }),
  setNarration: (narration) => set({ narration }),
}))
