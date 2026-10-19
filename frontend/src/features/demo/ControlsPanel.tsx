import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useScenarioStore } from '../../state/scenarioStore'

export function ControlsPanel() {
  const conditions = useScenarioStore((s) => s.conditions)
  const setConditions = useScenarioStore((s) => s.setConditions)
  const plan = useScenarioStore((s) => s.plan)
  const setPlan = useScenarioStore((s) => s.setPlan)
  const setMonteCarloResult = useScenarioStore((s) => s.setMonteCarloResult)

  const { data: scenario } = useQuery({
    queryKey: ['demo-scenario'],
    queryFn: api.getDemoScenario,
    staleTime: Infinity,
  })

  // Measured finding: reinforcing the population clusters' own low-lying
  // access cells is the fix that actually moves resilience in this
  // scenario (see docs/flood-evacuation-steps.md Phase 8) - unlike adding
  // boats, which does nothing because capacity was never the bottleneck.
  const reinforcedOn = (plan.reinforced_cells?.length ?? 0) > 0
  const toggleReinforced = () => {
    if (!scenario) return
    setPlan({
      reinforced_cells: reinforcedOn ? [] : scenario.population_clusters.map((pc) => pc.pos),
    })
  }

  const runMutation = useMutation({
    mutationFn: () =>
      api.runMonteCarlo({
        n_samples: 300,
        seed: 42,
        plan,
        point_conditions: conditions,
      }),
    onSuccess: (data) => setMonteCarloResult(data),
  })

  const boats = plan.boats_per_shelter ?? [4, 4, 4]

  return (
    <div className="bg-slate-900 rounded-lg p-3 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-slate-200">Live Controls</h2>

      <label className="flex flex-col gap-1 text-xs text-slate-300">
        Rainfall: {conditions.rainfall_mm.toFixed(0)} mm
        <input
          type="range"
          min={20}
          max={250}
          value={conditions.rainfall_mm}
          onChange={(e) => setConditions({ rainfall_mm: Number(e.target.value) })}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-300">
        Resource availability: {(conditions.resource_availability_pct * 100).toFixed(0)}%
        <input
          type="range"
          min={0.3}
          max={1}
          step={0.05}
          value={conditions.resource_availability_pct}
          onChange={(e) =>
            setConditions({ resource_availability_pct: Number(e.target.value) })
          }
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-300">
        Comms degradation: {(conditions.comms_degradation_pct * 100).toFixed(0)}%
        <input
          type="range"
          min={0}
          max={0.8}
          step={0.05}
          value={conditions.comms_degradation_pct}
          onChange={(e) => setConditions({ comms_degradation_pct: Number(e.target.value) })}
        />
      </label>

      <div className="flex flex-col gap-1 text-xs text-slate-300">
        Boats per shelter
        <div className="flex gap-2">
          {boats.map((b, i) => (
            <input
              key={i}
              type="number"
              min={0}
              max={20}
              value={b}
              onChange={(e) => {
                const next = [...boats]
                next[i] = Number(e.target.value)
                setPlan({ boats_per_shelter: next })
              }}
              className="w-14 bg-slate-800 rounded px-1 py-0.5 text-slate-100"
            />
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input type="checkbox" checked={reinforcedOn} onChange={toggleReinforced} />
        Reinforce local access roads (the fix that actually works here)
      </label>

      <button
        onClick={() => runMutation.mutate()}
        disabled={runMutation.isPending}
        className="mt-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded px-3 py-2 text-sm font-medium"
      >
        {runMutation.isPending ? 'Running…' : 'Run Simulation'}
      </button>
      {runMutation.isError && (
        <p className="text-xs text-red-400">{(runMutation.error as Error).message}</p>
      )}
    </div>
  )
}
