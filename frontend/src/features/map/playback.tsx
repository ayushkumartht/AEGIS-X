import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { Trace } from '@/api/types'
import { Button } from '@/components/ui/button'
import { useConsole } from '@/state/consoleStore'

/** Simulated hours shown per second of playback. */
export const HOURS_PER_SECOND = 1.6

/** Linear interpolation of an hourly series at fractional hour `t`. */
export function interp(series: number[], t: number) {
  const i = Math.min(Math.max(Math.floor(t), 0), series.length - 1)
  const j = Math.min(i + 1, series.length - 1)
  return series[i] + (series[j] - series[i]) * (t - i)
}

/**
 * Hour-by-hour playback of one representative future of the current plan.
 * `t` is the fractional hour the 3D view animates with; `hour` is its whole-hour copy for the UI.
 */
export function useTracePlayback() {
  const { district, plan, whatIf } = useConsole()
  const [trace, setTrace] = useState<Trace | null>(null)
  const [playing, setPlaying] = useState(false)
  const [hour, setHour] = useState(0)
  const t = useRef(0)

  const play = useMutation({
    mutationFn: (pick: 'median' | 'bad_day') => api.trace({ district, plan: plan ?? undefined, what_if: whatIf, pick, n_samples: 150, seed: 42 }),
    onSuccess: (tr) => {
      t.current = 0
      setHour(0)
      setTrace(tr)
      setPlaying(true)
    },
  })

  const scrub = (h: number) => {
    t.current = h
    setHour(h)
  }
  const stop = () => {
    setPlaying(false)
    setTrace(null)
  }
  const toggle = () => {
    if (!trace) return
    if (hour >= trace.level.length - 1) {
      scrub(0)
      setPlaying(true)
    } else setPlaying((p) => !p)
  }

  return { trace, playing, setPlaying, hour, setHour, t, play, scrub, stop, toggle, canPlay: Boolean(plan) }
}

/**
 * Advance a playback clock held in refs by `dt` seconds, for render loops that must not
 * depend on React state. Calls `onHour` when the whole hour changes.
 */
export function stepClock(clock: { current: number }, trace: Trace, playing: boolean, dt: number, onHour: (h: number) => void) {
  const last = trace.level.length - 1
  if (playing) {
    const before = Math.floor(clock.current)
    clock.current = Math.min(clock.current + dt * HOURS_PER_SECOND, last)
    if (Math.floor(clock.current) !== before) onHour(Math.floor(clock.current))
  }
  return clock.current
}

export type Playback = ReturnType<typeof useTracePlayback>

/** The playback controls and the live numbers for the current hour. `hands` are the areas' flood thresholds. */
export function PlaybackPanel({ pb, hands, className = '' }: { pb: Playback; hands: number[]; className?: string }) {
  const { trace, playing, play } = pb
  const h = Math.min(pb.hour, (trace?.level.length ?? 1) - 1)
  const lvlNow = trace ? trace.level[h] : 0
  const floodedAreas = hands.filter((x) => x < lvlNow).length
  const inDanger = trace ? trace.remaining[h].reduce((s, v, k) => s + (hands[k] < lvlNow ? v : 0), 0) : 0
  const moved = trace ? trace.remaining[0].reduce((s, v) => s + v, 0) - trace.remaining[h].reduce((s, v) => s + v, 0) : 0

  return (
    <div className={`flex flex-col gap-2 rounded-xl border bg-card/90 p-2.5 text-xs shadow-lg backdrop-blur ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {!trace ? (
          <>
            <Button size="sm" onClick={() => play.mutate('median')} disabled={play.isPending || !pb.canPlay}>Play a typical future</Button>
            <Button size="sm" variant="outline" onClick={() => play.mutate('bad_day')} disabled={play.isPending || !pb.canPlay}>Play a bad day</Button>
            <span className="text-muted-foreground">{play.isPending ? 'Simulating 150 futures to pick one' : 'Watch the current plan unfold hour by hour.'}</span>
          </>
        ) : (
          <>
            <Button size="sm" onClick={pb.toggle}>{playing ? 'Pause' : h >= trace.level.length - 1 ? 'Replay' : 'Play'}</Button>
            <Button size="sm" variant="ghost" onClick={pb.stop}>Back to manual level</Button>
            <span className="font-medium">{trace.pick === 'bad_day' ? 'Bad day (10th percentile)' : 'Typical future (median)'}</span>
            <span className="ml-auto tabular-nums text-muted-foreground">evacuated in time: {Math.round((trace.metrics.evacuated_pct ?? 0) * 100)}%</span>
          </>
        )}
      </div>
      {trace && (
        <>
          <input
            type="range"
            className="w-full accent-primary"
            aria-label="Hour of the simulated future"
            min={0}
            max={trace.level.length - 1}
            step={1}
            value={h}
            onChange={(e) => {
              pb.setPlaying(false)
              pb.scrub(Number(e.target.value))
            }}
          />
          <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
            <span className="font-semibold">Hour {h}</span>
            <span>Water {lvlNow.toFixed(1)} m above normal</span>
            <span>{floodedAreas} of {hands.length} areas flooded</span>
            <span>{Math.round(moved).toLocaleString()} people moved</span>
            <span>{Math.round(inDanger).toLocaleString()} people still in flooded areas</span>
            <span className="text-muted-foreground">
              {h < trace.start_h ? `order reaches people at hour ${trace.start_h.toFixed(0)}` : h < trace.boats_on_h ? `boats arrive at hour ${trace.boats_on_h.toFixed(0)}` : 'boats operating'}
            </span>
          </div>
        </>
      )}
      {play.isError && <p className="text-risk">{String(play.error)}</p>}
    </div>
  )
}
