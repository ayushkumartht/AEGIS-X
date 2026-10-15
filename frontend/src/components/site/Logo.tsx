import { cn } from '@/lib/utils'

/** AEGIS-X mark: a shield outline split by an X — "protect the decision, cross out the failure". */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-6', className)} aria-hidden>
      <path d="M16 2.5 28 7v8.5c0 7-5.1 12.2-12 14-6.9-1.8-12-7-12-14V7z" className="fill-foreground" />
      <path d="m11 11 10 10M21 11 11 21" className="stroke-background" strokeWidth={2.4} strokeLinecap="round" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <LogoMark />
      AEGIS-X
    </span>
  )
}
