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
  MousePointer2,
  Network,
  ShieldAlert,
  ShieldCheck,
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
import { ScenarioChart } from '@/components/visuals/ScenarioChart'
import { DecisionLoop } from '@/components/visuals/DecisionLoop'
import { BeforeAfter } from '@/components/visuals/BeforeAfter'
import { FlowDiagram } from '@/components/visuals/FlowDiagram'
import { CaseStudies } from '@/components/visuals/CaseStudies'
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

function SectionHeading({ label, title, body, className }: { label: string; title: ReactNode; body?: ReactNode; className?: string }) {
  return (
    <Reveal className={cn('mb-14 max-w-3xl', className)}>
      <SectionLabel>{label}</SectionLabel>
      <h2 className="text-3xl font-semibold tracking-tight text-balance md:text-5xl">{title}</h2>
      {body && <p className="mt-5 text-lg text-pretty text-muted-foreground">{body}</p>}
    </Reveal>
  )
}

function Gradient({ children }: { children: ReactNode }) {
  return <span className="bg-gradient-to-r from-primary via-blue-500 to-flood bg-clip-text text-transparent">{children}</span>
}

function FeatureCard({
  title,
  body,
  visual,
  className,
  delay = 0,
  tint = 'from-primary/10',
}: {
  title: string
  body: string
  visual: ReactNode
  className?: string
  delay?: number
  tint?: string
}) {
  return (
    <Reveal delay={delay} className={cn('group', className)}>
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_20px_50px_-20px_rgba(37,99,235,0.35)]">
        <div className={cn('flex flex-1 flex-col justify-center border-b bg-gradient-to-br to-transparent p-6', tint)}>{visual}</div>
        <div className="p-6">
          <h3 className="font-semibold tracking-tight">{title}</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
        </div>
      </div>
    </Reveal>
  )
}

function Photo({ src, alt, className, caption }: { src: string; alt: string; className?: string; caption?: ReactNode }) {
  return (
    <figure className={cn('group relative overflow-hidden rounded-2xl border', className)}>
      <img src={src} alt={alt} className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-[1.04]" loading="lazy" />
      {caption && (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />
          <figcaption className="absolute bottom-0 p-5 text-white">{caption}</figcaption>
        </>
      )}
    </figure>
  )
}

const HEADLINE_A = ['Test', 'the', 'decision']
const HEADLINE_B = ['before', 'reality', 'does.']

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const reduce = useReducedMotion()
  const word = (i: number) => ({
    initial: reduce ? false : { opacity: 0, y: 24, filter: 'blur(10px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.8, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] as const },
  })

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main>
        {/* ---------------- Hero ---------------- */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute -top-40 left-1/2 size-[640px] -translate-x-[85%] rounded-full bg-primary/25 blur-[120px]" />
            <div className="absolute -top-24 left-1/2 size-[560px] translate-x-[5%] rounded-full bg-flood/30 blur-[120px]" />
            <div className="absolute top-[520px] left-1/2 size-[520px] -translate-x-1/2 rounded-full bg-violet-400/15 blur-[120px]" />
            <div className="absolute inset-0 bg-grid mask-radial opacity-60" />
          </div>

          <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-24 md:pt-24">
            <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex justify-center">
              <Link
                to="/docs"
                className="group inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/70 py-1 pr-3 pl-1 text-xs shadow-sm backdrop-blur transition-colors hover:bg-accent"
              >
                <span className="rounded-full bg-gradient-to-r from-primary to-flood px-2 py-0.5 font-medium text-white">New</span>
                Decision intelligence for flood evacuation
                <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>

            <h1 className="mx-auto mt-8 max-w-4xl text-center text-5xl leading-[1.02] font-semibold tracking-tighter text-balance sm:text-6xl md:text-7xl lg:text-8xl">
              {HEADLINE_A.map((w, i) => (
                <motion.span key={w} className="inline-block" {...word(i)}>
                  {w}&nbsp;
                </motion.span>
              ))}
              <br className="hidden sm:block" />
              {HEADLINE_B.map((w, i) => (
                <motion.span key={w} className="inline-block" {...word(i + 3)}>
                  <Gradient>{w}</Gradient>
                  {i < HEADLINE_B.length - 1 && ' '}
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
              <Button asChild size="lg" className="h-11 rounded-full bg-gradient-to-r from-primary to-blue-600 px-6 shadow-lg shadow-primary/30 hover:opacity-95">
                <Link to="/demo">
                  Launch the live demo <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 rounded-full bg-background/70 px-6 backdrop-blur">
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
              <div className="rounded-2xl border bg-card/90 p-2 shadow-[0_40px_100px_-40px_rgba(30,64,175,0.55)] backdrop-blur">
                <div className="flex items-center justify-between gap-3 rounded-t-xl border-b px-4 py-3">
                  <div className="hidden items-center gap-2 sm:flex">
                    <span className="size-2.5 rounded-full bg-risk/70" />
                    <span className="size-2.5 rounded-full bg-warn/80" />
                    <span className="size-2.5 rounded-full bg-safe/80" />
                  </div>
                  <p className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
                    plan_a · 60 simulated futures<span className="hidden sm:inline"> · hover the chart to inspect any hour</span>
                  </p>
                  <Badge variant="outline" className="shrink-0 gap-1 font-mono text-[10px]">
                    <MousePointer2 className="size-3" /> illustrative
                  </Badge>
                </div>
                <div className="p-3 md:p-6">
                  <ScenarioChart />
                </div>
              </div>

              {/* floating findings */}
              <motion.div
                className="absolute -top-20 -left-6 hidden w-72 rounded-xl border border-risk/25 bg-card p-4 shadow-xl md:block"
                initial={reduce ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 3.2, duration: 0.6 }}
              >
                <div className="flex items-center gap-2 text-xs font-medium text-risk">
                  <ShieldAlert className="size-4" /> Red Team finding
                </div>
                <p className="mt-2 font-mono text-xs">bridge_main</p>
                <p className="mt-1 text-xs text-muted-foreground">Single point of failure. Remove it and the outcome drops by 100%.</p>
              </motion.div>
              <motion.div
                className="absolute -right-6 -bottom-10 hidden w-60 rounded-xl bg-gradient-to-br from-primary to-blue-800 p-4 text-white shadow-xl shadow-primary/30 md:block"
                initial={reduce ? false : { opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 3.5, duration: 0.6 }}
              >
                <p className="font-mono text-[10px] tracking-wider uppercase opacity-75">Resilience · worst 10%</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">
                  0% → <span className="text-emerald-300">23.7%</span>
                </p>
                <p className="mt-1 text-xs opacity-75">after the Red-Team-guided fix (demo scenario)</p>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ---------------- Stats ---------------- */}
        <section className="border-y bg-gradient-to-r from-primary/[0.04] via-flood/[0.06] to-safe/[0.04]">
          <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-y md:grid-cols-4 md:divide-y-0">
            {[
              { value: <CountUp to={2.9} decimals={1} prefix="~" suffix="s" />, label: 'to simulate 1,000 futures', note: 'measured', tone: 'text-primary' },
              { value: <CountUp to={6} />, label: 'analysis engines on one simulate() contract', note: 'built', tone: 'text-flood' },
              { value: <CountUp to={100} suffix="%" />, label: 'outcome drop the Red Team found at the bridge', note: 'demo scenario', tone: 'text-risk' },
              { value: <CountUp to={23.7} decimals={1} suffix="%" />, label: 'worst-case resilience after the fix, up from 0%', note: 'demo scenario', tone: 'text-safe' },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 0.08} className="px-6 py-10">
                <p className={cn('text-4xl font-semibold tracking-tight md:text-5xl', s.tone)}>{s.value}</p>
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
            title={
              <>
                Floods don't break plans on an average day. They break them on the <span className="text-risk">worst one.</span>
              </>
            }
            body="Collectors, control rooms and rescue commanders decide with forecasts that are ranges, reports that contradict each other and resources that may not show up — and no way to test a plan before lives depend on it."
          />

          <div className="grid auto-rows-[180px] gap-4 md:grid-cols-4 md:auto-rows-[200px]">
            <Reveal className="row-span-2 md:col-span-2">
              <Photo
                src="/images/iaf-helicopter-rescue.jpg"
                alt="Indian Air Force Cheetah helicopter winching a person off a rooftop surrounded by floodwater, Chennai 2015"
                className="h-full"
                caption={
                  <>
                    <p className="font-mono text-[10px] tracking-wider text-sky-200 uppercase">Chennai · December 2015</p>
                    <p className="mt-1 max-w-md text-lg font-medium">By the time a rooftop rescue is needed, the routes a plan depended on are already gone.</p>
                  </>
                }
              />
            </Reveal>
            <Reveal delay={0.05}>
              <Photo src="/images/army-rescue.jpg" alt="Army personnel evacuating residents by boat, Chennai 2015" className="h-full" caption={<p className="text-xs font-medium">Boat evacuation · Chennai</p>} />
            </Reveal>
            <Reveal delay={0.1}>
              <Photo src="/images/assam-dibrugarh.jpg" alt="Flooded market street in Dibrugarh, Assam, August 2015" className="h-full" caption={<p className="text-xs font-medium">Market street · Dibrugarh, Assam</p>} />
            </Reveal>
            <Reveal delay={0.15}>
              <Photo src="/images/chennai-street.jpg" alt="Residents wading through a waterlogged street in Nandanam, Chennai" className="h-full" caption={<p className="text-xs font-medium">Waterlogged road · Chennai</p>} />
            </Reveal>
            <Reveal delay={0.2}>
              <Photo src="/images/assam-village.jpg" alt="Floodwater around houses in a village in Karimganj district, Assam, June 2024" className="h-full" caption={<p className="text-xs font-medium">Village · Karimganj, Assam</p>} />
            </Reveal>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              { icon: CloudRainWind, tone: 'bg-flood/12 text-flood', title: 'The future is a range', body: 'A plan that works at 100 mm of rain can collapse at 200 mm. A single forecast hides that cliff.' },
              { icon: Unplug, tone: 'bg-risk/10 text-risk', title: 'Plans hide one weak link', body: 'One bridge, one shelter, one road the plan quietly depends on — usually found only after it fails.' },
              { icon: Clock3, tone: 'bg-warn/15 text-amber-600', title: 'No time, no second try', body: 'Decisions happen in hours. Mock drills test one fixed scenario a few times a year.' },
            ].map((p, i) => (
              <Reveal key={p.title} delay={i * 0.1} className="rounded-2xl border bg-card p-6">
                <div className={cn('flex size-11 items-center justify-center rounded-xl', p.tone)}>
                  <p.icon className="size-5" />
                </div>
                <h3 className="mt-4 font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{p.body}</p>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ---------------- Kerala before / after ---------------- */}
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 py-24 text-white md:py-32">
          <div className="pointer-events-none absolute -top-32 right-0 size-[520px] rounded-full bg-flood/20 blur-[120px]" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 md:grid-cols-[1fr_1.1fr]">
            <Reveal>
              <p className="mb-4 inline-flex items-center gap-2 font-mono text-xs tracking-widest text-sky-300 uppercase">
                <span className="size-1.5 rounded-full bg-sky-300" />
                Kerala · August 2018
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-balance md:text-5xl">The same coastline, six months apart.</h2>
              <p className="mt-5 text-lg text-white/75">
                Drag the slider. In the August image, floodwater (dark blue) spreads across the low-lying coast. NASA reported{' '}
                <span className="font-semibold text-sky-300">164% more rain</span> than normal in the first 20 days of August, and{' '}
                <span className="font-semibold text-rose-300">over a million people displaced</span>.
              </p>
              <p className="mt-6 text-sm text-white/60">
                Every one of those evacuations depended on decisions made before anyone knew how high the water would go. That is the gap AEGIS-X is
                built for.
              </p>
              <figure className="mt-8 flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur">
                <img src="/images/india-rainfall.jpg" alt="NASA map of accumulated rainfall over India, 19 July to 18 August 2018" className="h-20 w-28 rounded-md object-cover" loading="lazy" />
                <figcaption className="text-xs text-white/70">
                  Satellite-measured rainfall, 19 Jul – 18 Aug 2018. Kerala is the red hotspot on the south-west coast.
                  <span className="mt-1 block font-mono text-[10px] text-white/50">NASA Earth Observatory · IMERG / GPM</span>
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
                className="aspect-[4/5] border-white/15 shadow-2xl shadow-black/40"
              />
              <p className="mt-3 font-mono text-[10px] text-white/45">
                NASA Earth Observatory images by Lauren Dauphin, using Landsat (USGS) and modified Copernicus Sentinel data (ESA).
              </p>
            </Reveal>
          </div>
        </section>

        {/* ---------------- Case studies ---------------- */}
        <Section id="case-studies">
          <SectionHeading
            label="Case studies"
            title={
              <>
                Real floods. <Gradient>Real decisions.</Gradient>
              </>
            }
            body="Four Indian floods, four different ways a plan can fail. Figures come straight from NASA, the IFRC and UNICEF — and each shows the question AEGIS-X is built to answer before the water arrives."
          />
          <Reveal>
            <CaseStudies />
          </Reveal>
        </Section>

        {/* ---------------- How it works ---------------- */}
        <Section id="how-it-works" className="border-t bg-gradient-to-b from-accent/40 to-transparent">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div>
              <SectionHeading
                label="How it works"
                title="One loop. From the first report to the lesson learned."
                body="AEGIS-X doesn't predict one outcome. It explores what could happen, tests how a decision behaves across those futures, and challenges its own recommendation."
              />
              <div className="space-y-6">
                {[
                  { k: '01', tone: 'bg-flood/15 text-flood', t: 'Explore, don’t predict', b: 'Every answer is a distribution of outcomes — never a single number that hides the bad days.' },
                  { k: '02', tone: 'bg-primary/12 text-primary', t: 'Math decides, the LLM explains', b: 'Findings come from simulation. The language model only puts already-computed numbers into words.' },
                  { k: '03', tone: 'bg-safe/15 text-safe', t: 'The human decides', b: 'The system recommends and explains. An authorized officer accepts, edits or rejects — and re-runs in seconds.' },
                ].map((r, i) => (
                  <Reveal key={r.k} delay={i * 0.1} className="flex gap-4">
                    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-semibold', r.tone)}>{r.k}</span>
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
        <Section id="platform" className="border-t">
          <SectionHeading
            label="Platform"
            title={
              <>
                Seven capabilities. One question: <span className="text-risk">where does this plan fail?</span>
              </>
            }
            body="Each card below is a real module in the codebase, built on a single domain-agnostic simulate() contract."
          />
          <div className="grid gap-4 md:grid-cols-3">
            <FeatureCard
              className="md:col-span-2"
              tint="from-primary/10"
              title="Hundreds of futures, not one forecast"
              body="Monte Carlo sampling over rainfall, resource availability and communication loss. Every plan is judged by its whole distribution."
              visual={<ScenarioChart compact count={40} seed={7} />}
            />
            <FeatureCard
              delay={0.1}
              tint="from-risk/10"
              title="A Red Team that attacks its own plan"
              body="Knockout tests remove each bridge and shelter in turn. The one whose loss collapses the outcome is flagged — on the map."
              visual={<RedTeamGrid />}
            />
            <FeatureCard tint="from-violet-500/10" title="Uncertainty, ranked" body="Which unknown actually moves the outcome? Sensitivity analysis answers before anyone argues about it." visual={<TornadoMini />} />
            <FeatureCard
              delay={0.1}
              tint="from-flood/12"
              title="What to check next"
              body="Expected value of information ranks the missing facts worth sending a drone or a team to verify first."
              visual={<VoiMini />}
            />
            <FeatureCard
              delay={0.2}
              tint="from-safe/12"
              title="Trade-offs, not one answer"
              body="Multi-objective search keeps only Pareto-optimal plans across lives saved, time and resources."
              visual={<ParetoMini />}
            />
            <FeatureCard
              className="md:col-span-2"
              tint="from-safe/10"
              title="Fair comparisons, measured results"
              body="Plans are compared on the identical set of futures. In the demo, the Red Team's finding led to a fix that lifted worst-case resilience from 0% to 23.7%."
              visual={<CompareMini />}
            />
            <FeatureCard
              delay={0.1}
              tint="from-primary/10"
              title="A human makes the call"
              body="Accept, edit or reject. Edited plans are re-tested immediately, and every recommendation carries its reasons."
              visual={<HumanMini />}
            />
          </div>
        </Section>

        {/* ---------------- Architecture ---------------- */}
        <Section id="architecture" className="border-t bg-gradient-to-b from-accent/30 to-transparent">
          <SectionHeading
            label="Architecture"
            title={
              <>
                One engine. Any domain that can answer <span className="font-mono text-primary">simulate()</span>.
              </>
            }
            body="The core engine never imports flood code. Monte Carlo, Red Team, sensitivity, value of information and optimisation all work through one function — so a new domain is a new module, not a rewrite."
          />
          <Reveal>
            <FlowDiagram {...architectureFlow} />
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { icon: Network, tone: 'bg-primary/12 text-primary', t: 'One contract', b: 'simulate(scenario, plan, conditions) → metrics. Everything else is generic.' },
              { icon: Waves, tone: 'bg-flood/15 text-flood', t: 'Swappable domains', b: 'Flood is built end to end. Fire and crowd security already implement the interface.' },
              { icon: ShieldCheck, tone: 'bg-safe/15 text-safe', t: 'Reproducible by design', b: 'Seeded sampling and shared futures: the same inputs always give the same answer.' },
            ].map((f, i) => (
              <Reveal key={f.t} delay={i * 0.1} className="flex gap-4">
                <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', f.tone)}>
                  <f.icon className="size-5" />
                </span>
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
        <Section className="border-t">
          <SectionHeading label="Domains" title="Built deep for floods. Ready for what comes next." />
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Waves,
                name: 'Flood evacuation',
                status: 'Live',
                body: 'Rainfall-driven flood rise, real shortest-path routing, capacity-limited rescue over time.',
                img: '/images/navy-relief.jpg',
                alt: 'Indian Navy inflatable rescue boat with residents in floodwater, Chennai 2015',
                tone: '',
              },
              { icon: Flame, name: 'Urban fire', status: 'Interface ready', body: 'Fire spread, evacuation routes and firefighting allocation on the same engine.', tone: 'from-orange-400/25 via-rose-400/15 to-transparent text-orange-500' },
              { icon: Users, name: 'Crowd & event security', status: 'Interface ready', body: 'Density, choke points and unit deployment for large public gatherings.', tone: 'from-violet-400/25 via-primary/15 to-transparent text-violet-500' },
            ].map((d, i) => (
              <Reveal key={d.name} delay={i * 0.1}>
                <div className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-all duration-500 hover:-translate-y-1 hover:shadow-xl">
                  <div className="relative h-44 overflow-hidden border-b">
                    {d.img ? (
                      <img src={d.img} alt={d.alt} className="size-full object-cover transition duration-700 group-hover:scale-[1.04]" loading="lazy" />
                    ) : (
                      <div className={cn('flex size-full items-center justify-center bg-gradient-to-br', d.tone)}>
                        <d.icon className="size-12" strokeWidth={1.25} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold tracking-tight">{d.name}</h3>
                      <Badge className={d.status === 'Live' ? 'bg-safe text-white' : ''} variant={d.status === 'Live' ? 'default' : 'outline'}>
                        {d.status}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{d.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ---------------- Demo steps ---------------- */}
        <Section className="border-t bg-gradient-to-b from-accent/30 to-transparent">
          <div className="grid gap-14 lg:grid-cols-[1fr_1.2fr]">
            <SectionHeading
              label="See it work"
              title="Watch a plan fail. Then watch it get fixed."
              body="The live demo runs on the real engine — not a recording. Five minutes, start to finish."
            />
            <ol className="relative space-y-8 border-l-2 border-dashed border-primary/25 pl-8">
              {[
                { t: 'Run the default plan at 100 mm', b: 'Most people get out. The resilience badge looks healthy.', tone: 'bg-flood text-white' },
                { t: 'Push rainfall to 200 mm', b: 'Evacuation collapses — low-lying localities flood before boats reach them.', tone: 'bg-risk text-white' },
                { t: 'Press Red Team', b: 'The bridge is flagged as a single point of failure; the sensitivity chart shows rainfall dominates.', tone: 'bg-primary text-white' },
                { t: 'Reinforce local access roads', b: 'Re-run. Worst-case resilience rises from 0% to 23.7% across the full range of futures.', tone: 'bg-safe text-white' },
              ].map((s, i) => (
                <Reveal key={s.t} delay={i * 0.1}>
                  <li className="relative">
                    <span className={cn('absolute top-0 -left-[49px] flex size-8 items-center justify-center rounded-full font-mono text-xs font-semibold shadow-md', s.tone)}>{i + 1}</span>
                    <h3 className="font-semibold tracking-tight">{s.t}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{s.b}</p>
                  </li>
                </Reveal>
              ))}
              <Reveal delay={0.4}>
                <Button asChild className="rounded-full shadow-lg shadow-primary/25">
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
                  { q: 'Is the flood model validated against real events?', a: 'Not yet. The prototype uses a synthetic grid with illustrative constants. The case studies above show the kind of decisions it targets; calibrating against a documented event such as Chennai 2015 or Kerala 2018 is on the roadmap.' },
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
            <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-blue-700 to-slate-900 px-6 py-20 text-center text-white shadow-2xl shadow-primary/30 md:py-28">
              <div className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-flood/40 blur-[100px]" aria-hidden />
              <div className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-violet-500/30 blur-[100px]" aria-hidden />
              <div className="pointer-events-none absolute inset-0 opacity-[0.08] mask-radial [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:48px_48px]" aria-hidden />
              <h2 className="relative mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
                See the plan fail before reality shows you how.
              </h2>
              <div className="relative mt-10 flex flex-wrap justify-center gap-3">
                <Button asChild size="lg" className="h-11 rounded-full bg-white px-6 text-primary hover:bg-white/90">
                  <Link to="/demo">
                    Launch the live demo <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="ghost" className="h-11 rounded-full border border-white/30 px-6 text-white hover:bg-white/10 hover:text-white">
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
