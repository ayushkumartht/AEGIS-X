# AEGIS-X: Final Implementation Plan

> **One line:** This is the master build plan for AEGIS-X, from data ingestion to the officer's decision screen. Every later implementation step should start from this document.

**Read first:** [flood-evacuation-problem.md](flood-evacuation-problem.md) (the problem), [flood-evacuation-solution.md](flood-evacuation-solution.md) (the solution), [flood-decisions-uncertainty-data.md](flood-decisions-uncertainty-data.md) (the research on decisions, uncertainty and data sources).

**Replaces:** [flood-evacuation-implementation.md](flood-evacuation-implementation.md) and [flood-evacuation-steps.md](flood-evacuation-steps.md). Those described the v0 grid demo, which is built. Keep them as history (Phase 0 moves them to `docs/archive/`).

---

## Contents

1. [What we are building](#1-what-we-are-building)
2. [Where we are today](#2-where-we-are-today)
3. [Architecture](#3-architecture)
4. [Tech stack](#4-tech-stack)
5. [Folder structure](#5-folder-structure)
6. [Module design](#6-module-design)
7. [API](#7-api)
8. [Frontend](#8-frontend)
9. [Configuration and secrets](#9-configuration-and-secrets)
10. [Testing](#10-testing)
11. [Engineering rules](#11-engineering-rules)
12. [Build phases](#12-build-phases)
13. [Risks](#13-risks)
14. [Open decisions](#14-open-decisions)

---

## 1. What we are building

### 1.1 The product

A web app for a district flood-response team that:

1. Loads a **real district** (first: **Cachar, Assam**, including Silchar), with real terrain, roads, bridges, population and shelters.
2. Pulls the **latest forecast as a range** (rain and river flow ensembles) and turns it into hundreds of possible futures.
3. Lets the officer enter an **evacuation plan** and tests it against those futures.
4. Runs the **Red Team**, **sensitivity**, **value of information** and **optimiser** on the plan.
5. Explains the results in plain language, with an **LLM that only narrates engine output**.
6. Records the officer's **accept / edit / reject** decision in an audit log.
7. Can **replay a past flood** (Silchar, June 2022) hour by hour, to show the system working on a real event and to calibrate it.

### 1.2 What "done" looks like (final demo)

| # | The judge sees | Proves |
|---|---|---|
| 1 | Cachar on a real map: Barak river, roads, bridges, settlements, shelters | Works on real data, not a toy grid |
| 2 | Today's forecast range for Silchar, pulled live (or from cache when offline) | Real inputs, uncertainty as a range |
| 3 | A plan tested on 500 futures: average and worst-10% outcome | Explore, don't predict |
| 4 | Red Team names the bridge or road that breaks the plan and highlights it on the map | Hidden weak points |
| 5 | "Check bridge X first: +N% expected evacuated" | Value of information |
| 6 | Optimiser offers 3 plans with clear trade-offs; officer edits one and re-runs in seconds | Resilience and speed |
| 7 | Officer approves; the decision appears in the audit log with its evidence | Human in control |
| 8 | Replay of June 2022: what the system would have advised at each hour, compared with what happened | Credibility and calibration |

### 1.3 Out of scope

Same as the problem document: no flood forecasting of our own (we use IMD, GloFAS and others), no field execution, no relief-camp management, no hardware.

---

## 2. Where we are today

Checked against the repo on 2026-10-22. (The table that stood here on 2026-10-19 described the v0 grid demo; every phase in section 12 has since been built.) Latest detail: [flood-final-status-and-demo.md](flood-final-status-and-demo.md); going live: [fullstack-deployment-plan.md](fullstack-deployment-plan.md).

| Area | State | Location |
|---|---|---|
| Engine: Monte Carlo (LHS), Red Team (failure boxes, adversarial search, knockouts), Sobol sensitivity, VOI, NSGA-II optimiser, calibration | ✅ Built | `backend/aegis/engine/` |
| Flood model on the real Cachar road graph: time-stepped 48 h, HAND flood thresholds, calibrated rating curve, boats, shelters, compliance | ✅ Built | `backend/aegis/domains/flood/` |
| Real data for Silchar/Cachar: OSM roads/river/bridges/shelters/buildings, Open-Meteo forecast, GloFAS discharge, DEM | ✅ Built and committed | `data/processed/cachar`, `data/raw/cachar` |
| Storage, audit log, field-report fusion, June 2022 replay | ✅ Built | `storage/`, `fusion/`, `replay/` |
| API (`/api/v1`), WebSocket progress, rate limits | ✅ Built | `backend/aegis/api/` |
| Accounts (admin/officer/viewer) and Command Center | ✅ Built | `aegis/auth.py`, `/command` |
| LLM narration (Groq/Gemini/Claude) with number guardrail | ✅ Built; key read from `.env` | `backend/aegis/llm/` |
| Console with 3 views (Cesium real terrain, three.js, 2D) and hour-by-hour playback | ✅ Built | `frontend/src` |
| Deployment: Dockerfile, Render blueprint, Vercel config, CI | ✅ Built | `backend/Dockerfile`, `render.yaml`, `frontend/vercel.json` |
| Fire and crowd modules | ⬜ Stubs | `domains/fire`, `domains/crowd` |
| Official shelter list and boat inventory for Cachar; census-grade population | ⬜ Needs the district's documents | `data/reference/` |

---

## 3. Architecture

### 3.1 Layers

```
┌──────────────────────────────────────────────────────────────────────┐
│ 7. FRONTEND        React: map, plan editor, results, Red Team,       │
│                    "check next", decision bar, audit log, replay     │
├──────────────────────────────────────────────────────────────────────┤
│ 6. API             FastAPI /api/v1 (REST + WebSocket)                │
├──────────────────────────────────────────────────────────────────────┤
│ 5. LLM LAYER       Explains results, parses field reports.           │
│                    Provider-agnostic: Groq / Gemini / Claude / none  │
├──────────────────────────────────────────────────────────────────────┤
│ 4. CORE ENGINE     Monte Carlo · Compare · Red Team · Sensitivity ·  │
│    (domain-free)   VOI · Optimiser · Calibration                     │
├──────────────────────────────────────────────────────────────────────┤
│ 3. DOMAIN MODULE   flood: hydrology + evacuation simulation,         │
│                    uncertainty model, scenario builder               │
├──────────────────────────────────────────────────────────────────────┤
│ 2. FUSION          Field reports → beliefs with confidence           │
├──────────────────────────────────────────────────────────────────────┤
│ 1. INGESTION       Fetch + cache: Open-Meteo, OSM, WorldPop, DEM,    │
│                    shelters CSV, (later) IMD, CWC, Flood Hub         │
├──────────────────────────────────────────────────────────────────────┤
│ 0. STORAGE         data/ files (raw, processed) + SQLite database    │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 Data flow

```
 ┌───────────── ONCE PER DISTRICT ─────────────┐   ┌──────── EVERY FEW HOURS ────────┐
 │ DEM + OSM + WorldPop + shelters CSV          │   │ Rain ensemble + river ensemble │
 │        │ ingest/                              │   │        │ ingest/                │
 │        ▼                                      │   │        ▼                        │
 │ builder.py → FloodScenario (road graph,       │   │ uncertainty.py → ConditionSpace│
 │   flood thresholds, clusters, shelters)       │   │   (ranges for every unknown)   │
 └──────────────────────┬───────────────────────┘   └──────────────┬─────────────────┘
                        │        field reports → fusion/ → beliefs ─┤ (narrows ranges)
                        ▼                                           ▼
                 ┌──────────────────────────────────────────────────────┐
  officer ─────▶ │ PLAN  ─▶  engine: sample N futures from ConditionSpace │
  (plan editor)  │           simulate(scenario, plan, future) × N         │
                 │           → distributions, Red Team, VOI, optimiser    │
                 └───────────────────────────┬──────────────────────────┘
                                             ▼
                          LLM explains ─▶ officer decides ─▶ audit log
```

### 3.3 The three engine inputs

| Input | Meaning | Built from | Changes |
|---|---|---|---|
| **Scenario** | The district as it is | DEM, OSM, WorldPop, DDMP shelters | Once per district (rebuild if data changes) |
| **ConditionSpace → Conditions** | What we don't know, as ranges; one sample = one future | Forecast ensembles, priors, fused field reports | Every forecast update or new report |
| **Plan** | What the officer decides | Plan editor or optimiser | Every edit |

The engine never fetches data and never imports a domain. It only calls the `DomainModel` interface.

---

## 4. Tech stack

Pin exact versions at install time and record them in `backend/pyproject.toml` and `frontend/package.json` (the frontend is already pinned).

### 4.1 Backend

| Purpose | Choice | Notes |
|---|---|---|
| Language | **Python 3.13** | Already used in `.venv` |
| Packaging | `pyproject.toml` + `pip install -e ".[dev]"` | Replaces `requirements.txt` |
| Numerics | NumPy, SciPy | Already used |
| Road graph and routing | **NetworkX**, **OSMnx** | OSMnx downloads the OSM road graph for a bounding box |
| Rasters (DEM, population) | **rasterio** | Read GeoTIFF windows for the district |
| Vector data | **GeoPandas**, **Shapely**, **pyproj** | Shelters, rivers, reprojection |
| HTTP | **httpx** | One client with timeout, retries and caching |
| Config | **pydantic-settings** | Loads `.env` automatically |
| API | **FastAPI** + **uvicorn** | Already used |
| Database | **SQLModel** on **SQLite** | Move to PostgreSQL + PostGIS only if needed later |
| Sampling | SciPy `qmc.LatinHypercube` | Better coverage with fewer runs |
| Sensitivity | **SALib** (Sobol) | Replaces correlation-only sensitivity |
| Scenario discovery | **EMA Workbench** (PRIM) | "Fails when A > x and B < y" |
| Multi-objective optimiser | **pymoo** (NSGA-II) | Replaces random search |
| LLM SDKs | `groq` (existing), `google-genai`, `anthropic` | Behind one provider interface (§6.8) |
| Tests | pytest, **respx** (HTTP mocking) | No network in tests |
| Lint and format | ruff (optional, add later) | Could not be installed from the package index on 2026-10-19 |

### 4.2 Frontend

| Purpose | Choice | Notes |
|---|---|---|
| Framework | React 19 + Vite + TypeScript | Already set up |
| Styling and UI | Tailwind v4, shadcn/ui (Radix), lucide icons | Already set up |
| Map | **MapLibre GL JS** | Free, no key. Basemap tiles from a free style (for example OpenFreeMap). Check the tile provider's terms before choosing. |
| Charts | Recharts | Already used |
| Server state | TanStack Query | Already used |
| UI state | Zustand | Already used |
| API types | **openapi-typescript** | Generates TS types from FastAPI's OpenAPI schema, so frontend and backend can't drift |
| Routing | react-router-dom | Already used |

### 4.3 Data sources (from the research doc)

| Data | Source | Phase |
|---|---|---|
| Rain forecast ensemble (51 members) | Open-Meteo Ensemble API | 2 |
| River discharge ensemble (GloFAS, 50 members) | Open-Meteo Flood API | 2 |
| Past rain, past discharge | Open-Meteo Archive / Flood API | 2 |
| Roads, bridges, waterways, amenities | OpenStreetMap via OSMnx / Overpass | 2 |
| Population 100 m grid | WorldPop 2020 GeoTIFF | 2 |
| Elevation | Copernicus DEM 30 m or SRTM (scripted download); CartoDEM (manual, Bhuvan) as an upgrade | 2 |
| Shelters | District Disaster Management Plan → hand-made CSV | 2 |
| Past flood extent (validation) | Sentinel-1 flood maps (Copernicus GFM), NDEM atlas | 8 |
| IMD warnings, CWC river levels, Google Flood Hub | Need registration or PDF parsing | Later |

---

## 5. Folder structure

### 5.1 Target layout

```
AEGIS-X/
├── README.md                      # what it is, quickstart, links to docs
├── .env.example                   # every setting, no real values
├── .gitignore
│
├── backend/
│   ├── pyproject.toml             # dependencies, ruff, pytest config
│   ├── aegis/                     # the one Python package
│   │   ├── __init__.py
│   │   ├── settings.py            # pydantic-settings: reads .env
│   │   │
│   │   ├── engine/                # LAYER 4: domain-free. Never imports domains/
│   │   │   ├── interfaces.py      # Scenario, Plan, Conditions, ConditionSpace, DomainModel
│   │   │   ├── sampling.py        # random + Latin Hypercube sampling of a ConditionSpace
│   │   │   ├── montecarlo.py
│   │   │   ├── compare.py
│   │   │   ├── redteam.py         # worst case, knockout, PRIM, adversarial search
│   │   │   ├── sensitivity.py     # correlation + Sobol
│   │   │   ├── voi.py
│   │   │   ├── optimizer.py       # random search + NSGA-II
│   │   │   └── calibration.py     # coverage, Brier score, extent match
│   │   │
│   │   ├── domains/               # LAYER 3
│   │   │   ├── flood/
│   │   │   │   ├── types.py       # FloodScenario, FloodPlan, FloodConditions
│   │   │   │   ├── model.py       # FloodModel(DomainModel): simulate(), knockout support
│   │   │   │   ├── hydrology.py   # stage over time, HAND flooding, edge thresholds
│   │   │   │   ├── evacuation.py  # time-stepped routing + boats + shelters
│   │   │   │   ├── uncertainty.py # forecast + priors + beliefs → FloodConditionSpace
│   │   │   │   ├── builder.py     # district data → FloodScenario
│   │   │   │   ├── geojson.py     # FloodScenario → map layers for the frontend
│   │   │   │   └── demo.py        # small synthetic scenario (tests, offline demo)
│   │   │   ├── fire/              # thin module, same interface
│   │   │   └── crowd/             # thin module, same interface
│   │   │
│   │   ├── ingest/                # LAYER 1: fetch + cache, no modelling
│   │   │   ├── cache.py           # file cache under data/raw with metadata
│   │   │   ├── http.py            # shared httpx client (timeout, retry, user agent)
│   │   │   ├── district.py        # DistrictConfig loaded from data/districts/*.yaml
│   │   │   ├── open_meteo.py      # rain ensemble, archive, flood (GloFAS), elevation
│   │   │   ├── osm.py             # road graph, bridges, waterways, amenities
│   │   │   ├── worldpop.py        # population raster window
│   │   │   ├── dem.py             # elevation raster
│   │   │   └── shelters.py        # shelters CSV → validated records
│   │   │
│   │   ├── fusion/                # LAYER 2
│   │   │   ├── reports.py         # FieldReport schema, source reliability table
│   │   │   └── beliefs.py         # Bayesian update + time decay → probabilities
│   │   │
│   │   ├── llm/                   # LAYER 5
│   │   │   ├── base.py            # LLMProvider interface + get_provider()
│   │   │   ├── groq_provider.py
│   │   │   ├── gemini_provider.py
│   │   │   ├── claude_provider.py
│   │   │   ├── prompts.py         # all prompt text in one place
│   │   │   ├── explain.py         # engine output → narration
│   │   │   └── parse_report.py    # free text → FieldReport (schema-validated)
│   │   │
│   │   ├── storage/               # LAYER 0
│   │   │   ├── db.py              # engine + session
│   │   │   └── models.py          # SQLModel tables
│   │   │
│   │   ├── replay/                # historical event replay
│   │   │   └── replay.py
│   │   │
│   │   └── api/                   # LAYER 6
│   │       ├── main.py            # app factory, CORS, router registration
│   │       ├── deps.py            # settings, db session, loaded scenarios
│   │       ├── schemas.py         # request/response models
│   │       └── routers/
│   │           ├── districts.py
│   │           ├── simulate.py
│   │           ├── analysis.py
│   │           ├── explain.py
│   │           ├── reports.py
│   │           ├── decisions.py
│   │           ├── replay.py
│   │           └── ws.py
│   │
│   └── tests/
│       ├── unit/                  # engine, hydrology, evacuation, fusion
│       ├── integration/           # builder on fixtures, API with TestClient
│       └── fixtures/              # recorded API responses, tiny rasters, tiny graph
│
├── frontend/                      # see §8 for src/ layout
│
├── data/
│   ├── districts/
│   │   └── cachar.yaml            # bounding box, forecast points, river, event dates
│   ├── reference/                 # small, hand-made, COMMITTED
│   │   ├── cachar_shelters.csv
│   │   └── events/silchar_2022.yaml   # timeline from news/official reports
│   ├── raw/                       # fetched data cache, GITIGNORED
│   └── processed/                 # built scenarios, GITIGNORED
│
├── scripts/                       # command-line entry points
│   ├── fetch_data.py              # python scripts/fetch_data.py --district cachar
│   ├── build_scenario.py          # python scripts/build_scenario.py --district cachar
│   ├── replay_event.py
│   ├── benchmark.py               # timing of N futures
│   ├── gen_api_types.ps1          # OpenAPI → frontend/src/api/schema.d.ts
│   ├── dev.ps1                    # starts backend + frontend together
│   └── commit.ps1                 # moved from repo root
│
└── docs/
    ├── README.md                  # index of all docs
    ├── flood-evacuation-problem.md
    ├── flood-evacuation-solution.md
    ├── flood-decisions-uncertainty-data.md
    ├── final-implementation-plan.md   # this file
    ├── decisions/                 # short records of design decisions (ADR)
    └── archive/                   # old plans, kept for history
```

### 5.2 Moving from today's layout

| Today | Target |
|---|---|
| `core/engine/*` | `backend/aegis/engine/*` |
| `domains/flood/model.py` | Split into `backend/aegis/domains/flood/{types,model,hydrology,evacuation,demo}.py` |
| `domains/fire`, `domains/crowd` | `backend/aegis/domains/fire`, `.../crowd` |
| `api/main.py` | `backend/aegis/api/main.py` + `routers/` |
| `api/explain.py` | `backend/aegis/llm/explain.py` + `llm/groq_provider.py` |
| `tests/` | `backend/tests/` |
| `requirements.txt` | `backend/pyproject.toml` |
| `commit.ps1` | `scripts/commit.ps1` |
| `docs/flood-evacuation-implementation.md`, `docs/flood-evacuation-steps.md` | `docs/archive/` |

Imports change from `core.engine...` to `aegis.engine...`. Run the API with `uvicorn aegis.api.main:app` from `backend/`.

### 5.3 Layer rules (enforced in review and by a test)

- `aegis.engine` imports **nothing** from `aegis.domains`, `aegis.ingest`, `aegis.api` or `aegis.llm`.
- `aegis.domains.*` may import `aegis.engine.interfaces` only.
- `aegis.ingest` does no modelling; it returns files or plain records.
- `aegis.llm` never decides anything; it receives computed results and returns text or a schema-validated record.
- Only `aegis.api` and `scripts/` wire layers together.

---

## 6. Module design

### 6.1 District configuration

One YAML file per district. Everything district-specific lives here, not in code.

```yaml
# data/districts/cachar.yaml
id: cachar
name: Cachar, Assam
crs: EPSG:32646              # UTM zone 46N, metres
bbox: [92.65, 24.70, 92.95, 24.95]   # lon_min, lat_min, lon_max, lat_max (adjust after first build)
river:
  name: Barak
  osm_waterway_names: ["Barak", "Barak River"]
forecast_points:             # where rain and discharge ensembles are pulled
  - {id: silchar, lat: 24.83, lon: 92.78}
shelters_csv: data/reference/cachar_shelters.csv
population_cluster_size_m: 500   # population grid aggregated into clusters of this size
staging_points:              # where boats can be based
  - {id: sp_town, lat: 24.82, lon: 92.79}
events:
  - id: silchar_2022
    start: 2022-06-14
    end: 2022-06-30
```

### 6.2 Ingestion (`aegis/ingest`)

Every fetcher follows the same pattern: **check the cache, fetch if missing or refresh requested, save the raw response with metadata, return the path or records.**

```python
# aegis/ingest/cache.py
@dataclass
class CacheEntry:
    path: Path
    source: str          # "open_meteo.ensemble"
    params: dict
    fetched_at: datetime

def cached(source: str, params: dict, suffix: str, fetch: Callable[[], bytes],
           refresh: bool = False, max_age: timedelta | None = None) -> CacheEntry: ...
```

| Module | Functions | Output |
|---|---|---|
| `open_meteo.py` | `rain_ensemble(point, days)`, `discharge_ensemble(point, days)`, `rain_history(point, start, end)`, `discharge_history(point, start, end)` | Tidy arrays: `members × time` |
| `osm.py` | `road_graph(bbox)`, `bridges(bbox)`, `waterways(bbox, names)`, `amenities(bbox)` | NetworkX graph, GeoDataFrames |
| `worldpop.py` | `population(bbox)` | Raster array + transform |
| `dem.py` | `elevation(bbox)` | Raster array + transform |
| `shelters.py` | `load_shelters(csv)` | Validated list (id, name, lat, lon, capacity, type) |

Rules:
- Cache keys are the source name plus a hash of the parameters. Raw files go to `data/raw/<district>/<source>/`.
- Forecasts get `max_age` of 6 hours. Static data (DEM, OSM, WorldPop) never expire unless `--refresh` is passed.
- A demo must run **fully offline** from the cache.
- Every fetcher has a recorded fixture in `backend/tests/fixtures/` and a test that runs without network.

**Shelters CSV format** (hand-made from the district DDMP; OSM tags very few schools in Silchar):

```csv
id,name,lat,lon,capacity,type,source
sh_001,Example Govt. School,24.84,92.80,300,school,DDMP 2023 p.45
```

### 6.3 Scenario builder (`domains/flood/builder.py`)

Turns district data into a `FloodScenario`. Runs once per district through `scripts/build_scenario.py`, and the result is saved to `data/processed/<district>/`.

**Decision: move from a grid to a road graph.** The grid was right for the prototype. Real evacuation happens on roads, and OSM gives a road graph directly. Flooding still comes from a raster (the DEM). The synthetic demo becomes a small generated graph, so there is **one** simulation code path.

Steps:

1. **Road graph:** OSMnx graph for the bounding box, projected to the district CRS. Keep drivable roads plus tracks and paths (people walk out). Each edge gets a length and a travel time per mode (walk, vehicle).
2. **Elevation per edge:** sample the DEM along each edge and take the **lowest** point. An edge is cut when water rises above its lowest point.
3. **HAND per edge** (Height Above Nearest Drainage): elevation minus the elevation of the nearest river cell (river cells come from OSM waterways rasterised onto the DEM grid). This turns "river stage" into "which roads go under water", which plain elevation cannot do on a sloping valley.
4. **Bridges:** edges tagged `bridge=yes`. Threshold = HAND of the deck (from the DEM at the approaches), plus a configurable clearance.
5. **Population clusters:** aggregate WorldPop cells into squares of `population_cluster_size_m`, drop near-empty ones, snap each to its nearest graph node, and store the cluster's HAND (its lowest 20% of cells).
6. **Shelters and staging points:** snap to the nearest graph node, store capacity and HAND.
7. **Save:** graph and arrays as `scenario.npz` + `scenario.json` (metadata, CRS, source versions), plus GeoJSON layers for the map.

```python
# aegis/domains/flood/types.py
@dataclass
class FloodScenario(Scenario):
    node_xy: np.ndarray                 # (n_nodes, 2) projected coordinates
    edge_index: np.ndarray              # (n_edges, 2) node ids
    edge_length_m: np.ndarray
    edge_hand_m: np.ndarray             # water stage above which the edge is impassable
    edge_is_bridge: np.ndarray          # bool
    bridges: dict[str, int]             # bridge id -> edge index
    clusters: list[Cluster]             # id, node, population, vulnerable, hand_m
    shelters: list[Shelter]             # id, node, capacity, hand_m
    staging_points: list[StagingPoint]  # id, node
```

**Done when:** `build_scenario.py --district cachar` produces a scenario whose bridge, settlement and shelter counts are plausible on the map, and the build is reproducible from the cache.

### 6.4 Hydrology (`domains/flood/hydrology.py`)

Simple, explainable, and calibrated, not a full hydraulic model (as the solution doc §11 says).

- **River stage over time:** each future has a peak stage and a peak time. The stage curve over the simulation horizon is interpolated from the selected discharge ensemble member, converted with a **rating curve** `stage = a·Q^b + c`.
- **Rating curve calibration (Phase 8):** first choice, fit to CWC observed levels at the Silchar gauge from daily bulletins. Fallback, choose `a, b, c` so that the modelled flood extent on the June 2022 peak day best matches the Sentinel-1 extent (maximise the critical success index).
- **What is flooded at time t:** an edge, cluster or shelter is flooded when `stage(t) > hand_m`, minus a protection bonus if the plan guards or raises it.
- **Local rain (ponding):** a small extra depth in low cells from local rainfall, proportional to `local_rain_mm`, with one calibrated factor. This matters in towns like Silchar where rain floods streets before the river does.
- **Embankment breach (later in Phase 4):** a breach at a chosen embankment point drops the effective HAND of the area behind it from that time on.

### 6.5 Evacuation simulation (`domains/flood/evacuation.py`)

Replaces today's single static flood with a **time-stepped** simulation, because roads close one by one.

```
horizon: 48 h, tick: 15 min (configurable)

for each tick t:
    stage = stage_curve(t)
    passable = edge_hand_m + protection > stage, and bridge open in this future
    if the set of passable edges changed:
        recompute travel time from every cluster node to every open shelter
        (multi-source Dijkstra from shelters; cache by passable-set signature)
    if t >= plan.start_hour + warning_delay(comms):
        for clusters in plan priority order:
            willing = population × compliance, minus people already moved
            if the cluster still has a dry route: people walk or drive (road capacity limit)
            else: they need boats; boats come from staging points after the arrival delay,
                  each boat moves capacity × availability people per round trip
    people arrive at shelters; shelter overflow is counted
    people still in a cluster whose depth > safe depth are "at risk"
```

**Metrics returned** (`SimulationResult.metrics`):

| Metric | Meaning | Direction |
|---|---|---|
| `evacuated_pct` (**primary**) | Share of people at risk who reached a shelter in time | Higher is better |
| `people_at_risk_end` | People still in flooded clusters at the end | Lower |
| `avg_evac_time_h`, `last_evac_time_h` | How long it took | Lower |
| `boat_utilisation` | Share of boat capacity actually used | Information |
| `shelter_overflow` | People over shelter capacity | Lower |
| `unneeded_evacuations` | People moved from clusters that never flooded (false-alarm cost) | Lower |

`unneeded_evacuations` is what makes the "when to evacuate" decision (D1) a real trade-off instead of "always evacuate now".

**Performance budget:** 500 futures on Cachar in **under 5 seconds** on a laptop. Tools: cache routing by the passable-edge signature (many futures share it), NumPy arrays instead of Python objects in the tick loop, and a process pool across futures if needed. `scripts/benchmark.py` measures this, and the number goes in the README.

### 6.6 Plans and conditions (`domains/flood/types.py`, `uncertainty.py`)

The plan covers the decisions D1–D7 from the research doc; D8 (re-plan) is the loop itself.

```python
@dataclass
class FloodPlan(Plan):
    start_hour: float                    # D1 when to start evacuating
    priority: list[str]                  # D2 cluster ids in order
    open_shelters: list[str]             # D3 shelters used
    route_avoid: list[str]               # D4 edges/bridges not to use
    boats_at: dict[str, int]             # D5 staging point id -> boats
    vehicles_at: dict[str, int]          # D5 staging point id -> vehicles
    protected: list[str]                 # D6 edges or embankment points guarded/raised
    warning_channels: list[str]          # D7 "siren", "sms", "loudspeaker", "door_to_door"
```

```python
@dataclass
class FloodConditions(Conditions):
    peak_stage_m: float                  # U2 from the discharge ensemble + rating curve
    peak_time_h: float                   # U2
    local_rain_mm: float                 # U1 from the rain ensemble
    boat_availability_pct: float         # U8
    boat_delay_h: float                  # U8
    comms_degradation_pct: float         # U10
    compliance_pct: float                # U7 share of people willing to leave
    bridge_open: dict[str, float]        # U5 1.0 open / 0.0 closed, per key bridge
    # as_vector() and field_names() are overridden to flatten bridge_open
```

**`ConditionSpace`** (new in `engine/interfaces.py`) describes the ranges, so the engine can sample them, run Latin Hypercube and Sobol, and the UI can show and edit them:

```python
@dataclass
class Variable:
    name: str
    kind: Literal["continuous", "binary", "empirical"]
    low: float | None = None
    high: float | None = None
    mode: float | None = None        # triangular
    p_true: float | None = None      # binary
    samples: np.ndarray | None = None  # empirical (ensemble members)
    source: str = ""                 # "GloFAS ensemble 2026-10-19 00z", "prior", "field report r-12"
```

**Where each range comes from** (`uncertainty.py`):

| Variable | Source of the range |
|---|---|
| `peak_stage_m`, `peak_time_h` | Discharge ensemble members → rating curve. Each future picks a member and adds noise. |
| `local_rain_mm` | Rain ensemble members (empirical) |
| `boat_availability_pct`, `boat_delay_h` | Prior from the district resource list; narrowed by field reports |
| `comms_degradation_pct` | Prior, raised when the stage passes the level of known tower or substation sites |
| `compliance_pct` | Prior (research doc: refusal is common in Bihar and Assam), raised by warning channels such as door-to-door |
| `bridge_open[b]` | From fusion beliefs if there are reports, else from stage vs. bridge threshold with a margin |

The `source` field is shown in the UI, so the officer can see **why** a range is what it is.

### 6.7 Core engine upgrades (`aegis/engine`)

All stay domain-free.

| Feature | Change | Library |
|---|---|---|
| Sampling | `sample(space, n, method="lhs" or "random", seed)` | SciPy QMC |
| Sensitivity | Add Sobol first-order and total indices; keep correlation as the fast option | SALib |
| Red Team: scenario discovery | `discover_failure_boxes(batch, metric, threshold)` → "fails when peak_stage > x and bridge_open[b1] = 0" | EMA Workbench (PRIM) |
| Red Team: adversarial | Smallest change from the median future that makes the plan fail (search over the ConditionSpace) | SciPy optimise |
| VOI | Works on any `Variable`; maps each variable to a real **check action** (below) | Existing code |
| Optimiser | NSGA-II over plan parameters; objectives: mean evacuated, worst-10% evacuated, resources used | pymoo |
| Calibration | Interval coverage, Brier score, extent CSI | NumPy |

**VOI check actions** (shown to the officer instead of variable names):

| Variable | Action that reduces it |
|---|---|
| `bridge_open[b]` | Send a field team or drone to bridge b |
| `boat_availability_pct`, `boat_delay_h` | Call boat owners and NDRF/SDRF to confirm |
| `compliance_pct` | Ask ward members how many people will leave |
| `peak_stage_m` | Wait for the next forecast run or check the upstream gauge |
| `comms_degradation_pct` | Check with the telecom operators |

### 6.8 LLM layer (`aegis/llm`)

**One interface, many providers.** Select with `LLM_PROVIDER` in `.env`. With `none`, every LLM feature falls back to a template sentence, so the demo works without a key.

```python
# aegis/llm/base.py
class LLMProvider(Protocol):
    def complete(self, system: str, user: str, *, json_schema: dict | None = None,
                 temperature: float = 0.2) -> str: ...

def get_provider(settings: Settings) -> LLMProvider: ...   # groq | gemini | claude | none
```

| Use | Input | Output | Guardrail |
|---|---|---|---|
| `explain.py` | Engine results (numbers only) | 3–5 plain sentences | Prompt forbids new numbers; a check rejects any number in the text that is not in the input |
| `parse_report.py` | Free-text field report | `FieldReport` JSON | Must validate against the schema, else stored as unparsed for a human |
| Q&A (later) | Question + engine results | Answer citing the results | Same as explain |

All prompts live in `prompts.py`. The LLM is called **only from the backend**; keys never reach the browser.

### 6.9 Fusion (`aegis/fusion`)

```python
@dataclass
class FieldReport:
    id: str
    received_at: datetime
    source_type: Literal["field_team", "control_room", "official_feed", "public_call", "social_media"]
    subject: str          # "bridge:b_017", "cluster:c_042", "staging:sp_town"
    claim: str            # "closed", "open", "flooded", "boats_ready=6"
    raw_text: str
```

- **Reliability** per `source_type` (table in `reports.py`, editable).
- **Belief update:** for a yes/no claim, combine reports with a log-odds update weighted by reliability.
- **Time decay:** older reports lose weight with a half-life per subject type (a road report ages faster than a shelter report).
- **Output:** `beliefs: dict[subject, probability]`, which `uncertainty.py` uses to set `bridge_open`, boat availability and so on.

### 6.10 Storage (`aegis/storage`)

SQLite file at `data/aegis.db`, through SQLModel.

| Table | Holds |
|---|---|
| `scenario_build` | District, build time, source versions, file path |
| `forecast_snapshot` | Fetch time, ConditionSpace as JSON |
| `plan` | Plan JSON, author, created from (manual / optimiser / edited) |
| `run` | Plan, snapshot, sample count, seed, summary metrics |
| `field_report` | Reports and parsed claims |
| `decision` | **Audit log**: who, when, action (accept / edit / reject), plan, run, explanation shown, note |

Raw per-future results are not stored, only summaries and the seed, so any run can be reproduced.

### 6.11 Replay (`aegis/replay`)

Replays a past event hour by hour, using only data available **at that hour**:

1. Load the event file (`data/reference/events/silchar_2022.yaml`): timeline of known facts (breaches, closures, official orders), each with a source link.
2. For each step (for example every 6 hours): build the ConditionSpace from archived discharge and rain up to that time, run the engine on a reference plan, record the recommendation.
3. Compare with what happened: flood extent (Sentinel-1), timeline events.
4. Output a calibration report and a timeline view for the UI.

### 6.12 Fire and crowd modules

Stay thin until flood is finished. They must keep implementing the same `DomainModel` interface, so the "one engine, many domains" claim stays true. One smoke test each.

---

## 7. API

Base path `/api/v1`. Request and response models live in `api/schemas.py`. The frontend types are generated from the OpenAPI schema (`scripts/gen_api_types.ps1`).

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Status, LLM provider, data cache state |
| GET | `/districts` | Available districts |
| GET | `/districts/{id}/layers` | GeoJSON: roads, bridges, clusters, shelters, staging points, river |
| POST | `/districts/{id}/forecast/refresh` | Pull new forecasts, return the ConditionSpace |
| GET | `/districts/{id}/conditions` | Current ConditionSpace with sources |
| POST | `/districts/{id}/flood-state` | Flooded edges/clusters for a given stage and time (map overlay) |
| POST | `/simulate` | Monte Carlo for one plan: summary, distribution, worst-10% |
| WS | `/ws/simulate` | Same, streaming progress and partial results |
| POST | `/analysis/compare` | Plans on identical futures |
| POST | `/analysis/redteam` | Worst cases, knockouts, failure boxes |
| POST | `/analysis/sensitivity` | Correlation or Sobol |
| POST | `/analysis/voi` | Ranked check actions |
| POST | `/analysis/optimize` | Pareto set of plans |
| POST | `/explain` | Narration of any analysis result |
| POST | `/reports` | Add a field report (free text or structured) |
| GET | `/districts/{id}/beliefs` | Current fused beliefs |
| POST | `/decisions` | Record accept / edit / reject |
| GET | `/decisions` | Audit log |
| GET | `/replay/{event_id}` | Replay timeline and calibration report |

The old `/flood/*` endpoints are removed in the same phase the frontend switches to `/api/v1` (Phase 6). No duplicate endpoints are kept.

Every analysis request carries `district`, `plan`, `n_samples`, `seed` and optionally `condition_overrides` (the "what if" sliders). The same seed always gives the same answer.

---

## 8. Frontend

### 8.1 Pages

| Route | Page | Status |
|---|---|---|
| `/` | Landing page | ✅ Built |
| `/docs` | Documentation page | ✅ Built |
| `/demo` | Synthetic grid demo | ✅ Built; kept as the offline fallback |
| `/console` | **Officer console** on a real district | New (Phase 7) |
| `/replay/:eventId` | Event replay | New (Phase 8) |
| `/audit` | Decision log | New (Phase 6/7) |

### 8.2 Console layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Header: district · forecast time · data freshness · LLM status      │
├───────────────────────────────────────┬─────────────────────────────┤
│                                       │ Tabs:                       │
│   MAP (MapLibre)                      │  1 Situation  (conditions,  │
│   river, flood overlay (time slider), │    sources, field reports)  │
│   roads, bridges, clusters, shelters, │  2 Plan       (plan editor) │
│   staging points; Red Team highlights │  3 Results    (distribution,│
│                                       │    worst-10%, compare)      │
│                                       │  4 Red Team   (failures,    │
│                                       │    knockouts, tornado)      │
│                                       │  5 Check next (VOI actions) │
│                                       │  6 Options    (Pareto plans)│
├───────────────────────────────────────┴─────────────────────────────┤
│ Decision bar: explanation · Accept · Edit · Reject · note           │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.3 `frontend/src` layout

```
src/
├── main.tsx
├── App.tsx                    # routes
├── api/
│   ├── schema.d.ts            # GENERATED from OpenAPI, do not edit
│   ├── client.ts              # typed fetch wrapper
│   └── queries.ts             # TanStack Query hooks per endpoint
├── state/                     # Zustand stores: selection, plan draft, map view
├── pages/                     # one file per route
├── features/                  # one folder per console capability
│   ├── map/                   # MapView, layers/, FloodTimeSlider
│   ├── situation/             # ConditionList, SourceBadge, ReportFeed, ReportForm
│   ├── plan/                  # PlanEditor
│   ├── results/               # OutcomeDistribution, ResilienceBadge, PlanCompare
│   ├── redteam/               # FailureBoxes, KnockoutList, TornadoChart
│   ├── check-next/            # VoiActions
│   ├── options/               # ParetoChart, PlanOptionCard
│   ├── decision/              # DecisionBar, AuditTable
│   ├── replay/                # ReplayTimeline
│   └── demo/                  # existing grid demo components (GridCanvas, ControlsPanel, ...)
├── components/
│   ├── ui/                    # shadcn primitives (existing)
│   ├── site/                  # landing/site chrome (existing)
│   ├── visuals/               # landing visuals (existing)
│   └── docs/                  # docs page primitives (existing)
├── content/                   # static copy (existing)
└── lib/                       # utils, formatting, colour scales
```

The existing demo components move from `components/` to `features/demo/`.

### 8.4 UI rules

- Every number shown has its **range and source** one click away.
- Red Team findings, VOI actions and Pareto options are **clickable and highlight on the map**.
- Results always show the **worst-10%** next to the average.
- The decision bar is always visible; nothing is "applied" without an explicit accept.
- Works at laptop and projector resolutions; dark and light themes as on the site today.

---

## 9. Configuration and secrets

All settings come from environment variables, loaded from `.env` by `aegis/settings.py` (pydantic-settings). `.env` is gitignored; `.env.example` lists every key with no values.

```dotenv
# .env.example
AEGIS_ENV=dev                       # dev | demo | prod
AEGIS_DATA_DIR=data
AEGIS_DB_URL=sqlite:///data/aegis.db
AEGIS_OFFLINE=false                 # true = never call external APIs, cache only
AEGIS_CORS_ORIGINS=http://localhost:5173

LLM_PROVIDER=groq                   # groq | gemini | claude | none
LLM_MODEL=                          # empty = provider default
GROQ_API_KEY=
GEMINI_API_KEY=
ANTHROPIC_API_KEY=

HTTP_USER_AGENT=AEGIS-X/0.1 (contact: team email)
```

`AEGIS_OFFLINE=true` is the demo-day setting: everything runs from `data/raw` and `data/processed`.

---

## 10. Testing

| Level | What | Where |
|---|---|---|
| Unit | Engine maths (sampling, resilience, Pareto, VOI, Sobol wrapper), hydrology, evacuation on a tiny hand-made graph, fusion updates | `backend/tests/unit` |
| Invariants | Same seed → same result; compare uses identical futures; resilience ≤ median; more boats never lowers `evacuated_pct`; a closed bridge never improves it | `backend/tests/unit` |
| Layer rule | A test that fails if `aegis.engine` imports any other `aegis` layer | `backend/tests/unit/test_layers.py` |
| Ingestion | Every fetcher against a recorded fixture (respx), no network | `backend/tests/integration` |
| Builder | Build a scenario from a tiny fixture district | `backend/tests/integration` |
| API | Every endpoint with TestClient | `backend/tests/integration` |
| LLM | Provider `none` in tests; the number-check guardrail tested on fake outputs | `backend/tests/unit` |
| Performance | `scripts/benchmark.py`; result recorded in the README | manual, per phase |
| Frontend | `npm run build` (type check) and `npm run lint` | per change |
| End to end | Manual demo script (§12, Phase 10); Playwright later if time allows | |

Commands: `pytest` (from `backend/`), `npm run build`, `npm run lint`.

---

## 11. Engineering rules

1. **Math decides, the LLM explains.** No finding, number or recommendation may originate in the LLM.
2. **Every output is a range.** No single-number forecasts in the UI.
3. **The human decides.** Nothing is applied without an explicit accept, and every decision is logged.
4. **Reproducible.** Every run stores its seed, plan, scenario build and forecast snapshot.
5. **Offline-capable.** The demo must run with no internet.
6. **Sources visible.** Every range and every report shows where it came from.
7. **Measured, not assumed.** Performance and accuracy claims in docs come from a run, with the date.
8. **Small steps.** After every phase: tests pass, frontend builds, the app runs, the docs status table is updated.

---

## 12. Build phases

Phases run in order. Each ends with a **Done when** check; do not start the next phase until it passes.

### Phase 0: Restructure the repo

- [x] Create `backend/` with `pyproject.toml`; move `core/engine` → `backend/aegis/engine`, `domains` → `backend/aegis/domains`, `api` → `backend/aegis/api`, `tests` → `backend/tests`; update imports.
- [x] Split `domains/flood/model.py` into `types.py`, `model.py`, `demo.py` (no behaviour change yet).
- [x] Add `aegis/settings.py` (pydantic-settings); remove direct `os.environ` reads.
- [x] ~~Add ruff config~~ skipped: ruff could not be installed from the package index on 2026-10-19; revisit later.
- [x] Add `test_layers.py` (engine imports nothing else).
- [x] Move `commit.ps1` to `scripts/`; add `scripts/dev.ps1`.
- [x] Move old implementation docs to `docs/archive/`; add `docs/README.md` index.
- [x] Move existing demo components in the frontend to `features/demo/`.

**Done when:** all existing tests pass from `backend/`, `uvicorn aegis.api.main:app` serves the current endpoints, `/demo` works unchanged, and `.env` is loaded automatically.

### Phase 1: LLM provider layer

- [ ] `llm/base.py` with `LLMProvider` and `get_provider()`.
- [ ] Groq (move existing code), Gemini, Claude and `none` providers.
- [ ] `prompts.py` and `explain.py`; number-check guardrail.
- [ ] `/health` reports the active provider.

**Done when:** switching `LLM_PROVIDER` between `groq`, `gemini` and `none` changes the narration source without code changes, and tests pass with `none`.

### Phase 2: Data ingestion

- [ ] `ingest/cache.py`, `ingest/http.py`, `ingest/district.py`.
- [ ] `open_meteo.py` (rain ensemble, discharge ensemble, history, elevation).
- [ ] `osm.py`, `worldpop.py`, `dem.py`, `shelters.py`.
- [ ] `data/districts/cachar.yaml`; `data/reference/cachar_shelters.csv` (first version from the Cachar DDMP, with page references).
- [ ] `scripts/fetch_data.py --district cachar [--refresh]`.
- [ ] Recorded fixtures and offline tests for each fetcher.

**Done when:** `fetch_data.py --district cachar` fills `data/raw/cachar/`, a second run uses only the cache, and tests pass with no network.

### Phase 3: Scenario builder (road graph)

- [ ] `FloodScenario` on a graph (§6.3); rewrite `demo.py` to generate a small graph.
- [ ] `builder.py`: road graph, edge HAND, bridges, clusters, shelters, staging points.
- [ ] `geojson.py` and `scripts/build_scenario.py`.
- [ ] Temporary `GET /districts/cachar/layers` to see it on a map.

**Done when:** the Cachar scenario builds from cache, its layers look right on a map (river, bridges and settlements in plausible places), and the demo graph passes the old smoke tests (ported).

### Phase 4: Hydrology, evacuation and uncertainty

- [ ] `hydrology.py`: stage curve, rating curve (placeholder parameters until Phase 8), HAND flooding, local rain.
- [ ] `evacuation.py`: time-stepped simulation (§6.5) with walk/drive, boats, shelters, compliance, warning delay.
- [ ] New `FloodPlan` and `FloodConditions` (§6.6); `ConditionSpace` in the engine.
- [ ] `uncertainty.py`: ranges from ensembles and priors, with `source` on every variable.
- [ ] Knockout support for bridges, shelters and staging points.
- [ ] `scripts/benchmark.py`; meet the 5-second budget for 500 futures.

**Done when:** a Cachar plan runs on 500 futures from today's forecast within budget, the invariants in §10 pass, and the Red Team knockout names at least one real bridge or road whose loss changes the result.

### Phase 5: Engine upgrades

- [ ] Latin Hypercube sampling.
- [ ] Sobol sensitivity (SALib).
- [ ] PRIM failure boxes (EMA Workbench).
- [ ] Adversarial search.
- [ ] VOI over the new variables, with check actions.
- [ ] NSGA-II optimiser (pymoo) over plan parameters.

**Done when:** each analysis runs on Cachar and returns results that pass a sanity test (for example, failure boxes contain mostly failing futures), and the engine still imports no domain code.

### Phase 6: API v1, storage and audit log

- [ ] Routers and schemas for every endpoint in §7; app factory in `main.py`.
- [ ] SQLModel tables (§6.10); runs, plans and decisions stored.
- [ ] WebSocket streaming for `/ws/simulate`.
- [ ] Remove old `/flood/*` endpoints and point `/demo` at the new API.
- [ ] `scripts/gen_api_types.ps1`; generated `schema.d.ts` committed.

**Done when:** every endpoint has an integration test, a decision can be recorded and read back with its run and seed, and `/demo` still works.

### Phase 7: Officer console

- [ ] MapLibre map with all layers and a flood time slider.
- [ ] Tabs: Situation, Plan, Results, Red Team, Check next, Options (§8.2).
- [ ] Cross-highlighting between findings and the map.
- [ ] Decision bar and `/audit` page.

**Done when:** an officer can go through steps 1–7 of §1.2 on Cachar without touching code.

### Phase 8: Replay and calibration (Silchar 2022)

- [ ] `data/reference/events/silchar_2022.yaml` with a sourced timeline.
- [ ] Sentinel-1 flood extent for the peak day in `data/reference/` (small, clipped).
- [ ] Fit the rating curve and the local-rain factor; record the parameters and the fit quality.
- [ ] `replay/replay.py`, `GET /replay/silchar_2022`, `/replay/:eventId` page.
- [ ] Calibration report: extent match, interval coverage.

**Done when:** the replay page shows the hour-by-hour advice for June 2022, and the calibration numbers are in this document's status table with the date.

### Phase 9: Field reports and fusion

- [ ] `fusion/reports.py`, `fusion/beliefs.py`.
- [ ] `llm/parse_report.py` with schema validation.
- [ ] `/reports`, `/beliefs`; Situation tab shows the report feed with confidence.
- [ ] Beliefs feed `uncertainty.py` (for example, two reports of a closed bridge narrow `bridge_open`).

**Done when:** typing a report such as "<bridge name> is under water" into the report form changes that bridge's probability, and re-running the plan reflects it.

### Phase 10: Demo hardening

- [ ] `AEGIS_OFFLINE=true` run of the full demo from cache.
- [ ] Fixed seeds that tell a clear story; written demo script.
- [ ] Backup screen recording.
- [ ] README quickstart verified on a clean machine.
- [ ] Update the status table in §2 and the roadmap in the solution doc.

**Done when:** the full demo runs offline twice in a row without errors.

### Phase 11 (optional): Fire and crowd

- [ ] Implement `simulate()` for one of them on a synthetic scenario, using the same engine.

---

## 13. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| OSM roads or bridges incomplete in rural Cachar | Wrong routes | Check on the map in Phase 3; allow manual edits in a small overrides file |
| DEM vertical error (several metres in places) | Wrong flood thresholds | Use HAND instead of raw elevation; calibrate against Sentinel-1 |
| No public CWC API | No observed river levels | GloFAS via Open-Meteo for ranges; CWC bulletins parsed by hand for calibration |
| GloFAS is coarse and smooth | Under-estimates local peaks | Use it for ranges and trends; widen ranges with a calibrated factor |
| Shelter data only in PDFs | Slow to prepare | Hand-made CSV for one district first |
| Simulation too slow on a real graph | Not "seconds" | Routing cache, NumPy loop, process pool; measure every phase |
| External API down on demo day | Demo fails | Offline mode from cache |
| LLM states something wrong | Loss of trust | Numbers-only prompt, number check, template fallback |
| Over-trust in the tool | Wrong decision | Ranges always shown, sources visible, human accept required, audit log |

---

## 14. Open decisions

Record each decision in `docs/decisions/` when made.

| # | Question | Default if not decided |
|---|---|---|
| 1 | First district: Cachar (Silchar)? | Yes |
| 2 | DEM: Copernicus 30 m (scripted) or CartoDEM (manual)? | Copernicus first, CartoDEM later for comparison |
| 3 | Default LLM provider for the demo | `groq` (already integrated), `none` as fallback |
| 4 | Basemap tile provider | A free, no-key style; confirm its terms |
| 5 | Simulation horizon and tick | 48 h, 15 min |
| 6 | Keep the `/demo` grid page after the console exists? | Yes, as the offline and explainer fallback |
