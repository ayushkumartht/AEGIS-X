import { useMutation } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useScenarioStore } from '../../state/scenarioStore'
import type { CompareResponse } from '../../api/types'

export function PlanCompareTable() {
  const plan = useScenarioStore((s) => s.plan)

  // Measured finding (see docs/flood-evacuation-steps.md Phase 8): adding
  // boats does NOT move the outcome in this scenario - boat capacity is
  // never the bottleneck, reachability is. What DOES measurably help is
  // reinforcing the population clusters' own low-lying access cells so
  // they don't flood out before evacuation can even start. That's the
  // comparison this button actually runs.
  const compareMutation = useMutation({
    mutationFn: async () => {
      const scenario = await api.getDemoScenario()
      const reinforcedCells: [number, number][] = scenario.population_clusters.map(
        (pc) => pc.pos,
      )
      return api.comparePlans(
        { boats_per_shelter: plan.boats_per_shelter },
        { boats_per_shelter: plan.boats_per_shelter, reinforced_cells: reinforcedCells },
        300,
        1,
      )
    },
  })

  const rows: [string, CompareResponse[string]][] = compareMutation.data
    ? Object.entries(compareMutation.data)
    : []

  return (
    <div className="bg-slate-900 rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Plan Compare</h2>
        <button
          onClick={() => compareMutation.mutate()}
          disabled={compareMutation.isPending}
          className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded px-2 py-1 text-xs"
        >
          {compareMutation.isPending ? 'Comparing…' : 'Compare vs reinforced localities'}
        </button>
      </div>

      {rows.length > 0 && (
        <table className="text-xs text-slate-300 w-full">
          <thead>
            <tr className="text-slate-500 text-left">
              <th className="py-1">Plan</th>
              <th>Mean</th>
              <th>Worst 10%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, s]) => (
              <tr key={name} className="border-t border-slate-800">
                <td className="py-1">{name}</td>
                <td>{(s.mean * 100).toFixed(1)}%</td>
                <td>{(s.resilience * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
