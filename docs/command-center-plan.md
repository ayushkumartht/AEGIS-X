# Command Center: implementation plan (flood first; crowd and fire later)

Date: 22 Oct 2026. Status: plan only, nothing built yet.

**Goal.** A separate dashboard, in the spirit of what Dikshansh started: one screen that shows what is happening across many districts from **live official data**, and an **AI strategy advisor** that proposes what to do, using only that data and the AEGIS-X engine's own tested numbers. People decide. Flood is built first. Crowd and fire get slots in the design now and are built later.

Reads with: [dikshansh-contributions-2026-10-20.md](archive/dikshansh-contributions-2026-10-20.md) (what he built), [final-implementation-plan.md](final-implementation-plan.md) (engine and flood console), [fullstack-deployment-plan.md](fullstack-deployment-plan.md) (hosting, accounts).

---

## 1. What changes for the user

| Today | After this plan |
|---|---|
| `/console/:district`: test one plan for one district | unchanged: the deep-dive tool |
| `/command`: admin-only system overview (runs, accounts) | moves to `/admin` |
| (nothing) | **`/command`: the Command Center**: map of India, live alerts, flood risk per watched district, AI strategy brief, one click into the district console |

The Command Center is open to `officer` and `admin`; `viewer` can see it read-only. Visitors without an account see a public version without the AI advisor (it costs LLM calls).

## 2. Real data the dashboard will use (checked 22 Oct 2026)

Every feed below was called from this machine on 22 Oct 2026.

| Feed | What it gives | Status | Use |
|---|---|---|---|
| **NDMA SACHET** CAP alerts, `sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml` + per-alert CAP XML | Official alerts from IMD, CWC and state SDMAs: event (flood, heavy rain, lightning...), severity, urgency, certainty, effective/expiry time, sender, affected area | ✅ 200, 100 live items | Main alert feed. Titles are often in regional languages; the CAP XML has an `en-IN` info block, use that. |
| **GDACS** event API (`gdacs.org/gdacsapi/...?eventlist=FL&country=India`) | International flood/cyclone/earthquake events with alert level (green/orange/red) and GeoJSON | ✅ 200 | Large-event layer, cross-check |
| **Open-Meteo Flood API** (GloFAS) | River discharge forecast, any point in India, ensemble | ✅ 200 (already used for Cachar) | **Flood risk per watched district** (section 4) |
| **Open-Meteo Forecast / Ensemble** | Rain forecast, any point | ✅ 200 (already used) | Rain risk per district |
| **Open-Meteo Archive / GloFAS history** | 16+ years of discharge | ✅ (already used for calibration) | Return-period thresholds per district |
| OpenStreetMap Overpass / Nominatim | Roads, bridges, shelters, place search | ✅ (already used) | District build, map search |
| Cachar DDMA flood reports (PDF) | Camps, inmates, damage per revenue circle | ✅ manual (already used) | Shelter list; later a parser for daily reports |
| IMD district warnings API | District nowcasts and warnings | ❌ 401 "IP needs to be whitelisted" | Apply to IMD for whitelisting the server IP; SACHET already carries IMD alerts meanwhile |
| CWC flood forecast (`ffs.india-water.gov.in`) | River gauge levels vs danger level | ⚠️ timed out today | Add with retry and cache; show "unavailable" honestly when down |
| ReliefWeb API v2 | Situation reports | ⚠️ 403 until an approved `appname` is requested | Request an appname (free) |
| NASA FIRMS | Active fires from satellite | ⚠️ needs a free MAP_KEY | **Fire module, later** |

Rule: a layer whose feed is down shows "unavailable since <time>", never old data presented as current, and never invented data.

## 3. Architecture

```
            ┌──────────── feeds (poll + cache) ────────────┐
SACHET CAP ─┤ alerts.py   → Event rows (normalised)        │
GDACS      ─┤ gdacs.py    → Event rows                     │
Open-Meteo ─┤ risk.py     → RiskIndicator per district     │──► SQLite: event, indicator, brief,
CWC (later)─┘                                              │    recommendation, decision (hash-chained)
                                                           │
Hazard plugins:  flood (built)  | crowd (slot) | fire (slot)
   each gives: feeds it reads, indicators, a district model for the engine, strategy tools
                                                           │
AI strategy advisor (LLM with tools, section 5) ───────────►│ reads only tool results
                                                           │
API /api/v1/ops/* ─► Command Center page (/command)  ─► "Open district" → /console/:district
```

### 3.1 Hazard plugin contract (so crowd and fire slot in later)

```python
class Hazard(Protocol):
    id: str                                  # "flood", later "crowd", "fire"
    def feeds(self) -> list[Feed]: ...       # which feeds produce its events
    def indicators(self, district) -> list[RiskIndicator]: ...   # live risk numbers
    def model_for(self, district) -> Model | None: ...           # engine model if the district is built
    def strategy_tools(self) -> list[Tool]: ...                  # what the AI advisor may call
```

Flood implements all four now. Crowd and fire are registered as **disabled** plugins, so the UI shows them as "coming later" instead of empty panels.

### 3.2 Data model (new tables)

| Table | Fields | Notes |
|---|---|---|
| `event` | id, hazard, source (sachet/gdacs/cwc), source_id, title_en, severity, urgency, certainty, sender, area_desc, geometry (GeoJSON), effective, expires, fetched_at, raw_url | Deduplicated by (source, source_id). Expired alerts kept for history. |
| `indicator` | district, hazard, name, value, unit, threshold, level (normal/watch/warning/severe), computed_at, inputs (JSON) | Recomputed on each poll |
| `brief` | id, created_at, scope (all-India/state/district), inputs (JSON: ids of events, indicators, runs), text sections, source (llm/rules), model | Every brief records exactly what it was built from |
| `recommendation` | id, brief_id, district, action, rationale, evidence (run ids, numbers), status (proposed/accepted/rejected), decided_by | Accept/reject goes into the hash-chained decision log |
| `watched_district` | id, name, state, lat, lon, river point, built (has a scenario?) | Starts with Cachar (built) + flood-prone districts from the CWC/ASDMA lists (risk indicators only until built) |

### 3.3 Polling

A background task in the API process (asyncio, every 10 min for SACHET/GDACS, every 3 h for Open-Meteo), through the existing `cached_json` cache and rate limits. On Render one instance runs it; a `last_success` per feed is stored and shown.

## 4. Flood risk per district (real numbers, no guessing)

For each watched district:
1. **Return periods from history.** From 16+ years of GloFAS discharge at the district's river point (same method as `calibrate_from_record`), compute the 2-, 5- and 20-year flood discharges.
2. **Forecast.** Today's GloFAS ensemble for the next 7 days.
3. **Indicator.** Share of ensemble members that exceed each return period, and the day it happens: e.g. "40% chance of passing the 5-year flood on 25 Oct".
4. **Level.** normal / watch (2-yr likely) / warning (5-yr likely) / severe (20-yr likely). The thresholds are written in config and shown on screen.
5. **Alerts.** Active SACHET flood and heavy-rain alerts whose area matches the district raise the level by one step and are listed beside it.

Districts with a built scenario (Cachar) also show the engine's last tested plan result ("current plan evacuates 82% on a bad day").

## 5. AI strategy advisor

The LLM does not decide and does not make up numbers. It works like a staff officer with tools: it can only see what the tools return, and every number in its answer must come from a tool result (the existing `numbers_are_grounded` guardrail, extended to tool outputs).

### 5.1 Tools (flood)

| Tool | Returns | Backed by |
|---|---|---|
| `get_alerts(state?, district?)` | active official alerts | `event` table |
| `get_flood_risk(district)` | indicators from section 4 | `indicator` table |
| `get_district_assets(district)` | shelters (with how each was located), boats, bridges, population | scenario + provenance |
| `test_plan(district, plan)` | Monte Carlo summary of a plan | engine `simulate` |
| `red_team(district, plan)` | failure rate, single points of failure, failure conditions | engine Red Team |
| `what_to_check(district, plan)` | VOI ranking | engine VOI |
| `suggest_plans(district)` | Pareto options (safest / best average / leanest) | engine NSGA-II |

Groq supports tool calling. Each advisor session is capped at a fixed number of tool calls and engine samples, so it costs a known amount and cannot overload the server.

### 5.2 Output (structured, every time)

1. **Situation**: what the alerts and indicators say, each line citing its source.
2. **Where it is worst**: districts ranked by indicator level and people exposed.
3. **Recommended actions**: up to 5, each with *why* (the tool result), *what it buys* (engine numbers), *what it costs* (boats, false alarm), *what could break it* (Red Team).
4. **Check first**: the VOI top items.
5. **Uncertainty**: which inputs are estimates (from provenance), which feeds were down.

If the LLM is off or its answer fails the guardrail, the same structure is filled by rules from the tool results (no AI text, still useful).

### 5.3 Human decision

Each recommendation has Accept / Edit / Reject. The decision is saved with its evidence (the tool results it used) in the **hash-chained** audit log (Dikshansh's design: each row's SHA-256 includes the previous row's hash, and `/audit` shows "chain intact" or the first broken row).

## 6. What is ported from Dikshansh's work

| His feature | Port? | How |
|---|---|---|
| India-wide MapLibre map with heatmap, layer toggles, legend, popups | ✅ | Rebuild on the real `event` and `indicator` tables, not his synthetic JSON |
| Operating-mode selector (Armed Forces, Police, CAPF, Disaster Response, EM, Administration) | ✅ | Mode sets default filters and the advisor's phrasing; flood is the only active hazard for now |
| Situation brief with rule-based fallback and grounding | ✅ | Becomes section 5 (with tools) |
| Map place search (Nominatim proxy, cached, 1 req/s) | ✅ | `GET /ops/search` |
| Provenance (observed / derived / assumed) | ✅ | Extend the Situation tab sources list to an API `GET /districts/{d}/provenance` |
| Hash-chained audit log + integrity check | ✅ | Section 5.3 |
| Evidence captured with every decision | ✅ | Console decisions too |
| Resources tab (boats assigned vs available) | ✅ | Console |
| Console tab in the URL (`?tab=redteam`) | ✅ | Console |
| Synthetic `demo_events.json` | ❌ | Replaced by live SACHET/GDACS. A labelled "exercise mode" with recorded past alerts can come later for drills |
| His auth system | ❌ | Ours is already built |
| OpenTopoData elevation | ❌ | Not needed |
| `.runtimepackages` dump commit | ❌ | Never |

## 7. API (new, under `/api/v1/ops`)

| Method | Path | Who | Returns |
|---|---|---|---|
| GET | `/ops/feeds` | all | each feed: last success, last error, item count |
| GET | `/ops/events` | all | filtered events + GeoJSON + counts (filters: hazard, severity, state, district, since) |
| GET | `/ops/districts` | all | watched districts with indicators and level |
| GET | `/ops/districts/{id}/risk` | all | indicator detail with ensemble numbers |
| POST | `/ops/brief` | officer, admin | runs the advisor; returns the structured brief and its recommendations |
| GET | `/ops/briefs` | officer, admin | past briefs |
| POST | `/ops/recommendations/{id}/decision` | officer, admin | accept / edit / reject, hash-chained |
| GET | `/ops/search?q=` | all | place search (India) |
| GET | `/audit/integrity` | admin | hash-chain check |

## 8. Frontend

- `pages/CommandCenterPage.tsx` (new, at `/command`): mode selector · feed health strip · map (alerts, district risk, built districts) · district risk list · AI brief panel with Accept/Reject per recommendation · "Open console" per district.
- `components/ops/`: `OpsMap.tsx`, `FeedHealth.tsx`, `RiskList.tsx`, `BriefPanel.tsx`, `ModeSelector.tsx`, `PlaceSearch.tsx`.
- Current admin page moves to `pages/AdminPage.tsx` at `/admin`.
- Console: `ResourcesTab`, `?tab=` in the URL, evidence capture in `DecisionBar`.

## 9. Phases

| # | Phase | Done when |
|---|---|---|
| C1 | Feeds: SACHET CAP parser (English info block, area), GDACS, poller, `event` table, `/ops/feeds`, `/ops/events` | Live alerts from today appear with correct severity and area; a feed outage shows as "unavailable", tested with a recorded failure |
| C2 | Flood risk: watched-district list, return periods from history, ensemble exceedance, `indicator` table, `/ops/districts` | Cachar's indicator for June 2022 (replayed from history) reaches "severe" before the 2022 peak; today's levels match the GloFAS numbers |
| C3 | Command Center page: map, mode selector, risk list, feed health, place search; admin page moved to `/admin` | An officer sees all-India alerts and district levels on one screen and opens Cachar's console from it |
| C4 | AI advisor: tool-calling loop on Groq, caps, grounding on tool outputs, rule-based fallback, `brief` + `recommendation` tables | Every number in a brief traces to a tool result; with the LLM off the brief still fills from rules; a test feeds a fake LLM answer with an invented number and sees it rejected |
| C5 | Decisions: hash-chained audit, evidence capture, `/audit/integrity`, Accept/Reject on recommendations | Editing a stored decision row by hand makes `/audit/integrity` report that row |
| C6 | Console ports: Resources tab, `?tab=` URL, provenance API | — |
| C7 | Requests to outside bodies: IMD IP whitelisting, ReliefWeb appname; add CWC when reachable | Each source is added behind the same feed-health contract |

C1 to C5 is the core; C6 and C7 can run in parallel.

## 10. Crowd and fire (later, design slots only)

| Hazard | Likely real data | Engine model | Status |
|---|---|---|---|
| Fire | NASA FIRMS active fires (free key), Open-Meteo wind/humidity, OSM land use | spread + evacuation on the same road graph | plugin registered, disabled |
| Crowd (police) | event schedules, OSM venues/gates, transit timetables; live counts need a partner (police, venue, telecom) | flow through gates and choke points | plugin registered, disabled |

Decide data partners before building either, because without a live data source they would run on assumptions only.

## 11. Limits to state openly

- The AI advisor suggests; it never sends alerts or orders.
- District risk levels come from a global model (GloFAS ~5 km); local drainage and embankment breaches are not in it.
- SACHET areas are as precise as each sender writes them; some are whole districts.
- Feeds can go down; the screen shows when, and old data is labelled with its time.
