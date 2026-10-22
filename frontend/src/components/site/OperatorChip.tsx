import { UserRound } from 'lucide-react'
import { useOperator } from '@/state/operatorStore'

/** "Acting as" name for the decision log, in the header. Editable in place; remembered in this browser. */
export function OperatorChip() {
  const { name, setName } = useOperator()
  return (
    <label className="flex items-center gap-1.5 rounded-full border bg-card py-1 pl-2.5 pr-3 text-xs shadow-xs focus-within:ring-2 focus-within:ring-ring/40" title="This name is written into the decision log. It is not a login.">
      <UserRound className="size-3.5 text-muted-foreground" aria-hidden />
      <span className="text-muted-foreground">Acting as</span>
      <input
        className="w-32 bg-transparent font-medium outline-none placeholder:text-muted-foreground"
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        aria-label="Your name for the decision log"
        placeholder="Your name or role"
      />
    </label>
  )
}
