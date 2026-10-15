import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { Check, Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Two road networks joined by a single bridge; water rises row by row and the bridge is flagged. */
export function RedTeamGrid() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '-60px' })
  const reduce = useReducedMotion()
  const [level, setLevel] = useState(reduce ? 4 : 0)
  const cols = 15
  const rows = 9
  const gapCols = [6, 7, 8]
  const bridgeRow = 4

  useEffect(() => {
    if (!inView || reduce) return
    const id = window.setInterval(() => setLevel((l) => (l >= 6 ? 0 : l + 1)), 700)
    return () => window.clearInterval(id)
  }, [inView, reduce])

  return (
    <div ref={ref} className="relative">
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: rows * cols }).map((_, idx) => {
          const r = Math.floor(idx / cols)
          const c = idx % cols
          const inGap = gapCols.includes(c)
          const isBridge = inGap && r === bridgeRow
          // water creeps in from the low (left) side as `level` rises
          const flooded = !inGap && c < 6 && c < level
          return (
            <div
              key={idx}
              className={cn(
                'aspect-square rounded-[3px] transition-colors duration-500',
                inGap && !isBridge && 'bg-transparent',
                !inGap && c < 6 && (flooded ? 'bg-flood' : 'bg-primary/15'),
                !inGap && c > 8 && 'bg-safe/25',
                isBridge && 'bg-risk',
              )}
            />
          )
        })}
      </div>
      {/* pulsing ring on the bridge */}
      <motion.div
        className="pointer-events-none absolute rounded-md border-2 border-risk"
        style={{ left: `${(6 / cols) * 100}%`, width: `${(3 / cols) * 100}%`, top: `${(bridgeRow / rows) * 100}%`, height: `${(1 / rows) * 100}%` }}
        animate={reduce ? undefined : { scale: [1, 1.35, 1], opacity: [1, 0, 1] }}
        transition={{ duration: 1.8, repeat: Infinity }}
      />
      <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
        <span>population side</span>
        <span className="rounded-full bg-risk px-2 py-0.5 text-white">bridge_main · −100%</span>
        <span>shelter side</span>
      </div>
    </div>
  )
}

export function TornadoMini() {
  const rows = [
    { label: 'rainfall_mm', v: 0.84, tone: 'from-primary to-flood' },
    { label: 'resource_availability', v: 0.31, tone: 'from-violet-500 to-primary' },
    { label: 'comms_degradation', v: 0.12, tone: 'from-warn to-amber-300' },
  ]
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={r.label} className="grid grid-cols-[1fr_1.4fr] items-center gap-3">
          <span className="truncate font-mono text-[10px] text-muted-foreground">{r.label}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <motion.div
              className={cn('h-full rounded-full bg-gradient-to-r', r.tone)}
              initial={{ width: 0 }}
              whileInView={{ width: `${r.v * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.2 + i * 0.15, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      ))}
      <p className="pt-1 font-mono text-[10px] text-muted-foreground">illustrative ranking · |correlation| with outcome</p>
    </div>
  )
}

export function VoiMini() {
  const rows = [
    { label: 'Verify bridge water level', v: 1 },
    { label: 'Confirm boats actually ready', v: 0.45 },
    { label: 'Restore radio relay', v: 0.12 },
  ]
  return (
    <ol className="space-y-2">
      {rows.map((r, i) => (
        <motion.li
          key={r.label}
          className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2"
          initial={{ opacity: 0, x: -12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 + i * 0.12 }}
        >
          <span className="font-mono text-[10px] text-muted-foreground">0{i + 1}</span>
          <span className="flex-1 truncate text-xs">{r.label}</span>
          <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-gradient-to-r from-primary to-flood" style={{ width: `${r.v * 100}%` }} />
          </span>
        </motion.li>
      ))}
      <li className="list-none pt-1 font-mono text-[10px] text-muted-foreground">illustrative ranking · expected value of information</li>
    </ol>
  )
}

export function ParetoMini() {
  const pts = [
    [12, 78], [20, 64], [26, 70], [33, 48], [38, 58], [46, 36], [52, 44], [58, 28], [66, 33], [74, 20], [80, 26], [88, 14],
  ]
  const frontier = [[12, 78], [20, 64], [33, 48], [46, 36], [58, 28], [74, 20], [88, 14]]
  const d = frontier.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ')
  return (
    <svg viewBox="0 0 100 90" className="w-full" aria-label="Pareto front of candidate plans">
      <line x1={6} y1={84} x2={96} y2={84} className="stroke-border" />
      <line x1={6} y1={6} x2={6} y2={84} className="stroke-border" />
      <motion.path
        d={d}
        fill="none"
        className="stroke-safe"
        strokeWidth={1}
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.4, delay: 0.4 }}
      />
      {pts.map(([x, y], i) => {
        const onFront = frontier.some(([fx, fy]) => fx === x && fy === y)
        return (
          <motion.circle
            key={i}
            cx={x}
            cy={y}
            r={onFront ? 1.8 : 1.3}
            className={onFront ? 'fill-safe' : 'fill-flood/50'}
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
          />
        )
      })}
      <circle cx={46} cy={36} r={4} className="fill-primary/10 stroke-primary" strokeWidth={0.6} />
      <line x1={49} y1={39} x2={56} y2={50} className="stroke-primary" strokeWidth={0.3} />
      <text x={57} y={53} className="fill-primary font-mono text-[3.5px] font-semibold">resilient pick</text>
      <text x={96} y={89} textAnchor="end" className="fill-muted-foreground font-mono text-[3px]">risk →</text>
      <text x={8} y={10} className="fill-muted-foreground font-mono text-[3px]">people saved</text>
    </svg>
  )
}

/** Real measured result from the demo scenario (n = 300, seed = 1). */
export function CompareMini() {
  const rows = [
    { plan: 'Baseline plan', mean: 0.609, worst: 0.0, meanTone: 'bg-muted-foreground/30', worstTone: 'bg-risk' },
    { plan: 'Reinforced access roads', mean: 0.732, worst: 0.237, meanTone: 'bg-primary/30', worstTone: 'bg-safe' },
  ]
  return (
    <div className="space-y-4">
      {rows.map((r, i) => (
        <div key={r.plan}>
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="font-medium">{r.plan}</span>
            <span className="font-mono text-muted-foreground">
              mean {(r.mean * 100).toFixed(1)}% · worst-10% {(r.worst * 100).toFixed(1)}%
            </span>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full bg-muted">
            <motion.div
              className={cn('absolute inset-y-0 left-0 rounded-full', r.meanTone)}
              initial={{ width: 0 }}
              whileInView={{ width: `${r.mean * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.2 + i * 0.2 }}
            />
            <motion.div
              className={cn('absolute inset-y-0 left-0 rounded-full', r.worstTone)}
              initial={{ width: 0 }}
              whileInView={{ width: `${Math.max(r.worst * 100, 0.8)}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.5 + i * 0.2 }}
            />
          </div>
        </div>
      ))}
      <p className="font-mono text-[10px] text-muted-foreground">measured on the demo scenario · n = 300 · seed 1 · same futures for both plans</p>
    </div>
  )
}

export function HumanMini() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const log = ['Plan A rejected: fails when bridge closes', 'Plan B edited: +2 boats beyond the bridge', 'Plan B approved · reasoning saved to audit log']
  return (
    <div ref={ref} className="space-y-3">
      <div className="flex gap-2">
        {[
          { icon: Check, label: 'Accept', tone: 'border-safe bg-safe text-white' },
          { icon: Pencil, label: 'Edit', tone: 'border-primary/40 bg-background text-primary' },
          { icon: X, label: 'Reject', tone: 'border-risk/40 bg-background text-risk' },
        ].map(({ icon: Icon, label, tone }) => (
          <span key={label} className={cn('inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium', tone)}>
            <Icon className="size-3" />
            {label}
          </span>
        ))}
      </div>
      <div className="space-y-1.5 rounded-lg border bg-muted/50 p-3 font-mono text-[10px]">
        {log.map((line, i) => (
          <motion.p
            key={line}
            className="truncate text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.3 + i * 0.6 }}
          >
            <span className={i === 2 ? 'text-safe' : i === 0 ? 'text-risk' : 'text-primary'}>›</span> {line}
          </motion.p>
        ))}
      </div>
      <p className="font-mono text-[10px] text-muted-foreground">example flow · persistent audit log is on the roadmap</p>
    </div>
  )
}
