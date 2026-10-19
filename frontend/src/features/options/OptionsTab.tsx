import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { Plan } from '@/api/types'
import { Button } from '@/components/ui/button'
import { fmtPct } from '@/lib/formatters'
import { useConsole } from '@/state/consoleStore'

function summary(p: Plan): string {
  const boats = Object.values(p.boats_at ?? {}).reduce((a, b) => a + b, 0)
  return `starts at hour ${p.start_hour?.toFixed(0)}, ${boats} boats, ${(p.protected ?? []).length} areas protected, warning by ${(p.warning_channels ?? []).join(', ') || 'none'}`
}

export function OptionsTab() {
  const { district, whatIf, options, setOptions, setPlan, setTab } = useConsole()
  const run = useMutation({
    mutationFn: () => api.optimize({ district, what_if: whatIf }),
    onSuccess: setOptions,
  })
  const load = (p: Plan) => {
    setPlan(p)
    setTab('plan')
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground">Search for plans that balance people saved, safety on a bad day and boats used. Each is tested on the same futures.</p>
        <Button onClick={() => run.mutate()} disabled={run.isPending}>{run.isPending ? 'Searching' : 'Suggest plans'}</Button>
      </div>
      {run.isError && <p className="text-risk" role="alert">{String(run.error)}</p>}
      {options && (
        <div className="space-y-3">
          <table className="w-full">
            <thead className="text-left text-muted-foreground"><tr><th className="font-normal">Plan</th><th className="font-normal">Average</th><th className="font-normal">Worst 10%</th><th className="font-normal">Boats</th></tr></thead>
            <tbody className="divide-y">
              {[{ label: 'Baseline', ...options.baseline }, ...options.options].map((o) => (
                <tr key={o.label}>
                  <td className="py-1.5">{o.label}</td>
                  <td className="tabular-nums">{fmtPct(o.objectives.mean_evacuated, 0)}</td>
                  <td className="tabular-nums font-medium">{fmtPct(o.objectives.worst10_evacuated, 0)}</td>
                  <td className="tabular-nums">{o.objectives.boats_used}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {options.options.map((o) => (
            <div key={o.label} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <strong>{o.label}</strong>
                <Button size="sm" variant="outline" onClick={() => load(o.plan)}>Load into editor</Button>
              </div>
              <p className="mt-1 text-muted-foreground">{summary(o.plan)}</p>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Tested on {options.n_samples} shared futures, a quick search. Load a plan, edit it, then test it on 500 futures before deciding.</p>
        </div>
      )}
    </div>
  )
}
