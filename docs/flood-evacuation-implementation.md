# Flood Evacuation: Implementation Plan

> This document turns [flood-evacuation-solution.md](flood-evacuation-solution.md) into an actual build plan: what exists today, what is still missing, and the exact steps to get a working web app a judge can click through.

---

## 1. Current status (ground truth, checked against the repo)

| Layer | Status | Where |
|---|---|---|
| Core engine (Monte Carlo, compare, Red Team, sensitivity, VOI, optimizer) | ✅ Built, 7/7 smoke tests passing | [core/engine/](../core/engine) |
| Flood simulation (grid flood-rise, BFS pathfinding, capacity-constrained evacuation) | ✅ Built (prototype grid, not real roads yet) | [domains/flood/model.py](../domains/flood/model.py) |
| Fire / Crowd modules | ⬜ Interface stubs only, not implemented | [domains/fire/](../domains/fire), [domains/crowd/](../domains/crowd) |
| API | ✅ FastAPI with 4 working endpoints | [api/main.py](../api/main.py) |
| **Frontend / web UI** | ❌ **Does not exist yet** | — |
| LLM explanation layer (Groq) | ❌ Not built | — |
| Data fusion, calibration, audit log | ⬜ Planned, not built | — |

**What this document adds:** the frontend, the API additions it needs, and the Groq explanation layer — enough to turn the existing backend into the clickable demo described in the solution doc's section 5 (step-by-step officer walkthrough).

---

## 2. Target architecture

```
┌─────────────────────────────────────────────────────────────┐
│  BROWSER (React + MapLibre + charts)                         │
│  - Map panel · Controls panel · Outcome panel · Red Team panel│
└───────────────────────────┬────────────────────────────────┘
                             │ HTTP + WebSocket (JSON)
┌───────────────────────────▼────────────────────────────────┐
│  FASTAPI (api/main.py + new routers)                         │
│  /flood/* endpoints  →  core/engine/*  →  domains/flood/*    │
│  /flood/explain      →  Groq (LLM narrates engine output)    │
└───────────────────────────────────────────────────────────────┘
```

No new architecture layer is needed under the API — `core/engine` and `domains/flood` already produce everything the UI needs. This plan is almost entirely **frontend + two new endpoints** (`/flood/explain`, a WebSocket for live progress).

---

## 3. Tech stack for the web app

| Piece | Choice | Why |
|---|---|---|
| Frontend framework | **React + Vite** | Fast dev loop, component reuse across the 4 panels |
| Map rendering | **MapLibre GL JS** (or plain `<canvas>` for the grid, see §4.1) | Free, no API key needed for a synthetic grid demo |
| Charts | **Recharts** | Outcome distributions, tornado chart, Pareto scatter |
| State / data fetching | **TanStack Query** | Caches Monte Carlo results, handles loading/error states |
| Styling | **Tailwind CSS** | Fast to build a judge-facing dashboard without a design system |
| Backend | **FastAPI** (already built) + `websockets` | Already in `requirements.txt` via `uvicorn[standard]` |
| LLM | **Groq** (`llama-3.3-70b-versatile`) via the `groq` Python package | Fast inference, narrates Red Team/VOI output only |

Since the flood prototype is a **grid**, not a real road network yet (see solution doc §11), the map panel can start as an HTML5 `<canvas>` grid renderer — no MapLibre/tile server needed until the OSM upgrade (roadmap §8). This cuts real setup time significantly. Switch to MapLibre only after `domains/flood` is upgraded to a real OSM road graph.

---

## 4. Build plan, panel by panel

### 4.1 Panel 1 — Situation Map

**Shows:** the grid, flooded cells (blue, intensity = depth), roads, shelters (icons), population clusters (sized by count), the bridge (highlighted red if it's a current single point of failure).

**Data source:** `GET /flood/demo-scenario` (already built) returns `elevation`, `roads`, `shelters`, `bridges`, `population_clusters` as JSON arrays.

**Steps:**
1. `GridCanvas.tsx` — draws a `<canvas>` grid from the `elevation`/`roads` arrays; one cell = one `<canvas>` rect.
2. Overlay layer: shelters as circles, population clusters as sized dots, bridge as a labeled marker.
3. Flood overlay: re-fetch after each simulation run and recolor cells where `elevation < water_level` (the API needs to return `water_level_m`, which `SimulationResult.metrics["water_level_m"]` already provides — just expose it, see §5.1).
4. Red Team mode: when `single_points_of_failure` includes `bridge_main`, draw that cell with a red pulsing border.

**Estimate:** 0.5–1 day for a working canvas version.

### 4.2 Panel 2 — Live Controls

**Shows:** three sliders (rainfall mm, resource availability %, comms degradation %) plus a plan editor (boats per shelter) and a "Run Simulation" button. This is the panel judges touch during the demo.

**Steps:**
1. `ControlsPanel.tsx` with three `<input type="range">` sliders bound to local state.
2. On "Run Simulation," `POST /flood/monte-carlo` with the slider values narrowed into a tight range around the chosen point (see §5.2 — the current API samples full uncertainty ranges; the demo needs a "what if conditions are roughly X" mode too).
3. Debounce slider changes (300ms) so dragging doesn't spam the API.
4. Loading state while the batch runs (target: under 2 seconds for 200–500 samples at this grid size — measure first, see §6).

**Estimate:** 0.5 day.

### 4.3 Panel 3 — Outcome Panel

**Shows:** evacuated % distribution (mean/p10/p90 as a range bar), resilience (worst-10%), and a Plan A vs Plan B comparison table/chart.

**Data source:** `POST /flood/monte-carlo` (summary + resilience) and `POST /flood/compare` — both already built.

**Steps:**
1. `OutcomeChart.tsx` — Recharts horizontal bar/range chart for p10/p50/p90.
2. `PlanCompareTable.tsx` — side-by-side table reading `compare_summary()` output.
3. A "resilience" badge that turns red/yellow/green based on the worst-10% number, so judges see the "resilience, not just average" point at a glance.

**Estimate:** 0.5 day.

### 4.4 Panel 4 — Red Team Panel

**Shows:** the "🔴 RED TEAM" button, worst-case attribution text, single-point-of-failure ranking, and the sensitivity tornado chart. This is the panel that makes the demo land (solution doc §4, step 3).

**Data source:** `POST /flood/redteam` (already built, returns worst-case futures + SPOFs + sensitivity).

**Steps:**
1. `RedTeamPanel.tsx` with a button that calls `/flood/redteam` and renders:
   - a list of `single_points_of_failure`, sorted (already sorted server-side)
   - a tornado chart from `sensitivity` (horizontal bars, `abs_importance` descending)
   - the top `worst_case_futures` entry's `flagged_variables`
2. Feed the same payload into `/flood/explain` (new endpoint, §5.3) to get the one-paragraph plain-language narration judges actually read.
3. Clicking a SPOF entry (e.g. `bridge_main`) highlights it on the map panel (cross-panel state via a shared store — React Context or Zustand).

**Estimate:** 0.5–1 day (most of it is the map highlight wiring).

---

## 5. Backend additions needed

The engine is done; these are the only server-side gaps.

### 5.1 Expose `water_level_m` and per-cell flood state

`SimulationResult.metrics["water_level_m"]` already exists in [domains/flood/model.py](../domains/flood/model.py). Add a lightweight endpoint that, given conditions, returns the boolean flooded grid so the frontend can paint it without recomputing BFS client-side:

```python
# api/main.py
@app.post("/flood/flood-state")
def flood_state(conditions: ConditionOverride):
    scenario = generate_demo_scenario()
    water_level = (conditions.rainfall_mm or 100) * RAINFALL_TO_WATER_LEVEL
    flooded = (scenario.elevation < water_level).tolist()
    return {"water_level_m": water_level, "flooded": flooded}
```

### 5.2 "Point conditions" mode (not just ranges)

Today `sample_conditions()` always draws from a *distribution*. The slider demo wants: "run N samples **centered tightly around** this exact slider value," so the judge sees a distribution that reacts to their input rather than one that ignores it. Add a `FloodModel.sample_conditions_near(point, spread)` method, or simplest: let `/flood/monte-carlo` accept fixed `rainfall_mm` etc. and jitter ±10% instead of the full prior range.

### 5.3 `/flood/explain` — Groq narration endpoint

```python
# api/explain.py (new file)
import os
from groq import Groq

client = Groq(api_key=os.environ["GROQ_API_KEY"])

def explain_redteam(redteam_payload: dict) -> str:
    prompt = f"""You are narrating the output of a flood-evacuation Red Team
analysis for an operations officer. Use ONLY the data below. Do not invent
numbers or claims not present in it. Be concise (3-4 sentences).

Data:
{redteam_payload}
"""
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )
    return response.choices[0].message.content
```

```python
# api/main.py addition
from api.explain import explain_redteam

@app.post("/flood/explain")
def flood_explain(req: MonteCarloRequest):
    redteam_result = flood_redteam(req)  # reuse existing endpoint logic
    return {"narration": explain_redteam(redteam_result)}
```

**Guardrail (non-negotiable per the solution doc's "math decides, LLM explains" rule):** the prompt only ever receives already-computed numbers. It is never asked to find a weakness itself — only to phrase one.

### 5.4 WebSocket for live progress (optional, nice-to-have)

For the "re-simulates in seconds" effect to feel alive rather than a loading spinner, stream batch progress:

```python
@app.websocket("/flood/monte-carlo/stream")
async def monte_carlo_stream(websocket: WebSocket):
    await websocket.accept()
    req = await websocket.receive_json()
    scenario = generate_demo_scenario()
    plan = _build_plan(PlanOverride(**req.get("plan", {})), scenario)
    rng = np.random.default_rng(req.get("seed", 42))
    for i in range(req["n_samples"]):
        cond = _model.sample_conditions(rng, scenario)
        result = _model.simulate(scenario, plan, cond)
        if i % 20 == 0:
            await websocket.send_json({"progress": i / req["n_samples"]})
    await websocket.send_json({"done": True, ...})
```

Skip this for v1 if time is short — a 1–2 second spinner is fine; add it only if §6's timing shows batches taking long enough to need visible progress.

---

## 6. Performance: measure before promising

The solution doc states a **target** of 1,000 futures in under 5 seconds — this has not been measured yet. Before the demo:

1. Run `python -c "import time; from domains.flood.model import *; from core.engine.montecarlo import run_monte_carlo; m=FloodModel(); s=generate_demo_scenario(); p=generate_demo_plan(s); t=time.time(); run_monte_carlo(m,s,p,n_samples=1000); print(time.time()-t)"` and record the number here.
2. If it's slow (grid BFS per shelter per sample is the likely bottleneck — `len(shelters)` BFS calls × `n_samples`), the fix is to **cache BFS distance grids per unique flood state** rather than recomputing per sample (many samples share the same discretized water level). Memoize `_bfs_distance` keyed by a rounded `water_level`.
3. Re-measure after the fix and put the real number in this doc and in the README (replace "target" with "measured").

---

## 7. Step-by-step build order (hackathon-paced)

| Day | Task | Output |
|---|---|---|
| 1 | §6 performance check + fix if needed; §5.1–5.3 backend additions | API returns everything the UI needs, fast enough |
| 2 | Scaffold React app (Vite + Tailwind); Panel 1 (map canvas) + Panel 2 (controls) wired to live API | Judge can see the grid and move sliders |
| 3 | Panel 3 (outcome chart + compare table) + Panel 4 (Red Team button, SPOF list, tornado chart) | Full loop: change conditions → see outcome → Red Team → see weak point |
| 4 | Groq `/flood/explain` wired into Panel 4; cross-panel highlight (SPOF click → map highlight) | The "aha" moment: plain-language finding + visual highlight together |
| 5 | Polish: fixed demo script, seed values that produce a clean story (plan fails at X mm, bridge is the SPOF, fix raises resilience), backup recorded video | Demo-ready |

This matches the "judge changes weather → Red Team → fix plan → re-simulate" flow from the original pitch and the solution doc §5 walkthrough.

---

## 8. What this plan deliberately defers

Per the solution doc's roadmap (§12), these stay out of scope for the web-app MVP and should not block the demo:

- Real OSM road network (grid stays; swap-in is a `domains/flood` change, not a UI change)
- Data fusion / confidence levels on inputs
- Audit log and plan-editing persistence (editing a plan in the UI is fine; it doesn't need to be saved to a database for the demo)
- Calibration against a real historical flood
- Fire and crowd module UIs (their stubs stay stubs; only flood gets a full UI)

---

## 9. File/folder plan for the new frontend

```
frontend/
  package.json
  vite.config.ts
  src/
    main.tsx
    App.tsx                  # 4-panel layout
    state/
      scenarioStore.ts       # Zustand: current conditions, plan, highlighted element
    api/
      client.ts              # typed fetch wrappers for /flood/* endpoints
    components/
      GridCanvas.tsx          # Panel 1
      ControlsPanel.tsx        # Panel 2
      OutcomeChart.tsx         # Panel 3
      PlanCompareTable.tsx     # Panel 3
      RedTeamPanel.tsx         # Panel 4
      TornadoChart.tsx         # Panel 4 sub-component
```

This sits alongside the existing (currently empty) [frontend/](../frontend) directory already created in the repo skeleton.
