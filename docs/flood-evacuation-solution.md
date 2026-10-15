# Flood Evacuation: The Solution

> **One line:** AEGIS-X lets a flood-response team **test an evacuation plan against hundreds of possible futures before acting**. It shows where and why the plan fails, suggests a stronger plan, and tells the team which information to collect next. **The final decision always stays with a human.**

This document answers the problem described in [flood-evacuation-problem.md](flood-evacuation-problem.md). Each part of the solution is linked to the sub-problem (P1–P10) it solves.

---

## 1. The core idea

Most systems try to **predict** one outcome: "the water will reach 2.1 m". That single number is often wrong, and a plan built on it can fail badly when reality is different.

AEGIS-X does something else:

| Traditional approach | AEGIS-X approach |
|---|---|
| Predict **one** future | Explore **hundreds** of possible futures |
| Find the plan that is best on an average day | Find the plan that **still works on bad days** |
| Show the current situation | Show **what happens next** under each plan |
| Trust the plan | **Attack the plan** to find its weak points |
| "We don't know" | "**This** is the information worth collecting first" |
| AI gives the answer | AI gives evidence, **a human decides** |

Three rules guide the whole system:

1. **Explore, don't predict.** The output is always a range of outcomes, never a single number.
2. **Math decides, the LLM explains.** Every finding comes from simulation and analysis. The language model only turns those results into plain language and never invents a finding.
3. **The human decides.** The system recommends and explains. The authorised officer accepts, changes or rejects the recommendation.

---

## 2. How it works: the decision loop

```
  ┌────────┐   ┌────────────┐   ┌──────────┐   ┌─────────────┐
  │ SENSE  │──▶│ UNDERSTAND │──▶│ SIMULATE │──▶│ STRESS-TEST │
  │ inputs │   │ world model│   │ futures  │   │  red team   │
  └────────┘   └────────────┘   └──────────┘   └──────┬──────┘
       ▲                                              │
       │                                              ▼
  ┌────────┐   ┌────────────┐   ┌──────────┐   ┌─────────────┐
  │ LEARN  │◀──│   HUMAN    │◀──│ EXPLAIN  │◀──│  OPTIMIZE   │
  │ after  │   │  DECISION  │   │  why?    │   │ better plan │
  │ action │   │accept/edit │   │          │   │             │
  └────────┘   └────────────┘   └──────────┘   └─────────────┘
```

| Step | What happens | Solves |
|---|---|---|
| **Sense** | Collect rainfall forecasts, river levels, field reports, resource status and the road network | P1 |
| **Understand** | Merge everything into one map-based model of the situation, with a confidence level on each fact | P1 |
| **Simulate** | Run the plan through hundreds of possible futures | P2, P3 |
| **Stress-test** | The Red Team searches for the conditions and weak points that break the plan | P4, P5 |
| **Optimize** | Search for plans that balance lives saved, time and resources, especially on bad days | P7 |
| **Explain** | Show the results in plain language and on the map, and say what to check next | P6, P9 |
| **Human decision** | The officer accepts, edits or rejects the plan, then re-runs it in seconds | P8, P9 |
| **Learn** | After a drill or real event, compare what was predicted with what happened and improve the model | P10 |

---

## 3. Architecture

### 3.1 One engine, many domains

The whole system is built on **one function contract**:

```
simulate(scenario, plan, conditions) -> outcome metrics
```

- **The flood module** knows about water, roads, shelters and boats. It answers: *"If this is the situation, this is the plan, and this is how the future turns out, what happens?"*
- **The core engine** knows nothing about floods. It calls `simulate()` many times and does all the analysis: Monte Carlo, Red Team, sensitivity, value of information and optimisation.

Because of this split, the same engine also works for **urban fire** and **crowd security**. Only the domain module changes.

### 3.2 Layers

```
┌───────────────────────────────────────────────────────────────┐
│  USER INTERFACE: map, plan editor, sliders, charts, audit log │
├───────────────────────────────────────────────────────────────┤
│  EXPLANATION LAYER: LLM turns engine results into plain text  │
├───────────────────────────────────────────────────────────────┤
│  CORE DECISION ENGINE (domain-agnostic)                       │
│  Monte Carlo │ Plan compare │ Red Team │ Sensitivity │        │
│  Value of Information │ Optimizer │ Calibration               │
├───────────────────────────────────────────────────────────────┤
│  FLOOD DOMAIN MODULE: flood spread + evacuation simulation    │
├───────────────────────────────────────────────────────────────┤
│  WORLD MODEL: road graph, localities, shelters, resources     │
├───────────────────────────────────────────────────────────────┤
│  DATA FUSION: merge reports, resolve conflicts, confidence    │
├───────────────────────────────────────────────────────────────┤
│  INPUTS: forecasts, river levels, DEM, OSM roads, reports     │
└───────────────────────────────────────────────────────────────┘
```

---

## 4. Solution, problem by problem

### P1: Incomplete and conflicting information → **Data Fusion**

**What it does:** Combines reports from different sources into one picture, where every fact carries a confidence level.

**How:**
- Every source gets a **reliability score**: a field team is more reliable than a social media post, and a CWC gauge more than an unverified call.
- Conflicting reports are combined with a **Bayesian update**. For example: "bridge open" (control room, reliability 0.6) and "bridge under water" (field team, reliability 0.9) give "bridge under water, confidence 0.85".
- Older information slowly **loses weight** (time decay).
- Free-text reports ("water has entered ward 12, the NH-27 bridge is closed") are converted into structured events by an LLM: `{type: road_closed, location: NH-27 bridge, confidence: 0.7}`.
- Facts that stay uncertain are **not forced to a single value**. They go into the simulation as uncertainty, for example "bridge open with 40% probability".

**Result for the officer:** one map with confidence colours, instead of ten conflicting messages.

---

### World model → **a map-based model of the situation**

**What it does:** Represents everything that matters for evacuation and how the pieces are connected.

| Element | Represented as |
|---|---|
| Roads and bridges | Graph edges (from OpenStreetMap), each with a flood threshold |
| Localities | Nodes with population and how many vulnerable people they have |
| Shelters | Nodes with capacity and elevation |
| Terrain | Elevation grid (DEM) that decides which places flood first |
| Resources | Boats, vehicles and teams, with location and availability |

**How:** NetworkX / OSMnx for the road graph, plus an elevation (DEM) grid for flooding. The current prototype uses a grid world, and the real road network is the next upgrade.

---

### P2: Uncertain future → **Monte Carlo simulation of many futures**

**What it does:** Instead of one forecast, it runs the plan through **hundreds of possible futures**.

**How:**
1. Each uncertain input is given a range:
   - Rainfall: 80–250 mm (from the IMD forecast range)
   - Boats actually available: 50–100%
   - Communication loss: 0–40%
   - Bridge status: open or closed, with a probability
2. The engine draws hundreds of combinations from these ranges. **Latin Hypercube Sampling** is planned, so fewer runs cover the space evenly.
3. For each future, the **flood simulation** works out which roads and areas go under water, and when.
4. The **evacuation simulation** then:
   - finds the shortest open route from each locality to a shelter (graph search on roads that are still dry)
   - moves people over time steps, limited by the boat and vehicle capacity actually available
   - lets communication loss slow down coordination
5. Each future produces the metrics: % of people evacuated, people stranded, average evacuation time, and how much of the resources were used.

**Result for the officer:** *"In 90% of futures this plan evacuates more than 85% of people, but in the worst 10% only 52% get out."*

---

### P3: Fair plan comparison → **Common random numbers**

**What it does:** Compares Plan A and Plan B under **exactly the same futures**.

**How:** The engine draws the futures once, then runs every plan on the same set. Any difference in results is caused by the plan, not by luck in the sampling.

**Result for the officer:** a side-by-side view of the two plans' outcome distributions, average and worst case.

---

### P4: Hidden weak points → **Red Team engine**

**What it does:** An adversarial engine whose only job is to **break the plan**.

**How:** four techniques, all computed rather than guessed:

| Technique | Question it answers | Status |
|---|---|---|
| **Worst-case analysis** | In the futures where the plan failed worst, which conditions were unusual? | Built |
| **Knockout test** | If we remove one bridge, shelter or resource, how much worse does the plan get? This finds single points of failure. | Built |
| **Scenario discovery (PRIM)** | Which combination of conditions makes the plan fail? For example: "rain > 180 mm **and** bridge closed **and** fewer than 9 boats" | Planned |
| **Adversarial search** | What is the smallest change in conditions that makes the plan fail? | Planned |

The LLM then writes the finding in plain language:

> *"Your plan sends 60% of evacuees across the main bridge. If the bridge closes before hour 3, which happens in 78% of the failing futures, localities 2, 4 and 5 are cut off. This bridge is a single point of failure."* (illustrative example)

On the map, the bridge is **highlighted in red**.

---

### P5: Which uncertainty matters most → **Uncertainty Engine (sensitivity analysis)**

**What it does:** Ranks the uncertain inputs by how much they change the outcome.

**How:**
- **Now:** correlation between each input and the outcome across all simulated futures.
- **Planned:** proper **Sobol sensitivity indices** using SALib, which also capture combined effects.
- Shown as a **tornado chart**.

**Result for the officer:** *"Bridge status explains most of the risk. Rainfall comes second. Communication loss barely matters for this plan."* The team then knows where to focus.

---

### P6: What to find out next → **Active Intelligence (value of information)**

**What it does:** Instead of only saying "we are not sure", it says **which piece of information is most worth collecting** before deciding.

**How:** expected value of information, a standard decision-analysis method:
- Without new information, we must pick one plan for all possible futures.
- If we knew, for example, whether the bridge will stay open, we could pick the best plan **for that case**.
- The difference between the two is the value of that information.
- The engine calculates this for every uncertain input and ranks them.

**Result for the officer:**

| Check | Expected improvement |
|---|---|
| Send a drone to check the bridge water level | **+13% people evacuated** |
| Confirm how many boats are actually ready | +5% |
| Restore radio relay | +1% |

*(illustrative numbers)*

So the advice becomes: *"Send the drone to the bridge first."*

---

### P7: Competing goals → **Multi-objective optimisation for resilience**

**What it does:** Searches for plans that balance:
- maximum people evacuated
- minimum evacuation time
- minimum resources used
- **good performance on bad days** (resilience)

**How:**
- The engine generates many candidate plans (different boat splits, evacuation orders, pre-positioning choices, roads to reinforce).
- Each candidate is tested on the same futures.
- It keeps only the **Pareto-optimal** plans: plans where you cannot improve one goal without making another worse.
- **Resilience metric:** the average outcome in the **worst 10%** of futures, not just the overall average.
- **Now:** random search with a Pareto filter. **Planned:** NSGA-II using pymoo.

**Result for the officer:** a small set of trade-off options, for example:

| Plan | Average evacuated | Worst-10% evacuated | Boats used |
|---|---|---|---|
| A (current) | 88% | 52% | 12 |
| B (suggested) | 86% | **79%** | 12 |
| C (lean) | 81% | 70% | 9 |

*(illustrative)* Plan B is slightly worse on an average day but **much safer on a bad day**. This is what "resilience, not prediction" means in practice.

---

### P8: Conditions change fast → **Fast re-simulation**

**What it does:** When rain gets heavier, boats drop out or comms degrade, the officer moves a slider (or new data arrives) and the whole analysis **re-runs in seconds**.

**How:**
- Vectorised NumPy simulation and pre-computed road graphs
- **Measured: 1,000 futures in ~2.9 seconds** on the demo scenario's 20×20 grid (2026-10-15). Re-measure if the grid grows.
- Results stream to the screen as they are computed (WebSocket).

---

### P9: Human in control → **Human-in-the-loop decision interface**

**What it does:** The system **never acts on its own**. It supports the officer.

**How:**
- Every recommendation comes with a **reason**: which futures, which weak point, which numbers.
- The officer can **accept**, **edit** (for example move 3 boats from Shelter 1 to Shelter 2) or **reject** the recommendation.
- An edited plan is **re-tested immediately**.
- Every decision is stored in an **audit log**: who decided what, when, and based on which analysis. This supports accountability and later review.
- The officer can ask questions in plain language ("Why not send more boats to locality 4?"), and the answer is grounded in the engine's results.

---

### P10: Learning from each event → **Continuous learning (calibration)**

**What it does:** After a drill or a real flood, compares what the system predicted with what actually happened, and improves.

**How:**
- Checks whether the actual outcome fell inside the predicted range (**calibration**).
- Scores the predictions (for example with a Brier score or interval coverage).
- Updates model parameters, such as how fast water rises or how reliable each source is, using the new data.
- Over time the ranges get **narrower and more accurate** for that district.

---

## 5. How an officer uses it: step by step

Using the example from the problem document (6 localities, 3 shelters, 1 main bridge, 12 boats, 80–250 mm of rain forecast):

| Step | Officer does | AEGIS-X shows |
|---|---|---|
| 1 | Loads the district scenario and current reports | Map with localities, shelters, roads and bridge, with a confidence level on each report |
| 2 | Enters Plan A: 4 boats per shelter, evacuate nearest first | Range of outcomes: average 88%, worst 10% only 52% |
| 3 | Clicks **Red Team** | "Main bridge is a single point of failure. The plan fails when rain > 180 mm and the bridge closes before hour 3." The bridge is shown in red. |
| 4 | Looks at the **Uncertainty** panel | Tornado chart: bridge status matters most |
| 5 | Looks at **What to check next** | "Drone check on the bridge: +13%. Do this first." |
| 6 | Clicks **Suggest plans** | Pareto options A, B and C with their trade-offs |
| 7 | Picks Plan B and edits it (pre-positions 2 boats on the far side of the bridge) | Re-tested in seconds: worst 10% rises from 52% to 81% |
| 8 | Weather update: rain range moves up. Officer moves the slider. | Everything re-runs, and Plan B still holds |
| 9 | **Approves** Plan B | Decision saved in the audit log with the full analysis |
| 10 | After the event, enters actual outcomes | Calibration report, and the model is updated for next time |

*(All numbers are illustrative.)*

---

## 6. Why this leads to better decisions

| Problem today | How AEGIS-X changes it |
|---|---|
| Plans built for one expected forecast | Plans tested against the **full range** of what could happen |
| Weak points found after the failure | Weak points found **before** acting, by the Red Team |
| "We don't know" leads to waiting or guessing | "**Check this first**" makes information gathering targeted |
| Best-on-average plans that collapse on bad days | **Resilient** plans that hold up on bad days |
| Re-planning takes hours | Re-checking takes **seconds** |
| Decisions based on gut feeling, hard to explain | Decisions backed by **evidence**, explained and logged |
| Lessons written in reports and forgotten | Lessons **built into the model** |
| Experience stays with individual officers | Knowledge is **captured in the system** and shared |

---

## 7. Technology stack

| Layer | Technology | Why |
|---|---|---|
| Core language | Python | Strong scientific ecosystem |
| Numerical simulation | NumPy, SciPy | Fast, vectorised computation |
| Road network | OpenStreetMap + OSMnx + NetworkX | Free, real road data for any Indian district |
| Terrain | SRTM / Cartosat DEM | Elevation decides where water goes |
| Flood hazard reference | ISRO Bhuvan flood maps, CWC river levels | Ground truth and calibration |
| Rainfall | IMD forecasts | Gives the rainfall range |
| Sampling | Latin Hypercube (SciPy QMC) | Better coverage of futures with fewer runs |
| Sensitivity | SALib (Sobol) | Standard global sensitivity analysis |
| Scenario discovery | EMA Workbench (PRIM) | Finds the condition combinations that break a plan |
| Optimisation | pymoo (NSGA-II) | Standard multi-objective optimisation |
| Backend API | FastAPI + WebSocket | Fast API and live result streaming |
| Frontend | React + MapLibre / deck.gl + charts | Interactive map and visual results |
| Language layer | LLM: Claude API (e.g. Sonnet 5.5) online, or a local open model for offline / air-gapped use | Parses reports and explains results |
| Storage | SQLite (prototype) → PostgreSQL + PostGIS | Scenarios, plans, audit log, spatial data |
| Testing | pytest | Every engine module is tested |

---

## 8. Data inputs

| Input | Source | Used for |
|---|---|---|
| Road network | OpenStreetMap | Routes and shortest paths |
| Elevation | SRTM / Cartosat DEM | Which areas flood first |
| Rainfall forecast | IMD | Range of rainfall in futures |
| River and reservoir levels | CWC, state water resources departments | Flood level |
| Shelters | District Disaster Management Plan, OSM (schools, community halls) | Destinations and capacity |
| Population | Census, WorldPop | People per locality |
| Resources | District EOC records | Boats, vehicles, teams |
| Field reports | Control room, field teams, social media | Live situation updates |
| Past floods | Bhuvan flood maps, inquiry reports | Calibration and validation |

For the competition demo, a **fictional district** with synthetic data is used, so no sensitive real data is needed.

---

## 9. How the solution meets the success criteria

These are the criteria from section 9 of the problem document:

| # | Success criterion | How AEGIS-X meets it |
|---|---|---|
| 1 | See the plan across hundreds of futures | Monte Carlo engine produces a distribution of outcomes |
| 2 | See worst-case behaviour | Resilience metric (worst 10%) and worst-case analysis |
| 3 | Be told specifically what breaks the plan | Red Team: knockout test plus scenario discovery |
| 4 | Compare plans under identical conditions | Common random numbers in plan comparison |
| 5 | Know which uncertainty to reduce first | Sensitivity analysis plus value of information |
| 6 | Get updated answers in seconds | Fast re-simulation with live sliders (speed target still to be measured) |
| 7 | Understand why, and accept, change or reject | LLM explanations from engine results, plan editor, audit log |

---

## 10. What makes AEGIS-X different

| Existing tool type | What it does | What AEGIS-X adds |
|---|---|---|
| Flood forecasting (IMD, CWC) | Predicts water levels | Shows what the forecast means **for your plan** |
| GIS / dashboards / ICCC | Shows the current situation | Simulates **what happens next** under each plan |
| Static disaster plans | A fixed plan written once a year | A plan **tested, attacked and improved** for today's conditions |
| Mock drills | One scenario, a few times a year | Hundreds of scenarios, in seconds, as often as needed |
| AI chatbots | Text answers | Answers **backed by simulation**, with the reasoning shown |

**In one sentence:** *Most systems try to predict what will happen. AEGIS-X explores what could happen, tests how a plan behaves across all of it, attacks its own recommendation, and shows the human decision-maker where the plan can fail.*

---

## 11. Limitations and safeguards

We state these openly:

| Limitation | How we handle it |
|---|---|
| The model is a simplification of reality | Results are shown as **ranges**, never as certainties. Calibration improves the model over time. |
| Input ranges can be wrong | Sensitivity analysis shows whether the recommendation **changes** if the ranges change |
| Flood model is simplified (elevation-based, not full hydraulics) | Enough for comparing **plans**. It can be replaced later with a hydraulic model such as HEC-RAS outputs without changing the engine. |
| Prototype uses a grid world, not the real road network | Upgrade path to OSMnx is already designed into the engine |
| The LLM could produce wrong text | The LLM only explains engine output and never creates findings. Every claim links back to the numbers. |
| Over-trust in the system | The human decides, the reasons are always shown, and every decision is logged |
| Sensitive data | Can run fully **offline / on-premise** with a local model |

---

## 12. Current status and roadmap

| Component | Status |
|---|---|
| Core engine contract (`simulate()`) | ✅ Built |
| Flood simulation (grid world, flood rise, routes, capacity) | ✅ Built (prototype) |
| Monte Carlo engine | ✅ Built |
| Fair plan comparison | ✅ Built |
| Red Team: worst-case analysis and knockout test | ✅ Built |
| Sensitivity analysis (correlation) | ✅ Built |
| Value of information | ✅ Built |
| Optimiser (random search + Pareto) | ✅ Built |
| API (FastAPI) | ✅ Built |
| Interactive map and dashboard UI | ⬜ Next |
| Live sliders and fast re-simulation | ⬜ Next |
| LLM explanation layer | ⬜ Planned |
| Data fusion with confidence levels | ⬜ Planned |
| Real road network (OSMnx) and DEM | ⬜ Planned |
| Scenario discovery (PRIM) and adversarial search | ⬜ Planned |
| Sobol sensitivity and NSGA-II optimiser | ⬜ Planned |
| Audit log and plan editor | ⬜ Planned |
| Calibration and learning loop | ⬜ Planned |
| Urban fire and crowd security modules | ⬜ Planned (interfaces ready) |
