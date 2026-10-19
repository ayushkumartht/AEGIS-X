# AEGIS-X

**"Test the decision before reality does."**

AEGIS-X is a decision-intelligence platform for high-risk operations. It
doesn't predict a single outcome — it runs a plan through hundreds of
simulated futures, has a Red Team actively try to break it, tells you
which uncertainty matters most, and shows a human decision-maker where
the plan is strong and where it's fragile. The human always makes the
final call.

Built for the INNOTECH competition. Primary domain: **flood evacuation**.
Two thin modules (**urban fire**, **crowd/event security**) exist to
prove the core engine is domain-agnostic.

## Why this architecture

Every domain plugs into the SAME core engine through one function:

```
simulate(scenario, plan, conditions) -> metrics
```

- **A domain module** ([backend/aegis/domains/flood](backend/aegis/domains/flood), [fire](backend/aegis/domains/fire), [crowd](backend/aegis/domains/crowd)) provides
  the hazard model, how people/agents behave, the plan format, and the
  metrics that matter for that domain.
- **The core engine** ([backend/aegis/engine](backend/aegis/engine)) provides, generically, on top of
  `simulate()`: Monte Carlo sampling, Red Team analysis, sensitivity
  analysis, value-of-information ranking, multi-objective plan
  optimisation, and fair plan-vs-plan comparison.

Nothing in `backend/aegis/engine` imports anything from `domains/` (enforced by a test). That's the
whole "Core Engine + Modules" platform story — provably true in the code,
not just a claim on a slide.

## Project layout

```
backend/aegis/
  engine/         domain-free core (never imports domains/)
    interfaces.py   Scenario / Plan / Conditions / SimulationResult / DomainModel
    montecarlo.py   run_monte_carlo() — hundreds of simulated futures
    compare.py      compare_plans() — Plan A vs B on IDENTICAL sampled futures
    redteam.py      find_worst_case() + find_single_points_of_failure()
    sensitivity.py  which uncertain inputs matter most (tornado chart data)
    voi.py          expected_value_of_information() — "what to check next"
    optimizer.py    random_search_optimize() — Pareto front across objectives
  domains/flood/    FULL implementation: types.py, model.py, demo.py
  domains/fire/     stub — same interface
  domains/crowd/    stub — same interface
  api/              FastAPI layer (main.py, explain.py)
  settings.py       settings from .env
backend/tests/      smoke tests + layer-rule test
frontend/           React app (landing, docs, demo)
data/               district configs, reference data, fetched-data cache
scripts/            dev.ps1, commit.ps1
docs/               start at docs/README.md; master plan = final-implementation-plan.md
```

## Quickstart

```powershell
python -m venv .venv
.\.venv\Scripts\pip install numpy scipy fastapi "uvicorn[standard]" pydantic pydantic-settings httpx groq==1.7.0 pytest

# run the tests (from backend/)
cd backend
..\.venv\Scripts\python.exe -m pytest -v

# run the API (from backend/)
..\.venv\Scripts\python.exe -m uvicorn aegis.api.main:app --port 8000 --reload
# then open http://127.0.0.1:8000/docs

# or start backend + frontend together from the repo root
.\scripts\dev.ps1
```

### Frontend (demo UI)

```powershell
cd frontend
npm install
npm run dev
# open http://localhost:5173 (requires the API running on :8000, see above)
```

Copy `.env.example` to `.env` and set `GROQ_API_KEY` to enable the Red Team
narration button; everything else works without it. See
[docs/archive/flood-evacuation-steps.md](docs/archive/flood-evacuation-steps.md) for the
full build log, the demo script, and two real bugs found and fixed while
building this (inverted resilience calculation; a road-grid topology that
had no actual single point of failure).

## The flood module (what's actually implemented)

A grid world stands in for a real road network for now (see milestone 7
to swap in OpenStreetMap via OSMnx). Everything else is real,
working logic, not a mock:

- **Flood rise:** water level driven by rainfall vs. each cell's
  elevation; "reinforced" cells (from the plan) get extra tolerance.
- **Reachability:** actual multi-source BFS shortest paths over the
  (possibly flooded) road grid — a plan that routes to the wrong
  shelter really does perform worse, the model isn't a formula that
  ignores the map.
- **Evacuation:** capacity-constrained over discrete time ticks. Boats
  per shelter, resource availability, and comms degradation all
  genuinely limit throughput.
- **Uncertain conditions sampled per run:** rainfall, resource
  availability %, comms degradation %.

Uncertain inputs: `rainfall_mm`, `resource_availability_pct`,
`comms_degradation_pct`. Outcome metrics: `evacuated_pct`,
`stranded_count`, `avg_time_to_evacuate`, `resource_utilization`.

## What each core/engine pillar actually computes

| AEGIS-X pillar | Module | Real technique |
|---|---|---|
| Generates multiple futures | `montecarlo.py` | Monte Carlo sampling of uncertain conditions |
| Tests different plans | `compare.py` | Same sampled futures replayed per plan (fair A/B) |
| Red-Team AI | `redteam.py` | (a) z-score attribution on the worst Monte Carlo runs (b) remove-one-element-at-a-time impact test |
| Uncertainty Engine | `sensitivity.py` | Pearson correlation of each uncertain input vs. outcome (Sobol via SALib is the documented upgrade) |
| Active Intelligence | `voi.py` | Expected value of information: how much better the best achievable plan gets if an uncertain variable were known |
| Optimization | `optimizer.py` | Random search + Pareto-front (non-dominated sorting) across objectives (NSGA-II via pymoo is the documented upgrade) |
| Resilience (not just average) | `montecarlo.py: MonteCarloBatch.resilience()` | Mean outcome of the worst 10% of sampled futures |

The LLM's job in this system is to **narrate** what these functions find
("Bridge B is a single point of failure because...") — it never decides
the finding itself. That line matters when a judge asks "is this just an
LLM talking?"

## Build order (each step leaves a working demo)

1. ✅ Core engine interfaces + Monte Carlo + flood grid/BFS/evacuation simulate()
2. ✅ Plan comparison on identical sampled futures
3. ⬜ Live demo controls (weather/resources/comms sliders) wired to `/flood/monte-carlo`
4. ✅ Red Team: worst-case attribution + single-point-of-failure
5. ⬜ Replace Pearson correlation with real Sobol indices (SALib) once ranges are stable
6. ✅ Optimizer (random search + Pareto front); upgrade to NSGA-II (pymoo) if time allows
7. ⬜ Fill in `domains/fire` and `domains/crowd` (stubs already match the interface) + calibrate flood against a real event (Chennai 2015 / Kerala 2018) for a credibility check

## Honest limitations (say these out loud before a judge asks)

- Grid world, not a real road network — swap for OSMnx + a real DEM for production.
- Flood-rise and evacuation-capacity constants ([backend/aegis/domains/flood/model.py](backend/aegis/domains/flood/model.py) top) are
  illustrative, not calibrated against a real event yet.
- Sensitivity analysis uses Pearson correlation, a simplified stand-in
  for Sobol indices (documented in `sensitivity.py`).
- Optimizer uses random search + Pareto front, a simplified stand-in for
  NSGA-II (documented in `optimizer.py`).
- Fire and crowd modules are interface-matching stubs, not implemented.
