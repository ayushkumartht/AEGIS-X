import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { fmtPct } from '@/lib/formatters'
import { useConsole } from '@/state/consoleStore'

type Action = 'accept' | 'edit' | 'reject'

export function DecisionBar() {
  const { district, plan, sim, narration } = useConsole()
  const [note, setNote] = useState('')
  const [author, setAuthor] = useState('duty officer')
  const [done, setDone] = useState<string | null>(null)
  const qc = useQueryClient()

  const save = useMutation({
    mutationFn: (action: Action) =>
      api.addDecision({ district, action, plan: plan ?? {}, run_id: sim?.run_id ?? null, explanation: narration?.text ?? '', note, author }),
    onSuccess: (r, action) => {
      setDone(`Decision #${r.id} recorded: ${action}.`)
      setNote('')
      qc.invalidateQueries({ queryKey: ['decisions'] })
    },
  })
  const disabled = !sim || save.isPending
  const decide = (a: Action) => {
    setDone(null)
    save.mutate(a)
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-t bg-card px-4 py-3 text-sm">
      <div className="min-w-48 flex-1">
        {sim ? (
          <span>
            Current plan: <strong>{fmtPct(sim.summary.mean, 0)}</strong> on average, <strong>{fmtPct(sim.resilience_worst_10pct, 0)}</strong> on a bad day.
          </span>
        ) : (
          <span className="text-muted-foreground">Test a plan to decide on it. Nothing is applied without your decision.</span>
        )}
        {done && <div className="text-safe" role="status">{done}</div>}
        {save.isError && <div className="text-risk" role="alert">{String(save.error)}</div>}
      </div>
      <input className="w-36 rounded-lg border bg-background px-2 py-1.5" aria-label="Your name or role" value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={80} />
      <input className="w-56 rounded-lg border bg-background px-2 py-1.5" aria-label="Note for the log" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <Button onClick={() => decide('accept')} disabled={disabled}>Accept</Button>
        <Button variant="outline" onClick={() => decide('edit')} disabled={disabled}>Edit and accept</Button>
        <Button variant="outline" onClick={() => decide('reject')} disabled={disabled}>Reject</Button>
      </div>
    </div>
  )
}
