import { useCallback, useState } from 'react'
import { api, simulateStream } from '@/api/client'
import { useConsole } from '@/state/consoleStore'

/** Runs a simulation of the plan in the editor, streaming progress, and stores the result. */
export function useRunSim() {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async () => {
    const { district, plan, whatIf, setSim, setCompare, setNarration, setTab } = useConsole.getState()
    if (!plan) return
    setRunning(true)
    setProgress(0)
    setError(null)
    const args = { district, plan, what_if: whatIf, n_samples: 500, seed: 42 }
    try {
      let result
      try {
        result = await simulateStream(args, setProgress)
      } catch {
        result = await api.simulate(args)
      }
      setSim(result)
      setCompare(null)
      setNarration(null)
      setTab('results')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }, [])

  return { run, running, progress, error }
}
