import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react'
import { ArrowUpRight, CircleCheck, MoveHorizontal } from 'lucide-react'
import { BeforeAfter } from '@/components/visuals/BeforeAfter'
import { CASE_STUDIES } from '@/content/caseStudies'
import { cn } from '@/lib/utils'

const STEP_MS = 9000
const EASE = [0.22, 1, 0.36, 1] as const

/**
 * Case-study player for a dark section. Plays through the floods on its own
 * while on screen; hovering pauses it and picking one stops it.
 */
export function CaseStudies() {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '-160px' })
  const [index, setIndex] = useState(0)
  const [hovering, setHovering] = useState(false)
  const [picked, setPicked] = useState(false)
  const cs = CASE_STUDIES[index]

  const playing = inView && !hovering && !picked && !reduce

  useEffect(() => {
    if (!playing) return
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % CASE_STUDIES.length), STEP_MS)
    return () => window.clearTimeout(id)
  }, [index, playing])

  const item = (i: number) => ({
    initial: reduce ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay: reduce ? 0 : 0.15 + i * 0.08, ease: EASE },
  })

  return (
    <div ref={ref} onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
      {/* selector */}
      <div role="tablist" aria-label="Case studies" className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
        {CASE_STUDIES.map((c, i) => {
          const active = i === index
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setIndex(i)
                setPicked(true)
              }}
              className="group text-left outline-none"
            >
              <span className="block h-0.5 overflow-hidden rounded-full bg-white/15">
                {active && (
                  <motion.span
                    key={`${c.id}-${playing}`}
                    className="block h-full bg-sky-300"
                    initial={{ width: playing ? '0%' : '100%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: playing ? STEP_MS / 1000 : 0, ease: 'linear' }}
                  />
                )}
              </span>
              <span className={cn('mt-3 block text-sm font-medium transition-colors', active ? 'text-white' : 'text-white/50 group-hover:text-white/80')}>
                {c.place}
              </span>
              <span className="block text-xs text-white/40">{c.when}</span>
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.article
          key={cs.id}
          role="tabpanel"
          className="mt-12 grid items-start gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          {/* media: touching it (e.g. dragging the slider) stops autoplay */}
          <div onPointerDown={() => setPicked(true)}>
            {cs.compare ? (
              <>
                <BeforeAfter
                  before={cs.compare.before}
                  after={cs.compare.after}
                  beforeLabel={cs.compare.beforeLabel}
                  afterLabel={cs.compare.afterLabel}
                  alt={`Satellite view, ${cs.place}`}
                  className="aspect-[4/3] border-white/10"
                />
                <p className="mt-3 flex items-center justify-between gap-4 text-[11px] text-white/45">
                  <span className="inline-flex items-center gap-1.5 text-white/70">
                    <MoveHorizontal className="size-3.5" /> Drag to compare
                  </span>
                  {cs.compare.credit}
                </p>
              </>
            ) : (
              <>
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
                  <motion.img
                    src={cs.image}
                    alt={cs.imageAlt}
                    className="size-full object-cover"
                    initial={reduce ? false : { scale: 1.12 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 9, ease: 'linear' }}
                  />
                </div>
                <p className="mt-3 text-right text-[11px] text-white/45">{cs.imageCredit}</p>
              </>
            )}
          </div>

          {/* story */}
          <div>
            <motion.h3 {...item(0)} className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">
              {cs.title}
            </motion.h3>

            <dl className="mt-8 divide-y divide-white/10 border-y border-white/10">
              {cs.facts.map((f, i) => (
                <motion.div key={f.label} {...item(i + 1)} className="flex items-baseline gap-5 py-4">
                  <dt className="w-32 shrink-0 text-2xl font-semibold tracking-tight text-sky-300 md:text-3xl">{f.value}</dt>
                  <dd className="text-sm text-white/70">{f.label}</dd>
                </motion.div>
              ))}
            </dl>

            <motion.p {...item(4)} className="mt-8 leading-relaxed text-white/80">
              {cs.challenge}
            </motion.p>

            <motion.div {...item(5)} className="mt-8">
              <p className="text-sm font-medium text-white">What AEGIS-X would test</p>
              <ul className="mt-3 space-y-2.5">
                {cs.aegis.map((a) => (
                  <li key={a} className="flex gap-2.5 text-sm text-white/70">
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                    {a}
                  </li>
                ))}
              </ul>
            </motion.div>

            {cs.inset && (
              <motion.figure {...item(6)} className="mt-8 flex items-center gap-4">
                <img src={cs.inset.src} alt={cs.inset.caption} className="h-16 w-24 shrink-0 rounded-md object-cover" loading="lazy" />
                <figcaption className="text-xs text-white/60">
                  {cs.inset.caption}
                  <span className="mt-0.5 block text-[10px] text-white/40">{cs.inset.credit}</span>
                </figcaption>
              </motion.figure>
            )}

            <motion.a
              {...item(7)}
              href={cs.source.url}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex items-center gap-1 text-sm font-medium text-sky-300 hover:text-sky-200"
            >
              Source: {cs.source.label} <ArrowUpRight className="size-4" />
            </motion.a>
          </div>
        </motion.article>
      </AnimatePresence>

      <p className="mt-12 text-xs text-white/40">
        Figures are quoted from the linked sources. What AEGIS-X would test is illustrative of the approach, not a re-run of the event.
      </p>
    </div>
  )
}
