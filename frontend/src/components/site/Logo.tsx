import { cn } from '@/lib/utils'

/** AEGIS-X mark: a shield split by an X — "protect the decision, cross out the failure". */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-6', className)} aria-hidden>
      <defs>
        <linearGradient id="aegis-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.62 0.19 255)" />
          <stop offset="100%" stopColor="oklch(0.45 0.2 266)" />
        </linearGradient>
      </defs>
      <path d="M16 2.5 28 7v8.5c0 7-5.1 12.2-12 14-6.9-1.8-12-7-12-14V7z" fill="url(#aegis-mark)" />
      <path d="m11 11 10 10M21 11 11 21" stroke="white" strokeWidth={2.4} strokeLinecap="round" />
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
