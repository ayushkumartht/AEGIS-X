import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { seededRandom } from '@/lib/random'
import { cn } from '@/lib/utils'

/*
 * A realistic-looking Monte Carlo evacuation chart.
 * Each line is one simulated future: % of people evacuated over the 24 h after
 * the evacuation order. Line colour encodes that future's rainfall. In heavy-rain
 * futures the bridge is cut part-way through, and evacuation stalls — exactly
 * the behaviour the real flood model produces.
 */

const HOURS = 24
const STEP = 0.5
const N_POINTS = HOURS / STEP + 1
const BRIDGE_RAIN_MM = 165

// rainfall colour scale: light rain → heavy rain
const STOPS: [number, [number, number, number]][] = [
  [0, [34, 211, 238]], // cyan
  [0.4, [59, 130, 246]], // blue
  [0.7, [139, 92, 246]], // violet
  [1, [244, 63, 94]], // rose
]
function rainColor(t: number) {
  for (let i = 1; i < STOPS.length; i++) {
    const [p1, c1] = STOPS[i]
    const [p0, c0] = STOPS[i - 1]
    if (t <= p1) {
      const f = (t - p0) / (p1 - p0)
      const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * f))
      return `rgb(${c[0]},${c[1]},${c[2]})`
    }
  }
  return 'rgb(244,63,94)'
}

type Future = { rain: number; values: number[] }

function simulateFutures(count: number, seed: number): Future[] {
  const rand = seededRandom(seed)
  const futures: Future[] = []
  for (let i = 0; i < count; i++) {
    const rain = 60 + 200 * Math.pow(rand(), 1.25)
    const severity = (rain - 60) / 200
    const cap = 0.985 - 0.06 * rand() - 0.05 * severity
    const k = 0.42 + 0.22 * rand() - 0.12 * severity
    const t0 = 4.5 + 2.5 * rand() + 3 * severity
    const logistic = (t: number) => 1 / (1 + Math.exp(-k * (t - t0)))
    const l0 = logistic(0)
    const curve = (t: number) => (cap * (logistic(t) - l0)) / (1 - l0)

    // Heavy-rain futures lose the bridge; the heavier the rain, the earlier.
    const cutAt = rain > BRIDGE_RAIN_MM ? Math.max(3, 15 - ((rain - BRIDGE_RAIN_MM) / 95) * 11 + (rand() - 0.5) * 2) : Infinity

    const values: number[] = []
    for (let p = 0; p < N_POINTS; p++) {
      const t = p * STEP
      let v = t < cutAt ? curve(t) : curve(cutAt) + 0.004 * (t - cutAt)
      v += (rand() - 0.5) * 0.006
      values.push(Math.max(0, Math.min(1, v)))
    }
    futures.push({ rain, values })
  }
  return futures.sort((a, b) => a.rain - b.rain)
}

function quantile(sorted: number[], q: number) {
  const idx = (sorted.length - 1) * q
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

/** Catmull-Rom → cubic Bézier for smooth, natural curves. */
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return ''
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d
}

export function ScenarioChart({
  count = 60,
  seed = 23,
  compact = false,
  className,
}: {
  count?: number
  seed?: number
  compact?: boolean
  className?: string
}) {
  const reduce = useReducedMotion()
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const W = 760
  const H = compact ? 330 : 400
  const ML = 44
  const MR = 64
  const MT = 22
  const MB = compact ? 34 : 70
  const plotW = W - ML - MR
  const plotH = H - MT - MB
  const x = (t: number) => ML + (plotW * t) / HOURS
  const y = (v: number) => MT + plotH * (1 - v)

  const data = useMemo(() => {
    const futures = simulateFutures(count, seed)
    const stats = Array.from({ length: N_POINTS }, (_, p) => {
      const col = futures.map((f) => f.values[p]).sort((a, b) => a - b)
      const n = Math.max(1, Math.round(col.length * 0.1))
      return {
        p10: quantile(col, 0.1),
        p25: quantile(col, 0.25),
        p50: quantile(col, 0.5),
        p75: quantile(col, 0.75),
        p90: quantile(col, 0.9),
        worst: col.slice(0, n).reduce((s, v) => s + v, 0) / n,
      }
    })
    return { futures, stats }
  }, [count, seed])

  const pointsFor = (values: number[]) => values.map((v, p) => [x(p * STEP), y(v)] as [number, number])
  const band = (lo: keyof (typeof data.stats)[number], hi: keyof (typeof data.stats)[number]) => {
    const upper = data.stats.map((s, p) => `${p ? 'L' : 'M'}${x(p * STEP).toFixed(1)},${y(s[hi]).toFixed(1)}`).join(' ')
    const lower = data.stats
      .map((s, p) => ({ s, p }))
      .reverse()
      .map(({ s, p }) => `L${x(p * STEP).toFixed(1)},${y(s[lo]).toFixed(1)}`)
      .join(' ')
    return `${upper} ${lower} Z`
  }

  const median = smoothPath(pointsFor(data.stats.map((s) => s.p50)))
  const worst = smoothPath(pointsFor(data.stats.map((s) => s.worst)))
  const last = data.stats[N_POINTS - 1]

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (compact) return
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const vx = ((e.clientX - rect.left) / rect.width) * W
    const t = ((vx - ML) / plotW) * HOURS
    if (t < 0 || t > HOURS) return setHover(null)
    setHover(Math.round(t / STEP))
  }

  const drawIn = (delay: number, duration = 1.3) =>
    reduce
      ? {}
      : {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          transition: { duration, delay, ease: [0.65, 0, 0.35, 1] as const },
        }

  const hs = hover !== null ? data.stats[hover] : null

  return (
    <div className={cn('relative', className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label="Simulated evacuation progress over 24 hours for one plan across many futures, coloured by rainfall, with the median, worst 10% and 90% target"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`band-${seed}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(59,130,246)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="rgb(34,211,238)" stopOpacity={0.06} />
          </linearGradient>
          <linearGradient id={`rain-${seed}`} x1="0" y1="0" x2="1" y2="0">
            {STOPS.map(([p, c]) => (
              <stop key={p} offset={`${p * 100}%`} stopColor={`rgb(${c.join(',')})`} />
            ))}
          </linearGradient>
          <filter id={`glow-${seed}`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={ML} x2={W - MR} y1={y(v)} y2={y(v)} className="stroke-border" strokeDasharray={v === 0 ? undefined : '3 5'} />
            <text x={ML - 8} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
              {v * 100}%
            </text>
          </g>
        ))}
        {[0, 4, 8, 12, 16, 20, 24].map((h) => (
          <text key={h} x={x(h)} y={MT + plotH + 16} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
            {h}h
          </text>
        ))}

        {/* window where heavy-rain futures lose the bridge */}
        <motion.rect
          x={x(4)}
          y={MT}
          width={x(15) - x(4)}
          height={plotH}
          className="fill-risk"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 0.06 }}
          transition={{ delay: 2.4, duration: 0.8 }}
        />
        {!compact && (
          <motion.text
            x={x(4) + 8}
            y={MT + 14}
            className="fill-risk font-mono text-[10px] font-medium"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.6 }}
          >
            bridge cut window · heavy-rain futures stall here
          </motion.text>
        )}

        {/* target */}
        <line x1={ML} x2={W - MR} y1={y(0.9)} y2={y(0.9)} className="stroke-safe" strokeWidth={1.5} strokeDasharray="6 5" />
        <text x={ML + 8} y={y(0.9) - 6} className="fill-safe font-mono text-[10px] font-semibold">
          target · 90% evacuated
        </text>

        {/* futures */}
        {data.futures.map((f, i) => (
          <motion.path
            key={i}
            d={smoothPath(pointsFor(f.values))}
            fill="none"
            stroke={rainColor((f.rain - 60) / 200)}
            strokeWidth={1.2}
            strokeOpacity={0.45}
            strokeLinecap="round"
            {...drawIn(0.1 + i * 0.022, 1.1)}
          />
        ))}

        {/* bands */}
        <motion.path d={band('p10', 'p90')} fill={`url(#band-${seed})`} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.7, duration: 0.8 }} />
        <motion.path d={band('p25', 'p75')} className="fill-primary" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 0.1 }} transition={{ delay: 1.9, duration: 0.8 }} />

        {/* worst 10% and median */}
        <motion.path d={worst} fill="none" className="stroke-risk" strokeWidth={2.2} strokeDasharray="7 5" strokeLinecap="round" {...drawIn(2.1)} />
        <motion.path d={median} fill="none" className="stroke-white" strokeWidth={7} strokeLinecap="round" strokeOpacity={0.9} {...drawIn(1.9)} />
        <motion.path d={median} fill="none" className="stroke-blue-900" strokeWidth={3.2} strokeLinecap="round" filter={`url(#glow-${seed})`} {...drawIn(1.9)} />

        <motion.g initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3 }}>
          <circle cx={x(HOURS)} cy={y(last.p50)} r={4} className="fill-blue-900" />
          <text x={x(HOURS) + 8} y={y(last.p50) + 4} className="fill-blue-900 font-mono text-[11px] font-semibold">
            {Math.round(last.p50 * 100)}%
          </text>
          <circle cx={x(HOURS)} cy={y(last.worst)} r={4} className="fill-risk" />
          <text x={x(HOURS) + 8} y={y(last.worst) + 4} className="fill-risk font-mono text-[11px] font-semibold">
            {Math.round(last.worst * 100)}%
          </text>
        </motion.g>

        {/* hover crosshair */}
        {hs && hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover * STEP)} x2={x(hover * STEP)} y1={MT} y2={MT + plotH} className="stroke-foreground/40" strokeDasharray="3 3" />
            <circle cx={x(hover * STEP)} cy={y(hs.p90)} r={3} className="fill-flood" />
            <circle cx={x(hover * STEP)} cy={y(hs.p50)} r={4.5} className="fill-blue-900 stroke-background" strokeWidth={2} />
            <circle cx={x(hover * STEP)} cy={y(hs.p10)} r={3} className="fill-flood" />
            <circle cx={x(hover * STEP)} cy={y(hs.worst)} r={4} className="fill-risk stroke-background" strokeWidth={2} />
          </g>
        )}

        {/* legend */}
        {!compact && (
          <g transform={`translate(${ML}, ${H - 26})`}>
            <text y={4} className="fill-muted-foreground font-mono text-[10px]">rainfall</text>
            <rect x={56} y={-3} width={120} height={8} rx={4} fill={`url(#rain-${seed})`} />
            <text x={56} y={18} className="fill-muted-foreground font-mono text-[9px]">60 mm</text>
            <text x={176} y={18} textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">260 mm</text>
            <line x1={210} x2={234} y1={1} y2={1} className="stroke-blue-900" strokeWidth={3} />
            <text x={240} y={4} className="fill-muted-foreground font-mono text-[10px]">median</text>
            <line x1={300} x2={324} y1={1} y2={1} className="stroke-risk" strokeWidth={2.2} strokeDasharray="5 4" />
            <text x={330} y={4} className="fill-muted-foreground font-mono text-[10px]">worst 10%</text>
            <rect x={406} y={-4} width={22} height={10} rx={2} fill={`url(#band-${seed})`} />
            <text x={434} y={4} className="fill-muted-foreground font-mono text-[10px]">p10–p90</text>
          </g>
        )}
      </svg>

      {hs && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-44 rounded-lg border bg-background/95 p-3 text-xs shadow-lg backdrop-blur"
          style={hover * STEP > HOURS / 2 ? { left: `${(x(hover * STEP) / W) * 100 - 26}%` } : { left: `${(x(hover * STEP) / W) * 100 + 2}%` }}
        >
          <p className="font-mono text-[10px] text-muted-foreground">{(hover * STEP).toFixed(1)} h after the order</p>
          <dl className="mt-2 space-y-1">
            {[
              ['p90', hs.p90, 'text-flood'],
              ['median', hs.p50, 'text-blue-900'],
              ['p10', hs.p10, 'text-flood'],
              ['worst 10%', hs.worst, 'text-risk'],
            ].map(([k, v, c]) => (
              <div key={k as string} className="flex justify-between">
                <dt className="text-muted-foreground">{k as string}</dt>
                <dd className={cn('font-mono font-medium', c as string)}>{Math.round((v as number) * 100)}%</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}
