import { useMutation } from '@tanstack/react-query'
import { api } from '../api/client'
import { useScenarioStore } from '../state/scenarioStore'
import { TornadoChart } from './TornadoChart'

export function RedTeamPanel() {
  const plan = useScenarioStore((s) => s.plan)
  const redTeamResult = useScenarioStore((s) => s.redTeamResult)
  const setRedTeamResult = useScenarioStore((s) => s.setRedTeamResult)
  const narration = useScenarioStore((s) => s.narration)
  const setNarration = useScenarioStore((s) => s.setNarration)
  const highlightedElement = useScenarioStore((s) => s.highlightedElement)
  const setHighlightedElement = useScenarioStore((s) => s.setHighlightedElement)

  const redTeamMutation = useMutation({
    mutationFn: () => api.runRedTeam({ n_samples: 200, seed: 42, plan }),
    onSuccess: (data) => {
      setRedTeamResult(data)
      setNarration(null)
    },
  })

  const explainMutation = useMutation({
    mutationFn: () => api.explainRedTeam({ n_samples: 200, seed: 42, plan }),
    onSuccess: (data) => setNarration(data.narration),
  })

  return (
    <div className="bg-slate-900 rounded-lg p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Red Team</h2>
        <button
          onClick={() => redTeamMutation.mutate()}
          disabled={redTeamMutation.isPending}
          className="bg-red-700 hover:bg-red-600 disabled:opacity-50 rounded px-3 py-1.5 text-xs font-semibold"
        >
          {redTeamMutation.isPending ? 'Attacking…' : '🔴 RED TEAM'}
        </button>
      </div>

      {redTeamResult && (
        <>
          <div>
            <h3 className="text-xs font-medium text-slate-400 mb-1">Single points of failure</h3>
            <ul className="text-xs text-slate-300 flex flex-col gap-1">
              {redTeamResult.single_points_of_failure.map((spof) => (
                <li
                  key={spof.element_id}
                  onClick={() => setHighlightedElement(spof.element_id)}
                  className={`cursor-pointer rounded px-2 py-1 ${
                    highlightedElement === spof.element_id ? 'bg-red-900/50' : 'hover:bg-slate-800'
                  }`}
                >
                  <span className="font-mono">{spof.element_id}</span> — removing it changes the
                  outcome by {spof.drop_pct.toFixed(1)}%
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-medium text-slate-400 mb-1">Sensitivity (what matters most)</h3>
            <TornadoChart data={redTeamResult.sensitivity} />
          </div>

          <div>
            <button
              onClick={() => explainMutation.mutate()}
              disabled={explainMutation.isPending}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded px-2 py-1 text-xs"
            >
              {explainMutation.isPending ? 'Asking Groq…' : 'Explain in plain language'}
            </button>
            {explainMutation.isError && (
              <p className="text-xs text-amber-400 mt-1">
                {(explainMutation.error as Error).message}
              </p>
            )}
            {narration && (
              <p className="text-xs text-slate-300 mt-2 italic border-l-2 border-purple-500 pl-2">
                {narration}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
