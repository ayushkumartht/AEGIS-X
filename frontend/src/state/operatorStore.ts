import { create } from 'zustand'

const KEY = 'aegis.operator'
const DEFAULT = 'Duty officer'

/** The name written into the decision log. It is typed in, not verified: there are no accounts. */
function load(): string {
  try {
    return localStorage.getItem(KEY) || DEFAULT
  } catch {
    return DEFAULT
  }
}

interface OperatorState {
  name: string
  setName: (n: string) => void
}

export const useOperator = create<OperatorState>((set) => ({
  name: load(),
  setName: (name) => {
    try {
      localStorage.setItem(KEY, name)
    } catch {
      /* the name then lasts until the tab closes */
    }
    set({ name })
  },
}))

/** The name to send with a request: trimmed, never empty. */
export const operatorName = () => useOperator.getState().name.trim() || DEFAULT
