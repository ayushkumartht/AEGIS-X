import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useSpring } from 'motion/react'
import {
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Boxes,
  ChevronDown,
  CircleCheck,
  Clock3,
  CloudRainWind,
  Gauge,
  HelpCircle,
  MessageSquareWarning,
  Radio,
  Search,
  Ship,
  Target,
  Unplug,
} from 'lucide-react'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Callout, Code, CodeBlock, DataTable, DocH2, DocH3, Figure, List, P } from '@/components/docs/DocPrimitives'
import { FlowDiagram } from '@/components/visuals/FlowDiagram'
import { DecisionLoop } from '@/components/visuals/DecisionLoop'
import { BeforeAfter } from '@/components/visuals/BeforeAfter'
import { architectureFlow, floodSimFlow, monteCarloFlow, redTeamFlow, requestFlow, voiFlow } from '@/content/flows'
import { IMAGE_CREDITS } from '@/content/credits'
import { CASE_STUDIES } from '@/content/caseStudies'
import { cn } from '@/lib/utils'

const NAV = [
  {
    group: 'Start here',
    items: [
      { id: 'overview', label: 'AEGIS-X in 60 seconds' },
      { id: 'quickstart', label: 'Run it locally' },
    ],
  },
  {
    group: 'The problem',
    items: [
      { id: 'problem', label: 'In one sentence' },
      { id: 'story', label: 'A night in the control room' },
      { id: 'why-hard', label: 'Why it is hard' },
      { id: 'gaps', label: "What's missing today" },
      { id: 'questions', label: 'The 10 questions we answer' },
    ],
  },
  {
    group: 'Real events',
    items: [{ id: 'case-studies', label: 'Case studies' }],
  },
  {
    group: 'The solution',
    items: [
      { id: 'solution', label: 'Core idea' },
      { id: 'decision-loop', label: 'Decision loop' },
      { id: 'mapping', label: 'Question → technique' },
    ],
  },
  {
    group: 'Architecture',
    items: [
      { id: 'architecture', label: 'System architecture' },
      { id: 'request-lifecycle', label: 'Request lifecycle' },
      { id: 'project-structure', label: 'Project structure' },
      { id: 'domain-contract', label: 'The domain contract' },
    ],
  },
  {
    group: 'Engine',
    items: [
      { id: 'flood-model', label: 'Flood simulation' },
      { id: 'monte-carlo', label: 'Monte Carlo' },
      { id: 'red-team', label: 'Red Team' },
      { id: 'sensitivity', label: 'Sensitivity' },
      { id: 'voi', label: 'Value of information' },
      { id: 'optimizer', label: 'Optimizer' },
    ],
  },
  {
    group: 'Results',
    items: [
      { id: 'findings', label: 'Measured findings' },
      { id: 'demo-walkthrough', label: 'Demo walkthrough' },
    ],
  },
  {
    group: 'Reference',
    items: [
      { id: 'api', label: 'API reference' },
      { id: 'glossary', label: 'Glossary' },
      { id: 'tech-stack', label: 'Tech stack' },
      { id: 'limitations', label: 'Limitations' },
      { id: 'roadmap', label: 'Roadmap' },
      { id: 'credits', label: 'Image credits' },
    ],
  },
]

const ALL_IDS = NAV.flatMap((g) => g.items.map((i) => i.id))

/** Highlights whichever section heading was most recently scrolled past. */
function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState(ids[0])
  useEffect(() => {
    const onScroll = () => {
      let current = ids[0]
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top < 140) current = id
      }
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [ids])
  return active
}

function SidebarNav({ active, onNavigate }: { active: string; onNavigate?: () => void }) {
  const [query, setQuery] = useState('')
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return NAV
    return NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q) || g.group.toLowerCase().includes(q)) })).filter(
      (g) => g.items.length > 0,
    )
  }, [query])

  return (
    <div className="space-y-6">
      <label className="relative block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the docs…"
          className="h-9 w-full rounded-lg border bg-background pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
        />
      </label>
      <nav className="space-y-6 text-sm">
        {groups.length === 0 && <p className="text-muted-foreground">No section matches “{query}”.</p>}
        {groups.map((g) => (
          <div key={g.group}>
            <p className="mb-2 text-xs font-semibold tracking-wide text-foreground uppercase">{g.group}</p>
            <ul className="space-y-0.5 border-l">
              {g.items.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={onNavigate}
                    className={cn(
                      '-ml-px block border-l-2 py-1 pl-4 transition-colors',
                      active === item.id ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  )
}

const SUMMARY = [
  {
    icon: MessageSquareWarning,
    tone: 'bg-risk/10 text-risk',
    title: 'The problem',
    body: 'Flood plans are made for one forecast, then break on the bad day nobody tested.',
    href: '#problem',
  },
  {
    icon: Boxes,
    tone: 'bg-primary/10 text-primary',
    title: 'The solution',
    body: 'Run the plan through hundreds of futures, let a Red Team attack it, show where it fails.',
    href: '#solution',
  },
  {
    icon: Gauge,
    tone: 'bg-flood/15 text-flood',
    title: 'How fast',
    body: '1,000 simulated futures in about 2.9 seconds — fast enough to re-check as conditions change.',
    href: '#findings',
  },
  {
    icon: CircleCheck,
    tone: 'bg-safe/15 text-safe',
    title: 'Who decides',
    body: 'Always a human. AEGIS-X recommends and explains; the officer accepts, edits or rejects.',
    href: '#decision-loop',
  },
]

const STORY = [
  { time: '18:00', icon: CloudRainWind, tone: 'bg-flood text-white', text: 'Forecast for the next 12 hours: 80 to 250 mm of rain. That range is the whole problem.' },
  { time: '20:00', icon: Radio, tone: 'bg-warn text-white', text: 'Control room says the main bridge is open. A field team says it is under water. Which one is right?' },
  { time: '22:00', icon: Ship, tone: 'bg-violet-500 text-white', text: 'Only 8 of the 12 boats on paper actually reach their positions.' },
  { time: '23:30', icon: Unplug, tone: 'bg-risk text-white', text: 'Two localities can only be reached across that one bridge — something the plan never said out loud.' },
  { time: '00:00', icon: Target, tone: 'bg-primary text-white', text: 'The Collector must commit to a plan now, with no way to test it first.' },
]

const HARD = [
  { icon: CloudRainWind, tone: 'bg-flood/15 text-flood', t: 'The future is a range', b: 'A plan that works at 100 mm can fail completely at 200 mm.' },
  { icon: Clock3, tone: 'bg-warn/20 text-amber-600', t: 'Things change by the hour', b: 'A safe road at 6 PM can be cut off by 8 PM.' },
  { icon: MessageSquareWarning, tone: 'bg-violet-500/15 text-violet-600', t: 'Reports disagree', b: '“Bridge open” and “bridge under water” can arrive together.' },
  { icon: Ship, tone: 'bg-primary/10 text-primary', t: 'Resources don’t show up', b: 'Boats on paper are not always boats in the water.' },
  { icon: Radio, tone: 'bg-slate-500/15 text-slate-600', t: 'Comms break down', b: 'Power cuts and damaged towers delay every order.' },
  { icon: Unplug, tone: 'bg-risk/10 text-risk', t: 'Plans hide weak links', b: 'One bridge or shelter can silently carry the whole plan.' },
]

const QUESTIONS = [
  { q: 'Which report should I trust?', a: 'Each source gets a reliability score; conflicting reports are combined, not guessed.', status: 'planned' },
  { q: 'What could actually happen?', a: 'Hundreds of simulated futures, shown as a range — never one number.', status: 'built' },
  { q: 'Is Plan B really better than Plan A?', a: 'Both are tested on exactly the same futures, so the comparison is fair.', status: 'built' },
  { q: 'Where will my plan break?', a: 'The Red Team removes each bridge and shelter in turn and flags what collapses it.', status: 'built' },
  { q: 'Which unknown matters most?', a: 'Sensitivity analysis ranks rainfall, resources and comms by impact.', status: 'built' },
  { q: 'What should I check first?', a: 'Value of information ranks the missing facts worth verifying.', status: 'built' },
  { q: 'Lives vs time vs resources?', a: 'Only Pareto-optimal plans are shown, with the trade-offs visible.', status: 'built' },
  { q: 'Can I re-check quickly?', a: '1,000 futures in about 2.9 seconds; move a slider and re-run.', status: 'built' },
  { q: 'Am I still in control?', a: 'Yes. Every recommendation comes with reasons you can accept, edit or reject.', status: 'partial' },
  { q: 'Will we learn from this flood?', a: 'Predictions get compared with what actually happened, to recalibrate.', status: 'planned' },
]

const GLOSSARY = [
  ['Future', 'One possible way things could turn out — e.g. 180 mm of rain, 70% of boats available, 20% comms loss.'],
  ['Plan', 'The decision being tested: boats per shelter, evacuation order, roads to reinforce.'],
  ['Monte Carlo', 'Running the same plan through many randomly drawn futures to see the full range of outcomes.'],
  ['Median (p50)', 'The middle outcome: half the futures did better, half did worse.'],
  ['p10 / p90', 'The outcome that 10% of futures fell below / 90% fell below — the edges of the likely range.'],
  ['Resilience', 'The average outcome in the worst 10% of futures. High resilience = the plan still works on bad days.'],
  ['Single point of failure', 'One bridge, shelter or resource whose loss brings the whole plan down.'],
  ['Red Team', 'An engine whose only job is to find how a plan fails — by computation, not opinion.'],
  ['Sensitivity', 'How much each uncertain input moves the outcome.'],
  ['Value of information', 'How much better the decision gets if you learn something you don’t know yet.'],
  ['Pareto-optimal', 'A plan where you cannot improve one goal without making another worse.'],
]

export default function DocumentationPage() {
  const active = useScrollSpy(ALL_IDS)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const activeGroup = NAV.find((g) => g.items.some((i) => i.id === active))
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })
  const [showTop, setShowTop] = useState(false)

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 1200)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <motion.div className="fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-gradient-to-r from-primary via-flood to-safe" style={{ scaleX: progress }} />
      <SiteHeader />

      {/* mobile section picker */}
      <div className="sticky top-16 z-40 border-b bg-background/90 backdrop-blur lg:hidden">
        <button type="button" onClick={() => setMobileNavOpen((o) => !o)} className="flex w-full items-center justify-between px-6 py-3 text-sm" aria-expanded={mobileNavOpen}>
          <span className="text-muted-foreground">
            {activeGroup?.group} / <span className="text-primary">{activeGroup?.items.find((i) => i.id === active)?.label}</span>
          </span>
          <ChevronDown className={cn('size-4 transition-transform', mobileNavOpen && 'rotate-180')} />
        </button>
        {mobileNavOpen && (
          <div className="max-h-[65vh] overflow-y-auto border-t px-6 py-5">
            <SidebarNav active={active} onNavigate={() => setMobileNavOpen(false)} />
          </div>
        )}
      </div>

      <div className="mx-auto flex max-w-7xl gap-10 px-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto py-10 pr-2">
            <SidebarNav active={active} />
          </div>
        </aside>

        <main className="min-w-0 flex-1 py-10 md:py-14">
          <div className="max-w-3xl">
            {/* ===================== Start here ===================== */}
            <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-flood/10 to-safe/10 p-8 md:p-10">
              <div className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-flood/25 blur-3xl" aria-hidden />
              <p className="relative inline-flex items-center gap-2 font-mono text-xs font-medium tracking-widest text-primary uppercase">
                <BookOpen className="size-3.5" /> Documentation
              </p>
              <h1 className="relative mt-3 text-4xl font-semibold tracking-tight text-balance md:text-5xl">
                AEGIS-X, explained <span className="bg-gradient-to-r from-primary to-flood bg-clip-text text-transparent">simply.</span>
              </h1>
              <p className="relative mt-4 max-w-2xl text-lg text-muted-foreground">
                What problem we solve, how the platform works, what we have measured — and what is not built yet. Start with the 60-second summary,
                or jump to any section on the left.
              </p>
            </div>

            <DocH2 id="overview" kicker="Start here">
              AEGIS-X in 60 seconds
            </DocH2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {SUMMARY.map((s) => (
                <a key={s.title} href={s.href} className="group rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10">
                  <span className={cn('flex size-10 items-center justify-center rounded-xl', s.tone)}>
                    <s.icon className="size-5" />
                  </span>
                  <p className="mt-4 font-semibold">{s.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Read more <ArrowRight className="size-3" />
                  </span>
                </a>
              ))}
            </div>
            <Callout title="Decision support, not autonomy">
              AEGIS-X never acts on its own. It recommends and explains; an authorized human accepts, edits or rejects every plan.
            </Callout>

            <DocH2 id="quickstart" kicker="Start here">
              Run it locally
            </DocH2>
            <P>Two terminals: one for the engine API, one for the web app. The landing page and these docs work without the API; the live demo needs both.</P>
            <CodeBlock
              title="1 · backend (PowerShell)"
              code={`python -m venv .venv
.\\.venv\\Scripts\\pip install -r requirements.txt
.\\.venv\\Scripts\\pytest tests/ -v          # 7 smoke tests
.\\.venv\\Scripts\\python.exe -m uvicorn api.main:app --port 8000 --reload`}
            />
            <CodeBlock
              title="2 · frontend"
              code={`cd frontend
npm install
npm run dev    # http://localhost:5173`}
            />
            <Callout tone="tip">
              Optional: copy <Code>.env.example</Code> to <Code>.env</Code> and set <Code>GROQ_API_KEY</Code> to turn on plain-language narration of Red
              Team findings. Without it, <Code>/flood/explain</Code> returns a clear 503 and everything else still works.
            </Callout>

            {/* ===================== Problem ===================== */}
            <DocH2 id="problem" kicker="The problem">
              In one sentence
            </DocH2>
            <blockquote className="mt-6 rounded-2xl border-l-4 border-risk bg-risk/5 p-6 text-xl leading-relaxed font-medium text-pretty">
              During a flood, officers must pick an evacuation plan <span className="text-risk">before</span> they know how bad it will get — and today
              there is no way to test that plan before lives depend on it.
            </blockquote>
            <P>
              The people deciding are District Collectors and disaster management authorities, Emergency Operations Centres, and NDRF/SDRF commanders.
              They are experienced. What they lack is a way to <strong>try a plan out first</strong>.
            </P>

            <DocH2 id="story" kicker="The problem">
              A night in the control room
            </DocH2>
            <P>A fictional, but typical, evening in a riverside district: six low-lying localities, three shelters, one bridge, twelve boats.</P>
            <ol className="relative mt-8 space-y-6 border-l-2 border-dashed border-primary/25 pl-8">
              {STORY.map((s) => (
                <li key={s.time} className="relative">
                  <span className={cn('absolute top-0 -left-[49px] flex size-8 items-center justify-center rounded-full shadow-md', s.tone)}>
                    <s.icon className="size-4" />
                  </span>
                  <p className="font-mono text-xs font-semibold text-primary">{s.time}</p>
                  <p className="mt-1 text-foreground/85">{s.text}</p>
                </li>
              ))}
            </ol>
            <Callout tone="warn" title="The question nobody can answer tonight">
              “If I send four boats to each shelter, what share of people get out at 100 mm? At 250 mm? And what happens if the bridge goes at hour 3?”
            </Callout>

            <DocH2 id="why-hard" kicker="The problem">
              Why it is hard
            </DocH2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {HARD.map((h) => (
                <div key={h.t} className="flex gap-4 rounded-xl border bg-card p-4">
                  <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', h.tone)}>
                    <h.icon className="size-5" />
                  </span>
                  <div>
                    <p className="font-medium">{h.t}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{h.b}</p>
                  </div>
                </div>
              ))}
            </div>

            <DocH2 id="gaps" kicker="The problem">
              What's missing today
            </DocH2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border bg-card p-6">
                <p className="text-sm font-semibold">What officers have</p>
                <List items={['Annual disaster management plans', 'Weather and river forecasts', 'Dashboards showing the situation now', 'Experience and mock drills']} />
              </div>
              <div className="rounded-2xl border border-primary/25 bg-primary/5 p-6">
                <p className="text-sm font-semibold text-primary">What none of them can do</p>
                <List
                  items={[
                    'Test today’s plan against tonight’s range of futures',
                    'Say which bridge or shelter the plan secretly depends on',
                    'Tell you which missing report matters most',
                    'Re-check the plan in seconds when rain gets heavier',
                  ]}
                />
              </div>
            </div>

            <DocH2 id="questions" kicker="The problem">
              The 10 questions we answer
            </DocH2>
            <P>The whole problem, broken into the questions an officer actually asks — and the one-line answer AEGIS-X gives to each.</P>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {QUESTIONS.map((item, i) => (
                <div key={item.q} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">
                      <span className="mr-2 font-mono text-xs text-primary">P{i + 1}</span>
                      {item.q}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn(
                        'shrink-0 text-[10px]',
                        item.status === 'built' && 'border-safe/40 bg-safe/10 text-safe',
                        item.status === 'partial' && 'border-warn/50 bg-warn/10 text-amber-600',
                        item.status === 'planned' && 'text-muted-foreground',
                      )}
                    >
                      {item.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
                </div>
              ))}
            </div>

            {/* ===================== Case studies ===================== */}
            <DocH2 id="case-studies" kicker="Real events">
              Case studies
            </DocH2>
            <P>Four real Indian floods. Figures are quoted from the linked sources; the AEGIS-X angle shows what it would test, not a re-run of the event.</P>
            <div className="mt-6 space-y-4">
              {CASE_STUDIES.map((c) => (
                <article key={c.id} className="grid overflow-hidden rounded-2xl border bg-card sm:grid-cols-[200px_1fr]">
                  <img src={c.image} alt={c.imageAlt} className="h-44 w-full object-cover sm:h-full" loading="lazy" />
                  <div className="p-5">
                    <p className="text-xs font-medium text-primary">
                      {c.place} · {c.when}
                    </p>
                    <h3 className="mt-1 font-semibold">{c.title}</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {c.facts.map((f) => (
                        <span key={f.label} className="rounded-lg bg-muted px-2.5 py-1 text-xs">
                          <span className="font-semibold text-foreground">{f.value}</span> <span className="text-muted-foreground">{f.label}</span>
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      <span className="font-medium text-risk">Decision problem: </span>
                      {c.challenge}
                    </p>
                    <a href={c.source.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      Source: {c.source.label} <ArrowUpRight className="size-3" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
            <Figure caption="Kerala coast before (6 Feb 2018) and after (22 Aug 2018) the floods. Drag to compare. NASA Earth Observatory, Landsat (USGS) and modified Copernicus Sentinel data (ESA).">
              <BeforeAfter
                before="/images/kerala-before.jpg"
                after="/images/kerala-after.jpg"
                beforeLabel="6 Feb 2018"
                afterLabel="22 Aug 2018"
                alt="False-colour satellite view of the Kerala coast"
                className="aspect-[16/10]"
              />
            </Figure>

            {/* ===================== Solution ===================== */}
            <DocH2 id="solution" kicker="The solution">
              Core idea
            </DocH2>
            <P>
              Most systems predict one outcome. That single number is usually wrong, and a plan built on it fails when reality differs. AEGIS-X instead{' '}
              <strong>explores</strong>: it runs the plan through hundreds of futures, attacks it, and shows the whole range — paying special attention to
              the bad days.
            </P>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                { t: 'Explore, don’t predict', b: 'Answers are ranges, never one number.', tone: 'border-flood/30 bg-flood/5 text-flood' },
                { t: 'Math decides, LLM explains', b: 'Findings come from simulation only.', tone: 'border-primary/30 bg-primary/5 text-primary' },
                { t: 'The human decides', b: 'Always. Accept, edit or reject.', tone: 'border-safe/30 bg-safe/5 text-safe' },
              ].map((r) => (
                <div key={r.t} className={cn('rounded-xl border p-4', r.tone)}>
                  <p className="font-semibold">{r.t}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{r.b}</p>
                </div>
              ))}
            </div>
            <DataTable
              head={['Traditional', 'AEGIS-X']}
              rows={[
                ['Predict one future', 'Explore hundreds of possible futures'],
                ['Best plan on an average day', 'Plan that still works on bad days (resilience)'],
                ['Show the current situation', 'Show what happens next under each plan'],
                ['Trust the plan', 'Attack the plan to find its weak points'],
                ['"We don’t know"', '"This is the information worth collecting first"'],
                ['AI gives the answer', 'AI gives evidence; a human decides'],
              ]}
            />

            <DocH2 id="decision-loop" kicker="The solution">
              Decision loop
            </DocH2>
            <P>Eight stages, repeated every time conditions change. Hover a stage to pause the loop.</P>
            <div className="mt-8 rounded-2xl border bg-gradient-to-br from-accent/50 to-transparent p-4 sm:px-16 sm:py-8">
              <DecisionLoop />
            </div>

            <DocH2 id="mapping" kicker="The solution">
              Question → technique
            </DocH2>
            <P>For readers who want the engineering behind each answer: the established method used, and where it lives in the code.</P>
            <DataTable
              head={['Question', 'Technique', 'Where', 'Status']}
              mono={[2]}
              rows={[
                ['P2 · what could happen?', 'Monte Carlo sampling', 'core/engine/montecarlo.py', <Badge key="b" className="bg-safe text-white">built</Badge>],
                ['P3 · is B better than A?', 'Common random numbers', 'core/engine/compare.py', <Badge key="b" className="bg-safe text-white">built</Badge>],
                ['P4 · where will it break?', 'Worst-case attribution + knockout tests', 'core/engine/redteam.py', <Badge key="b" className="bg-safe text-white">built</Badge>],
                ['P5 · what matters most?', 'Correlation sensitivity (Sobol planned)', 'core/engine/sensitivity.py', <Badge key="b" className="bg-safe text-white">built</Badge>],
                ['P6 · what to check first?', 'Expected value of information', 'core/engine/voi.py', <Badge key="b" className="bg-safe text-white">built</Badge>],
                ['P7 · the trade-offs?', 'Pareto front (NSGA-II planned)', 'core/engine/optimizer.py', <Badge key="b" className="bg-safe text-white">built</Badge>],
                ['P8 · re-check quickly?', 'Seeded, fast simulation', 'api/main.py', <Badge key="b" className="bg-safe text-white">built</Badge>],
                ['P9 · am I in control?', 'Explain + accept / edit / reject', 'api/explain.py · frontend', <Badge key="b" variant="outline" className="border-warn/50 text-amber-600">partial</Badge>],
                ['P1 · which report to trust?', 'Bayesian fusion with source reliability', '—', <Badge key="b" variant="outline">planned</Badge>],
                ['P10 · will we learn?', 'Calibration against real outcomes', '—', <Badge key="b" variant="outline">planned</Badge>],
              ]}
            />

            {/* ===================== Architecture ===================== */}
            <DocH2 id="architecture" kicker="Architecture">
              System architecture
            </DocH2>
            <P>
              Five layers. The key boundary is between the <strong>core engine</strong>, which knows nothing about floods, and the{' '}
              <strong>domain modules</strong>, which know nothing about statistics. They meet at one function: <Code>simulate()</Code>.
            </P>
          </div>
          <div className="mt-8 max-w-5xl">
            <FlowDiagram {...architectureFlow} />
            <p className="mt-3 text-xs text-muted-foreground">
              Blue boxes are the decision-critical path. Dashed connectors are domains that implement the interface but are not built yet. Moving dots show
              the direction of each call.
            </p>
          </div>

          <div className="max-w-3xl">
            <DocH2 id="request-lifecycle" kicker="Architecture">
              Request lifecycle
            </DocH2>
            <P>What happens between an officer dragging the rainfall slider and the chart redrawing. On the demo grid, 1,000 futures take about 2.9 s.</P>
          </div>
          <div className="mt-8 max-w-5xl">
            <FlowDiagram {...requestFlow} />
          </div>

          <div className="max-w-3xl">
            <DocH2 id="project-structure" kicker="Architecture">
              Project structure
            </DocH2>
            <CodeBlock
              title="repository"
              code={`AEGIS-X/
├── core/engine/          # domain-agnostic decision engine
│   ├── interfaces.py     # Scenario · Plan · Conditions · DomainModel
│   ├── montecarlo.py     # run_monte_carlo(), resilience()
│   ├── compare.py        # compare_plans() on shared futures
│   ├── redteam.py        # worst-case attribution, single points of failure
│   ├── sensitivity.py    # which inputs move the outcome
│   ├── voi.py            # expected value of information
│   └── optimizer.py      # Pareto-front plan search
├── domains/
│   ├── flood/model.py    # full flood evacuation model
│   ├── fire/model.py     # interface stub
│   └── crowd/model.py    # interface stub
├── api/
│   ├── main.py           # FastAPI endpoints
│   └── explain.py        # LLM narration (explains, never decides)
├── tests/                # smoke + regression tests
├── docs/                 # problem, solution, implementation, steps
└── frontend/             # React 19 · Vite · Tailwind v4 · shadcn/ui`}
            />

            <DocH2 id="domain-contract" kicker="Architecture">
              The domain contract
            </DocH2>
            <P>
              A domain is anything that can implement four methods. The engine calls only these — which is why fire and crowd security can be added
              without touching a line of <Code>core/engine</Code>.
            </P>
            <CodeBlock
              title="core/engine/interfaces.py"
              lang="python"
              code={`class DomainModel(ABC):
    @abstractmethod
    def sample_conditions(self, rng, scenario) -> Conditions:
        """Draw one random future (rainfall, resources, comms...)."""

    @abstractmethod
    def simulate(self, scenario, plan, conditions) -> SimulationResult:
        """Run exactly one deterministic simulation."""

    def removable_elements(self, scenario) -> list[str]:
        """Bridges, shelters... the Red Team may knock out."""

    def perturb_scenario(self, scenario, removed_element) -> Scenario:
        """Copy of the scenario with one element disabled."""`}
            />

            {/* ===================== Engine ===================== */}
            <DocH2 id="flood-model" kicker="Engine">
              Flood simulation
            </DocH2>
            <P>
              <Code>FloodModel.simulate()</Code> turns one sampled future into evacuation metrics. The prototype uses a 20 × 20 grid instead of a real road
              network, but every step is real computation: flood depth from elevation, true shortest paths, and capacity-limited rescue over time.
            </P>
          </div>
          <div className="mt-8 max-w-5xl">
            <FlowDiagram {...floodSimFlow} />
          </div>
          <div className="max-w-3xl">
            <List
              items={[
                <>
                  <strong>Topology:</strong> two road networks — the low-lying population side and the shelter side — joined by a single bridge, so a real
                  bottleneck exists for the Red Team to find.
                </>,
                <>
                  <strong>Reachability:</strong> breadth-first search from every shelter over roads that are still dry; a cluster with no path is stranded.
                </>,
                <>
                  <strong>Capacity:</strong> boats × 8 people per tick, scaled by resource availability and reduced by communication loss.
                </>,
              ]}
            />

            <DocH2 id="monte-carlo" kicker="Engine">
              Monte Carlo
            </DocH2>
            <P>
              Each uncertain input is a range. The engine draws N futures with a seeded generator, runs the same plan through each, and reports a
              distribution. <strong>Resilience</strong> is the mean outcome of the worst 10% of futures — the number that separates a robust plan from one
              that only looks good on average.
            </P>
          </div>
          <div className="mt-8 max-w-5xl">
            <FlowDiagram {...monteCarloFlow} />
          </div>

          <div className="max-w-3xl">
            <DocH2 id="red-team" kicker="Engine">
              Red Team
            </DocH2>
            <P>
              Two techniques, both computed. <strong>Worst-case attribution</strong> takes the futures where the plan did worst and flags which inputs were
              unusually extreme. <strong>Knockout tests</strong> disable each bridge and shelter in turn, re-run under the same futures, and rank elements by
              how far the outcome drops.
            </P>
          </div>
          <div className="mt-8 max-w-5xl">
            <FlowDiagram {...redTeamFlow} />
          </div>
          <div className="max-w-3xl">
            <Callout title="Where the LLM fits">
              Only after the findings exist. <Code>api/explain.py</Code> sends already-computed numbers to the model with instructions never to add a number,
              cause or finding that is not in the data.
            </Callout>

            <DocH2 id="sensitivity" kicker="Engine">
              Sensitivity
            </DocH2>
            <P>
              Ranks each uncertain input by the absolute correlation between its sampled values and the outcome, shown as a tornado chart. It is a
              deliberately simple stand-in for Sobol indices; the interface is ready for SALib once input ranges are stable.
            </P>

            <DocH2 id="voi" kicker="Engine">
              Value of information
            </DocH2>
            <P>
              Without new information we must pick one plan for every future. If we knew a variable — say, whether the bridge survives — we could pick the
              best plan for that case. The difference between the two is what that information is worth, and the ranking tells the team what to verify
              first.
            </P>
          </div>
          <div className="mt-8 max-w-5xl">
            <FlowDiagram {...voiFlow} />
          </div>

          <div className="max-w-3xl">
            <DocH2 id="optimizer" kicker="Engine">
              Optimizer
            </DocH2>
            <P>
              Generates candidate plans, evaluates each on the same futures, and keeps only the Pareto-optimal set. Random search today; the return shape is
              ready for NSGA-II via pymoo.
            </P>

            {/* ===================== Results ===================== */}
            <DocH2 id="findings" kicker="Results">
              Measured findings
            </DocH2>
            <P>Numbers below come from running the real code on the demo scenario — not from slides.</P>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                { v: '≈ 2.9 s', l: 'for 1,000 Monte Carlo futures (20 × 20 grid)', tone: 'text-primary' },
                { v: '−100%', l: 'outcome when the bridge is knocked out (59.9% → 0%)', tone: 'text-risk' },
                { v: '0 change', l: 'from adding boats (4 → 7 per shelter) — capacity was never the bottleneck', tone: 'text-amber-600' },
                { v: '0% → 23.7%', l: 'worst-10% resilience after reinforcing access roads (n = 300, seed 1)', tone: 'text-safe' },
              ].map((f) => (
                <div key={f.l} className="rounded-xl border bg-card p-5">
                  <p className={cn('text-2xl font-semibold tracking-tight', f.tone)}>{f.v}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{f.l}</p>
                </div>
              ))}
            </div>
            <DocH3 id="bugs-found">Bugs found by measuring, not assuming</DocH3>
            <List
              items={[
                <>
                  <strong>Resilience was inverted.</strong> It averaged the best 10% of runs instead of the worst. Fixed, with a regression test.
                </>,
                <>
                  <strong>The bridge was never a real bottleneck.</strong> A full road lattice had too many redundant routes. Rebuilt as two networks joined by
                  one bridge.
                </>,
                <>
                  <strong>About 25% of population clusters were unreachable by construction.</strong> They spawned off-road. Now snapped onto roads.
                </>,
                <>
                  <strong>The obvious fix was wrong.</strong> Reinforcing the bridge did nothing in the demo range; low-lying localities flooded first. The demo is
                  built around the fix that actually works.
                </>,
              ]}
            />

            <DocH2 id="demo-walkthrough" kicker="Results">
              Demo walkthrough
            </DocH2>
            <ol className="mt-6 space-y-5">
              {[
                ['Open the demo', 'Orange dots are population clusters, green are shelters, the outlined cell is the bridge.'],
                ['Run at 100 mm', 'Roughly 80% evacuated; the resilience badge is healthy.'],
                ['Push rainfall to 200 mm and re-run', 'Evacuation collapses toward 0%.'],
                ['Press Red Team', 'bridge_main is flagged; the tornado chart shows rainfall dominates. Click it to highlight on the map.'],
                ['Tick "Reinforce local access roads" and re-run', 'The outcome recovers substantially.'],
                ['Open Plan Compare', 'Baseline vs. reinforced across the full range: worst-10% 0% → 23.7%.'],
              ].map(([t, b], i) => (
                <li key={t} className="flex gap-4">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-xs text-white">{i + 1}</span>
                  <div>
                    <p className="font-medium">{t}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{b}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Button asChild className="mt-8 rounded-full shadow-lg shadow-primary/25">
              <Link to="/demo">
                Open the live demo <ArrowRight />
              </Link>
            </Button>

            {/* ===================== Reference ===================== */}
            <DocH2 id="api" kicker="Reference">
              API reference
            </DocH2>
            <P>
              Base URL <Code>http://127.0.0.1:8000</Code>. Interactive docs at <Code>/docs</Code> on the API server. Every endpoint builds the seeded demo
              scenario, so results are reproducible.
            </P>
            <DataTable
              head={['Method', 'Path', 'Body', 'Returns']}
              mono={[0, 1]}
              rows={[
                ['GET', '/flood/demo-scenario', '—', 'grid, elevation, roads, shelters, bridges, population clusters'],
                ['POST', '/flood/flood-state', 'ConditionOverride', 'water_level_m, flooded[][]'],
                ['POST', '/flood/monte-carlo', 'MonteCarloRequest', 'summary (mean, p10, p50, p90, worst, best), resilience_worst_10pct'],
                ['POST', '/flood/compare?n_samples&seed', '{ plan_a, plan_b }', 'per plan: summary + resilience, on identical futures'],
                ['POST', '/flood/redteam', 'MonteCarloRequest', 'worst_case_futures, single_points_of_failure, sensitivity'],
                ['POST', '/flood/explain', 'MonteCarloRequest', 'narration + the red-team data it is based on (503 without GROQ_API_KEY)'],
              ]}
            />
            <CodeBlock
              title="MonteCarloRequest"
              lang="json"
              code={`{
  "n_samples": 300,              // 10 – 5000, default 500
  "seed": 42,
  "plan": {
    "boats_per_shelter": [4, 4, 4],
    "evacuation_priority": [0, 1, 2, 3, 4, 5],
    "reinforced_cells": [[8, 6], [5, 4]]
  },
  "point_conditions": {          // optional: jitter ±10% around a point
    "rainfall_mm": 200,
    "resource_availability_pct": 0.8,
    "comms_degradation_pct": 0.1
  }
}`}
            />
            <CodeBlock
              title="example"
              lang="bash"
              code={`curl -X POST http://127.0.0.1:8000/flood/monte-carlo \\
  -H "Content-Type: application/json" \\
  -d '{"n_samples": 300, "point_conditions": {"rainfall_mm": 200}}'`}
            />

            <DocH2 id="glossary" kicker="Reference">
              Glossary
            </DocH2>
            <P>Plain-language meanings of every term used on this site.</P>
            <dl className="mt-6 divide-y rounded-2xl border bg-card">
              {GLOSSARY.map(([term, def]) => (
                <div key={term} className="grid gap-1 px-5 py-4 sm:grid-cols-[180px_1fr] sm:gap-6">
                  <dt className="flex items-center gap-2 font-medium">
                    <HelpCircle className="size-4 text-primary" />
                    {term}
                  </dt>
                  <dd className="text-sm text-muted-foreground">{def}</dd>
                </div>
              ))}
            </dl>

            <DocH2 id="tech-stack" kicker="Reference">
              Tech stack
            </DocH2>
            <DataTable
              head={['Layer', 'Technology']}
              rows={[
                ['Simulation engine', 'Python 3.13 · NumPy · SciPy'],
                ['API', 'FastAPI · Pydantic · Uvicorn'],
                ['Narration', 'Groq-hosted LLM (llama-3.3-70b-versatile), swappable for a local model'],
                ['Web app', 'React 19 · Vite 8 · TypeScript 7 · Tailwind CSS v4'],
                ['UI system', 'shadcn/ui · Radix · lucide icons · Geist typeface'],
                ['Motion & charts', 'Motion · Recharts · custom SVG charts and flow diagrams'],
                ['State & data', 'Zustand · TanStack Query · React Router'],
                ['Roadmap', 'OSMnx road networks · DEM terrain · SALib · pymoo · EMA Workbench'],
              ]}
            />

            <DocH2 id="limitations" kicker="Reference">
              Limitations
            </DocH2>
            <Callout tone="warn" title="Stated openly, before anyone asks">
              These are the honest edges of the current prototype.
            </Callout>
            <List
              items={[
                'Grid world, not a real road network — the OSMnx upgrade path is designed in but not built.',
                'Flood-rise and capacity constants are illustrative, not yet calibrated against a real event.',
                'Case studies show the kind of decision AEGIS-X targets; they are not simulated re-runs of those events.',
                'Sensitivity uses correlation; full Sobol indices are planned.',
                'The optimizer uses random search with a Pareto filter; NSGA-II is planned.',
                'Data fusion, a persistent audit log and calibration are not built yet.',
                'Fire and crowd-security modules implement the interface only.',
              ]}
            />

            <DocH2 id="roadmap" kicker="Reference">
              Roadmap
            </DocH2>
            <DataTable
              head={['Next', 'Why it matters']}
              rows={[
                ['Real road network + elevation (OSMnx, SRTM/Cartosat)', 'Run on an actual district instead of a synthetic grid'],
                ['Calibration against Chennai 2015 / Kerala 2018', 'Turn illustrative constants into validated ones'],
                ['Data fusion with confidence levels', 'Handle contradictory field reports (P1)'],
                ['Audit log and plan persistence', 'Accountability for every approved decision (P9)'],
                ['Sobol sensitivity, NSGA-II, scenario discovery (PRIM)', 'Stronger, standard analysis methods'],
                ['Fire and crowd-security modules', 'Prove the engine across domains'],
              ]}
            />

            <DocH2 id="credits" kicker="Reference">
              Image credits
            </DocH2>
            <P>
              All photographs are used under their licences. NASA imagery does not imply NASA endorsement; GODL-India images do not imply endorsement by the
              data provider; CC BY-SA images are used unmodified apart from resizing.
            </P>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {IMAGE_CREDITS.map((c) => (
                <a key={c.file} href={c.source} target="_blank" rel="noreferrer" className="group flex gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/30">
                  <img src={c.file} alt="" className="size-16 shrink-0 rounded-md object-cover" loading="lazy" />
                  <div className="min-w-0 text-xs">
                    <p className="font-medium">{c.what}</p>
                    <p className="mt-1 text-muted-foreground">{c.credit}</p>
                    <p className="mt-1 font-mono text-[10px] text-primary">{c.license}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </main>

        {/* on this page */}
        <aside className="hidden w-48 shrink-0 2xl:block">
          <div className="sticky top-16 py-10">
            <p className="mb-3 text-sm font-medium">On this page</p>
            {activeGroup && (
              <ul className="space-y-2 text-sm">
                {activeGroup.items.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className={cn('transition-colors hover:text-foreground', active === item.id ? 'text-primary' : 'text-muted-foreground')}>
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-8 rounded-xl border bg-gradient-to-br from-primary/10 to-flood/10 p-4">
              <p className="text-sm font-medium">Try it live</p>
              <p className="mt-1 text-xs text-muted-foreground">Break a plan, then fix it — on the real engine.</p>
              <Button asChild size="sm" className="mt-3 w-full rounded-full">
                <Link to="/demo">Open demo</Link>
              </Button>
            </div>
          </div>
        </aside>
      </div>

      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed right-6 bottom-6 z-50 flex size-11 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 transition-transform hover:-translate-y-0.5"
          aria-label="Back to top"
        >
          <ArrowUp className="size-5" />
        </button>
      )}

      <SiteFooter />
    </div>
  )
}
