import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from 'motion/react'
import { ArrowRight, Calculator, Link2, Tag, UserCheck } from 'lucide-react'
import { SiteHeader } from '@/components/site/SiteHeader'
import { HeroCinematic } from '@/components/site/HeroCinematic'
import { SiteFooter } from '@/components/site/SiteFooter'
import { Reveal } from '@/components/site/Reveal'
import { ScenarioChart } from '@/components/visuals/ScenarioChart'
import { BeforeAfter } from '@/components/visuals/BeforeAfter'
import { HumanMini, RedTeamGrid } from '@/components/visuals/FeatureVisuals'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

const SCREENS = [
  {
    id: 'command',
    label: 'Command Center',
    src: '/images/product/command-center.jpg',
    body: 'Live alerts, river gauges and flood risk for 22 districts, with an AI brief that cites its evidence.',
  },
  {
    id: 'situation',
    label: 'Situation',
    src: '/images/product/console-situation.jpg',
    body: "Silchar's real roads, relief camps and people. Every estimate is labelled as one.",
  },
  { id: 'plan', label: 'Plan', src: '/images/product/console-plan.jpg', body: 'Set when the order goes out, which shelters open, where boats wait and how people are warned.' },
  { id: 'results', label: 'Results', src: '/images/product/console-results.jpg', body: 'The same plan across 300 futures: the typical night and the bad one, side by side.' },
  { id: 'redteam', label: 'Red Team', src: '/images/product/console-redteam.jpg', body: 'The bridge or shelter whose loss quietly breaks the plan, found by computation.' },
  { id: '3d', label: '3D replay', src: '/images/product/console-3d.jpg', body: 'Watch the water rise hour by hour and see who gets out in time.' },
]

const NUMBERS = [
  { to: 22, label: 'districts watched live', note: 'NDMA SACHET · GloFAS' },
  { to: 178861, label: 'people modelled in Silchar', note: 'scaled to Census 2011' },
  { to: 51, label: 'river forecasts in every run', note: 'GloFAS ensemble' },
  { to: 2.9, decimals: 1, prefix: '~', suffix: ' s', label: 'to test 1,000 futures', note: 'measured on a laptop' },
]

const STEPS = [
  {
    k: '01',
    title: 'Simulate',
    body: 'One plan meets hundreds of possible floods: higher water, late boats, lost signals, people who stay home.',
    visual: <ScenarioChart compact count={36} seed={7} />,
  },
  {
    k: '02',
    title: 'Break it',
    body: 'A Red Team knocks out each bridge, shelter and boat base in turn and flags the one the plan cannot lose.',
    visual: <RedTeamGrid />,
  },
  {
    k: '03',
    title: 'Decide',
    body: 'The officer reads the evidence, accepts or rejects, and the decision is written to a log that cannot be quietly edited.',
    visual: <HumanMini />,
  },
]

const PRINCIPLES = [
  { icon: Calculator, title: 'The AI never computes a number', body: 'Every figure comes from the simulation. The language model only puts it into words, and is checked.' },
  { icon: UserCheck, title: 'A person makes every call', body: 'AEGIS-X recommends and explains. An officer accepts or rejects, with their name on it.' },
  { icon: Tag, title: 'Estimates say so', body: 'Real data shows its source. Anything assumed or simulated is labelled on screen.' },
  { icon: Link2, title: 'A log you can verify', body: 'Each decision is hash-chained to the one before. Change a row and the audit page shows where.' },
]

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function CountUp({ to, decimals = 0, prefix = '', suffix = '' }: { to: number; decimals?: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduce = useReducedMotion()
  const [value, setValue] = useState(reduce ? to : 0)

  useEffect(() => {
    if (!inView || reduce) return
    const controls = animate(0, to, { duration: 1.6, ease: [0.22, 1, 0.36, 1], onUpdate: setValue })
    return () => controls.stop()
  }, [inView, reduce, to])

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {value.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  )
}

function Heading({ eyebrow, title, body, className }: { eyebrow: string; title: ReactNode; body?: ReactNode; className?: string }) {
  return (
    <Reveal className={cn('max-w-2xl', className)}>
      <p className="text-sm font-medium text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-4xl font-semibold tracking-tight text-balance md:text-5xl">{title}</h2>
      {body && <p className="mt-5 text-lg text-pretty text-muted-foreground">{body}</p>}
    </Reveal>
  )
}

function ProductShowcase() {
  const reduce = useReducedMotion()
  const [active, setActive] = useState(SCREENS[0].id)
  const screen = SCREENS.find((s) => s.id === active) ?? SCREENS[0]

  return (
    <div>
      <div className="-mx-6 overflow-x-auto px-6 pb-1">
        <div className="mx-auto flex w-max gap-1 rounded-full border bg-muted/50 p-1" role="tablist" aria-label="Product screens">
          {SCREENS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === active}
              onClick={() => setActive(s.id)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm whitespace-nowrap transition-colors',
                s.id === active ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={screen.id}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="mx-auto mt-5 max-w-xl text-center text-sm text-muted-foreground"
        >
          {screen.body}
        </motion.p>
      </AnimatePresence>

      <div className="mt-8 rounded-2xl border bg-card p-1.5 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.35)]">
        <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-muted">
          <AnimatePresence initial={false}>
            <motion.img
              key={screen.src}
              src={screen.src}
              alt={`AEGIS-X ${screen.label} screen`}
              className="absolute inset-0 size-full object-cover object-top"
              initial={reduce ? false : { opacity: 0, scale: 1.01 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              loading="lazy"
            />
          </AnimatePresence>
        </div>
      </div>
      {/* warm the cache so switching tabs never shows an empty frame */}
      <div className="hidden" aria-hidden>
        {SCREENS.map((s) => (
          <img key={s.src} src={s.src} alt="" loading="lazy" />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader overlay />

      <main>
        <HeroCinematic />

        {/* ---------------- Product ---------------- */}
        <section id="product" className="scroll-mt-20 py-28 md:py-36">
          <div className="mx-auto max-w-6xl px-6">
            <Heading
              className="mx-auto mb-12 text-center"
              eyebrow="The product"
              title="One screen for the whole night."
              body="From the first alert to the signed decision. These are real screens, running on real data for Silchar, Assam."
            />
            <Reveal>
              <ProductShowcase />
            </Reveal>
          </div>
        </section>

        {/* ---------------- Numbers ---------------- */}
        <section className="border-y">
          <div className="mx-auto grid max-w-6xl grid-cols-2 md:grid-cols-4">
            {NUMBERS.map((n, i) => (
              <Reveal key={n.label} delay={i * 0.06} className={cn('px-6 py-12', i > 0 && 'md:border-l', i % 2 === 1 && 'border-l', i > 1 && 'border-t md:border-t-0')}>
                <p className="text-4xl font-semibold tracking-tight md:text-5xl">
                  <CountUp to={n.to} decimals={n.decimals} prefix={n.prefix} suffix={n.suffix} />
                </p>
                <p className="mt-2 text-sm">{n.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{n.note}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------------- How it works ---------------- */}
        <section id="how-it-works" className="scroll-mt-20 py-28 md:py-36">
          <div className="mx-auto max-w-6xl px-6">
            <Heading
              className="mb-16"
              eyebrow="How it works"
              title="Simulate. Break it. Decide."
              body="Floods don't break plans on an average day. They break them on the worst one, so that is where AEGIS-X looks."
            />
            <div className="grid gap-6 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <Reveal key={s.k} delay={i * 0.1} className="flex flex-col overflow-hidden rounded-2xl border bg-card">
                  <div className="flex min-h-56 flex-1 flex-col justify-center border-b bg-muted/30 p-6">{s.visual}</div>
                  <div className="p-6">
                    <p className="font-mono text-xs text-muted-foreground">{s.k}</p>
                    <h3 className="mt-2 text-xl font-semibold tracking-tight">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Principles ---------------- */}
        <section id="principles" className="scroll-mt-20 border-t bg-muted/30 py-28 md:py-36">
          <div className="mx-auto max-w-6xl px-6">
            <Heading className="mb-16" eyebrow="Built to be trusted" title="Decision support, not decision making." />
            <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {PRINCIPLES.map((p, i) => (
                <Reveal key={p.title} delay={i * 0.08}>
                  <p.icon className="size-6 text-primary" strokeWidth={1.5} />
                  <h3 className="mt-5 font-semibold tracking-tight">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Why: Kerala before / after ---------------- */}
        <section className="bg-slate-950 py-28 text-white md:py-36">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 md:grid-cols-[1fr_1.1fr]">
            <Reveal>
              <p className="text-sm font-medium text-sky-300">Kerala · August 2018</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight text-balance md:text-5xl">The same coast, six months apart.</h2>
              <p className="mt-6 text-lg leading-relaxed text-white/70">
                Drag the slider. NASA measured <span className="text-white">164% more rain</span> than normal in twenty days, and over{' '}
                <span className="text-white">a million people</span> left their homes. Every one of those moves rested on a decision made before anyone
                knew how high the water would go.
              </p>
              <p className="mt-6 text-white/90">That decision is what AEGIS-X is for.</p>
            </Reveal>
            <Reveal delay={0.1}>
              <BeforeAfter
                before="/images/kerala-before.jpg"
                after="/images/kerala-after.jpg"
                beforeLabel="6 Feb 2018"
                afterLabel="22 Aug 2018"
                alt="False-colour satellite view of the Kerala coast"
                className="aspect-[4/5] border-white/10"
              />
              <p className="mt-3 text-[11px] text-white/40">NASA Earth Observatory · Landsat (USGS) and modified Copernicus Sentinel data (ESA)</p>
            </Reveal>
          </div>
        </section>

        {/* ---------------- CTA ---------------- */}
        <section className="py-32 md:py-44">
          <Reveal className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-4xl font-semibold tracking-tight text-balance md:text-6xl">See where your plan fails, while there is still time to fix it.</h2>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
              <Link
                to="/command"
                className="group inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background transition hover:opacity-90"
              >
                Open the Command Center
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link to="/docs" className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground">
                Read the documentation
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
