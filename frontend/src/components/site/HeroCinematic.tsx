import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/*
 * Full-bleed hero. Real, licensed photographs of Indian floods cycle behind a
 * single headline with a slow Ken Burns move. Nothing sits on top of the photo
 * except the words and two actions.
 */

const SLIDES = [
  {
    src: '/images/hero-chennai-rescue.jpg',
    place: 'Chennai',
    when: 'Dec 2015',
    caption: 'Indian Air Force winch rescue from a flooded rooftop',
    credit: 'Indian Air Force · GODL-India',
    position: '68% 55%',
  },
  {
    src: '/images/hero-assam-street.jpg',
    place: 'Dibrugarh, Assam',
    when: 'Aug 2015',
    caption: 'A market street under water',
    credit: 'Arunabh0368 · CC BY-SA 4.0',
    position: '55% 60%',
  },
  {
    src: '/images/hero-uttarakhand-airlift.jpg',
    place: 'Gauchar, Uttarakhand',
    when: 'Jun 2013',
    caption: 'With roads cut, helicopters became the only way in',
    credit: 'Ministry of Defence (PIB) · GODL-India',
    position: '50% 70%',
  },
  {
    src: '/images/hero-chennai-orbit.jpg',
    place: 'North-west of Chennai',
    when: '8 Dec 2015',
    caption: 'Floodwater that persisted a week after the rain, seen from orbit',
    credit: 'NASA Earth Observatory · USGS Landsat',
    position: '50% 50%',
  },
]

const SLIDE_MS = 7000

export function HeroCinematic() {
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]

  useEffect(() => {
    if (reduce) return
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), SLIDE_MS)
    return () => window.clearTimeout(id)
  }, [index, reduce])

  const rise = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] as const },
  })

  return (
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-slate-950 text-white" aria-label="AEGIS-X introduction">
      <AnimatePresence initial={false}>
        <motion.img
          key={slide.src}
          src={slide.src}
          alt={`${slide.caption} — ${slide.place}, ${slide.when}`}
          className="absolute inset-0 -z-20 size-full object-cover"
          style={{ objectPosition: slide.position }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.12 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1.02 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 1.4, ease: 'easeInOut' }, scale: { duration: SLIDE_MS / 1000 + 1.5, ease: 'linear' } }}
          fetchPriority={index === 0 ? 'high' : 'auto'}
        />
      </AnimatePresence>
      {/* preload the next slide so the crossfade never flashes */}
      <link rel="preload" as="image" href={SLIDES[(index + 1) % SLIDES.length].src} />

      {/* grading: keep the photo sharp, darken only where the words sit */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/85 via-slate-950/35 to-transparent" aria-hidden />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950/90 via-transparent to-slate-950/40" aria-hidden />

      <div className="relative mx-auto flex w-full max-w-7xl flex-1 items-center px-6 pt-28 pb-10 lg:px-10">
        <div className="max-w-3xl">
          <motion.p {...rise(0.1)} className="flex items-center gap-2 text-sm font-medium text-sky-200">
            <span className="size-1.5 rounded-full bg-sky-300" />
            Flood decision support for India
          </motion.p>

          <motion.h1
            {...rise(0.2)}
            className="mt-6 text-5xl leading-[0.95] font-semibold tracking-tighter text-balance sm:text-6xl lg:text-7xl xl:text-[5.5rem]"
          >
            Test the decision
            <br />
            <span className="text-sky-300">before reality does.</span>
          </motion.h1>

          <motion.p {...rise(0.35)} className="mt-7 max-w-xl text-lg leading-relaxed text-pretty text-white/80 md:text-xl">
            AEGIS-X runs an evacuation plan through hundreds of possible floods, finds where it breaks, and shows the officer what to fix, before a
            single boat is sent.
          </motion.p>

          <motion.div {...rise(0.5)} className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link
              to="/command"
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-slate-950 transition hover:bg-sky-50"
            >
              Open the Command Center
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link to="/console/cachar" className="group inline-flex items-center gap-1.5 text-sm font-medium text-white/85 transition hover:text-white">
              Try the Silchar console
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </div>
      </div>

      {/* slide indicators + photo credit */}
      <div className="relative mx-auto w-full max-w-7xl px-6 pb-8 lg:px-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex gap-2" role="tablist" aria-label="Background photographs">
            {SLIDES.map((s, i) => (
              <button
                key={s.src}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`${s.place}, ${s.when}`}
                onClick={() => setIndex(i)}
                className="py-2"
              >
                <span className={cn('block h-0.5 overflow-hidden rounded-full bg-white/25 transition-all', i === index ? 'w-12' : 'w-6 hover:bg-white/50')}>
                  {i === index && (
                    <motion.span
                      key={`bar-${index}`}
                      className="block h-full bg-white"
                      initial={{ width: reduce ? '100%' : '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: SLIDE_MS / 1000, ease: 'linear' }}
                    />
                  )}
                </span>
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={slide.caption}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-white/60 md:text-right"
            >
              {slide.place} · {slide.when} — {slide.caption}
              <span className="block text-[10px] text-white/40">{slide.credit}</span>
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
