# Contributing to AEGIS-X

Thanks for helping. Small, focused pull requests with tests are the easiest to review.

## Setup

```bash
git clone https://github.com/ayushkumartht/AEGIS-X.git
cd AEGIS-X
python -m venv .venv
.venv/Scripts/pip install -r backend/requirements.txt pytest      # Linux/macOS: .venv/bin/pip
cd frontend && npm install
```

Run the API from `backend/` (`python -m uvicorn aegis.api.main:app --reload`) and the frontend from `frontend/` (`npm run dev`). See the README quickstart.

## Ground rules

- **The engine stays domain-free.** Nothing in `backend/aegis/engine` imports from `domains/` (a test checks it).
- **The AI never decides and never invents numbers.** Anything it writes is checked against the evidence it was given, with a rule-based fallback. Keep it that way.
- **Never present an estimate as data.** If an input is assumed, say so where it is shown.
- **No secrets in git.** `.env` is ignored; use `.env.example` for new settings.

## Tests

```bash
cd backend && python -m pytest -q          # a few minutes: the Cachar engine tests are real simulations
cd frontend && npx tsc -b && npm run build
```

Add a test for every behaviour you add or fix. Tests must not call live feeds (set `AEGIS_OFFLINE=true`; the poller is off in tests).

## Commits and branches

Conventional Commits (`feat(engine): ...`, `fix(flood): ...`, `docs: ...`). Branch from `master` as `feat/<name>` or `fix/<name>`.

## Pull request checklist

- [ ] Tests pass and new behaviour has a test
- [ ] `npx tsc -b` and `npm run build` pass
- [ ] Docs and `CHANGELOG.md` updated
- [ ] No keys, passwords or personal data in the diff
