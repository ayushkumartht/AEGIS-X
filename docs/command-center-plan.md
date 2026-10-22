# Command Center: final architecture and build plan

Date: 22 Oct 2026. Status: **final, built** (C1 to C6 done on 22 Oct 2026; C7 needs the owner, see section 11).

**What it is.** A separate dashboard at `/command`, the full version of what Dikshansh started: one screen for many districts, fed by **live official data** (NDMA SACHET alerts including CWC river gauges, GDACS, GloFAS river forecasts), with an **AI strategy advisor** that proposes actions using only that data and the AEGIS-X engine's own tested numbers. People decide; every decision is stored in a tamper-evident log. Flood is built first. Crowd and fire plug into the same design later.

Reads with: [archive/dikshansh-contributions-2026-10-20.md](archive/dikshansh-contributions-2026-10-20.md) (what he built), [final-implementation-plan.md](final-implementation-plan.md) (engine, flood console), [fullstack-deployment-plan.md](fullstack-deployment-plan.md) (hosting, accounts).

---

## 1. Screens

| Route | Who | What |
|---|---|---|
| `/command` | everyone (AI advisor: officer, admin) | **Command Center**: India map with live alerts and district flood risk, alert list, district risk table, feed health, AI strategy brief with Accept/Reject, operating-mode selector, place search |
| `/console/:district` | everyone (decisions: officer, admin) | the existing deep-dive flood tool; opened from the Command Center |
| `/admin` | admin | system overview and accounts (was `/command` before) |
| `/audit` | everyone | decision log, now with "chain intact" check |

## 2. Live data (checked from this machine on 22 Oct 2026)

| Feed | What it gives | Status | How it is used |
|---|---|---|---|
| **NDMA SACHET** RSS + CAP 1.2 XML per alert | Official alerts from IMD, **CWC**, state SDMAs: event, severity, urgency, certainty, effective/expiry, English headline and description, area text, LGD district code | ✅ 100 live items | Main alert feed. **CWC flood alerts carry the gauge's water level, warning level and danger level** in the description and the gauge position in `altitude`/`ceiling` (lat, lon). Polygon URLs return 403, so position comes from the gauge, the watched-district names, or geocoding the area text. |
| **GDACS** event API | International flood/cyclone events for India, alert level, GeoJSON point | ✅ | Big-event layer |
| **Open-Meteo Flood API** (GloFAS v4) | River discharge: 7-day ensemble forecast and a multi-decade daily history at any point | ✅ | District flood risk (section 4) |
| Open-Meteo Ensemble | Rain forecast | ✅ | Rain shown beside the river risk |
| OSM Nominatim | Place search, area-text geocoding | ✅ (1 request/s, cached) | Search box, locating alerts |
| IMD district API | Nowcasts | ❌ IP whitelisting needed | IMD alerts already reach us through SACHET |
| CWC FFS site | Gauge dashboard | ⚠️ timed out | Not needed: CWC alerts come through SACHET |
| ReliefWeb v2 | Situation reports | ⚠️ needs an approved appname | Later |
| NASA FIRMS | Active fires | ⚠️ needs a free key | Fire module, later |

Rule: a feed that fails shows "unavailable since <time>" and its last data is labelled with its age. Nothing is invented to fill a gap.

## 3. Architecture

```
                 ┌───────────────── backend/aegis/ops ─────────────────┐
 SACHET RSS ───► │ feeds/sachet.py  parse CAP (en-IN), hazard, place   │
 GDACS API  ───► │ feeds/gdacs.py                                       │──► store.py (SQLite)
 GloFAS     ───► │ risk.py   return periods + ensemble exceedance       │     ops_event
                 │ districts.py   watched districts, river-cell search  │     ops_indicator
                 │ poller.py      background refresh, feed health       │     ops_feed
                 │ hazards.py     flood ✔ | crowd ✖ | fire ✖ (slots)    │     ops_brief
                 │ advisor.py     evidence → LLM brief → guardrail      │     ops_recommendation
                 └──────────────────────────────────────────────────────┘
                                   │                          decision (hash-chained)
 engine (Monte Carlo, Red Team, VOI, optimiser) on built districts ◄──┘
                                   │
 api/routers/ops.py  /api/v1/ops/*  ──► frontend /command  ──► /console/:district
```

### 3.1 Hazard plugins

```python
@dataclass
class Hazard:
    id: str            # "flood" | "crowd" | "fire"
    name: str
    enabled: bool
    keywords: tuple    # words in an alert's event/headline that belong to this hazard
    note: str          # shown when disabled: what data it still needs
```

Flood is enabled. Crowd and fire are registered **disabled**, so the screen shows "coming later: needs <data>" and alerts that mention fire are still collected under that hazard.

### 3.2 Tables

| Table | Key fields |
|---|---|
| `ops_event` | `uid` (source:id), source, hazard, event, severity, urgency, certainty, sender, state, area, headline, description, lat, lon, place_method, district_id, effective, expires, sent, gauge (JSON: level, warning, danger, trend), url, fetched_at |
| `ops_indicator` | district_id, computed_at, forecast_date, q_2/q_5/q_20, p_2/p_5/p_20 (share of ensemble members exceeding), peak_day, peak_median, level, inputs |
| `ops_feed` | name, last_attempt, last_success, last_error, items |
| `ops_brief` | id, created_at, scope, mode, evidence (JSON), sections (JSON), source (llm/rules), model, author |
| `ops_recommendation` | id, brief_id, district_id, action, why, gain, cost, risk, status, decided_by, decision_id |
| `decision` (existing) | + `evidence_json`, `previous_hash`, `decision_hash` |

### 3.3 Refresh

`poller.py` runs inside the API process (asyncio task started at app start when `AEGIS_OPS_POLL=true`): SACHET and GDACS every 10 minutes, GloFAS indicators every 3 hours. Each CAP alert is fetched once and cached forever (alerts do not change; updates arrive as new alerts). `POST /ops/refresh` (officer, admin) forces a refresh. On Render a single instance runs the poller.

## 4. District flood risk

Watched districts live in `data/ops/watched_districts.yaml` (flood-prone districts of Assam, Bihar, UP, West Bengal, Odisha, Kerala, J&K, Maharashtra, Andhra Pradesh; Cachar is the built one).

1. **River cell.** GloFAS is a ~5 km grid; a town's coordinates may sit on a cell without the main river. `districts.py` tries a 3×3 neighbourhood (0.05° steps) and keeps the cell with the largest mean flow over one year. The choice is cached and shown.
2. **Return periods.** From the daily history (2005 to last year), annual maxima → Gumbel fit (method of moments) → the 2-, 5- and 20-year flood flows. Fewer than 10 years of data: no indicator, said so.
3. **Forecast.** GloFAS 7-day ensemble; for each return period, the share of members that exceed it on any day, and the day of the highest median flow.
4. **Level.** severe: P(20-yr) ≥ 30% · warning: P(5-yr) ≥ 30% · watch: P(2-yr) ≥ 30% · else normal. Thresholds are in the same YAML and printed on screen.
5. **Alerts.** Active SACHET alerts of the flood hazard located in the district are listed beside it; a CWC gauge above its danger level raises the level to at least "warning".

## 5. AI strategy advisor

**How it works: evidence first, then words.** The advisor does not let the LLM browse or decide. It:

1. **Collects evidence** deterministically: active flood alerts (with CWC gauge numbers), district risk indicators, and for districts with a built scenario at watch level or above: the engine's result for the baseline plan, its Red Team (failure rate, single points of failure) and the top "check first" item. Each piece of evidence gets an id (`E1`, `E2`...).
2. **Writes the brief** with the LLM (Groq), asking for JSON with fixed sections, every statement citing evidence ids.
3. **Checks** it: valid JSON, every cited id exists, every number appears in the evidence (`numbers_are_grounded`). Fails → the same sections are filled by rules from the evidence.

Mode (Armed Forces, Police, CAPF/Response, Disaster Response, Emergency Management, Administration) changes the wording and which actions come first (e.g. Armed Forces: boats, airlift, engineers; Administration: orders, camps, relief), never the numbers.

**Brief sections:** situation · where it is worst · recommended actions (≤ 5; each: action, why with evidence ids, what it gains, what it costs, what could break it) · check first · uncertainty (estimates, feeds down).

**Decisions:** each recommendation has Accept / Reject. The decision is stored in the decision log with the brief's evidence, hash-chained to the previous decision (SHA-256 over the row plus the previous hash). `/audit` shows "chain intact" or the first row that does not verify. Limit, stated on screen: without an outside anchor, deleting the newest rows cannot be detected.

Cost and load: one brief = one LLM call and at most two engine runs of ≤ 300 futures; rate-limited like other heavy endpoints.

## 6. Dikshansh's work: what is taken over

| His feature | Here |
|---|---|
| India-wide MapLibre map: heat of events by severity, points, layer toggles, legend, popups | ✅ on live `ops_event` / `ops_indicator` instead of his synthetic JSON |
| Operating modes (Armed Forces, Police, CAPF/Response, Disaster Response, Emergency Management, Administration) | ✅ filters + advisor wording |
| Situation brief with rule-based fallback and grounding | ✅ section 5, with engine evidence |
| Place search (Nominatim proxy, cached, 1 request/s) | ✅ `GET /ops/search` |
| Week-over-week activity comparison | ✅ alert counts this week vs last week, labelled "reported alerts, not a risk measure" |
| Hash-chained audit + integrity check | ✅ |
| Evidence stored with every decision | ✅ console and Command Center |
| Resources tab (boats assigned vs available) | ✅ console |
| Console tab in the URL (`?tab=`) | ✅ console |
| Provenance per input (observed / derived / assumed) | ✅ already in the Situation tab; also `GET /districts/{d}/provenance` |
| Synthetic demo events | ❌ replaced by live feeds |
| His auth system | ❌ ours is in place |
| OpenTopoData, `.runtimepackages` dump | ❌ |

## 7. API (`/api/v1/ops`)

| Method | Path | Who | Returns |
|---|---|---|---|
| GET | `/ops/hazards` | all | hazard plugins and whether enabled |
| GET | `/ops/feeds` | all | per feed: last success/attempt/error, items |
| GET | `/ops/events` | all | events (filters: hazard, severity, state, active, days) + GeoJSON + counts + week-over-week |
| GET | `/ops/districts` | all | watched districts with latest indicator, level, active alerts |
| POST | `/ops/refresh` | officer, admin | refresh feeds now |
| POST | `/ops/brief` | officer, admin | build a brief (body: mode, scope) |
| GET | `/ops/briefs` | officer, admin | recent briefs |
| POST | `/ops/recommendations/{id}/decision` | officer, admin | accept / reject (hash-chained) |
| GET | `/ops/search?q=` | all | place search in India |
| GET | `/audit/integrity` | all | chain check |

## 8. Frontend

```
frontend/src/
  pages/CommandCenterPage.tsx      new /command
  pages/AdminPage.tsx              old Command Center, now /admin
  features/ops/
    OpsMap.tsx                     MapLibre: alerts (severity), district risk, built districts, search pin
    FeedHealth.tsx                 one chip per feed
    AlertList.tsx                  filterable alert list (CWC gauges show level vs danger)
    DistrictRisk.tsx               table: level, P(5-yr), peak day, alerts, "Open console"
    BriefPanel.tsx                 AI brief with evidence chips and Accept/Reject
    ModeSelector.tsx, PlaceSearch.tsx
  features/plan/ResourcesTab.tsx   console
```

## 9. Folder and file plan (backend)

```
backend/aegis/ops/
  __init__.py
  hazards.py        registry (flood on; crowd, fire off)
  feeds/sachet.py   RSS + CAP parse, hazard + place, CWC gauge numbers
  feeds/gdacs.py
  districts.py      watched districts, river cell search
  risk.py           Gumbel return periods, ensemble exceedance, level
  store.py          ops_* tables
  poller.py         refresh loop + feed health
  advisor.py        evidence, LLM brief, guardrail, rule fallback
backend/aegis/api/routers/ops.py
data/ops/watched_districts.yaml
```

Tests: CAP parsing on recorded XML (no network), Gumbel and exceedance on synthetic series, poller failure → feed marked unavailable, advisor rejecting an LLM answer with an invented number, hash-chain detects an edited row, API role checks.

## 10. Crowd and fire (later)

| Hazard | Data still needed | Model |
|---|---|---|
| Fire | NASA FIRMS key; Open-Meteo wind/humidity (works); OSM land use (works) | spread + evacuation on the road graph |
| Crowd (police) | event schedules, venue gates from OSM (works), live counts from a partner | flow through gates and choke points |

## 11. Build order and status

| # | Phase | Done when | Status |
|---|---|---|---|
| C1 | Feeds: SACHET + GDACS parsers, store, poller, `/ops/feeds`, `/ops/events` | Today's alerts appear with severity and place; a failing feed shows as unavailable | done |
| C2 | District risk: watched districts, river cell, return periods, exceedance, `/ops/districts` | Each watched district has a level with its numbers; Cachar's June 2022 history passes the 5-year flow | done |
| C3 | Command Center page; admin moved to `/admin` | An officer sees India alerts and district levels and opens Cachar's console from it | done |
| C4 | Advisor | Every number traces to evidence; LLM off still gives a brief; invented number rejected (test) | done |
| C5 | Hash-chained decisions + evidence + `/audit/integrity` | Editing a stored row by hand is reported | done |
| C6 | Console: Resources tab, `?tab=` | — | done |
| C7 | Outside requests: IMD whitelisting, ReliefWeb appname, FIRMS key | each source added behind the same feed-health contract | needs the owner |

## 11b. Simulated exercise (added 23 Oct 2026)

On a calm day every district is "normal" and the screen shows nothing happening. For drills and demos the Command Center has a **simulated exercise** scenario, "Brahmaputra and Barak in spate" (`aegis/ops/exercise.py`).

- **Per viewer, never global.** `?exercise=1` on the page (`exercise=true` on `/ops/events`, `/ops/districts`, `/ops/feeds`, and `exercise` in the brief request). Nobody else's screen changes, and it is never mixed with live data.
- **Labelled everywhere.** Amber banner on the page, source "SIMULATED EXERCISE", alert ids `exercise:...`, a "SIMULATED EXERCISE" badge on the brief whose first line says it is built on a simulated scenario, and decisions taken on it are stored with `exercise: true` (shown on `/audit`).
- **Realistic shape.** 1 severe (Cachar), 3 warning, 7 watch districts. Flood levels come from each district's own GloFAS flood flows (so "20-year flood" means that river's 20-year flood); 14 alerts with CWC gauge readings against warning and danger levels (Cachar's Barak gauge above danger), IMD heavy-rain alerts and state SDMA alerts at real gauge sites. All readings are invented.
- **The engine is real.** For built districts the evacuation engine runs against the simulated flood (the rating curve turns the simulated peak flow into a stage; local rain is added), so the brief's evacuation numbers are tested numbers for that scenario.

## 12. Limits (shown in the UI)

- The advisor suggests; it never sends alerts or orders.
- District risk comes from a global model (GloFAS, ~5 km); local drainage and embankment breaches are not in it.
- Alert positions are as precise as each sender writes them.
- Feeds go down; the screen shows when.
