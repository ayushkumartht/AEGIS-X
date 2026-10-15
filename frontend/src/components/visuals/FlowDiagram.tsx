import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

export type FlowNode = {
  id: string
  label: string
  detail?: string
  /** Centre position in diagram units (diagram is `width` × `height`). */
  x: number
  y: number
  /** Box width in diagram units. */
  w?: number
  tone?: 'default' | 'solid' | 'muted'
}

export type FlowEdge = {
  from: string
  to: string
  label?: string
  dashed?: boolean
  /** h = horizontal-first elbow, v = vertical-first elbow. Defaults to whichever axis dominates. */
  route?: 'h' | 'v'
}

export type FlowLane = { label: string; y: number; h: number }

function edgePath(x1: number, y1: number, x2: number, y2: number, route: 'h' | 'v') {
  if (x1 === x2 || y1 === y2) return { d: `M${x1},${y1} L${x2},${y2}`, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 }
  if (route === 'h') {
    const xm = (x1 + x2) / 2
    return { d: `M${x1},${y1} H${xm} V${y2} H${x2}`, mx: xm, my: (y1 + y2) / 2 }
  }
  const ym = (y1 + y2) / 2
  return { d: `M${x1},${y1} V${ym} H${x2} V${y2}`, mx: (x1 + x2) / 2, my: ym }
}

/**
 * Animated flowchart: connectors draw themselves when scrolled into view and
 * small "packets" travel along them to show the direction of flow.
 */
export function FlowDiagram({
  nodes,
  edges,
  lanes = [],
  width = 1000,
  height,
  minWidth = 760,
  ariaLabel,
  className,
}: {
  nodes: FlowNode[]
  edges: FlowEdge[]
  lanes?: FlowLane[]
  width?: number
  height: number
  minWidth?: number
  ariaLabel: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const pct = (v: number, of: number) => `${(v / of) * 100}%`

  return (
    <div className={className}>
      <p className="mb-2 font-mono text-[10px] text-muted-foreground sm:hidden">Swipe to explore the diagram →</p>
    <div className="overflow-x-auto rounded-xl border bg-background">
      <div
        role="img"
        aria-label={ariaLabel}
        className="relative bg-grid"
        style={{ aspectRatio: `${width} / ${height}`, minWidth }}
      >
        <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 size-full" aria-hidden>
          {lanes.map((lane) => (
            <g key={lane.label}>
              <rect
                x={12}
                y={lane.y}
                width={width - 24}
                height={lane.h}
                rx={14}
                className="fill-accent/45 stroke-primary/20"
                strokeDasharray="4 6"
              />
            </g>
          ))}
          {edges.map((e, i) => {
            const a = byId.get(e.from)
            const b = byId.get(e.to)
            if (!a || !b) return null
            const route = e.route ?? (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? 'h' : 'v')
            const { d } = edgePath(a.x, a.y, b.x, b.y, route)
            return (
              <g key={`${e.from}-${e.to}-${i}`}>
                <motion.path
                  d={d}
                  fill="none"
                  className="stroke-primary/45"
                  strokeWidth={1.5}
                  strokeDasharray={e.dashed ? '5 5' : undefined}
                  initial={reduce ? false : { pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.9, delay: 0.2 + i * 0.08, ease: [0.65, 0, 0.35, 1] }}
                />
                {!reduce && !e.dashed && (
                  <circle r={3.5} className="fill-flood">
                    <animateMotion dur="2.6s" repeatCount="indefinite" begin={`${1 + i * 0.35}s`} path={d} />
                  </circle>
                )}
              </g>
            )
          })}
        </svg>

        {lanes.map((lane) => (
          <span
            key={lane.label}
            className="absolute font-mono text-[10px] font-medium tracking-wider text-primary/70 uppercase"
            // bottom-left of the lane: connectors usually enter boxes from the top, so this spot stays clear
            style={{ left: pct(28, width), top: pct(lane.y + lane.h - 22, height) }}
          >
            {lane.label}
          </span>
        ))}

        {edges.map((e, i) => {
          if (!e.label) return null
          const a = byId.get(e.from)
          const b = byId.get(e.to)
          if (!a || !b) return null
          const route = e.route ?? (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? 'h' : 'v')
          const { mx, my } = edgePath(a.x, a.y, b.x, b.y, route)
          return (
            <span
              key={`label-${i}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border bg-background px-2 py-0.5 font-mono text-[10px] whitespace-nowrap text-muted-foreground"
              style={{ left: pct(mx, width), top: pct(my, height) }}
            >
              {e.label}
            </span>
          )
        })}

        {nodes.map((n, i) => (
          <motion.div
            key={n.id}
            className={cn(
              'absolute -translate-x-1/2 -translate-y-1/2 rounded-lg border px-3 py-2 text-center shadow-sm',
              n.tone === 'solid' && 'border-primary bg-gradient-to-br from-primary to-blue-700 text-primary-foreground shadow-[0_8px_24px_-10px] shadow-primary/60',
              n.tone === 'muted' && 'border-dashed bg-muted text-foreground',
              (!n.tone || n.tone === 'default') && 'bg-background text-foreground',
            )}
            style={{ left: pct(n.x, width), top: pct(n.y, height), width: pct(n.w ?? 170, width) }}
            initial={reduce ? false : { opacity: 0, scale: 0.94 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-xs leading-tight font-semibold">{n.label}</p>
            {n.detail && (
              <p className={cn('mt-0.5 font-mono text-[10px] leading-tight', n.tone === 'solid' ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
                {n.detail}
              </p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
    </div>
  )
}
