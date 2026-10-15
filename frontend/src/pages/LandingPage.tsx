import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { animate, motion, useInView, useReducedMotion } from 'motion/react'
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Clock3,
  CloudRainWind,
  Flame,
  Network,
  ShieldAlert,
  Unplug,
  Users,
  Waves,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { Reveal, SectionLabel } from '@/components/site/Reveal'
import { FuturesFan } from '@/components/visuals/FuturesFan'
import { DecisionLoop } from '@/components/visuals/DecisionLoop'
import { BeforeAfter } from '@/components/visuals/BeforeAfter'
import { FlowDiagram } from '@/components/visuals/FlowDiagram'
import { CompareMini, HumanMini, ParetoMini, RedTeamGrid, TornadoMini, VoiMini } from '@/components/visuals/FeatureVisuals'
import { architectureFlow } from '@/content/flows'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
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
      {value.toFixed(decimals)}
      {suffix}
    </span>
  )
}

function Section({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} className={cn('scroll-mt-20 py-24 md:py-32', className)}>
      <div className="mx-auto max-w-6xl px-6">{children}</div>
    </section>
  )
}

function SectionHeading({ label, title, body }: { label: string; title: ReactNode; body?: ReactNode }) {
  return (
    <Reveal className="mb-14 max-w-3xl">
      <SectionLabel>{label}</SectionLabel>
      <h2 className="text-3xl font-semibold tracking-tight text-balance md:text-5xl">{title}</h2>
      {body && <p className="mt-5 text-lg text-pretty text-muted-foreground">{body}</p>}
    </Reveal>
  )
}

function FeatureCard({
  title,
  body,
  visual,
  className,
  delay = 0,
}: {
  title: string
  body: string
  visual: ReactNode
  className?: string
  delay?: number
}) {
  return (
    <Reveal delay={delay} className={cn('group', className)}>
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border bg-background transition-shadow duration-500 hover:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.18)]">
        <div className="flex flex-1 flex-col justify-center border-b bg-muted/30 p-6">{visual}</div>
        <div className="p-6">
          <h3 className="font-semibold tracking-tight">{title}</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
        </div>
      </div>
    </Reveal>
  )
}

const HEADLINE = ['Test', 'the', 'decision', 'before', 'reality', 'does.']

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const reduce = useReducedMotion()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main>
        {/* ---------------- Hero ---------------- */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-grid mask-radial opacity-70" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-24 md:pt-24">
            <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex justify-center">
              <Link
                to="/docs"
                className="group inline-flex items-center gap-2 rounded-full border bg-background/70 py-1 pr-3 pl-1 text-xs backdrop-blur transition-colors hover:bg-muted"
              >
                <span className="rounded-full bg-foreground px-2 py-0.5 font-medium text-background">New</span>
                Decision intelligence for flood evacuation
                <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>

            <h1 className="mx-auto mt-8 max-w-4xl text-center text-5xl leading-[1.02] font-semibold tracking-tighter text-balance sm:text-6xl md:text-7xl lg:text-8xl">
              {HEADLINE.map((word, i) => (
                <motion.span
                  key={word}
                  className="inline-block"
                  initial={reduce ? false : { opacity: 0, y: 24, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.8, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                >
                  {word}
                  {i < HEADLINE.length - 1 && ' '}
                </motion.span>
              ))}
            </h1>

            <motion.p
              className="mx-auto mt-8 max-w-2xl text-center text-lg text-pretty text-muted-foreground md:text-xl"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.6 }}
            >
              AEGIS-X runs an evacuation plan through hundreds of possible futures, has a Red Team try to break it, and shows the officer in charge
              exactly where it fails — before a single boat is sent.
            </motion.p>

            <motion.div
              className="mt-10 flex flex-wrap justify-center gap-3"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.75 }}
            >
              <Button asChild size="lg" className="h-11 rounded-full px-6">
                <Link to="/demo">
                  Launch the live demo <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 rounded-full px-6">
                <Link to="/docs">
                  <BookOpen /> Read the documentation
                </Link>
              </Button>
            </motion.div>

            {/* hero visual */}
            <motion.div
              className="relative mx-auto mt-20 max-w-5xl"
              initial={reduce ? false : { opacity: 0, y: 40, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="rounded-2xl border bg-background/80 p-2 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)] backdrop-blur">
                <div className="flex items-center justify-between rounded-t-xl border-b px-4 py-3">
                  <div className="hidden items-center gap-2 sm:flex">
                    <span className="size-2.5 rounded-full bg-foreground/15" />
                    <span className="size-2.5 rounded-full bg-foreground/15" />
                    <span className="size-2.5 rounded-full bg-foreground/15" />
                  </div>
                  <p className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
                    plan_a · 46 futures<span className="hidden sm:inline"> · rainfall 20–250 mm</span>
                  </p>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    illustrative
                  </Badge>
                </div>
                <div className="p-4 md:p-8">
                  <FuturesFan className="w-full" />
                </div>
              </div>

              {/* floating findings */}
              <motion.div
                className="absolute -bottom-8 -left-4 hidden w-72 rounded-xl border bg-background p-4 shadow-xl md:block"
                initial={reduce ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 3.2, duration: 0.6 }}
              >
                <div className="flex items-center gap-2 text-xs font-medium">
                  <ShieldAlert className="size-4" /> Red Team finding
                </div>
                <p className="mt-2 font-mono text-xs">bridge_main</p>
                <p className="mt-1 text-xs text-muted-foreground">Single point of failure. Remove it and the outcome drops by 100%.</p>
              </motion.div>
              <motion.div
                className="absolute -top-6 -right-4 hidden w-60 rounded-xl border bg-foreground p-4 text-background shadow-xl md:block"
                initial={reduce ? false : { opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 3.5, duration: 0.6 }}
              >
                <p className="font-mono text-[10px] tracking-wider uppercase opacity-70">Resilience · worst 10%</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">0% → 23%</p>
                <p className="mt-1 text-xs opacity-70">after the Red-Team-guided fix (demo scenario)</p>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ---------------- Stats ---------------- */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-y md:grid-cols-4 md:divide-y-0">
            {[
              { value: <CountUp to={2.9} decimals={1} prefix="~" suffix="s" />, label: 'to simulate 1,000 futures', note: 'measured' },
              { value: <CountUp to={6} />, label: 'analysis engines on one simulate() contract', note: 'built' },
              { value: <CountUp to={100} suffix="%" />, label: 'outcome drop the Red Team found at the bridge', note: 'demo scenario' },
              { value: <CountUp to={23.7} decimals={1} suffix="%" />, label: 'worst-case resilience after the fix, up from 0%', note: 'demo scenario' },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 0.08} className="px-6 py-10">
                <p className="text-4xl font-semibold tracking-tight md:text-5xl">{s.value}</p>
                <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
                <p className="mt-1 font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase">{s.note}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------------- Problem ---------------- */}
        <Section id="problem">
          <SectionHeading
            label="The problem"
            title="Floods don't break plans on an average day. They break them on the worst one."
            body="Collectors, control rooms and rescue commanders decide with forecasts that are ranges, reports that contradict each other and resources that may not show up — and no way to test a plan before lives depend on it."
          />

          <div className="grid gap-4 md:grid-cols-3 md:grid-rows-2">
            <Reveal className="md:col-span-2 md:row-span-2">
              <figure className="group relative h-full min-h-72 overflow-hidden rounded-2xl border">
                <img
                  src="/images/iaf-helicopter-rescue.jpg"
                  alt="Indian Air Force Cheetah helicopter winching a person off a rooftop surrounded by floodwater, Chennai 2015"
                  className="absolute inset-0 size-full object-cover grayscale transition duration-700 group-hover:scale-[1.03] group-hover:grayscale-0"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <figcaption className="absolute bottom-0 p-6 text-white">
                  <p className="font-mono text-[10px] tracking-wider uppercase opacity-70">Chennai · December 2015</p>
                  <p className="mt-1 max-w-md text-lg font-medium">By the time a rooftop rescue is needed, the routes a plan depended on are already gone.</p>
                </figcaption>
              </figure>
            </Reveal>
            <Reveal delay={0.1}>
              <figure className="group relative h-56 overflow-hidden rounded-2xl border md:h-full">
                <img
                  src="/images/army-rescue.jpg"
                  alt="Army personnel evacuating residents by boat through a flooded street, Chennai 2015"
                  className="absolute inset-0 size-full object-cover grayscale transition duration-700 group-hover:scale-[1.03] group-hover:grayscale-0"
                  loading="lazy"
                />
              </figure>
            </Reveal>
            <Reveal delay={0.2}>
              <figure className="group relative h-56 overflow-hidden rounded-2xl border md:h-full">
                <img
                  src="/images/chennai-street.jpg"
                  alt="Residents wading through a waterlogged street in Nandanam, Chennai, December 2015"
                  className="absolute inset-0 size-full object-cover grayscale transition duration-700 group-hover:scale-[1.03] group-hover:grayscale-0"
                  loading="lazy"
                />
              </figure>
            </Reveal>
          </div>

          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {[
              { icon: CloudRainWind, title: 'The future is a range', body: 'A plan that works at 100 mm of rain can collapse at 200 mm. A single forecast hides that cliff.' },
              { icon: Unplug, title: 'Plans hide one weak link', body: 'One bridge, one shelter, one road the plan quietly depends on — usually found only after it fails.' },
              { icon: Clock3, title: 'No time, no second try', body: 'Decisions happen in hours. Mock drills test one fixed scenario a few times a year.' },
            ].map((p, i) => (
              <Reveal key={p.title} delay={i * 0.1}>
                <div className="flex size-10 items-center justify-center rounded-xl border">
                  <p.icon className="size-5" />
                </div>
                <h3 className="mt-4 font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{p.body}</p>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ---------------- Kerala before / after ---------------- */}
        <section className="border-y bg-foreground py-24 text-background md:py-32">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 md:grid-cols-[1fr_1.1fr]">
            <Reveal>
              <p className="mb-4 inline-flex items-center gap-2 font-mono text-xs tracking-widest uppercase opacity-60">
                <span className="size-1.5 rounded-full bg-background" />
                Kerala · August 2018
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-balance md:text-5xl">The same coastline, six months apart.</h2>
              <p className="mt-5 text-lg text-background/70">
                Drag the slider. In the August image, floodwater (dark) covers the low-lying coast. NASA reported 164% more rain than normal in the
                first 20 days of August, and over a million people displaced.
              </p>
              <p className="mt-6 text-sm text-background/60">
                Every one of those evacuations depended on decisions made before anyone knew how high the water would go. That is the gap AEGIS-X is
                built for.
              </p>
              <figure className="mt-8 flex items-center gap-4 rounded-xl border border-background/15 p-3">
                <img src="/images/india-rainfall.jpg" alt="NASA map of accumulated rainfall over India, 19 July to 18 August 2018" className="h-20 w-28 rounded-md object-cover" loading="lazy" />
                <figcaption className="text-xs text-background/60">
                  Satellite-measured rainfall, 19 Jul – 18 Aug 2018. Kerala is the hotspot on the south-west coast.
                  <span className="mt-1 block font-mono text-[10px] opacity-70">NASA Earth Observatory · IMERG / GPM</span>
                </figcaption>
              </figure>
            </Reveal>
            <Reveal delay={0.15}>
              <BeforeAfter
                before="/images/kerala-before.jpg"
                after="/images/kerala-after.jpg"
                beforeLabel="6 Feb 2018"
                afterLabel="22 Aug 2018"
                alt="False-colour satellite view of the Kerala coast"
                className="aspect-[4/5] border-background/15"
              />
              <p className="mt-3 font-mono text-[10px] text-background/50">
                NASA Earth Observatory images by Lauren Dauphin, using Landsat (USGS) and modified Copernicus Sentinel data (ESA).
              </p>
            </Reveal>
          </div>
        </section>

        {/* ---------------- How it works ---------------- */}
        <Section id="how-it-works">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div>
              <SectionHeading
                label="How it works"
                title="One loop. From the first report to the lesson learned."
                body="AEGIS-X doesn't predict one outcome. It explores what could happen, tests how a decision behaves across those futures, and challenges its own recommendation."
              />
              <div className="space-y-6">
                {[
                  { k: '01', t: 'Explore, don’t predict', b: 'Every answer is a distribution of outcomes — never a single number that hides the bad days.' },
                  { k: '02', t: 'Math decides, the LLM explains', b: 'Findings come from simulation. The language model only puts already-computed numbers into words.' },
                  { k: '03', t: 'The human decides', b: 'The system recommends and explains. An authorized officer accepts, edits or rejects — and re-runs in seconds.' },
                ].map((r, i) => (
                  <Reveal key={r.k} delay={i * 0.1} className="flex gap-5">
                    <span className="font-mono text-sm text-muted-foreground">{r.k}</span>
                    <div>
                      <h3 className="font-semibold tracking-tight">{r.t}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{r.b}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
            <Reveal delay={0.1} className="sm:px-12">
              <DecisionLoop />
            </Reveal>
          </div>
        </Section>

        {/* ---------------- Platform bento ---------------- */}
        <Section id="platform" className="border-t bg-muted/20">
          <SectionHeading
            label="Platform"
            title="Seven capabilities. One question: where does this plan fail?"
            body="Each card below is a real module in the codebase, built on a single domain-agnostic simulate() contract."
          />
          <div className="grid gap-4 md:grid-cols-3">
            <FeatureCard
              className="md:col-span-2"
              title="Hundreds of futures, not one forecast"
              body="Monte Carlo sampling over rainfall, resource availability and communication loss. Every plan is judged by its whole distribution."
              visual={<FuturesFan count={28} seed={4} className="w-full" />}
            />
            <FeatureCard
              delay={0.1}
              title="A Red Team that attacks its own plan"
              body="Knockout tests remove each bridge and shelter in turn. The one whose loss collapses the outcome is flagged — on the map."
              visual={<RedTeamGrid />}
            />
            <FeatureCard title="Uncertainty, ranked" body="Which unknown actually moves the outcome? Sensitivity analysis answers before anyone argues about it." visual={<TornadoMini />} />
            <FeatureCard
              delay={0.1}
              title="What to check next"
              body="Expected value of information ranks the missing facts worth sending a drone or a team to verify first."
              visual={<VoiMini />}
            />
            <FeatureCard
              delay={0.2}
              title="Trade-offs, not one answer"
              body="Multi-objective search keeps only Pareto-optimal plans across lives saved, time and resources."
              visual={<ParetoMini />}
            />
            <FeatureCard
              className="md:col-span-2"
              title="Fair comparisons, measured results"
              body="Plans are compared on the identical set of futures. In the demo, the Red Team's finding led to a fix that lifted worst-case resilience from 0% to 23%."
              visual={<CompareMini />}
            />
            <FeatureCard
              delay={0.1}
              title="A human makes the call"
              body="Accept, edit or reject. Edited plans are re-tested immediately, and every recommendation carries its reasons."
              visual={<HumanMini />}
            />
          </div>
        </Section>

        {/* ---------------- Architecture ---------------- */}
        <Section id="architecture">
          <SectionHeading
            label="Architecture"
            title="One engine. Any domain that can answer simulate()."
            body="The core engine never imports flood code. Monte Carlo, Red Team, sensitivity, value of information and optimisation all work through one function — so a new domain is a new module, not a rewrite."
          />
          <Reveal>
            <FlowDiagram {...architectureFlow} />
          </Reveal>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              { icon: Network, t: 'One contract', b: 'simulate(scenario, plan, conditions) → metrics. Everything else is generic.' },
              { icon: Waves, t: 'Swappable domains', b: 'Flood is built end to end. Fire and crowd security already implement the interface.' },
              { icon: ShieldAlert, t: 'Reproducible by design', b: 'Seeded sampling and shared futures: the same inputs always give the same answer.' },
            ].map((f, i) => (
              <Reveal key={f.t} delay={i * 0.1} className="flex gap-4">
                <f.icon className="mt-0.5 size-5 shrink-0" />
                <div>
                  <h3 className="font-semibold tracking-tight">{f.t}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.b}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-10">
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/docs#architecture">
                Explore the full architecture <ArrowUpRight />
              </Link>
            </Button>
          </Reveal>
        </Section>

        {/* ---------------- Domains ---------------- */}
        <Section className="border-t bg-muted/20">
          <SectionHeading label="Domains" title="Built deep for floods. Ready for what comes next." />
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: Waves, name: 'Flood evacuation', status: 'Live', body: 'Rainfall-driven flood rise, real shortest-path routing, capacity-limited rescue over time.', img: '/images/navy-relief.jpg', alt: 'Indian Navy inflatable rescue boat with residents in floodwater, Chennai 2015' },
              { icon: Flame, name: 'Urban fire', status: 'Interface ready', body: 'Fire spread, evacuation routes and firefighting allocation on the same engine.' },
              { icon: Users, name: 'Crowd & event security', status: 'Interface ready', body: 'Density, choke points and unit deployment for large public gatherings.' },
            ].map((d, i) => (
              <Reveal key={d.name} delay={i * 0.1}>
                <div className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-background">
                  <div className="relative h-44 overflow-hidden border-b bg-muted/40">
                    {d.img ? (
                      <img src={d.img} alt={d.alt} className="size-full object-cover grayscale transition duration-700 group-hover:scale-[1.03] group-hover:grayscale-0" loading="lazy" />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-grid">
                        <d.icon className="size-10 text-muted-foreground" strokeWidth={1.25} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold tracking-tight">{d.name}</h3>
                      <Badge variant={d.status === 'Live' ? 'default' : 'outline'}>{d.status}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{d.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ---------------- Demo steps ---------------- */}
        <Section>
          <div className="grid gap-14 lg:grid-cols-[1fr_1.2fr]">
            <SectionHeading
              label="See it work"
              title="Watch a plan fail. Then watch it get fixed."
              body="The live demo runs on the real engine — not a recording. Five minutes, start to finish."
            />
            <ol className="relative space-y-8 border-l pl-8">
              {[
                { t: 'Run the default plan at 100 mm', b: 'Most people get out. The resilience badge looks healthy.' },
                { t: 'Push rainfall to 200 mm', b: 'Evacuation collapses — low-lying localities flood before boats reach them.' },
                { t: 'Press Red Team', b: 'The bridge is flagged as a single point of failure; the sensitivity chart shows rainfall dominates.' },
                { t: 'Reinforce local access roads', b: 'Re-run. Worst-case resilience rises from 0% to 23% across the full range of futures.' },
              ].map((s, i) => (
                <Reveal key={s.t} delay={i * 0.1}>
                  <li className="relative">
                    <span className="absolute top-0 -left-[45px] flex size-7 items-center justify-center rounded-full border bg-background font-mono text-xs">{i + 1}</span>
                    <h3 className="font-semibold tracking-tight">{s.t}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{s.b}</p>
                  </li>
                </Reveal>
              ))}
              <Reveal delay={0.4}>
                <Button asChild className="rounded-full">
                  <Link to="/demo">
                    Open the live demo <ArrowRight />
                  </Link>
                </Button>
              </Reveal>
            </ol>
          </div>
        </Section>

        {/* ---------------- FAQ ---------------- */}
        <Section className="border-t">
          <div className="grid gap-14 lg:grid-cols-[1fr_1.4fr]">
            <SectionHeading label="FAQ" title="Questions we'd ask, too." />
            <Reveal>
              <Accordion type="single" collapsible className="w-full">
                {[
                  { q: 'Does the AI make the decision?', a: 'No. AEGIS-X recommends and explains; an authorized human accepts, edits or rejects every plan. It is decision support, not autonomous control.' },
                  { q: 'Is the Red Team just an LLM giving opinions?', a: 'No. Weak points are found by computation — knockout tests and worst-case attribution over simulated futures. The LLM only phrases findings that were already computed, and never invents one.' },
                  { q: 'Where do the probabilities come from?', a: 'Each uncertain input is a range (for example the forecast spread). Sensitivity analysis then shows whether the recommendation changes if those ranges are wrong.' },
                  { q: 'Is the flood model validated against real events?', a: 'Not yet. The prototype uses a synthetic grid with illustrative constants. Calibrating against a documented event such as Chennai 2015 or Kerala 2018 is on the roadmap, and we say so openly.' },
                  { q: 'Can it run without internet access?', a: 'The simulation engine runs entirely locally. Only the optional plain-language narration calls an external LLM, and it can be swapped for a local model.' },
                ].map((f, i) => (
                  <AccordionItem key={f.q} value={`q${i}`}>
                    <AccordionTrigger className="text-base">{f.q}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Reveal>
          </div>
        </Section>

        {/* ---------------- CTA ---------------- */}
        <section className="px-6 pb-24">
          <Reveal>
            <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-foreground px-6 py-20 text-center text-background md:py-28">
              <div className="pointer-events-none absolute inset-0 opacity-[0.07] mask-radial [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:48px_48px]" aria-hidden />
              <h2 className="relative mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
                See the plan fail before reality shows you how.
              </h2>
              <div className="relative mt-10 flex flex-wrap justify-center gap-3">
                <Button asChild size="lg" variant="secondary" className="h-11 rounded-full px-6">
                  <Link to="/demo">
                    Launch the live demo <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="ghost" className="h-11 rounded-full px-6 text-background hover:bg-background/10 hover:text-background">
                  <Link to="/docs">Read the documentation</Link>
                </Button>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
