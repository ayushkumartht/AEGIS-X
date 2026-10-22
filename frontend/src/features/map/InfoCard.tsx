export type CardKind = 'cluster' | 'shelter' | 'staging' | 'bridge'
type Tone = 'risk' | 'safe' | 'warn' | 'muted'

export interface CardData {
  kind: CardKind
  id: string
  title: string
  subtitle?: string
  status?: { label: string; tone: Tone }
  stats: { label: string; value: string }[]
  bars?: { label: string; value: number; max: number; note: string; tone?: Tone }[]
  notes?: string[]
}

const STRIPE: Record<CardKind, string> = { cluster: 'bg-[#f59e0b]', shelter: 'bg-[#16a34a]', staging: 'bg-[#7c3aed]', bridge: 'bg-[#f59e0b]' }
const KIND_LABEL: Record<CardKind, string> = { cluster: 'Settlement', shelter: 'Relief shelter', staging: 'Boat base', bridge: 'Bridge' }
const TONE: Record<Tone, string> = {
  risk: 'bg-risk/15 text-risk border-risk/40',
  safe: 'bg-safe/15 text-safe border-safe/40',
  warn: 'bg-warn/15 text-warn border-warn/40',
  muted: 'bg-muted text-muted-foreground border-border',
}
const BAR: Record<Tone, string> = { risk: 'bg-risk', safe: 'bg-safe', warn: 'bg-warn', muted: 'bg-primary' }

/** Info card for a map object. `compact` is the hover version; the pinned version has everything. */
export function InfoCard({ data, compact = false, onClose }: { data: CardData; compact?: boolean; onClose?: () => void }) {
  return (
    <div className={`overflow-hidden rounded-xl border bg-card/95 text-xs shadow-xl backdrop-blur ${compact ? 'w-60' : 'w-72'}`} role={compact ? undefined : 'dialog'} aria-label={compact ? undefined : `${data.title} details`}>
      <div className={`h-1.5 ${STRIPE[data.kind]}`} />
      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{KIND_LABEL[data.kind]}</div>
            <div className="truncate text-sm font-semibold">{data.title}</div>
            {data.subtitle && <div className="truncate text-muted-foreground">{data.subtitle}</div>}
          </div>
          {onClose && <button className="rounded px-1.5 text-base leading-none text-muted-foreground hover:bg-accent hover:text-foreground" onClick={onClose} aria-label="Close details">×</button>}
        </div>
        {data.status && <span className={`inline-block rounded-full border px-2 py-0.5 font-medium ${TONE[data.status.tone]}`}>{data.status.label}</span>}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {data.stats.slice(0, compact ? 3 : 12).map((s) => (
            <div key={s.label} className="contents">
              <dt className="text-muted-foreground">{s.label}</dt>
              <dd className="text-right font-medium tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
        {!compact && data.bars?.map((b) => (
          <div key={b.label}>
            <div className="flex justify-between"><span className="text-muted-foreground">{b.label}</span><span className="tabular-nums">{b.note}</span></div>
            <div className="mt-0.5 h-1.5 rounded bg-muted"><div className={`h-1.5 rounded ${BAR[b.tone ?? 'muted']}`} style={{ width: `${Math.min(100, Math.max(0, (b.value / Math.max(b.max, 1e-9)) * 100))}%` }} /></div>
          </div>
        ))}
        {!compact && data.notes?.map((n) => <p key={n} className="text-muted-foreground">{n}</p>)}
        {compact && <p className="text-muted-foreground">Click for details</p>}
      </div>
    </div>
  )
}
