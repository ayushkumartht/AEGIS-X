# Dikshansh Choudhary's contributions (2026-10-20) — removed from history

> **Why this file exists:** on 2026-10-21, 8 commits by Dikshansh Choudhary (`6b6312b`..`ff09564`) were merged into `master`, then removed by a hard reset and force-push, at the repo owner's request. This document records **what those commits implemented** before the code was removed, so the work is not lost to memory even though it is gone from the branch. The commits are still reachable by hash in local git history until garbage-collected, and may still exist on Dikshansh's own fork/clone.

**Scope of the removed work:** 8 commits, touching ~54 non-generated files (plus one commit that accidentally added a 74 MB local Python virtual-environment dump, `.runtimepackages/`, which should **not** be reinstated). Net effect: it layered a second, broader "Command Center" situational-awareness product on top of the existing flood-evacuation decision tool, plus an authentication system and an audit-log integrity upgrade.

---

## 1. The big picture: what Dikshansh was building

The existing AEGIS-X app (as built so far) is a **single-domain decision tool**: an officer tests a flood evacuation plan against simulated futures and sees Monte Carlo / Red Team / VOI / optimizer results for one district at a time, reached via `/console/:district`.

Dikshansh's commits added a **second, higher-level screen** in front of that: a **national Command Center** — an India-wide situational-awareness map and briefing screen — plus the access-control and audit infrastructure a real multi-user deployment would need. His own README rewrite describes the intended product as:

> "Unified Situational Awareness & Decision Intelligence... The default command center opens an India-centered MapLibre map... The implemented analytical domain remains flood evacuation... A human reviews results and records decisions. The application does not autonomously issue orders."

He also reframed the audience from a generic "decision-intelligence platform" to something closer to a **multi-agency HADR (Humanitarian Assistance and Disaster Relief) coordination tool** — the new "operating mode" selector lists Armed Forces, Police, CAPF / Response, Disaster Response, Emergency Management, and Administration as audiences.

Every new feature was written with heavy, explicit "this is synthetic / not verified / do not treat as operational" caveating — a consistent pattern across his commits (see §8).

---

## 2. Commit-by-commit summary

| Commit | Title | What it did |
|---|---|---|
| `6b6312b` | feat: add provenance tracking and resource management features | Provenance API + panel; `ResourcesTab`; `ScenarioLabTab`; decision records gain `operation_id` and `evidence` |
| `fbaf6c8` | feat: add map search and situation event features | `OperationalMap` (India-wide MapLibre map); situation-events API backed by a JSON fixture; place search via Nominatim; `CommandCenterPage` |
| `f1bcd1d` | feat(auth) + feat(situation) + ConsolePage URL tabs + AuthGate + demo assets | Login/logout/role auth (`auth.py`); LLM-backed situation briefing (`situation.py`); `AuthGate.tsx`; `ConsolePage` reads/writes the active tab via URL `?tab=`; `demo_assets.json` |
| `f801b55` | feat(map): enhance OperationalMap with error handling and attribution | Map error surface, attribution control polish, import cleanup |
| `eca28bd` | feat(CommandCenterPage): 30-day default range + "Show all events" | UX fix: the bundled demo events are older than 7 days, so the default filter missed them |
| `458ea1a` | "changes" | **Accidental**: committed the entire local `.runtimepackages/` virtualenv dump (3,409 files, ~1.25M lines). Not a real feature; do not reinstate. |
| `ec6e6ca` | feat(elevation): OpenTopoData integration | New `opentopodata.py` ingestion module; `scripts/build_scenario.py` gets a `--elevation-source` flag |
| `ff09564` | feat(docs): README/CHANGELOG/docs updates | Full README rewrite (product positioning + an extensive, explicit limitations section); `CHANGELOG.md` created; `scripts/README.md` and `DocumentationPage.tsx` updated |

---

## 3. Backend: Command Center data APIs

### 3.1 `backend/aegis/api/routers/situation.py` (new)

Normalized "situation event" feed, meant to represent incident-style reports on a map (not the flood engine's own simulation output).

- **`SituationEvent` model**: id, title, category, severity, timestamp, `EventLocation` (state, district, lat/lon), description, source, `source_type`, `data_classification` (`synthetic` vs `observed`/`public`), `status`, `confidence` (0–1), `related_events`, `tags`, `processing_status`. A `model_validator` back-fills legacy/missing fields (e.g. infers `synthetic` classification when the source name contains "synthetic").
- **`GET /situation/events`** (aliased at `/events`): loads `data/situation/demo_events.json`, filters by category / severity / state / district / status / source / date range, and returns:
  - the filtered events,
  - a GeoJSON `FeatureCollection` for the map,
  - `metrics`: total, active count, high-priority count, breakdowns by severity/category/state, and a **current-week vs prior-week** comparison (`historical.change_pct`) with an explicit note that this is "reported event activity comparison only; it does not establish cause or threat probability."
  - `mode`: `synthetic_demo` / `connected` / `empty`, with a `warning` string the frontend surfaces verbatim when the data is synthetic or missing.
  - Malformed records in the fixture are skipped and counted (`invalid_records_skipped`), not silently dropped.
- **`GET /situation/analysis`**: runs the same filters, then calls `build_situation_brief()` (see below) to produce a narrative briefing.
- **`SituationAsset` model + `GET /situation/assets`**: separate feed for mapped "infrastructure" and "resources" (facilities, boats, vehicles, etc.) from `data/situation/demo_assets.json`, with the same synthetic/observed classification and per-state/district filtering.

### 3.2 `backend/aegis/llm/situation.py` (new)

`build_situation_brief(collection, provider)` — turns the filtered event set into a structured briefing with five sections: `situation` (facts), `assessment` (trend sentence), `key_concerns` (high/critical event IDs), `uncertainty` (a caveat string), and `interpretation`.

- The **rule-based fallback** (`source: "rule_based"`) is always computed first from plain counts/percentages — no LLM required.
- If an LLM provider is configured, it's asked to phrase the `interpretation` from the same structured input (`input_data`, capped at 100 events) and the result is accepted **only if `numbers_are_grounded()` passes** (same guardrail used elsewhere in the codebase: no invented numbers) — otherwise it silently falls back to the rule-based text.
- Every brief carries `evidence_ids` (the event IDs it was built from) so the UI/audit log can trace the narrative back to specific records.

### 3.3 `backend/aegis/api/routers/map_search.py` (new)

`GET /map/search?q=...` — thin, cached, rate-limited proxy to **Nominatim** (OpenStreetMap's geocoder) restricted to India (`countrycodes=in`), so the frontend never calls a third-party service directly from the browser. In-memory cache (1 hour TTL, capped at 300 entries), global 1-request/second throttle, and a clean 503 when `AEGIS_OFFLINE=true`.

### 3.4 `backend/aegis/api/routers/districts.py` — new `GET /districts/{district}/provenance`

For every scenario input (population, roads, elevation, resources, staging points, shelters) and every uncertainty-range variable, labels it `observed` / `derived` / `assumed` with a confidence level, a source string, and a one-line method note. Intent: so the officer console can show, next to any number, *where it came from* and *how much to trust it* — this is what `ProvenancePanel.tsx` (§4) renders.

### 3.5 `backend/aegis/auth.py` (new) — authentication

Deliberately dependency-free (stdlib only):

- **Passwords**: PBKDF2-HMAC-SHA256, 310,000 iterations, random 16-byte salt, stored as `pbkdf2_sha256$<iters>$<salt_hex>$<digest_hex>` in the `AEGIS_AUTH_USERS` env var (JSON: `{"username": {"role": ..., "password_hash": ...}}`). `hash_password()` / `verify_password()` helpers; a constant-time compare via `hmac.compare_digest`.
- **Tokens**: a minimal hand-rolled JWT-like scheme — `v1.<base64url(payload)>.<base64url(HMAC-SHA256(payload))>`, 8-hour TTL, signed with `AEGIS_AUTH_SECRET` (must be ≥32 bytes or every auth check fails closed). Carried in an **HttpOnly, SameSite=strict** cookie (`aegis_access`) scoped to `/api/v1`, or a `Bearer` header.
- **Roles**: `admin`, `operator`, `analyst`, `viewer`.
- **Endpoints**: `POST /auth/login` (uses a dummy password hash on unknown usernames to avoid a timing side-channel revealing which usernames exist), `GET /auth/me`, `POST /auth/logout`.
- **`auth_configuration_valid()`**: true only if the secret is long enough and at least one configured user has a valid role and a `pbkdf2_sha256$`-prefixed hash — used to fail closed with a clear 503 rather than silently accepting everyone.
- **Enforcement** was wired into `api/main.py` as global middleware: auth is required whenever `AEGIS_AUTH_ENABLED=true` **or** `AEGIS_ENV=prod`; GET/HEAD requests are open to any authenticated session, while `POST /decisions` needs `admin`/`operator`, most analysis/report/forecast-refresh endpoints need `admin`/`operator`/`analyst`, and everything else defaults to `admin`-only.
- `backend/tests/test_auth.py` exercises the full flow: a `viewer` can read decisions but not create one (403); an `operator` can.

### 3.6 `backend/aegis/storage/db.py` / `repo.py` — hash-chained audit log

Extended the `decision` table with `operation_id`, `evidence_json`, `previous_hash`, `decision_hash` (migrated in-place via `ALTER TABLE ... ADD COLUMN` guarded by `PRAGMA table_info`, so existing databases upgrade without a migration tool).

- `add_decision()` now computes a **SHA-256 hash of the canonical (sorted-key) JSON of each decision row, chained to the previous row's hash** — a simple blockchain-style tamper-evidence scheme, computed inside a `BEGIN IMMEDIATE` transaction to serialize the chain correctly under concurrent writers.
- New `audit_integrity()` (presumably exposed as `GET /audit/integrity`, used by `AuditPage.tsx` and asserted in `test_auth.py`) recomputes every row's hash and reports `valid` / `invalid` / `valid_with_legacy_records`, which rows don't verify, and which pre-hash ("legacy") rows have no hash at all. Its own docstring is explicit about the limit: **"Without an external hash anchor, tail deletion or a full privileged rewrite cannot be detected; this is not immutable storage."**

### 3.7 `backend/aegis/ingest/opentopodata.py` (new) — alternate elevation source

`elevations()` fetches SRTM 90 m elevation from the public **OpenTopoData** API (`api.opentopodata.org/v1/srtm90m`) in batches of 100 points with a 1.1 s pause between batches (politeness/rate-limiting) and raises `DataError` if a batch comes back incomplete. Cached the same way as the existing Open-Meteo elevation fetch. `scripts/build_scenario.py` gained an `--elevation-source` flag to choose between it and the existing source, and scenario metadata now records which one was used.

---

## 4. Frontend: Command Center UI

### 4.1 `frontend/src/pages/CommandCenterPage.tsx` (new) — the new default landing experience

A full operational dashboard, separate from the flood console:

- **Operating-mode selector**, persisted to `localStorage` (`aegis-mode`): Armed Forces, Police, CAPF / Response, Disaster Response, Emergency Management, Administration. Each mode maps to a default event category filter (e.g. Police → "public safety").
- **Filters**: time range (with a 30-day default — fixed in `eca28bd` after discovering the bundled demo data is older than the original 7-day default), category, severity, state, district, status, source, plus a custom date range.
- Fetches `/situation/events` (filtered) and a second unfiltered `days: 365` query to populate the filter dropdowns themselves.
- Shows active-event count, high-priority count, and the current-week-vs-prior-week trend.
- A **"Generate brief"** action (`situationAnalysis`) calls the LLM-or-rule-based briefing endpoint (§3.2) and renders it.
- Embeds `OperationalMap` and `MapLegend`.

### 4.2 `frontend/src/components/map/OperationalMap.tsx` (new) — India-wide map

A second, independent MapLibre map (distinct from the flood console's `MapView`/`Scene3D`):

- OSM **raster** basemap (`tile.openstreetmap.org`, configurable via `VITE_OSM_RASTER_TILE_URL`), centered on India.
- Layers: a heatmap of event density (weighted by severity), event points (colored/sized by severity, with a highlighted stroke for the selected event), infrastructure points, resource points — each independently toggleable via `MapControls`.
- Click-to-select events and asset popups (name, kind/status, district/state, quantity, source, classification).
- A **search marker** layer wired to `MapSearch` (place search → fly-to + pin).
- Explicit `onError` handling surfacing a user-visible message instead of a silently broken map.

Supporting components: `MapControls.tsx` (layer toggles), `MapLayers.tsx`, `MapLegend.tsx` (severity/legend key), `MapSearch.tsx` (debounced search box hitting `GET /map/search`).

### 4.3 `frontend/src/components/AuthGate.tsx` (new)

Wraps the whole app. Calls `/health` to check `auth_enabled`; if auth is off, renders children immediately (so the existing no-login flood console keeps working unchanged). If auth is on but not configured server-side, shows a blocking message instead of a broken login form. Otherwise shows a login form, or — once authenticated — a small "username · role / Sign out" badge plus the app.

### 4.4 `frontend/src/components/ProvenancePanel.tsx` (new)

Renders the `/districts/{id}/provenance` list as a collapsible per-item list with `observed`/`derived`/`assumed` colored badges and a confidence label, plus a synthetic-data banner when the whole district is synthetic. Intended to sit in the flood console's Situation tab.

### 4.5 `frontend/src/features/plan/ResourcesTab.tsx` (new) — flood console addition

A new console tab: modeled boats/vehicles available vs. assigned (flags over-assignment in red), per-staging-point allocation table, and total shelter capacity — explicitly scoped as "does not model medical teams, personnel rosters, or agency-specific capabilities."

### 4.6 `frontend/src/features/situation/ScenarioLabTab.tsx` (new) — flood console addition

A redesigned what-if panel (overlapping with/replacing part of the existing `SituationTab`): sliders for peak stage, time-to-peak, rainfall, boat availability, compliance, comms degradation, plus bridge-closure checkboxes, with a prominent "what-if values replace model ranges for this run — not forecasts or observed conditions" banner and a "last completed run" summary.

### 4.7 Other frontend edits

- `ConsolePage.tsx`: tab state moved into the URL (`?tab=...`) so a console view is linkable/bookmarkable; new `ResourcesTab` added to the tab set.
- `DecisionBar.tsx`: now also collects an `operation_id` (defaulting to `HADR-<DISTRICT>-001`) and bundles the current run/comparison/red-team/plan-options/briefing into an `evidence` object sent with every decision.
- `AuditPage.tsx`: shows the operation ID, a `status` badge, the integrity-check result (§3.6) at the top of the page, and a collapsible "Captured evidence" JSON block per decision.
- `ResultsTab.tsx`: minor integration changes to feed the new evidence capture.
- `App.tsx`: new routes for the Command Center and wraps everything in `AuthGate`.
- `vite-env.d.ts`: typed the new `VITE_OSM_RASTER_TILE_URL` env var.
- `DocumentationPage.tsx` / `LandingPage.tsx`: copy rewritten to describe the Command Center, the operating modes, and the synthetic-data caveats; landing page's elevation-source description updated for the OpenTopoData option.

---

## 5. New data fixtures

- `data/situation/demo_events.json` — ~8+ synthetic India-wide "exercise inject" events (bridge access reports, weather observations, etc.) spanning multiple states, each explicitly labeled as fictional/synthetic in its own description text, used by `test_situation.py` and the Command Center demo.
- `data/situation/demo_assets.json` — matching synthetic infrastructure/resource fixture for `GET /situation/assets`.
- `data/README.md` — updated to document these new fixtures.

---

## 6. Tests added

- `backend/tests/test_auth.py` — login, role-gated `/decisions` access (viewer read-only, operator can write), audit integrity check after a write.
- `backend/tests/test_situation.py` — demo events are well-formed and India-wide (`≥8` events, `≥5` states), filters narrow both the event list and the metrics consistently, and a generated brief keeps its `evidence_ids` and the "not a real-world report" uncertainty language intact.
- `backend/tests/test_fusion_storage.py` — extended (15 lines) for the audit-log schema/hash changes.

---

## 7. Documentation changes

- **`README.md`**: full rewrite. Repositioned the product as "Unified Situational Awareness & Decision Intelligence" with HADR/multi-agency framing; added a long, itemized "Current capabilities" list and an equally long "Important data limits" section spelling out, feature by feature, what is synthetic vs. real, what is not independently validated, and what is explicitly out of scope (no federated identity, no password reset, no rate limiting, Pearson correlation is not causal, etc.).
- **`CHANGELOG.md`** (new file): `Unreleased` / `0.2.0` / `0.1.0` sections; notes the `srtm90m` elevation option, HTTP retry behavior honoring `Retry-After`, and a change to how historical replay reuses a committed calibration.
- **`scripts/README.md`**: documented the new `--elevation-source` flag.
- **`docs/final-implementation-plan.md`**: updated (27 lines) to reflect the above — not reviewed line-by-line in this summary.

---

## 8. Recurring design pattern across all of this

Every new feature follows the same honest-prototype discipline already established in the flood engine (see `docs/final-implementation-plan.md` engineering rules): **separate the fact from the fabrication, and say so out loud**.

- Every synthetic dataset carries `data_classification: "synthetic"` end-to-end (API → UI banner).
- Every narrative/briefing feature reuses the existing `numbers_are_grounded()` guardrail so an LLM can phrase text but never invent a number.
- Every new capability's README bullet is paired with an explicit limitation bullet in the same section.
- Auth and audit-hashing both **fail closed** (missing/short secret → 503, not "open access"; hash-chain mismatch → reported, not hidden) rather than fail open.

---

## 9. If this work is wanted back

The commits are not deleted from git's object database yet (only unreferenced by any branch after the reset + force-push). They can be recovered, as long as they haven't been garbage-collected, with:

```powershell
git fetch origin                      # harmless; does not restore anything by itself
git cherry-pick 6b6312b^..ff09564     # replay all 8 commits onto the current branch
```

or, to inspect first without touching the current branch:

```powershell
git show 6b6312b                      # etc., per commit in the table above
git diff 6b6312b^..ff09564 -- <path>  # full diff of a specific file across the whole series
```

**Before replaying:** drop the `458ea1a` ("changes") commit specifically — it only adds the accidental `.runtimepackages/` virtualenv dump and should not be reinstated. The other 7 commits are coherent, working features (per the commit-by-commit notes above). Note that `.env.example` is currently back to its **pre-Dikshansh** state (no `AEGIS_AUTH_*` block) — that file was reverted to the repo owner's version during the earlier merge cleanup, so `backend/aegis/settings.py`'s `aegis_auth_enabled` / `aegis_auth_secret` / `aegis_auth_users` fields (from `6b6312b`, if replayed) would have no matching documented keys in `.env.example` until that block is re-added too.
