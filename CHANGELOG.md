# Changelog

## [Unreleased]
### Added
- `types.py`, `constants.py`, `exceptions.py`, `utils.py` in `backend/aegis/`
- `MonteCarloBatch.median()` helper
- `p05` and `p95` percentiles in `MonteCarloBatch.summary()`
- `Settings.is_production` property
- Full `__all__` exports in engine and domains packages

## [0.2.0] - 2026-10-01
### Changed
- Restructured project layout to `backend/aegis/` package hierarchy
- Frontend components moved to `frontend/src/features/demo/`
- Added `pyproject.toml`

## [0.1.0] - 2026-09-01
### Added
- Initial Monte Carlo engine
- Flood, fire, crowd domain models
- React + Vite frontend
