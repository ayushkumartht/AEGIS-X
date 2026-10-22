import { Link } from 'react-router-dom'
import type { WatchedDistrict } from '@/api/types'
import { LEVEL_COLOR, LEVEL_LABEL } from './levels'

interface Props {
  districts: WatchedDistrict[]
  selectedId: string | null
  onSelect: (id: string) => void
}

const pct = (x: number | undefined) => `${Math.round((x ?? 0) * 100)}%`

/** Watched districts, worst first: level, why, the forecast share behind it, and a way into the console. */
export function DistrictRisk({ districts, selectedId, onSelect }: Props) {
  return (
    <ul className="divide-y rounded-xl border bg-card text-sm">
      {districts.map((d) => {
        const ind = d.indicator
        return (
          <li key={d.id} className={selectedId === d.id ? 'bg-accent' : undefined}>
            <button className="flex w-full items-start gap-3 px-3 py-2 text-left" onClick={() => onSelect(d.id)} aria-pressed={selectedId === d.id}>
              <span className="mt-1 inline-block size-3 shrink-0 rounded-full" style={{ background: LEVEL_COLOR[d.level] }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{d.name}</span>
                  <span className="text-xs text-muted-foreground">{d.state} · {d.river}</span>
                </span>
                <span className="block text-xs text-muted-foreground">
                  <strong className="text-foreground">{LEVEL_LABEL[d.level]}.</strong>{' '}
                  {ind?.reason ? ind.reason : 'No river forecast indicator yet.'}
                  {ind?.exceed && d.level === 'normal' && ind.exceed['2'] > 0 ? ` (${pct(ind.exceed['2'])} pass the 2-year flood; a watch level needs 30%)` : ''}
                </span>
                {d.alerts.length > 0 && (
                  <span className="mt-0.5 block text-xs">
                    {d.alerts.length} active alert{d.alerts.length > 1 ? 's' : ''}:{' '}
                    {d.alerts.map((a) => a.gauge ? `${a.event}, gauge ${a.gauge.level_m} m (danger ${a.gauge.danger_m} m)` : a.event).join('; ')}
                  </span>
                )}
              </span>
            </button>
            {d.console && (
              <div className="px-3 pb-2 pl-9 text-xs">
                <Link className="font-medium text-primary underline" to={`/console/${d.console}`}>Open the evacuation console</Link>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
