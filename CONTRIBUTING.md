# Contributing to AEGIS-X

## Quick Setup

```bash
git clone https://github.com/ayushkumartht/AEGIS-X.git
cd AEGIS-X
cd backend && pip install -e ".[dev]"
cd ../frontend && npm install && npm run dev
```

## Commit Convention

We follow Conventional Commits:
```
feat(engine): add p95 percentile to summary
fix(flood): clamp survivor_fraction to [0, 1]
docs(api): update explain endpoint docstring
```

## Branching

- `master` - stable
- `feat/<name>` - new features
- `fix/<name>` - bug fixes

## Running Tests

```bash
cd backend && pytest -q
```

## Pull Request Checklist

- [ ] Tests pass
- [ ] Docstrings added/updated
- [ ] CHANGELOG.md updated
