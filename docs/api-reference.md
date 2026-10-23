# API reference

Base URL: `http://localhost:8000/api/v1` (deployed: `https://<your-api>/api/v1`). Interactive docs with every schema: **`/docs`** (Swagger) and **`/redoc`**.

- JSON in, JSON out. No authentication (there are no accounts).
- **Heavy** endpoints (simulations, analyses, briefs) are rate-limited per client IP (`AEGIS_RATE_LIMIT_PER_MIN`, default 30/min) and run in at most `AEGIS_MAX_HEAVY_JOBS` slots (default 2). Over the limit: `429`; server busy for 30 s: `503`.
- Unknown or unbuilt district: `404` with a hint. Bad input: `422` with the field that failed.

**Sections:** [health](#health) · [districts](#districts) · [simulate](#simulate) · [analysis](#analysis) · [workflow](#workflow-explanations-reports-decisions) · [command center](#command-center-ops) · [replay](#replay) · [shared bodies](#shared-request-bodies)

---

## Health

| Method | Path | Returns |
|---|---|---|
| GET | `/health` | `status`, `version`, `env`, `offline`, `llm_provider`, `districts` |

## Districts

| Method | Path | Returns |
|---|---|---|
| GET | `/districts` | built districts (`demo`, `cachar`) |
| GET | `/districts/{d}/layers` | GeoJSON layers: roads (with height above river), river, areas, shelters, boat bases, bridges, bounds, metadata, totals |
| GET | `/districts/{d}/conditions` | forecast metadata, every uncertain input with its range and **source**, beliefs from field reports, resources |
| GET | `/districts/{d}/terrain` | height grid for the 3D view |
| GET | `/districts/{d}/buildings` | building footprints mapped in OpenStreetMap (cache only) |
| GET | `/districts/{d}/baseline-plan` | the starting plan for the editor |
| GET | `/districts/{d}/scenario` | areas, shelters, boat bases, bridges as JSON |
| POST | `/districts/{d}/flood-state` | `{level_m, closed_bridges}` → cut roads, flooded areas and shelters, people in flooded areas |
| POST | `/districts/{d}/forecast/refresh` | re-fetch the forecast ensembles *(rate limited)* |

## Simulate

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/simulate` *(heavy)* | [AnalysisRequest](#analysisrequest) | `summary` (mean, p05…p95, worst, best), `resilience_worst_10pct`, `histogram`, `metric_means`, per-area results, `forecast`, `run_id` |
| POST | `/simulate/trace` *(heavy)* | AnalysisRequest + `pick: median \| bad_day` (default 150 futures) | hour-by-hour story of one representative future, for the 3D playback |
| WS | `/ws/simulate` | send an AnalysisRequest as the first message | `{"progress": 0..1}` messages, then `{"done": true, "result": …}` or `{"error": …}` |

Example:

```bash
curl -X POST localhost:8000/api/v1/simulate -H "Content-Type: application/json" \
  -d '{"district": "cachar", "n_samples": 500, "seed": 42, "what_if": {"peak_stage_m": 5.5}}'
```

## Analysis

All *heavy*. Same futures as `/simulate` for the same seed.

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/analysis/compare` | [CompareRequest](#comparerequest) (2-6 plans) | per plan: summary, histogram, metric means; `same_futures: true` |
| POST | `/analysis/redteam` | AnalysisRequest + `fail_below` (default 0.5) | `failure_rate`, `single_points_of_failure` (element, drop %), `failure_boxes` (limits, density, coverage, support, description), `adversarial` shifts, `sensitivity`, `worst_case_futures` |
| POST | `/analysis/sensitivity` | AnalysisRequest + `method: correlation \| sobol`, `sobol_n` (16-256) | influence per uncertain input (S1/ST for Sobol) |
| POST | `/analysis/voi` | AnalysisRequest (≤ 300 futures used) | `best_plan_now`, `candidate_plans`, `check_next` (variable, action, gain %, best plan per range) |
| POST | `/analysis/optimize` | [OptimizeRequest](#optimizerequest) | `baseline` and labelled `options` (*Safest on a bad day*, *Best on average*, *Leanest*) with their plans and objectives |

## Workflow: explanations, reports, decisions

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/explain` *(rate limited)* | `{payload}` (analysis results) | `{text, source}`: the model's text if it passes the number check, else a template |
| POST | `/reports` *(rate limited)* | `{district, text, source_type, author}` | parsed claim and updated beliefs |
| GET | `/districts/{d}/reports` | | stored field reports |
| GET | `/districts/{d}/beliefs` | | current beliefs |
| POST | `/decisions` *(rate limited)* | [DecisionRequest](#decisionrequest) | `{id}`; stored hash-chained with its evidence |
| GET | `/decisions?district=` | | decision log, newest first, with run, evidence and hash |
| GET | `/audit/integrity` | | `status` (`valid`, `valid_with_legacy_records`, `invalid`), `checked`, `legacy`, `broken` row ids, `head` hash |

## Command Center (`/ops`)

Add `?exercise=true` to `events`, `districts` and `feeds` to get the labelled simulated scenario instead of live data (per request; nothing is stored or mixed).

| Method | Path | Returns |
|---|---|---|
| GET | `/ops/hazards` | hazard plugins (`flood` on, `fire` and `crowd` later) |
| GET | `/ops/feeds` | per feed: last attempt, last success, last error, item count |
| GET | `/ops/exercise` | the exercise scenario's title and notice |
| GET | `/ops/events?hazard=&severity=&state=&active=&days=&district_id=` | alerts, a GeoJSON of the located ones, counts by severity, week-over-week |
| GET | `/ops/districts` | 22 watched districts with level (`normal`/`watch`/`warning`/`severe`/`unknown`), indicator numbers and active alerts |
| GET | `/ops/modes` | operating modes (Administration, Disaster Response, Emergency Management, Armed Forces, Police, CAPF) |
| POST | `/ops/refresh?risk=` *(heavy)* | refresh the alert feeds now (and river risk if `risk=true`) |
| POST | `/ops/brief` *(heavy)* | body `{mode, exercise, include_engine, author}` → stored brief: sections, evidence, recommendations, source (`groq`… or `rules`) |
| GET | `/ops/briefs?limit=` | recent briefs |
| POST | `/ops/recommendations/{id}/decision` *(rate limited)* | body `{action: accept \| reject, note, author}` → decision id; `409` if already decided |
| GET | `/ops/search?q=` *(rate limited)* | place search in India (OpenStreetMap Nominatim, cached, at most 1 live request per second) |

## Replay

| Method | Path | Returns |
|---|---|---|
| GET | `/replay/{event_id}` | day-by-day observed vs predicted river level and the plan options' outcomes (`silchar_2022`) |

---

## Shared request bodies

### AnalysisRequest

| Field | Type | Default | Notes |
|---|---|---|---|
| `district` | string | `demo` | `demo` or `cachar` |
| `plan` | [PlanModel](#planmodel) | baseline | missing fields take the baseline's values |
| `what_if` | [WhatIf](#whatif) | none | fixes an uncertain input instead of sampling it |
| `n_samples` | int | 300 | 20 to 5000 |
| `seed` | int | 42 | same seed, same futures, same result |

### PlanModel

| Field | Meaning |
|---|---|
| `start_hour` | hour (0-48) at which the evacuation order goes out |
| `priority` | area ids, most urgent first |
| `open_shelters` | shelter ids in use |
| `route_avoid` | key bridge ids not to route over |
| `boats_at`, `vehicles_at` | `{staging_id: count}` |
| `protected` | `"cluster:<id>"` areas raised or guarded (flood about 1 m later) |
| `warning_channels` | any of `siren`, `sms`, `loudspeaker`, `door_to_door` |

### WhatIf

`peak_stage_m`, `local_rain_mm`, `boat_availability_pct` (0-1), `boat_delay_h`, `comms_degradation_pct` (0-1), `compliance_pct` (0-1), `peak_time_h`, `bridge_closed` (list of bridge ids).

### CompareRequest

`district`, `plans` (`{name: PlanModel}`, 2 to 6), `what_if`, `n_samples` (default 300), `seed`.

### OptimizeRequest

`district`, `what_if`, `n_samples` (10-200, default 20), `population` (6-60, default 16), `generations` (1-30, default 6), `seed`.

### DecisionRequest

| Field | Notes |
|---|---|
| `district`, `action` | `accept`, `edit` or `reject` |
| `plan` | the plan decided on |
| `run_id` | the simulation it rests on (404 if unknown) |
| `explanation`, `note` | up to 5000 and 500 characters |
| `evidence` | snapshot of the analyses (up to 200,000 characters) |
| `author` | the name typed in the header; **not verified** (default `Duty officer`) |
