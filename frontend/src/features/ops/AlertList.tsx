import type { OpsEvent } from '@/api/types'
import { SEVERITY_COLOR, ago } from './levels'

/** Position of a gauge between its warning and danger levels, as a share of that span (clamped). */
function gaugeShare(g: NonNullable<OpsEvent['gauge']>) {
  if (g.warning_m === null || g.danger_m === null || g.danger_m <= g.warning_m) return null
  return Math.min(1, Math.max(0, (g.level_m - g.warning_m) / (g.danger_m - g.warning_m)))
}

export function AlertList({ events, onlyActive }: { events: OpsEvent[]; onlyActive: boolean }) {
  const rows = events.filter((e) => !onlyActive || e.active)
  if (!rows.length) return <p className="rounded-xl border bg-card px-3 py-3 text-sm text-muted-foreground">No {onlyActive ? 'active ' : ''}alerts in this hazard right now.</p>
  return (
    <ul className="divide-y rounded-xl border bg-card text-sm">
      {rows.slice(0, 30).map((e) => {
        const share = e.gauge ? gaugeShare(e.gauge) : null
        return (
          <li key={e.uid} className="px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded px-1.5 py-0.5 text-xs font-semibold text-white" style={{ background: SEVERITY_COLOR[e.severity] ?? SEVERITY_COLOR.Unknown }}>{e.severity}</span>
              <span className="font-medium">{e.event}</span>
              <span className="text-xs text-muted-foreground">{e.sender} · {ago(e.sent)}</span>
              {!e.active && <span className="text-xs text-muted-foreground">(expired)</span>}
            </div>
            <div className="text-xs text-muted-foreground">{e.area}{e.state && !e.area.includes(e.state) ? `, ${e.state}` : ''}</div>
            {e.gauge && (
              <div className="mt-1 text-xs">
                Gauge <strong>{e.gauge.level_m} m</strong>
                {e.gauge.warning_m !== null && <> · warning {e.gauge.warning_m} m</>}
                {e.gauge.danger_m !== null && <> · danger {e.gauge.danger_m} m</>}
                {e.gauge.trend && <> · {e.gauge.trend}</>}
                {share !== null && (
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-muted" role="img" aria-label={`${Math.round(share * 100)}% of the way from warning to danger level`}>
                    <div className="h-full" style={{ width: `${share * 100}%`, background: share >= 1 ? '#dc2626' : '#f97316' }} />
                  </div>
                )}
              </div>
            )}
            {!e.gauge && e.headline && <div className="mt-0.5 line-clamp-2 text-xs">{e.headline}</div>}
          </li>
        )
      })}
    </ul>
  )
}
