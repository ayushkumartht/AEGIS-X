# Changelog

## [Unreleased]

## [0.3.0] - 2026-10-23
### Added
- **Command Center** (`/command`): live official alerts (NDMA SACHET, GDACS), district flood levels from GloFAS, feed health, place search, operating modes.
- **AI strategy brief** with evidence ids, a number/id/district guardrail and a rule-based fallback; Accept / Reject per recommendation.
- **Exercise mode**: a labelled, per-viewer simulated flood scenario, tested against the real evacuation engine.
- **Tamper-evident decision log** (hash chain, `/audit/integrity`) with evidence stored per decision.
- Hour-by-hour flood playback in the real-terrain and lite 3D views.
- Real relief-camp list for Silchar from the district flood report, with labelled estimates.
- Console redesign: infographic sidebar (range bars, gauges, meters), icon tabs, clearer buttons.
- Docker, Render and Vercel configuration; rate limits for heavy endpoints; HTTP fallback when WebSockets are blocked.
- MIT license.

### Changed
- Groq default model is now `openai/gpt-oss-120b` (the previous default no longer exists).
- The decision-log author is a typed name; there are **no accounts or login**.

### Removed
- Login, roles and the admin page.
- Superseded v0 grid-demo documents and helper scripts.

## [0.2.0] - 2026-10-01
### Changed
- Restructured the project into the `backend/aegis/` package hierarchy and added `pyproject.toml`.

## [0.1.0] - 2026-09-01
### Added
- Initial Monte Carlo engine, flood / fire / crowd model stubs, React + Vite frontend.
