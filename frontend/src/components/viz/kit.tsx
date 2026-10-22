import type { LucideIcon } from 'lucide-react'
import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Shared building blocks for the console and the Command Center: cards, KPI tiles, gauges and range bars. */

export type Tone = 'neutral' | 'primary' | 'safe' | 'warn' | 'risk' | 'flood'

export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-foreground',
  primary: 'text-primary',
  safe: 'text-safe',
  warn: 'text-warn',
  risk: 'text-risk',
  flood: 'text-flood',
}
export const TONE_BG: Record<Tone, string> = {
  neutral: 'bg-muted-foreground',
  primary: 'bg-primary',
  safe: 'bg-safe',
  warn: 'bg-warn',
  risk: 'bg-risk',
  flood: 'bg-flood',
}
const TONE_SOFT: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  safe: 'bg-safe/15 text-safe',
  warn: 'bg-warn/25 text-foreground',
  risk: 'bg-risk/10 text-risk',
  flood: 'bg-flood/15 text-flood',
}
const TONE_VAR: Record<Tone, string> = {
  neutral: 'var(--muted-foreground)',
  primary: 'var(--primary)',
  safe: 'var(--safe)',
  warn: 'var(--warn)',
  risk: 'var(--risk)',
  flood: 'var(--flood)',
}

/** A rounded icon chip in a tone. */
export function IconChip({ icon: Icon, tone = 'primary', className }: { icon: LucideIcon; tone?: Tone; className?: string }) {
  return (
    <span className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-lg', TONE_SOFT[tone], className)} aria-hidden>
      <Icon className="size-4" />
    </span>
  )
}

export function Pill({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', TONE_SOFT[tone], className)}>{children}</span>
}

/** A titled card. The header carries an icon, an optional one-line explanation and an action. */
export function Panel({ icon, title, hint, action, tone = 'primary', children, className }: {
  icon?: LucideIcon
  title: string
  hint?: string
  action?: ReactNode
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-xl border bg-card shadow-xs', className)}>
      <header className="flex items-start gap-3 px-4 pt-3.5">
        {icon && <IconChip icon={icon} tone={tone} />}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-tight">{title}</h3>
          {hint && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </header>
      <div className="px-4 pb-4 pt-3">{children}</div>
    </section>
  )
}

/** A KPI tile: big number, label, and a one-line meaning. */
export function Stat({ icon: Icon, label, value, hint, tone = 'neutral', className }: {
  icon?: LucideIcon
  label: string
  value: ReactNode
  hint?: string
  tone?: Tone
  className?: string
}) {
  return (
    <div className={cn('rounded-xl border bg-card p-3 shadow-xs', className)}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="size-3.5" aria-hidden />}
        {label}
      </div>
      <div className={cn('mt-1 text-2xl font-semibold leading-none tabular-nums', TONE_TEXT[tone])}>{value}</div>
      {hint && <div className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{hint}</div>}
    </div>
  )
}

/** A circular gauge for a 0..1 value, with the number in the middle. */
export function Ring({ value, label, tone = 'primary', size = 84, display }: {
  value: number
  label?: string
  tone?: Tone
  size?: number
  display?: string
}) {
  const v = Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 1)
  const r = (size - 12) / 2
  const c = 2 * Math.PI * r
  return (
    <figure className="m-0 flex flex-col items-center gap-1" aria-label={`${label ?? 'value'}: ${display ?? Math.round(v * 100) + '%'}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={8} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TONE_VAR[tone]} strokeWidth={8} strokeLinecap="round"
            strokeDasharray={`${c * v} ${c}`} style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold tabular-nums">{display ?? `${Math.round(v * 100)}%`}</span>
      </div>
      {label && <figcaption className="text-center text-[11px] leading-tight text-muted-foreground">{label}</figcaption>}
    </figure>
  )
}

/** A thin progress bar with an optional label row. */
export function Meter({ value, max = 1, tone = 'primary', label, right, className }: {
  value: number
  max?: number
  tone?: Tone
  label?: ReactNode
  right?: ReactNode
  className?: string
}) {
  const pct = max > 0 ? Math.min(Math.max(value / max, 0), 1) * 100 : 0
  return (
    <div className={className}>
      {(label || right) && (
        <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
          <span>{label}</span>
          <span className="tabular-nums text-muted-foreground">{right}</span>
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn('h-full rounded-full transition-all duration-500', TONE_BG[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/**
 * A range on a fixed scale: the track is the whole scale, the band is the forecast range, the tick
 * is the most likely value. Reads at a glance where an uncertain input sits.
 */
export function RangeBar({ low, high, at, min, max, unit = '', tone = 'flood', format }: {
  low: number
  high: number
  at?: number
  min: number
  max: number
  unit?: string
  tone?: Tone
  format?: (n: number) => string
}) {
  const span = max - min || 1
  const pos = (x: number) => Math.min(Math.max(((x - min) / span) * 100, 0), 100)
  const f = format ?? ((n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(2)))
  return (
    <div>
      <div className="relative h-2.5 rounded-full bg-muted" role="img" aria-label={`from ${f(low)}${unit} to ${f(high)}${unit}`}>
        <div className={cn('absolute top-0 h-full rounded-full opacity-90', TONE_BG[tone])} style={{ left: `${pos(low)}%`, width: `${Math.max(pos(high) - pos(low), 1.5)}%` }} />
        {at !== undefined && <div className="absolute -top-0.5 h-3.5 w-0.5 rounded bg-foreground" style={{ left: `${pos(at)}%` }} />}
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>{f(min)}{unit}</span>
        <span className="font-medium text-foreground">{f(low)} to {f(high)}{unit}</span>
        <span>{f(max)}{unit}</span>
      </div>
    </div>
  )
}

/** Two-sided probability: how likely a thing is (open, working), as a bar with the share written in it. */
export function ProbBar({ p, positive = 'open', negative = 'closed' }: { p: number; positive?: string; negative?: string }) {
  const share = Math.min(Math.max(p, 0), 1)
  const tone: Tone = share >= 0.75 ? 'safe' : share >= 0.4 ? 'warn' : 'risk'
  return (
    <div className="relative h-5 overflow-hidden rounded-md bg-risk/15 text-[11px] font-medium" role="img" aria-label={`${Math.round(share * 100)}% ${positive}`}>
      <div className={cn('absolute inset-y-0 left-0', TONE_BG[tone])} style={{ width: `${share * 100}%` }} />
      <span className="absolute inset-y-0 left-2 flex items-center text-white">{Math.round(share * 100)}% {positive}</span>
      {share < 0.8 && <span className="absolute inset-y-0 right-2 flex items-center text-risk">{negative}</span>}
    </div>
  )
}

/** A friendly empty state with an icon, a sentence and an optional action. */
export function Empty({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-8 text-center">
      <IconChip icon={Icon} className="size-11 rounded-full" />
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      {body && <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** A button that shows a spinner while its work runs. */
export function ActionButton({ icon: Icon, busy, busyText, children, ...props }: React.ComponentProps<typeof Button> & { icon?: LucideIcon; busy?: boolean; busyText?: string }) {
  return (
    <Button {...props} disabled={props.disabled || busy}>
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : Icon ? <Icon aria-hidden /> : null}
      {busy && busyText ? busyText : children}
    </Button>
  )
}

/** A toggle chip: a choice that is on or off, with an icon. Used instead of bare checkboxes. */
export function Chip({ on, onClick, icon: Icon, children, title }: { on: boolean; onClick: () => void; icon?: LucideIcon; children: ReactNode; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        on ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground',
      )}
    >
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
    </button>
  )
}

/** A +/- number input for small whole numbers (boats at a base). */
export function Stepper({ value, onChange, min = 0, max = 99, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string }) {
  const set = (n: number) => onChange(Math.min(Math.max(n, min), max))
  return (
    <div className="inline-flex items-center overflow-hidden rounded-lg border bg-background" role="group" aria-label={label}>
      <button type="button" className="px-2 py-1 text-muted-foreground hover:bg-accent disabled:opacity-40" onClick={() => set(value - 1)} disabled={value <= min} aria-label={`less ${label}`}>−</button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button type="button" className="px-2 py-1 text-muted-foreground hover:bg-accent disabled:opacity-40" onClick={() => set(value + 1)} disabled={value >= max} aria-label={`more ${label}`}>+</button>
    </div>
  )
}
