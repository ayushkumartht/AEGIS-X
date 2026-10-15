import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

export const LOOP_STEPS = [
  { name: 'Sense', body: 'Forecasts, river levels, field reports and resource status are pulled in as they arrive.' },
  { name: 'Understand', body: 'Everything is merged into one model of the situation, with a confidence level on every fact.' },
  { name: 'Simulate', body: 'The plan is run through hundreds of possible futures, not one forecast.' },
  { name: 'Stress-test', body: 'The Red Team searches for the conditions and the single element that break the plan.' },
  { name: 'Optimize', body: 'Trade-offs between lives, time and resources are surfaced, favouring plans that survive bad days.' },
  { name: 'Explain', body: 'Findings are shown on the map and narrated in plain language, every claim traceable to numbers.' },
  { name: 'Decide', body: 'The authorized human accepts, edits or rejects, and re-runs the analysis in seconds.' },
  { name: 'Learn', body: 'After the event, prediction is compared with reality and the model is recalibrated.' },
]

export function DecisionLoop({ className }: { className?: string }) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '-100px' })
  const reduce = useReducedMotion()

  useEffect(() => {
    if (paused || !inView || reduce) return
    const id = window.setInterval(() => setActive((a) => (a + 1) % LOOP_STEPS.length), 2200)
    return () => window.clearInterval(id)
  }, [paused, inView, reduce])

  const n = LOOP_STEPS.length
  const angleOf = (i: number) => (i / n) * Math.PI * 2 - Math.PI / 2

  return (
    <div ref={ref} className={className}>
      {/* Small screens: a circle can't fit eight labels plus a description, so show an ordered list. */}
      <ol className="space-y-2 sm:hidden">
        {LOOP_STEPS.map((step, i) => (
          <li
            key={step.name}
            className={cn('rounded-xl border p-4 transition-colors duration-300', i === active ? 'border-primary bg-primary text-primary-foreground' : 'bg-background')}
          >
            <p className="text-sm font-medium">
              <span className="mr-2 font-mono opacity-60">{String(i + 1).padStart(2, '0')}</span>
              {step.name}
            </p>
            <p className={cn('mt-1 text-xs', i === active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{step.body}</p>
          </li>
        ))}
      </ol>
      <div className="relative mx-auto hidden aspect-square w-full max-w-[520px] sm:block" onMouseLeave={() => setPaused(false)}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
        <circle cx={50} cy={50} r={38} className="fill-none stroke-border" strokeWidth={0.4} />
        <circle cx={50} cy={50} r={38} className="fill-none stroke-foreground/15" strokeWidth={0.3} strokeDasharray="0.6 1.6" />
        {/* progress arc to the active step */}
        <motion.circle
          cx={50}
          cy={50}
          r={38}
          className="fill-none stroke-primary"
          strokeWidth={0.8}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          animate={{ pathLength: (active + 1) / n }}
          transition={{ duration: 0.8, ease: [0.65, 0, 0.35, 1] }}
        />
      </svg>

      {LOOP_STEPS.map((step, i) => {
        const a = angleOf(i)
        const x = 50 + Math.cos(a) * 38
        const y = 50 + Math.sin(a) * 38
        const isActive = i === active
        return (
          <button
            key={step.name}
            type="button"
            onMouseEnter={() => {
              setPaused(true)
              setActive(i)
            }}
            onFocus={() => {
              setPaused(true)
              setActive(i)
            }}
            onClick={() => setActive(i)}
            className={cn(
              'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all duration-300',
              isActive
                ? 'scale-110 border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                : 'bg-background text-muted-foreground hover:text-foreground',
            )}
            style={{ left: `${x}%`, top: `${y}%` }}
            aria-pressed={isActive}
          >
            <span className="mr-1.5 font-mono opacity-60">{String(i + 1).padStart(2, '0')}</span>
            {step.name}
          </button>
        )
      })}

      <div className="absolute inset-[24%] flex flex-col items-center justify-center text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
            transition={{ duration: 0.35 }}
          >
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Step {active + 1} / {n}
            </p>
            <p className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{LOOP_STEPS[active].name}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">{LOOP_STEPS[active].body}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      </div>
    </div>
  )
}
