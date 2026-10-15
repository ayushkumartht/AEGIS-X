import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown } from 'lucide-react'
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
import { cn } from '@/lib/utils'

const NAV = [
  {
    group: 'Getting started',
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'quickstart', label: 'Quickstart' },
    ],
  },
  {
    group: 'The problem',
    items: [
      { id: 'problem', label: 'Context' },
      { id: 'why-hard', label: 'Why it is hard' },
      { id: 'gaps', label: "What's missing today" },
      { id: 'problem-statement', label: 'Problem statement' },
    ],
  },
  {
    group: 'The solution',
    items: [
      { id: 'solution', label: 'Core idea' },
      { id: 'decision-loop', label: 'Decision loop' },
      { id: 'mapping', label: 'Problem → technique' },
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
  return (
    <nav className="space-y-7 text-sm">
      {NAV.map((g) => (
        <div key={g.group}>
          <p className="mb-2 font-medium">{g.group}</p>
          <ul className="space-y-0.5 border-l">
            {g.items.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={onNavigate}
                  className={cn(
                    '-ml-px block border-l py-1 pl-4 transition-colors',
                    active === item.id ? 'border-foreground font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
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
  )
}

export default function DocumentationPage() {
  const active = useScrollSpy(ALL_IDS)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const activeGroup = NAV.find((g) => g.items.some((i) => i.id === active))

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      {/* mobile section picker */}
      <div className="sticky top-16 z-40 border-b bg-background/90 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen((o) => !o)}
          className="flex w-full items-center justify-between px-6 py-3 text-sm"
          aria-expanded={mobileNavOpen}
        >
          <span className="text-muted-foreground">
            {activeGroup?.group} / <span className="text-foreground">{activeGroup?.items.find((i) => i.id === active)?.label}</span>
          </span>
          <ChevronDown className={cn('size-4 transition-transform', mobileNavOpen && 'rotate-180')} />
        </button>
        {mobileNavOpen && (
          <div className="max-h-[60vh] overflow-y-auto border-t px-6 py-5">
            <SidebarNav active={active} onNavigate={() => setMobileNavOpen(false)} />
          </div>
        )}
      </div>

      <div className="mx-auto flex max-w-7xl gap-10 px-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto py-10 pr-2">
            <SidebarNav active={active} />
          </div>
        </aside>

        <main className="min-w-0 flex-1 py-10 md:py-14">
          <div className="max-w-3xl">
            {/* ===================== Getting started ===================== */}
            <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Documentation</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance md:text-5xl">AEGIS-X, from problem to architecture</h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Everything about what AEGIS-X solves, how it is built, what it has been measured to do — and what it does not do yet.
            </p>

            <DocH2 id="overview">Overview</DocH2>
            <P>
              AEGIS-X is a decision-intelligence platform for high-risk operations. Its first and deepest module is <strong>flood evacuation</strong>.
              Given a plan — how many boats go to which shelter, which roads to reinforce — it answers three questions before anything is sent:
            </P>
            <List
              items={[
                <>
                  <strong>How does this plan perform across the whole range of futures?</strong> Not one forecast: hundreds of sampled ones.
                </>,
                <>
                  <strong>Where, specifically, does it break?</strong> A Red Team engine searches for the conditions and the single element that collapse
                  it.
                </>,
                <>
                  <strong>What should we find out next?</strong> Value-of-information ranks the missing facts most worth verifying.
                </>,
              ]}
            />
            <Callout title="Decision support, not autonomy">
              AEGIS-X never acts on its own. It recommends and explains; an authorized human accepts, edits or rejects every plan.
            </Callout>

            <DocH2 id="quickstart">Quickstart</DocH2>
            <P>Run the API and the web app locally. Both are needed for the live demo; the landing page and these docs work without the API.</P>
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
            <Callout>
              Optional: copy <Code>.env.example</Code> to <Code>.env</Code> and set <Code>GROQ_API_KEY</Code> to enable plain-language narration of Red
              Team findings. Without it, <Code>/flood/explain</Code> returns a clear 503 and everything else works.
            </Callout>

            {/* ===================== Problem ===================== */}
            <DocH2 id="problem">The problem: context</DocH2>
            <P>
              Floods are among India's most frequent large-scale disasters. Every monsoon, districts must move thousands of people out of danger
              within hours. Chennai in 2015 and Kerala in 2018 showed the same pattern: the hardest part was rarely the rescue itself — it was making
              the right decisions early, while information was incomplete and the situation kept changing.
            </P>
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
            <P>
              The people deciding are District Collectors and disaster management authorities (when to evacuate, which shelters to open), Emergency
              Operations Centres (where boats and teams go, in what order), and NDRF/SDRF commanders (which route, which locality first). They are
              experienced — and they decide under pressure, with partial information, and no way to try a plan out first.
            </P>

            <DocH2 id="why-hard">Why it is hard</DocH2>
            <DataTable
              head={['Difficulty', 'What it looks like on the ground']}
              rows={[
                ['The future is uncertain', 'A rainfall forecast is a range (e.g. 80–250 mm). A plan that works at 100 mm can fail completely at 200 mm.'],
                ['The situation keeps changing', 'Roads and bridges go under one by one. A safe route at 6 PM can be cut off by 8 PM.'],
                ['Information conflicts', '"Bridge open" from the control room, "bridge under water" from a field team. Old reports arrive late.'],
                ['Resources are unreliable', 'Boats are stuck elsewhere, vehicles break down; what goes to one area is gone from another.'],
                ['Communication breaks down', 'Power cuts and damaged towers delay orders exactly when coordination matters most.'],
                ['Plans hide weak points', 'A plan may silently depend on one bridge or shelter — found only after it fails.'],
                ['No time, no second chance', 'Decisions happen in hours or minutes, and a wrong one cannot be undone.'],
              ]}
            />

            <DocH2 id="gaps">What's missing today</DocH2>
            <DataTable
              head={['What exists', 'What it lacks']}
              rows={[
                ['District Disaster Management Plans', 'Written once a year; do not adapt to today’s flood, roads or resources.'],
                ['Weather and flood forecasts', 'Give an expected value — not what that value means for a specific plan.'],
                ['Dashboards and command centres', 'Show what is happening now, not what happens next under each decision.'],
                ['Officer experience', 'Valuable, but cannot be tested beforehand, audited, or handed to the next officer.'],
                ['Mock drills', 'One fixed scenario, a few times a year.'],
              ]}
            />
            <P>
              <strong>The gap:</strong> nothing lets a decision-maker test a plan against many possible futures before acting, see where and why it
              fails, and know which missing information matters most.
            </P>

            <DocH2 id="problem-statement">Problem statement</DocH2>
            <blockquote className="mt-6 border-l-2 border-foreground pl-5 text-lg leading-8 text-pretty">
              How can a flood-response decision-maker, working with uncertain, incomplete and changing information and limited resources, know{' '}
              <em>before acting</em> how an evacuation plan will hold up across the range of possible futures, where and why it will fail, and which
              information is most worth gathering next — while keeping the final decision in human hands?
            </blockquote>
            <DataTable
              head={['#', 'Sub-problem']}
              mono={[0]}
              rows={[
                ['P1', 'Merge incomplete, conflicting reports and represent how far each can be trusted.'],
                ['P2', 'Understand how a plan performs across many possible futures, not one forecast.'],
                ['P3', 'Compare plans fairly, under exactly the same conditions.'],
                ['P4', 'Find a plan’s hidden weak points before they fail.'],
                ['P5', 'Know which uncertainty matters most for the outcome.'],
                ['P6', 'Know which information to collect next.'],
                ['P7', 'Balance lives saved, time, resources and safety on bad days.'],
                ['P8', 'Re-check the plan quickly when conditions change.'],
                ['P9', 'Keep the human in control, with reasons they can question.'],
                ['P10', 'Learn from each event so the next estimate is better.'],
              ]}
            />

            {/* ===================== Solution ===================== */}
            <DocH2 id="solution">The solution: core idea</DocH2>
            <P>
              Most systems predict one outcome. A single number is usually wrong, and a plan built on it fails badly when reality differs. AEGIS-X
              instead <strong>explores</strong>: it runs the plan through hundreds of futures, attacks it, and reports the whole distribution — with
              special attention to the bad tail.
            </P>
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
            <Callout title="Three rules">
              <strong>Explore, don't predict</strong> — outputs are ranges. <strong>Math decides, the LLM explains</strong> — every finding comes from
              simulation. <strong>The human decides</strong> — always.
            </Callout>

            <DocH2 id="decision-loop">Decision loop</DocH2>
            <P>Eight stages, repeated every time conditions change. Hover a stage to pause the loop.</P>
            <div className="mt-8 rounded-2xl border bg-muted/20 p-4 sm:px-16 sm:py-8">
              <DecisionLoop />
            </div>

            <DocH2 id="mapping">Problem → technique</DocH2>
            <P>Every sub-problem maps to an established method, and to where it lives (or will live) in the code.</P>
            <DataTable
              head={['Problem', 'Technique', 'Where', 'Status']}
              mono={[2]}
              rows={[
                ['P2 · uncertain future', 'Monte Carlo sampling', 'core/engine/montecarlo.py', <Badge key="b">built</Badge>],
                ['P3 · fair comparison', 'Common random numbers', 'core/engine/compare.py', <Badge key="b">built</Badge>],
                ['P4 · hidden weak points', 'Worst-case attribution + knockout tests', 'core/engine/redteam.py', <Badge key="b">built</Badge>],
                ['P5 · what matters most', 'Correlation sensitivity (Sobol planned)', 'core/engine/sensitivity.py', <Badge key="b">built</Badge>],
                ['P6 · what to check next', 'Expected value of information', 'core/engine/voi.py', <Badge key="b">built</Badge>],
                ['P7 · competing goals', 'Pareto front (NSGA-II planned)', 'core/engine/optimizer.py', <Badge key="b">built</Badge>],
                ['P8 · fast re-checks', 'Seeded, vectorisable simulation', 'api/main.py', <Badge key="b">built</Badge>],
                ['P9 · human control', 'Explain + accept / edit / reject', 'api/explain.py · frontend', <Badge key="b" variant="outline">partial</Badge>],
                ['P1 · conflicting reports', 'Bayesian fusion with source reliability', '—', <Badge key="b" variant="outline">planned</Badge>],
                ['P10 · learning', 'Calibration against real outcomes', '—', <Badge key="b" variant="outline">planned</Badge>],
              ]}
            />

            {/* ===================== Architecture ===================== */}
            <DocH2 id="architecture">System architecture</DocH2>
            <P>
              Five layers. The key boundary is between the <strong>core engine</strong>, which knows nothing about floods, and the{' '}
              <strong>domain modules</strong>, which know nothing about statistics. They meet at one function: <Code>simulate()</Code>.
            </P>
          </div>
          <div className="mt-8 max-w-5xl">
            <FlowDiagram {...architectureFlow} />
            <p className="mt-3 text-xs text-muted-foreground">
              Solid boxes are the decision-critical path. Dashed connectors are domains that implement the interface but are not built yet. Moving dots
              show the direction of each call.
            </p>
          </div>

          <div className="max-w-3xl">
            <DocH2 id="request-lifecycle">Request lifecycle</DocH2>
            <P>What happens between an officer dragging the rainfall slider and the chart redrawing. On the demo grid, 1,000 futures take about 2.9 s.</P>
          </div>
          <div className="mt-8 max-w-5xl">
            <FlowDiagram {...requestFlow} />
          </div>

          <div className="max-w-3xl">
            <DocH2 id="project-structure">Project structure</DocH2>
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

            <DocH2 id="domain-contract">The domain contract</DocH2>
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
            <DocH2 id="flood-model">Flood simulation</DocH2>
            <P>
              <Code>FloodModel.simulate()</Code> turns one sampled future into evacuation metrics. The prototype uses a 20 × 20 grid instead of a
              real road network, but every step is real computation: flood depth from elevation, true shortest paths, and capacity-limited rescue
              over time.
            </P>
          </div>
          <div className="mt-8 max-w-5xl">
            <FlowDiagram {...floodSimFlow} />
          </div>
          <div className="max-w-3xl">
            <List
              items={[
                <>
                  <strong>Topology:</strong> two road networks — the low-lying population side and the shelter side — joined by a single bridge, so a
                  real bottleneck exists for the Red Team to find.
                </>,
                <>
                  <strong>Reachability:</strong> breadth-first search from every shelter over roads that are still dry; a cluster with no path is
                  stranded.
                </>,
                <>
                  <strong>Capacity:</strong> boats × 8 people per tick, scaled by resource availability and reduced by communication loss.
                </>,
              ]}
            />

            <DocH2 id="monte-carlo">Monte Carlo</DocH2>
            <P>
              Each uncertain input is a range. The engine draws N futures with a seeded generator, runs the same plan through each, and reports a
              distribution. <strong>Resilience</strong> is the mean outcome of the worst 10% of futures — the number that separates a robust plan
              from one that only looks good on average.
            </P>
          </div>
          <div className="mt-8 max-w-5xl">
            <FlowDiagram {...monteCarloFlow} />
          </div>

          <div className="max-w-3xl">
            <DocH2 id="red-team">Red Team</DocH2>
            <P>
              Two independent techniques, both computed. <strong>Worst-case attribution</strong> takes the futures where the plan did worst and flags
              which inputs were unusually extreme (z-score). <strong>Knockout tests</strong> disable each bridge and shelter in turn, re-run under the
              same futures, and rank elements by how far the outcome drops.
            </P>
          </div>
          <div className="mt-8 max-w-5xl">
            <FlowDiagram {...redTeamFlow} />
          </div>
          <div className="max-w-3xl">
            <Callout title="Where the LLM fits">
              Only after the findings exist. <Code>api/explain.py</Code> sends already-computed numbers to the model with instructions never to add a
              number, cause or finding that is not in the data.
            </Callout>

            <DocH2 id="sensitivity">Sensitivity</DocH2>
            <P>
              Ranks each uncertain input by the absolute correlation between its sampled values and the outcome across the batch, shown as a tornado
              chart. It is a deliberately simple stand-in for Sobol indices; the interface is ready for SALib once input ranges are stable.
            </P>

            <DocH2 id="voi">Value of information</DocH2>
            <P>
              Without new information we must pick one plan for every future. If we knew a variable — say, whether the bridge survives — we could
              pick the best plan for that case. The difference between the two is what that information is worth, and the ranking tells the team what
              to verify first.
            </P>
          </div>
          <div className="mt-8 max-w-5xl">
            <FlowDiagram {...voiFlow} />
          </div>

          <div className="max-w-3xl">
            <DocH2 id="optimizer">Optimizer</DocH2>
            <P>
              Generates candidate plans, evaluates each on the same futures, and keeps only the Pareto-optimal set — plans where no objective can
              improve without another getting worse. Random search today; the return shape is ready for NSGA-II via pymoo.
            </P>

            {/* ===================== Results ===================== */}
            <DocH2 id="findings">Measured findings</DocH2>
            <P>Numbers below come from running the real code on the demo scenario — not from slides.</P>
            <DataTable
              head={['Measurement', 'Result']}
              rows={[
                ['1,000 Monte Carlo futures (20 × 20 grid)', '≈ 2.9 s'],
                ['Bridge knocked out (full uncertainty range)', 'evacuated 59.9% → 0% · a 100% drop'],
                ['Boats per shelter 4 → 7', 'no change — capacity was never the bottleneck'],
                ['Reinforce population access roads (n = 300, seed 1)', 'mean 60.9% → 73.2% · worst-10% 0% → 23.7%'],
                ['Backend test suite', '7 / 7 passing'],
              ]}
            />
            <DocH3 id="bugs-found">Bugs found by measuring, not assuming</DocH3>
            <List
              items={[
                <>
                  <strong>Resilience was inverted.</strong> It averaged the best 10% of runs instead of the worst. Fixed, with a regression test.
                </>,
                <>
                  <strong>The bridge was never a real bottleneck.</strong> A full road lattice had too many redundant routes. Rebuilt as two networks
                  joined by one bridge.
                </>,
                <>
                  <strong>About 25% of population clusters were unreachable by construction.</strong> They spawned off-road. Now snapped onto roads.
                </>,
                <>
                  <strong>The obvious fix was wrong.</strong> Reinforcing the bridge did nothing in the demo range; low-lying localities flooded
                  first. The demo is built around the fix that actually works.
                </>,
              ]}
            />

            <DocH2 id="demo-walkthrough">Demo walkthrough</DocH2>
            <ol className="mt-6 space-y-5">
              {[
                ['Open the demo', 'Orange dots are population clusters, green are shelters, the outlined cell is the bridge.'],
                ['Run at 100 mm', 'Roughly 80% evacuated; the resilience badge is healthy.'],
                ['Push rainfall to 200 mm and re-run', 'Evacuation collapses toward 0%.'],
                ['Press Red Team', 'bridge_main is flagged; the tornado chart shows rainfall dominates. Click it to highlight on the map.'],
                ['Tick "Reinforce local access roads" and re-run', 'The outcome recovers substantially.'],
                ['Open Plan Compare', 'Baseline vs. reinforced across the full range: worst-10% 0% → 23%.'],
              ].map(([t, b], i) => (
                <li key={t} className="flex gap-4">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs">{i + 1}</span>
                  <div>
                    <p className="font-medium">{t}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{b}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Button asChild className="mt-8 rounded-full">
              <Link to="/demo">
                Open the live demo <ArrowRight />
              </Link>
            </Button>

            {/* ===================== Reference ===================== */}
            <DocH2 id="api">API reference</DocH2>
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

            <DocH2 id="tech-stack">Tech stack</DocH2>
            <DataTable
              head={['Layer', 'Technology']}
              rows={[
                ['Simulation engine', 'Python 3.13 · NumPy · SciPy'],
                ['API', 'FastAPI · Pydantic · Uvicorn'],
                ['Narration', 'Groq-hosted LLM (llama-3.3-70b-versatile), swappable for a local model'],
                ['Web app', 'React 19 · Vite 8 · TypeScript 7 · Tailwind CSS v4'],
                ['UI system', 'shadcn/ui · Radix · lucide icons · Geist typeface'],
                ['Motion & charts', 'Motion · Recharts · custom SVG flow diagrams'],
                ['State & data', 'Zustand · TanStack Query · React Router'],
                ['Roadmap', 'OSMnx road networks · DEM terrain · SALib · pymoo · EMA Workbench'],
              ]}
            />

            <DocH2 id="limitations">Limitations</DocH2>
            <Callout tone="warn" title="Stated openly, before anyone asks">
              These are the honest edges of the current prototype.
            </Callout>
            <List
              items={[
                'Grid world, not a real road network — the OSMnx upgrade path is designed in but not built.',
                'Flood-rise and capacity constants are illustrative, not yet calibrated against a real event.',
                'Sensitivity uses correlation; full Sobol indices are planned.',
                'The optimizer uses random search with a Pareto filter; NSGA-II is planned.',
                'Data fusion, a persistent audit log and calibration are not built yet.',
                'Fire and crowd-security modules implement the interface only.',
              ]}
            />

            <DocH2 id="roadmap">Roadmap</DocH2>
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

            <DocH2 id="credits">Image credits</DocH2>
            <P>
              All photographs are used under their licences. NASA imagery does not imply NASA endorsement; GODL-India images do not imply endorsement by
              the data provider.
            </P>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {IMAGE_CREDITS.map((c) => (
                <a key={c.file} href={c.source} target="_blank" rel="noreferrer" className="group flex gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50">
                  <img src={c.file} alt="" className="size-16 shrink-0 rounded-md object-cover grayscale group-hover:grayscale-0" loading="lazy" />
                  <div className="min-w-0 text-xs">
                    <p className="font-medium">{c.what}</p>
                    <p className="mt-1 text-muted-foreground">{c.credit}</p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">{c.license}</p>
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
                    <a href={`#${item.id}`} className={cn('transition-colors hover:text-foreground', active === item.id ? 'text-foreground' : 'text-muted-foreground')}>
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-8 rounded-xl border p-4">
              <p className="text-sm font-medium">Try it live</p>
              <p className="mt-1 text-xs text-muted-foreground">Break a plan, then fix it — on the real engine.</p>
              <Button asChild size="sm" className="mt-3 w-full rounded-full">
                <Link to="/demo">Open demo</Link>
              </Button>
            </div>
          </div>
        </aside>
      </div>

      <SiteFooter />
    </div>
  )
}
