import { useMemo } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { seededRandom } from '@/lib/random'

const W = 600
const H = 340
const X0 = 44
const X1 = 584
const Y_TOP = 24
const Y_BOTTOM = 296
const STEPS = 14

type Trajectory = number[]

function buildFutures(count: number, seed: number) {
  const rand = seededRandom(seed)
  const futures: Trajectory[] = []
  for (let i = 0; i < count; i++) {
    // Each future draws its own "rainfall severity"; harsher futures cap lower and some collapse.
    const severity = rand()
    const cap = severity < 0.7 ? 0.78 + rand() * 0.2 : 0.05 + rand() * 0.55
    const speed = 0.18 + rand() * 0.22
    const traj: Trajectory = []
    for (let t = 0; t <= STEPS; t++) {
      const base = cap * (1 - Math.exp(-speed * t))
      const noise = (rand() - 0.5) * 0.03
      traj.push(Math.max(0, Math.min(1, base + noise)))
    }
    futures.push(traj)
  }
  return futures
}

function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b)
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

const xAt = (t: number) => X0 + ((X1 - X0) * t) / STEPS
const yAt = (v: number) => Y_BOTTOM - (Y_BOTTOM - Y_TOP) * v

function toPath(values: number[]) {
  return values.map((v, t) => `${t === 0 ? 'M' : 'L'}${xAt(t).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ')
}

export function FuturesFan({ count = 46, seed = 11, className }: { count?: number; seed?: number; className?: string }) {
  const reduce = useReducedMotion()

  const { futures, band, median, worst, medianEnd, worstEnd } = useMemo(() => {
    const futures = buildFutures(count, seed)
    const p10: number[] = []
    const p50: number[] = []
    const p90: number[] = []
    const worstTenth: number[] = []
    for (let t = 0; t <= STEPS; t++) {
      const column = futures.map((f) => f[t])
      p10.push(percentile(column, 0.1))
      p50.push(percentile(column, 0.5))
      p90.push(percentile(column, 0.9))
      const sorted = [...column].sort((a, b) => a - b)
      const n = Math.max(1, Math.round(sorted.length * 0.1))
      worstTenth.push(sorted.slice(0, n).reduce((s, v) => s + v, 0) / n)
    }
    const upper = p90.map((v, t) => `${t === 0 ? 'M' : 'L'}${xAt(t)},${yAt(v)}`).join(' ')
    const lower = [...p10]
      .map((v, t) => ({ v, t }))
      .reverse()
      .map(({ v, t }) => `L${xAt(t)},${yAt(v)}`)
      .join(' ')
    return {
      futures,
      band: `${upper} ${lower} Z`,
      median: toPath(p50),
      worst: toPath(worstTenth),
      medianEnd: p50[STEPS],
      worstEnd: worstTenth[STEPS],
    }
  }, [count, seed])

  const draw = (delay: number, duration = 1.4) =>
    reduce
      ? {}
      : {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          transition: { duration, delay, ease: [0.65, 0, 0.35, 1] as const },
        }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label="Simulated futures for one evacuation plan, with median and worst-10% outcome highlighted">
      {/* gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}>
          <line x1={X0} x2={X1} y1={yAt(v)} y2={yAt(v)} className="stroke-border" strokeDasharray="2 4" />
          <text x={X0 - 10} y={yAt(v) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">
            {Math.round(v * 100)}%
          </text>
        </g>
      ))}
      <text x={X1} y={H - 8} textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">
        time →
      </text>
      <text x={X0} y={H - 8} className="fill-muted-foreground font-mono text-[9px]">
        people evacuated
      </text>

      {/* individual futures */}
      {futures.map((f, i) => (
        <motion.path
          key={i}
          d={toPath(f)}
          fill="none"
          className="stroke-foreground"
          strokeWidth={1}
          strokeOpacity={0.14}
          {...draw(0.15 + i * 0.03, 1.2)}
        />
      ))}

      {/* p10–p90 band */}
      <motion.path
        d={band}
        className="fill-foreground"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 0.06 }}
        transition={{ delay: 1.8, duration: 0.8 }}
      />

      {/* worst-10% */}
      <motion.path d={worst} fill="none" className="stroke-foreground" strokeWidth={1.5} strokeDasharray="5 5" {...draw(2.1)} />
      {/* median */}
      <motion.path d={median} fill="none" className="stroke-foreground" strokeWidth={2.5} {...draw(1.9)} />

      <motion.g initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3 }}>
        <text x={X1 - 4} y={yAt(medianEnd) - 8} textAnchor="end" className="fill-foreground font-mono text-[10px] font-medium">
          median
        </text>
        <text x={X1 - 4} y={yAt(worstEnd) - 8} textAnchor="end" className="fill-foreground font-mono text-[10px] font-medium">
          worst 10%
        </text>
      </motion.g>

      {/* scanning "now" line */}
      {!reduce && (
        <motion.line
          y1={Y_TOP}
          y2={Y_BOTTOM}
          className="stroke-foreground"
          strokeOpacity={0.35}
          initial={{ x1: X0, x2: X0 }}
          animate={{ x1: [X0, X1], x2: [X0, X1] }}
          transition={{ delay: 3.2, duration: 6, repeat: Infinity, repeatDelay: 1.5, ease: 'linear' }}
        />
      )}
    </svg>
  )
}
