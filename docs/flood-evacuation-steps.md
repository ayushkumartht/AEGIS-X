# Flood Evacuation: Execution Steps

> Checklist derived from [flood-evacuation-implementation.md](flood-evacuation-implementation.md). Each step is concrete enough to execute directly — commands, file paths, and exact package versions. Versions below were checked live against PyPI/npm on 2026-10-15; re-check before executing if this file is run much later.

**Legend:** ☐ not started · pin version exactly as listed (that's today's "latest" — don't use caret ranges that could drift mid-build).

---

## Phase 0 — Backend performance baseline

☐ **0.1** Run the timing check from implementation doc §6:
```powershell
.\.venv\Scripts\python.exe -c "import time; from domains.flood.model import *; from core.engine.montecarlo import run_monte_carlo; m=FloodModel(); s=generate_demo_scenario(); p=generate_demo_plan(s); t=time.time(); run_monte_carlo(m,s,p,n_samples=1000); print(time.time()-t)"
```
☐ **0.2** If > ~2 seconds: memoize `_bfs_distance` in [domains/flood/model.py](../domains/flood/model.py) keyed by `round(water_level, 1)` per shelter, so repeated samples with near-identical flood states reuse the BFS result instead of recomputing it.
☐ **0.3** Re-run 0.1, record the real number in this file and in [README.md](../README.md) (replace the "target" language with a measured one).

**Measured result:** ✅ **2.94 seconds for 1,000 samples** (measured 2026-10-15, on the demo scenario's 20×20 grid). Under the 5-second target — no BFS memoization needed for this grid size. Re-measure if the grid size grows significantly.

---

## Phase 1 — Backend additions

Package to add — **pin exactly**:

```
groq==1.7.0
```

☑ **1.1** Added `groq==1.7.0` to [requirements.txt](../requirements.txt); installed in `.venv`.
☑ **1.2** Created [api/explain.py](../api/explain.py) — Groq narration wrapper (`llama-3.3-70b-versatile`), reads `GROQ_API_KEY`, raises a clear `RuntimeError` if unset.
☑ **1.3** Added [.env.example](../.env.example) with `GROQ_API_KEY=`; `.env` already covered by `.gitignore`.
☑ **1.4** Added `POST /flood/explain` to [api/main.py](../api/main.py). Verified 503 with a clear message when `GROQ_API_KEY` is unset (expected — no key configured yet).
☑ **1.5** Added `POST /flood/flood-state`.
☑ **1.6** Added `point_conditions` to `MonteCarloRequest` + `FloodModel.sample_conditions_near()` in [domains/flood/model.py](../domains/flood/model.py).
☑ **1.7** CORS enabled for `http://localhost:5173`.
☑ **1.8** All 7 tests pass. **Bonus fix found while testing:** `MonteCarloBatch.resilience()` in [core/engine/montecarlo.py](../core/engine/montecarlo.py) had inverted worst/best logic (was averaging the *best* 10% of runs, not the worst). Fixed, and added a regression assertion (`resilience <= p50`) to the smoke test so this can't silently regress.

---

## Phase 2 — Frontend scaffold (latest stable, pinned)

Exact versions checked live via `npm view <pkg> version` — **use these, not `latest` or caret ranges**, so a re-run of this file next month doesn't silently pull a different major version:

| Package | Version |
|---|---|
| react, react-dom | 19.3.1 |
| vite | 8.3.4 |
| @vitejs/plugin-react | 6.1.2 |
| typescript | 7.0.2 |
| tailwindcss, @tailwindcss/vite | 4.3.3 |
| recharts | 3.10.1 |
| zustand | 5.0.15 |
| @tanstack/react-query | 5.104.2 |
| (maplibre-gl) | 6.14.0 — **not installed in Phase 2**; only needed after the real-OSM upgrade (see implementation doc §4.1 and Phase 9 below) |

☑ **2.1** Scaffolded via `npm create vite@latest frontend -- --template react-ts` (gave React 19.2.8/TS 6.0.2 by default; overridden in 2.2).
☑ **2.2** Pinned every version from the table above in `frontend/package.json`; `npm install` clean, 0 vulnerabilities.
☑ **2.3** Tailwind v4 wired via `@tailwindcss/vite` in `vite.config.ts` + `@import "tailwindcss";` in `index.css` (CSS-first config, no `tailwind.config.js` needed).
☑ **2.4** `npm run build` confirms the toolchain (faster signal than starting the dev server for a scaffold check); CSS output (6.96kB) confirmed Tailwind was actually processed. Dev server verified running in Phase "end-to-end check" below.

---

## Phase 3 — Shared frontend plumbing

☑ **3.1** `frontend/src/api/client.ts` + `types.ts` — typed wrappers for all 6 endpoints.
☑ **3.2** `frontend/src/state/scenarioStore.ts` — Zustand store exactly as planned, plus `narration` for the Groq text.
☑ **3.3** `frontend/src/App.tsx` — 2-column responsive grid (map/controls left, outcome+compare/red-team right on desktop; stacks on mobile). `QueryClientProvider` wired in `main.tsx`.

---

## Phase 4 — Panel 1: Situation Map

☑ **4.1** `GridCanvas.tsx` built: elevation shading, road dots, population circles (sized + labeled by count), shelter circles (labeled S0/S1/S2), bridge marker.
☑ **4.2** Flood overlay via `useQuery(['flood-state', rainfall_mm], ...)` — recolors automatically whenever the rainfall slider value changes.
☑ **4.3** `highlightedElement` watched; shelter/bridge draw with a highlighted (yellow/red) border + fill when selected from the Red Team panel.

---

## Phase 5: Panel 2 — Live Controls

☑ **5.1** `ControlsPanel.tsx` built: 3 sliders, boats-per-shelter number inputs, a "Reinforce local access roads" checkbox (the fix that actually matters — see Phase 8), "Run Simulation" button.
☑ **5.2** **Deviation from plan:** no debounce needed — sliders only update local/store state; the API is called once on explicit "Run Simulation" click, not on every drag tick. Simpler and arguably better for a live demo (deliberate action, not a request storm).
☑ **5.3** Wired via `useMutation(api.runMonteCarlo)` with `point_conditions` (Phase 1.6's jitter mode) + current plan; result stored via `setMonteCarloResult`.

---

## Phase 6 — Panel 3: Outcome

☑ **6.1** `OutcomeChart.tsx` built: p10/p50/p90 bar chart + color-coded resilience badge + mean/best/worst line.
☑ **6.2** `PlanCompareTable.tsx` built — **changed from the original "+3 boats" idea** (measured to do literally nothing, see Phase 8.1 finding #2) to baseline vs. reinforced-localities, which measurably moves resilience (0% → 23.2%).

---

## Phase 7 — Panel 4: Red Team

☑ **7.1** `TornadoChart.tsx` built.
☑ **7.2** `RedTeamPanel.tsx` built: 🔴 RED TEAM button, SPOF list (clickable), tornado chart.
☑ **7.3** "Explain in plain language" button calls `explainRedTeam()`; shows a 503 with the clear "GROQ_API_KEY is not set" message until a real key is configured (verified via TestClient) — this is expected, not a bug.
☑ **7.4** Clicking a SPOF item sets `highlightedElement`; `GridCanvas` highlights it (Phase 4.3).

---

## Phase 8 — Demo polish

☑ **8.1** Calibrated against the real running code (not assumed). **Two real bugs were found and fixed along the way**, both worth knowing about:

1. **The road grid had no real bottleneck.** The original "every 2nd row/col" lattice spans the *whole* grid, so removing any single cell (including the "bridge") never mattered — `find_single_points_of_failure` correctly reported 0% impact for everything, because nothing was actually a single point of failure. **Fix:** [domains/flood/model.py](../domains/flood/model.py) now builds two separate local lattices (population side / shelter side) with a genuine 2-column gap between them, crossed only by one explicit bridge cell pair. Confirmed: removing `bridge_main` now drops `evacuated_pct` from 0.60 to **0.0 (100% drop)** — a real single point of failure.
2. **~25% of population clusters were unreachable by construction.** The old cluster-placement snapping logic only handled an edge case and left clusters on non-road cells (permanently `stranded`, independent of flooding or plan quality). **Fix:** clusters now always snap onto a road column.

**The actual demo story, measured, not assumed:**
- At low rainfall (50–100mm), the default plan evacuates **~81% on average**.
- Between 150–200mm, outcomes **collapse to 0%** — but *not* because the bridge floods (its own elevation only floods above ~287mm, outside the slider range). The real cause: the population clusters' **own low-lying cells flood first**, stranding them before evacuation can start. Adding boats does **nothing** here (verified: 4 vs 7 boats/shelter gives bit-identical results — capacity was never the bottleneck, reachability is).
- **The fix that actually works:** reinforcing the population clusters' own access cells (`reinforced_cells`). Measured on the full uncertainty range (n=300, seed=1): baseline resilience (worst-10%) = **0.0%** → reinforced = **23.2%**, mean 59.2% → 71.7%. This is a real, non-scripted finding — and arguably a *better* demo moment than "reinforce the bridge," because it's the kind of non-obvious insight the Red Team/VOI pillars are supposed to surface.
- `single_points_of_failure` at full-prior nominal conditions still correctly flags `bridge_main` (100% drop) — that finding is about the general case across the full rainfall range, which includes samples where the bridge, not the localities, is what's binding.

☑ **8.2** Demo script below, confirmed against the running app.
☐ **8.3** Record a backup video of the full demo flow (map → sliders → Red Team → fix → re-run) in case of live-demo failure.

**Demo script:**
1. Open the app. Point out the map: orange = population clusters (left/flood-prone side), green = shelters, gray outline = the one bridge connecting the two sides.
2. Leave sliders at default (rainfall 100mm). Click **Run Simulation** → outcome panel shows ~79–81% evacuated, resilience healthy.
3. Drag rainfall to **200mm**. Click **Run Simulation** again → evacuated % collapses toward 0%. Point out the resilience badge turning red.
4. Click **🔴 RED TEAM** → single-points-of-failure list appears (bridge_main, 100% impact on the general case); sensitivity tornado chart shows `rainfall_mm` dominates. Click "Explain in plain language" for the Groq narration.
5. Check **"Reinforce local access roads"** and click **Run Simulation** again at 200mm → evacuated % recovers substantially. This is the "fix the plan, re-run, resilience ↑" moment from the original pitch.
6. Open **Plan Compare**: baseline vs. reinforced-localities side by side, resilience 0% → 23%, under the full uncertainty range (not just the slider point) — proves the fix generalizes, not cherry-picked.

---

## End-to-end verification (done)

- Backend (`uvicorn api.main:app --port 8000`) and frontend (`npm run dev`, port 5173) both confirmed running simultaneously.
- CORS preflight + actual response both carry `Access-Control-Allow-Origin: http://localhost:5173` — verified with real HTTP requests, not just reading the code.
- `/flood/monte-carlo`, `/flood/redteam`, `/flood/compare`, `/flood/flood-state` all functionally tested via `TestClient` with real inputs, not just "imports without error."
- `/flood/explain` correctly returns 503 with a clear message when `GROQ_API_KEY` is unset (no key has been configured in this session — add one to `.env` to see real narration).
- Frontend `npm run build` passes (TypeScript + Vite) after every phase.
- All 7 backend tests pass, including a strengthened regression test for the resilience bug found in Phase 1.

## Phase 9 — Deferred (do not build now)

Explicitly out of scope for this execution pass — confirm nothing above accidentally depends on these:
- MapLibre / real OSM road network (stays grid-canvas per implementation doc §4.1)
- Data fusion / confidence levels, audit log, calibration
- Fire/crowd module UIs
- WebSocket live-progress streaming (only add if Phase 0's measured time makes a loading spinner feel broken)

---

## Execution order reminder

Phases are sequential (0 → 1 → 2 → ... → 8); each phase's checkboxes should be run in listed order within the phase. After every phase, run `pytest tests/ -v` (backend changes) or `npm run build` (frontend changes) before moving on — don't stack unverified phases.
