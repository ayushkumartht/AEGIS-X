# AEGIS-X architecture

<p align="center">
  <img src="images/architecture.svg" alt="AEGIS-X system architecture: live data, backend layers, frontend and the officer" width="100%">
</p>

> **Math decides · AI explains · Humans decide.** Every number on screen comes from the simulation engine or an official feed. The language model only phrases what it is given, and a person accepts or rejects every recommendation.

**On this page:** [principles](#1-five-principles) · [system context](#2-system-context) · [backend layers](#3-backend-layers) · [the engine](#4-the-engine) · [the flood model](#5-the-flood-model) · [live data pipeline](#6-live-data-pipeline) · [AI brief and guardrail](#7-ai-brief-and-guardrail) · [decision log](#8-tamper-evident-decision-log) · [data model](#9-data-model) · [frontend](#10-frontend) · [deployment](#11-deployment) · [numbers](#12-numbers-that-matter) · [repo map](#13-repo-map)

---

## 1. Five principles

| # | Principle | Where it shows in the code |
|---|---|---|
| 1 | **The engine knows nothing about floods.** It calls one function and works for any hazard. | `backend/aegis/engine/` imports nothing from `domains/`; a test enforces it. |
| 2 | **Ranges, not predictions.** Every uncertain input is a distribution; every result is a spread with a bad-day figure. | `ConditionSpace`, Latin hypercube sampling, `resilience()` = mean of the worst 10%. |
| 3 | **Fair comparison.** Plans are compared on the *same* sampled futures, so a difference is the plan, not luck. | `compare_plans()` draws futures once. |
| 4 | **Never pass an estimate off as data.** Each input carries its source; estimates are labelled on screen; a failed feed says so. | `Variable.source`, Situation tab "Where this data comes from", `ops_feed` health. |
| 5 | **The AI is boxed in.** It sees only numbered evidence, must cite it, and every number, id and district is checked; otherwise rules write the text. | `aegis/ops/advisor.py`, `aegis/llm/explain.py`. |

## 2. System context

```mermaid
flowchart LR
  classDef ext fill:#0c4a6e,stroke:#38bdf8,color:#e0f2fe
  classDef core fill:#1e1b4b,stroke:#a78bfa,color:#ede9fe
  classDef ui fill:#164e63,stroke:#22d3ee,color:#ecfeff
  classDef human fill:#14532d,stroke:#4ade80,color:#dcfce7
  classDef ai fill:#500724,stroke:#f472b6,color:#fce7f3

  SACHET["NDMA SACHET<br/>IMD · CWC · SDMA alerts"]:::ext
  GDACS["GDACS events"]:::ext
  GLOFAS["GloFAS · Open-Meteo<br/>river + rain ensembles"]:::ext
  OSM["OpenStreetMap<br/>roads · bridges · river"]:::ext
  LLM["Groq / Gemini / Claude"]:::ai

  API["AEGIS-X API<br/>FastAPI · /api/v1"]:::core
  DB[("SQLite<br/>hash-chained log")]:::core

  CC["Command Center<br/>/command"]:::ui
  CON["Evacuation Console<br/>/console/cachar"]:::ui
  OFF(["Officer"]):::human

  SACHET --> API
  GDACS --> API
  GLOFAS --> API
  OSM -. built offline into the scenario .-> API
  API <--> LLM
  API <--> DB
  CC <--> API
  CON <--> API
  OFF --> CC
  OFF --> CON
```

## 3. Backend layers

```mermaid
flowchart TB
  classDef api fill:#312e81,stroke:#818cf8,color:#eef2ff
  classDef ops fill:#431407,stroke:#fb923c,color:#ffedd5
  classDef eng fill:#083344,stroke:#22d3ee,color:#cffafe
  classDef dom fill:#052e16,stroke:#4ade80,color:#dcfce7
  classDef sto fill:#422006,stroke:#fbbf24,color:#fef3c7
  classDef llm fill:#500724,stroke:#f472b6,color:#fce7f3

  subgraph API["api/ · FastAPI routers"]
    R1[districts]:::api
    R2[simulate + WebSocket]:::api
    R3[analysis]:::api
    R4[workflow]:::api
    R5[ops]:::api
    R6[replay]:::api
    LIM[limits · rate + job slots]:::api
  end
  subgraph OPS["ops/ · Command Center"]
    POLL[poller]:::ops
    FEEDS[feeds: SACHET · GDACS]:::ops
    RISK[risk: Gumbel + exceedance]:::ops
    ADV[advisor: evidence → brief]:::ops
    EXR[exercise scenario]:::ops
  end
  subgraph ENG["engine/ · domain-free"]
    MC[Monte Carlo]:::eng
    RT[Red Team]:::eng
    SEN[Sensitivity]:::eng
    VOI[Value of information]:::eng
    OPT[NSGA-II]:::eng
  end
  subgraph DOM["domains/"]
    FL[flood ✔]:::dom
    FI[fire · later]:::dom
    CR[crowd · later]:::dom
  end
  LLMX["llm/ · providers + guardrail"]:::llm
  FUS["fusion/ · field reports → beliefs"]:::ops
  STO[("storage/ · SQLite")]:::sto

  R2 --> MC
  R3 --> RT & SEN & VOI & OPT
  R5 --> ADV & RISK & FEEDS
  POLL --> FEEDS & RISK
  ADV --> MC
  ADV --> LLMX
  R4 --> LLMX & FUS
  MC & RT & SEN & VOI & OPT --> FL
  FEEDS & RISK & ADV & R4 & R2 --> STO
```

| Package | Responsibility |
|---|---|
| `api/` | Routers, request schemas, per-district context cache, rate limits and heavy-job slots, WebSocket streaming with an HTTP fallback. |
| `engine/` | Sampling, Monte Carlo, comparison, Red Team, sensitivity, value of information, optimiser, calibration. Pure numpy/scipy. |
| `domains/flood/` | The scenario (road graph + people + shelters), plan, conditions, the 48-hour evacuation model, plan codec for the optimiser. |
| `ops/` | Live feeds, river-risk levels, background poller, AI advisor, exercise scenario, hazard registry. |
| `llm/` | Groq, Gemini and Claude over plain HTTPS; prompts; the number guardrail; field-report parsing. |
| `fusion/` | Turns free-text field reports into Bayesian beliefs about bridges and resources. |
| `ingest/` | OpenStreetMap, Open-Meteo/GloFAS, geocoding, shelter CSV, file cache with offline mode. |
| `storage/` | SQLite tables and queries, including the hash-chained decision log. |
| `replay/` | Rating-curve calibration and the day-by-day replay of a past flood. |

## 4. The engine

Every domain implements one contract. The engine only ever calls these methods:

```mermaid
classDiagram
  direction LR
  class DomainModel {
    <<abstract>>
    +simulate(scenario, plan, conditions) SimulationResult
    +condition_space(scenario) ConditionSpace
    +conditions_from_values(values) Conditions
    +removable_elements(scenario) list
    +perturb_scenario(scenario, element) Scenario
  }
  class ConditionSpace {
    +variables: list~Variable~
    +sample_unit(n, method)
    +values_from_unit(u)
  }
  class Variable {
    +name
    +kind continuous / binary / empirical
    +source
  }
  class SimulationResult {
    +metrics: dict
    +details: dict
  }
  class FloodModel
  class FireModel
  class CrowdModel
  DomainModel <|-- FloodModel
  DomainModel <|-- FireModel
  DomainModel <|-- CrowdModel
  ConditionSpace "1" *-- "many" Variable
  DomainModel ..> ConditionSpace
  DomainModel ..> SimulationResult
```

```mermaid
flowchart LR
  classDef s fill:#083344,stroke:#22d3ee,color:#cffafe
  A[ConditionSpace<br/>8 scalars + 1 per key bridge]:::s --> B[Latin hypercube<br/>500 futures]:::s
  B --> C[simulate × 500<br/>~6 s on Silchar]:::s
  C --> D[MonteCarloBatch]:::s
  D --> E[summary: mean · p10 · p90<br/>worst 10% = resilience]:::s
  D --> F[Red Team<br/>knockouts · PRIM boxes · adversarial]:::s
  D --> G[Sensitivity<br/>correlation · Sobol]:::s
  D --> H[VOI<br/>best plan per information bin]:::s
  B --> I[NSGA-II<br/>plans on shared futures]:::s
```

| Analysis | Question it answers | Method |
|---|---|---|
| Monte Carlo | How does the plan do across plausible futures, and on a bad day? | Latin hypercube over the condition space; resilience = mean of the worst 10%. |
| Compare | Is plan B really better than plan A? | Both on identical futures. |
| Red Team: knockouts | Which single bridge, shelter or boat base breaks the plan? | Remove one element, re-run the same futures, rank by the drop. |
| Red Team: failure boxes | Under which conditions does it fail? | PRIM-style box search over failing futures (density, coverage, support). |
| Red Team: adversarial | What is the smallest push that breaks it? | Search from a typical future towards the failure line. |
| Sensitivity | Which unknown moves the result most? | Correlation (fast) or Sobol indices (Saltelli/Jansen). |
| Value of information | What should we find out first? | Best candidate plan per bin of a variable vs the best plan without knowing it. |
| Optimiser | Which plans trade off safety, average and boats best? | NSGA-II on an encoded plan; labelled Pareto picks. |

## 5. The flood model

One future = one set of conditions, played hour by hour for 48 hours on the Silchar road graph.

```mermaid
flowchart TD
  classDef f fill:#052e16,stroke:#4ade80,color:#dcfce7
  classDef w fill:#0c4a6e,stroke:#38bdf8,color:#e0f2fe
  S([future: peak level, timing, rain,<br/>boats, delay, comms, compliance, bridges]):::w --> L[water level each hour<br/>rating curve + forecast error + local rain]:::w
  L --> CUT[roads, bridges, areas cut<br/>when level > their height above the river]:::w
  CUT --> R[route each area to the nearest<br/>open shelter with room]:::f
  W[warning reaches people<br/>delay set by channels and comms]:::f --> M
  R --> M[people move: walkers · vehicles · boats<br/>in plan priority order]:::f
  M --> SH[shelters fill; overflow goes on]:::f
  SH --> N{48 h done?}:::f
  N -- no --> L
  N -- yes --> OUT([metrics: evacuated %, people still at risk,<br/>rescued late, moved needlessly, overflow, boat use]):::w
```

Details are in [domain-models.md](domain-models.md).

## 6. Live data pipeline

```mermaid
sequenceDiagram
  autonumber
  participant P as Poller (every 10 min / 3 h)
  participant S as NDMA SACHET
  participant G as GDACS
  participant F as GloFAS (Open-Meteo)
  participant DB as SQLite
  participant UI as Command Center
  P->>S: RSS (100 latest alerts)
  S-->>P: list of CAP links
  par 8 workers, cached forever
    P->>S: CAP XML per alert
  end
  P->>P: English info block · hazard · gauge level/warning/danger · place
  P->>G: India flood + cyclone events
  P->>DB: upsert events · feed health
  Note over P,F: every 3 hours
  P->>F: 20-year history (once) + 7-day ensemble
  P->>P: Gumbel 2/5/20-yr floods · share of members above each · level
  P->>DB: indicator per district
  UI->>DB: (via API, every minute) events · districts · feeds
```

**District flood level** = which flood the forecast is likely to pass:

```mermaid
stateDiagram-v2
  direction LR
  [*] --> Normal
  Normal --> Watch: ≥30% of members pass the 2-year flood
  Watch --> Warning: ≥30% pass the 5-year flood
  Warning --> Severe: ≥30% pass the 20-year flood
  Severe --> Warning
  Warning --> Watch
  Watch --> Normal
  Normal --> NoIndicator: river not resolved at 5 km
  NoIndicator: No indicator
```

A feed that fails keeps its last data, labelled with its age; nothing is invented to fill the gap. **Exercise mode** swaps the live rows for a labelled simulated scenario, per request (`?exercise=true`), never stored and never mixed.

## 7. AI brief and guardrail

<p align="center">
  <img src="images/decision-flow.svg" alt="From evidence to decision: collect evidence, AI drafts, guardrail checks, system fills numbers, officer decides, hash-chained log" width="100%">
</p>

```mermaid
sequenceDiagram
  autonumber
  actor O as Officer
  participant UI as Command Center
  participant A as Advisor
  participant E as Engine
  participant L as Groq
  participant DB as SQLite
  O->>UI: Generate brief (mode)
  UI->>A: POST /ops/brief
  A->>A: collect evidence E1..En (alerts, levels)
  A->>E: tested numbers for built districts (cached 30 min)
  E-->>A: evacuated %, bad day, failure rate, SPOF
  A->>L: evidence only + fixed JSON format
  L-->>A: draft brief
  alt passes the guardrail
    A->>A: add the system's counts and engine numbers
  else number / id / district / format wrong
    A->>A: rule-based brief from the same evidence
  end
  A->>DB: brief + evidence + recommendations
  UI-->>O: brief with evidence chips
  O->>UI: Accept / Reject
  UI->>DB: decision chained to the previous hash
```

What the guardrail checks: every number in every sentence appears in the evidence (or in fixed definitions such as 2/5/20-year), every cited id exists, every action's district is a watched district, at most 5 actions and at most 5 items per section. Counts and engine numbers are never taken from the model.

## 8. Tamper-evident decision log

```mermaid
flowchart LR
  classDef d fill:#422006,stroke:#fbbf24,color:#fef3c7
  D1["decision 41<br/>hash = H(h40 + row)"]:::d --> D2["decision 42<br/>hash = H(h41 + row)"]:::d --> D3["decision 43<br/>hash = H(h42 + row)"]:::d
```

`/audit/integrity` recomputes every hash: an edited row, or a row removed from the middle, breaks the chain at that point. Older rows without a hash are counted as legacy. Limit, stated on screen: deleting the newest rows cannot be detected without an outside copy of the latest hash.

## 9. Data model

```mermaid
erDiagram
  RUN ||--o{ DECISION : "based on"
  OPS_BRIEF ||--|{ OPS_RECOMMENDATION : contains
  OPS_RECOMMENDATION |o--|| DECISION : "accepted or rejected as"
  RUN {
    int id
    text district
    json plan
    int n_samples
    int seed
    json summary
  }
  DECISION {
    int id
    text author
    text action
    json plan
    json evidence
    text previous_hash
    text decision_hash
  }
  FIELD_REPORT {
    int id
    text district
    text raw_text
    json parsed
    text author
  }
  OPS_EVENT {
    text uid
    text source
    text hazard
    text severity
    real lat
    real lon
    json gauge
  }
  OPS_INDICATOR {
    text district_id
    text level
    json data
  }
  OPS_FEED {
    text name
    text last_success
    text last_error
  }
  OPS_BRIEF {
    int id
    text mode
    text source
    json evidence
    json sections
  }
  OPS_RECOMMENDATION {
    int id
    text action
    text status
  }
```

## 10. Frontend

```mermaid
flowchart TB
  classDef p fill:#164e63,stroke:#22d3ee,color:#ecfeff
  classDef c fill:#1e293b,stroke:#64748b,color:#e2e8f0
  App[App · React Router]:::p
  App --> CC["/command · CommandCenterPage"]:::p
  App --> CON["/console/:district · ConsolePage"]:::p
  App --> AUD["/audit · AuditPage"]:::p
  App --> REP["/replay/:event · ReplayPage"]:::p
  CC --> OM[OpsMap · MapLibre]:::c & DR[DistrictRisk]:::c & AL[AlertList]:::c & BP[BriefPanel]:::c & FH[FeedHealth]:::c
  CON --> MAP3[CesiumScene · Scene3D · MapView]:::c
  CON --> TABS[7 tabs: Situation · Plan · Resources · Results · Red Team · Check next · Options]:::c
  CON --> DB2[DecisionBar]:::c
  TABS --> KIT[viz kit: Panel · Ring · RangeBar · ProbBar · Meter · Chip · Stepper]:::c
```

| Concern | Choice |
|---|---|
| Server state | TanStack Query (polling every minute on the Command Center) |
| Client state | Zustand (`consoleStore`, `operatorStore`) |
| Maps | MapLibre (2D), CesiumJS with Esri terrain/imagery (real 3D), three.js (3D lite with playback) |
| Charts | Recharts plus a small SVG kit (rings, range bars, meters) |
| Styling | Tailwind CSS v4 tokens: `flood`, `risk`, `safe`, `warn` |

## 11. Deployment

```mermaid
flowchart LR
  classDef v fill:#111827,stroke:#e5e7eb,color:#f9fafb
  classDef r fill:#312e81,stroke:#818cf8,color:#eef2ff
  U([Browser]) --> V[Vercel<br/>static React build]:::v
  U -- HTTPS / WSS --> RD[Render<br/>Docker · uvicorn]:::r
  RD --> DISK[(persistent disk<br/>/var/data/aegis.db)]:::r
  RD --> EXT[Groq · Open-Meteo · SACHET · GDACS]:::v
  GH[GitHub Actions<br/>tests · tsc · build · docker]:::v -.-> V & RD
```

Why not serverless for the API: simulations take seconds of CPU, progress streams over a WebSocket, and the decision log needs a disk. Details: [fullstack-deployment-plan.md](fullstack-deployment-plan.md).

## 12. Numbers that matter

| What | Value |
|---|---|
| Silchar road graph | 6,655 nodes · 7,252 edges · 8 key bridges |
| People and places | 178,861 people in 196 areas · 90 shelters (50 relief camps) · 2 boat bases |
| One plan test | 500 futures in about 6 seconds |
| Red Team on Silchar | 2-5 minutes (one re-run per knockout element) |
| River calibration | 16 years of discharge; 2022 replay over 18 days |
| Watched districts | 22, across 8 states and union territories |
| Feed refresh | alerts every 10 minutes, river risk every 3 hours |
| AI brief | one model call; engine numbers cached 30 minutes |
| Tests | about 150 backend tests, plus type-check and build in CI |

## 13. Repo map

```
backend/aegis/
├── engine/      interfaces · sampling · montecarlo · compare · redteam · sensitivity · voi · optimizer · calibration
├── domains/
│   ├── flood/   types · builder · hydrology · evacuation · model · uncertainty · plans · geojson · serialize · checks · demo
│   ├── fire/    stub
│   └── crowd/   stub
├── ops/         feeds/{sachet,gdacs} · districts · risk · poller · advisor · exercise · hazards · store
├── llm/         base · groq/gemini/claude providers · prompts · explain (guardrail) · parse_report
├── fusion/      reports · beliefs
├── ingest/      osm · open_meteo · geocode · shelters · district · cache · http
├── storage/     db · repo (hash chain)
├── replay/      calibration + replay
└── api/         main · routers/{districts,simulate,analysis,workflow,ops,replay} · schemas · limits · services · context
frontend/src/
├── pages/       CommandCenter · Console · Audit · Replay · Landing · Documentation
├── features/    map · ops · situation · plan · results · redteam · check-next · options · decision
├── components/  viz/kit · ui · site
└── state/       consoleStore · operatorStore
```
