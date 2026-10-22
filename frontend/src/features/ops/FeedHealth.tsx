import type { FeedStatus } from '@/api/types'
import { ago } from './levels'

/** One chip per data feed: when it last worked, or why it is unavailable. */
export function FeedHealth({ feeds, offline }: { feeds: FeedStatus[]; offline: boolean }) {
  if (!feeds.length) {
    return <p className="text-xs text-muted-foreground">{offline ? 'Offline mode: live feeds are off.' : 'Waiting for the first refresh of the live feeds.'}</p>
  }
  return (
    <ul className="flex flex-wrap gap-2 text-xs" aria-label="Data feed status">
      {feeds.map((f) => {
        const down = Boolean(f.last_error) && !(f.last_success && f.last_attempt === f.last_success)
        return (
          <li key={f.name} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1" title={f.last_error ?? undefined}>
            <span className={`inline-block size-2 rounded-full ${down ? 'bg-risk' : 'bg-safe'}`} aria-hidden />
            <span className="font-medium">{f.name}</span>
            <span className="text-muted-foreground">
              {down ? `unavailable (last worked ${ago(f.last_success)})` : `${f.items} items, ${ago(f.last_success)}`}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
