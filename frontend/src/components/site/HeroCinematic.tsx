import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, BookOpen, ChevronDown, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

/*
 * Full-bleed cinematic hero. Real, licensed photographs of Indian floods cycle
 * behind the headline with a slow Ken Burns move; a viewfinder-style HUD frames
 * the shot, and a glass panel on the right shows numbers measured on the
 * AEGIS-X demo scenario (clearly labelled as such).
 */

const SLIDES = [
  {
    src: '/images/hero-chennai-rescue.jpg',
    place: 'Chennai',
    when: 'Dec 2015',
    coords: '13.08°N · 80.27°E',
    caption: 'Indian Air Force winch rescue from a flooded rooftop',
    credit: 'Indian Air Force · GODL-India',
    position: '68% 55%',
  },
  {
    src: '/images/hero-assam-street.jpg',
    place: 'Dibrugarh, Assam',
    when: 'Aug 2015',
    coords: '27.47°N · 94.91°E',
    caption: 'A market street under water',
    credit: 'Arunabh0368 · CC BY-SA 4.0',
    position: '55% 60%',
  },
  {
    src: '/images/hero-uttarakhand-airlift.jpg',
    place: 'Gauchar, Uttarakhand',
    when: 'Jun 2013',
    coords: '30.28°N · 79.16°E',
    caption: 'With roads cut, helicopters became the only way in',
    credit: 'Ministry of Defence (PIB) · GODL-India',
    position: '50% 70%',
  },
  {
    src: '/images/hero-chennai-orbit.jpg',
    place: 'North-west of Chennai',
    when: '8 Dec 2015',
    coords: 'Landsat 8 · OLI',
    caption: 'Floodwater that persisted a week after the rain, seen from orbit',
    credit: 'NASA Earth Observatory · USGS Landsat',
    position: '50% 50%',
  },
]

const SLIDE_MS = 7000

function Corner({ className }: { className: string }) {
  return <span className={cn('pointer-events-none absolute size-6 border-white/60', className)} aria-hidden />
}

function Counter({ to, suffix = '', decimals = 0, delay = 0 }: { to: number; suffix?: string; decimals?: number; delay?: number }) {
  const reduce = useReducedMotion()
  const [v, setV] = useState(reduce ? to : 0)
  useEffect(() => {
    if (reduce) return
    const c = animate(0, to, { duration: 1.8, delay, ease: [0.22, 1, 0.36, 1], onUpdate: setV })
    return () => c.stop()
  }, [to, delay, reduce])
  return (
    <span className="tabular-nums">
      {v.toFixed(decimals)}
      {suffix}
    </span>
  )
}

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
    initial: reduce ? false : { opacity: 0, y: 28, filter: 'blur(8px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] as const },
  })

  return (
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-slate-950 text-white" aria-label="AEGIS-X introduction">
      {/* background slideshow */}
      <AnimatePresence initial={false}>
        <motion.img
          key={slide.src}
          src={slide.src}
          alt={`${slide.caption} — ${slide.place}, ${slide.when}`}
          className="absolute inset-0 -z-20 size-full object-cover"
          style={{ objectPosition: slide.position }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.14 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1.02 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 1.4, ease: 'easeInOut' }, scale: { duration: SLIDE_MS / 1000 + 1.5, ease: 'linear' } }}
          fetchPriority={index === 0 ? 'high' : 'auto'}
        />
      </AnimatePresence>
      {/* preload the next slide so the crossfade never flashes */}
      <link rel="preload" as="image" href={SLIDES[(index + 1) % SLIDES.length].src} />

      {/* grading: readable text on the left, cinematic vignette everywhere */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/90 via-slate-950/45 to-transparent" aria-hidden />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950/95 via-transparent to-slate-950/45" aria-hidden />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_65%_45%,transparent_45%,rgba(2,6,23,0.35)_100%)]" aria-hidden />
      <div
        className="absolute inset-0 -z-10 opacity-[0.035] [background-image:repeating-linear-gradient(0deg,white_0px,white_1px,transparent_1px,transparent_3px)]"
        aria-hidden
      />

      {/* viewfinder HUD */}
      <div className="pointer-events-none absolute inset-4 hidden md:block lg:inset-6" aria-hidden>
        <Corner className="top-16 left-0 border-t border-l" />
        <Corner className="top-16 right-0 border-t border-r" />
        <Corner className="bottom-0 left-0 border-b border-l" />
        <Corner className="right-0 bottom-0 border-r border-b" />
        <div className="absolute top-[4.6rem] right-8 flex items-center gap-3 font-mono text-[10px] tracking-[0.2em] text-white/70 uppercase">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 animate-pulse rounded-full bg-rose-400" /> Field record
          </span>
          <span className="text-white/40">|</span>
          <AnimatePresence mode="wait">
            <motion.span key={slide.coords} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {slide.coords}
            </motion.span>
          </AnimatePresence>
          <span className="text-white/40">|</span>
          <span>
            {String(index + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* content */}
      <div className="relative mx-auto grid w-full max-w-7xl flex-1 items-center gap-12 px-6 pt-32 pb-12 lg:grid-cols-[1.35fr_0.65fr] lg:px-10">
        <div>
          <motion.p {...rise(0.1)} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-[11px] tracking-[0.18em] text-sky-200 uppercase backdrop-blur">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-sky-300 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-sky-300" />
            </span>
            Decision intelligence<span className="hidden sm:inline"> · Flood response</span>
          </motion.p>

          <motion.h1 {...rise(0.2)} className="mt-7 text-5xl leading-[0.98] font-semibold tracking-tighter text-balance drop-shadow-[0_2px_24px_rgba(2,6,23,0.6)] sm:text-6xl lg:text-[4.25rem] xl:text-[4.75rem]">
            Test the decision
            <br />
            <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-emerald-200 bg-clip-text text-transparent">before reality does.</span>
          </motion.h1>

          <motion.p {...rise(0.35)} className="mt-7 max-w-xl text-lg leading-relaxed text-pretty text-white/75 md:text-xl">
            Every monsoon, officers commit boats, teams and shelters before they know how high the water will go. AEGIS-X runs their plan through
            hundreds of possible futures, has a Red Team try to break it, and shows exactly where it fails — before a single boat is sent.
          </motion.p>

          <motion.div {...rise(0.5)} className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/demo"
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-slate-950 shadow-[0_10px_40px_-10px_rgba(125,211,252,0.6)] transition hover:bg-sky-50"
            >
              Launch the live demo
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/docs"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-white/25 bg-white/5 px-6 text-sm font-medium text-white backdrop-blur transition hover:bg-white/10"
            >
              <BookOpen className="size-4" /> Read the documentation
            </Link>
          </motion.div>

          <motion.ul {...rise(0.65)} className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/60">
            {['Case data from NASA, IFRC & UNICEF', 'A human approves every plan', 'Engine runs fully offline'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="size-1 rounded-full bg-sky-300" />
                {t}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* glass HUD panel */}
        <motion.aside
          initial={reduce ? false : { opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative hidden rounded-2xl border border-white/15 bg-slate-950/40 p-6 shadow-2xl shadow-black/40 backdrop-blur-md lg:block"
        >
          <Corner className="-top-px -left-px rounded-tl-2xl border-t-2 border-l-2 !border-sky-300" />
          <Corner className="-right-px -bottom-px rounded-br-2xl border-r-2 border-b-2 !border-sky-300" />
          <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.18em] text-white/60 uppercase">
            <span>Simulation · plan_a</span>
            <span className="rounded-full border border-white/20 px-2 py-0.5 text-[9px]">demo scenario</span>
          </div>

          <div className="mt-5">
            <p className="text-xs text-white/60">Futures simulated</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight">
              <Counter to={300} delay={0.9} />
            </p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-300"
                initial={{ width: reduce ? '100%' : '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.8, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <dt className="text-[11px] text-white/55">Evacuated at 100 mm</dt>
              <dd className="mt-1 text-2xl font-semibold text-sky-300">
                ~<Counter to={79} suffix="%" delay={1.2} />
              </dd>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <dt className="text-[11px] text-white/55">Evacuated at 200 mm</dt>
              <dd className="mt-1 text-2xl font-semibold text-rose-300">
                <Counter to={0} suffix="%" delay={1.2} />
              </dd>
            </div>
          </dl>

          <div className="mt-3 flex items-start gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-rose-300" />
            <div className="text-xs">
              <p className="font-medium text-rose-200">Red Team: single point of failure</p>
              <p className="mt-0.5 font-mono text-white/70">bridge_main · outcome −100% if lost</p>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-xs">
            <p className="text-white/60">Worst-case resilience after the fix</p>
            <p className="mt-1 text-lg font-semibold">
              0% → <span className="text-emerald-300">23.7%</span>
            </p>
          </div>

          <p className="mt-4 font-mono text-[10px] text-white/40">Measured on the AEGIS-X demo grid · not the event shown behind</p>
        </motion.aside>
      </div>

      {/* bottom bar: slide indicators + caption */}
      <div className="relative mx-auto w-full max-w-7xl px-6 pb-8 lg:px-10">
        <div className="grid gap-6 border-t border-white/15 pt-5 md:grid-cols-[1fr_auto] md:items-end">
          <div className="grid grid-cols-4 gap-3" role="tablist" aria-label="Background photographs">
            {SLIDES.map((s, i) => (
              <button key={s.src} type="button" role="tab" aria-selected={i === index} onClick={() => setIndex(i)} className="group text-left">
                <span className="block h-0.5 overflow-hidden rounded-full bg-white/20">
                  {i === index && (
                    <motion.span
                      key={`bar-${index}`}
                      className="block h-full bg-white"
                      initial={{ width: reduce ? '100%' : '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: SLIDE_MS / 1000, ease: 'linear' }}
                    />
                  )}
                  {i < index && <span className="block h-full w-full bg-white/60" />}
                </span>
                <span className={cn('mt-2 block truncate text-xs transition-colors', i === index ? 'text-white' : 'text-white/45 group-hover:text-white/75')}>
                  {s.place}
                </span>
                <span className="block font-mono text-[10px] text-white/40">{s.when}</span>
              </button>
            ))}
          </div>
          <div className="flex items-end justify-between gap-6 md:justify-end">
            <AnimatePresence mode="wait">
              <motion.p
                key={slide.caption}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="max-w-xs text-right text-xs text-white/70"
              >
                {slide.caption}
                <span className="mt-0.5 block font-mono text-[10px] text-white/40">{slide.credit}</span>
              </motion.p>
            </AnimatePresence>
            <a href="#overview" className="hidden flex-col items-center gap-1 text-[10px] tracking-[0.2em] text-white/50 uppercase hover:text-white md:flex">
              Scroll
              <ChevronDown className="size-4 animate-bounce" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
