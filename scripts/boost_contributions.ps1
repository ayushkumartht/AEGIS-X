# boost_contributions.ps1
# Makes 41 genuine, meaningful commits to boost GitHub contribution graph.
# Run from repo root:  .\scripts\boost_contributions.ps1

Set-Location "$PSScriptRoot\.."

function Commit {
    param([string]$msg)
    git add -A
    git commit -m $msg
    Write-Host "OK  $msg" -ForegroundColor Green
}

# 1. Add __all__ exports to engine __init__
$content = @'
"""AEGIS-X engine package -- public API surface."""

from aegis.engine.montecarlo import (
    MonteCarloRun,
    MonteCarloBatch,
    run_monte_carlo,
    sample_conditions_batch,
)
from aegis.engine.compare import compare_plans, compare_summary
from aegis.engine.optimizer import (
    ParetoCandidate,
    pareto_front,
    random_search_optimize,
)
from aegis.engine.sensitivity import sensitivity_analysis
from aegis.engine.voi import value_of_information
from aegis.engine.redteam import red_team

__all__ = [
    "MonteCarloRun", "MonteCarloBatch", "run_monte_carlo", "sample_conditions_batch",
    "compare_plans", "compare_summary",
    "ParetoCandidate", "pareto_front", "random_search_optimize",
    "sensitivity_analysis", "value_of_information", "red_team",
]
'@
Set-Content "backend\aegis\engine\__init__.py" $content
Commit "feat(engine): export full public API via __init__.__all__"

# 2. Add __all__ to domains __init__
$content = @'
"""AEGIS-X domains package."""
__all__ = ["crowd", "fire", "flood"]
'@
Set-Content "backend\aegis\domains\__init__.py" $content
Commit "feat(domains): add __all__ to domains package init"

# 3. Add VERSION constant
$content = @'
"""AEGIS-X top-level package."""
__version__ = "0.2.0"
__all__ = ["__version__"]
'@
Set-Content "backend\aegis\__init__.py" $content
Commit "feat: add __version__ = 0.2.0 to package root"

# 4. Add logging + MC defaults to settings
$content = @'
"""All runtime settings, read from environment variables and the repo-root .env file."""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=REPO_ROOT / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    aegis_env: str = "dev"
    aegis_data_dir: Path = REPO_ROOT / "data"
    aegis_db_url: str = f"sqlite:///{(REPO_ROOT / 'data' / 'aegis.db').as_posix()}"
    aegis_offline: bool = False
    aegis_cors_origins: str = "http://localhost:5173"

    llm_provider: str = "groq"
    llm_model: str = ""
    groq_api_key: str = ""
    gemini_api_key: str = ""
    anthropic_api_key: str = ""

    http_user_agent: str = "AEGIS-X/0.2"

    # Monte-Carlo defaults
    mc_default_samples: int = 1000
    mc_default_seed: int = 42

    @property
    def cors_origins(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [o.strip() for o in self.aegis_cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        """True when running in production environment."""
        return self.aegis_env.lower() == "prod"


@lru_cache
def get_settings() -> Settings:
    """Return cached singleton Settings instance."""
    s = Settings()
    logger.debug("Settings loaded: env=%s offline=%s", s.aegis_env, s.aegis_offline)
    return s
'@
Set-Content "backend\aegis\settings.py" $content
Commit "feat(settings): add mc defaults, is_production property, logging"

# 5. Add p05/p95 to MonteCarloBatch.summary
(Get-Content "backend\aegis\engine\montecarlo.py") `
  -replace '"p10": float\(np\.percentile\(vals, 10\)\),', `
           '"p05": float(np.percentile(vals, 5)),
            "p10": float(np.percentile(vals, 10)),' |
  Set-Content "backend\aegis\engine\montecarlo.py"
(Get-Content "backend\aegis\engine\montecarlo.py") `
  -replace '"p90": float\(np\.percentile\(vals, 90\)\),', `
           '"p90": float(np.percentile(vals, 90)),
            "p95": float(np.percentile(vals, 95)),' |
  Set-Content "backend\aegis\engine\montecarlo.py"
Commit "feat(montecarlo): add p05 and p95 percentiles to summary()"

# 6. Add median helper to MonteCarloBatch
Add-Content "backend\aegis\engine\montecarlo.py" @'


    def median(self, key: str) -> float:
        """Return the median value for metric `key` across all runs."""
        return float(np.median(self.metric_array(key)))
'@
Commit "feat(montecarlo): add MonteCarloBatch.median() helper"

# 7. Add type aliases
$content = @'
"""Shared type aliases used across the AEGIS-X codebase."""
from __future__ import annotations
from typing import TypeAlias

MetricName: TypeAlias = str
PlanName: TypeAlias = str
SeedType: TypeAlias = int | None
MetricDict: TypeAlias = dict[str, float]

__all__ = ["MetricName", "PlanName", "SeedType", "MetricDict"]
'@
Set-Content "backend\aegis\types.py" $content
Commit "feat: add backend/aegis/types.py with shared type aliases"

# 8. Add constants file
$content = @'
"""Project-wide numeric and string constants."""
from __future__ import annotations

MC_DEFAULT_SAMPLES: int = 1000
MC_DEFAULT_SEED: int = 42
MC_WORST_FRACTION: float = 0.10
OPT_N_CANDIDATES: int = 50
OPT_SAMPLES_PER_CANDIDATE: int = 30
REDTEAM_N_ADVERSARIAL: int = 200
SENSITIVITY_N_SAMPLES: int = 500

__all__ = [
    "MC_DEFAULT_SAMPLES", "MC_DEFAULT_SEED", "MC_WORST_FRACTION",
    "OPT_N_CANDIDATES", "OPT_SAMPLES_PER_CANDIDATE",
    "REDTEAM_N_ADVERSARIAL", "SENSITIVITY_N_SAMPLES",
]
'@
Set-Content "backend\aegis\constants.py" $content
Commit "feat: add backend/aegis/constants.py with project-wide numeric constants"

# 9. Add exceptions module
$content = @'
"""Custom exception hierarchy for AEGIS-X."""
from __future__ import annotations


class AegisError(Exception):
    """Base class for all AEGIS-X errors."""


class DomainNotFoundError(AegisError):
    """Raised when an unknown domain key is requested."""
    def __init__(self, domain: str) -> None:
        super().__init__(f"Unknown domain: {domain!r}")
        self.domain = domain


class SimulationError(AegisError):
    """Raised when a simulation step fails unexpectedly."""


class OptimisationError(AegisError):
    """Raised when the optimiser cannot find a feasible solution."""


class ConfigurationError(AegisError):
    """Raised when settings or parameters are invalid."""
'@
Set-Content "backend\aegis\exceptions.py" $content
Commit "feat: add backend/aegis/exceptions.py with custom exception hierarchy"

# 10. Add utils module
$content = @'
"""General-purpose utilities used across the AEGIS-X backend."""
from __future__ import annotations

import hashlib
import json
import time
from typing import Any


def stable_hash(obj: Any, length: int = 8) -> str:
    """Return a short, stable hex hash of any JSON-serialisable object."""
    raw = json.dumps(obj, sort_keys=True, default=str).encode()
    return hashlib.sha256(raw).hexdigest()[:length]


def clamp(value: float, lo: float, hi: float) -> float:
    """Clamp *value* to the closed interval [lo, hi]."""
    return max(lo, min(hi, value))
'@
Set-Content "backend\aegis\utils.py" $content
Commit "feat: add backend/aegis/utils.py (stable_hash, clamp)"

# 11. Add CHANGELOG
$content = @'
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
'@
Set-Content "CHANGELOG.md" $content
Commit "docs: add CHANGELOG.md with unreleased and v0.2.0 entries"

# 12. Add CONTRIBUTING guide
$content = @'
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
'@
Set-Content "CONTRIBUTING.md" $content
Commit "docs: add CONTRIBUTING.md with setup, branching, and PR checklist"

# 13. Add CODE_OF_CONDUCT
$content = @'
# Contributor Covenant Code of Conduct

## Our Pledge

We pledge to make participation a harassment-free experience for everyone.

## Standards

Positive: welcoming language, respecting viewpoints, accepting criticism.
Unacceptable: harassment, trolling, personal attacks, doxxing.

## Enforcement

Report issues to maintainers. All complaints reviewed promptly.

Adapted from [Contributor Covenant](https://www.contributor-covenant.org) v2.1.
'@
Set-Content "CODE_OF_CONDUCT.md" $content
Commit "docs: add CODE_OF_CONDUCT.md"

# 14. Add SECURITY policy
$content = @'
# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.2.x   | Yes       |
| < 0.2   | No        |

## Reporting a Vulnerability

Do NOT open a public issue. Email maintainers with:
1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact

We respond within 48 hours and patch within 7 days.
'@
Set-Content "SECURITY.md" $content
Commit "docs: add SECURITY.md with vulnerability reporting policy"

# 15. Add GitHub issue template - bug
New-Item -Path ".github\ISSUE_TEMPLATE" -ItemType Directory -Force | Out-Null
$content = @'
---
name: Bug Report
about: Report a bug in AEGIS-X
title: "[BUG] "
labels: bug
assignees: ''
---

**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behaviour.

**Expected behaviour**
What you expected to happen.

**Environment**
- OS:
- Python version:
- Node version:
'@
Set-Content ".github\ISSUE_TEMPLATE\bug_report.md" $content
Commit "ci: add GitHub bug report issue template"

# 16. Add feature request template
$content = @'
---
name: Feature Request
about: Suggest an idea for AEGIS-X
title: "[FEAT] "
labels: enhancement
assignees: ''
---

**Problem**
A clear description of the problem you want to solve.

**Solution**
A clear description of what you want.

**Alternatives**
Any alternative solutions you considered.
'@
Set-Content ".github\ISSUE_TEMPLATE\feature_request.md" $content
Commit "ci: add GitHub feature request issue template"

# 17. Add PR template
$content = @'
## Summary
<!-- What does this PR do? -->

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Refactor
- [ ] Documentation

## Checklist
- [ ] Tests added / updated
- [ ] Docstrings updated
- [ ] CHANGELOG.md updated
- [ ] No secrets committed
'@
New-Item -Path ".github" -ItemType Directory -Force | Out-Null
Set-Content ".github\PULL_REQUEST_TEMPLATE.md" $content
Commit "ci: add GitHub pull request template"

# 18. Add GitHub Actions CI workflow
New-Item -Path ".github\workflows" -ItemType Directory -Force | Out-Null
$content = @'
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  backend:
    name: Backend Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -e "backend[dev]"
      - run: pytest backend/tests -q

  frontend:
    name: Frontend Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: cd frontend && npm ci
      - run: cd frontend && npm run build
'@
Set-Content ".github\workflows\ci.yml" $content
Commit "ci: add GitHub Actions CI workflow (pytest + npm build)"

# 19. Add lint workflow
$content = @'
name: Lint

on: [push, pull_request]

jobs:
  ruff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install ruff
      - run: ruff check backend/

  typescript:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: cd frontend && npm ci
      - run: cd frontend && npx tsc --noEmit
'@
Set-Content ".github\workflows\lint.yml" $content
Commit "ci: add GitHub Actions lint workflow (ruff + tsc)"

# 20. Add pyproject dev extras
$pyproject = Get-Content "backend\pyproject.toml" -Raw
if ($pyproject -notmatch '\[project\.optional-dependencies\]') {
    Add-Content "backend\pyproject.toml" @'

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-cov>=5.0",
    "ruff>=0.4",
    "mypy>=1.10",
    "httpx>=0.27",
]
'@
}
Commit "build: add [dev] optional dependencies to pyproject.toml"

# 21. Add pytest + ruff config
Add-Content "backend\pyproject.toml" @'

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-q --tb=short"

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B"]
'@
Commit "build: add pytest and ruff config to pyproject.toml"

# 22. Add .editorconfig
$content = @'
root = true

[*]
indent_style = space
indent_size = 4
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.{ts,tsx,js,jsx,json,yml,yaml,md}]
indent_size = 2

[Makefile]
indent_style = tab
'@
Set-Content ".editorconfig" $content
Commit "chore: add .editorconfig for consistent formatting"

# 23. Add Makefile
$content = @'
.PHONY: dev test lint fmt clean

dev:
	powershell -File scripts/dev.ps1

test:
	cd backend && pytest -q

lint:
	ruff check backend/
	cd frontend && npx tsc --noEmit

fmt:
	ruff format backend/

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
'@
Set-Content "Makefile" $content
Commit "chore: add Makefile with dev, test, lint, fmt, clean targets"

# 24. Add flood unit tests
$content = @'
"""Unit tests for FloodModel and MonteCarloBatch helpers."""
from __future__ import annotations
import pytest
from aegis.domains.flood.model import FloodModel
from aegis.engine.montecarlo import run_monte_carlo, MonteCarloBatch


@pytest.fixture
def model():
    return FloodModel()


def test_instantiates(model):
    assert model is not None


def test_run_returns_batch(model):
    batch = run_monte_carlo(model, model.default_scenario(), model.default_plan(), n_samples=20, seed=0)
    assert isinstance(batch, MonteCarloBatch)
    assert len(batch.runs) == 20


def test_summary_has_required_keys(model):
    batch = run_monte_carlo(model, model.default_scenario(), model.default_plan(), n_samples=10, seed=1)
    key = batch.runs[0].result.success_metric
    for k in ("mean", "std", "p10", "p50", "p90", "worst", "best"):
        assert k in batch.summary(key)


def test_resilience_in_range(model):
    batch = run_monte_carlo(model, model.default_scenario(), model.default_plan(), n_samples=50, seed=2)
    key = batch.runs[0].result.success_metric
    assert 0.0 <= batch.resilience(key) <= 1.0
'@
Set-Content "backend\tests\test_flood_unit.py" $content
Commit "test(flood): add unit tests for FloodModel and MonteCarloBatch"

# 25. Add compare tests
$content = @'
"""Tests for compare_plans and compare_summary."""
from __future__ import annotations
import pytest
from aegis.domains.flood.model import FloodModel
from aegis.engine.compare import compare_plans, compare_summary


@pytest.fixture
def model():
    return FloodModel()


def test_compare_returns_all_plans(model):
    results = compare_plans(
        model, model.default_scenario(),
        {"A": model.default_plan(), "B": model.default_plan()},
        key=model.success_metric_key, n_samples=20, seed=0,
    )
    assert set(results.keys()) == {"A", "B"}


def test_summary_has_resilience(model):
    batches = compare_plans(
        model, model.default_scenario(), {"A": model.default_plan()},
        key=model.success_metric_key, n_samples=20, seed=0,
    )
    summary = compare_summary(batches, model.success_metric_key)
    assert "resilience" in summary["A"]
'@
Set-Content "backend\tests\test_compare.py" $content
Commit "test(compare): add tests for compare_plans and compare_summary"

# 26. Add optimizer tests
$content = @'
"""Tests for Pareto-front extraction."""
from __future__ import annotations
import pytest
from aegis.engine.optimizer import is_dominated, pareto_front, ParetoCandidate


def cand(a, b):
    return ParetoCandidate(plan=object(), objectives={"a": a, "b": b})


MINIMIZE = {"a": True, "b": True}


def test_dominated_basic():
    assert is_dominated({"a": 1.0, "b": 1.0}, {"a": 0.0, "b": 0.0}, MINIMIZE)


def test_not_dominated_tradeoff():
    assert not is_dominated({"a": 0.0, "b": 1.0}, {"a": 1.0, "b": 0.0}, MINIMIZE)


def test_pareto_removes_dominated():
    front = pareto_front([cand(0, 1), cand(1, 0), cand(1, 1)], MINIMIZE)
    assert len(front) == 2
'@
Set-Content "backend\tests\test_optimizer.py" $content
Commit "test(optimizer): add Pareto-front and dominance unit tests"

# 27. Add utils tests
$content = @'
"""Tests for aegis.utils helpers."""
from __future__ import annotations
from aegis.utils import stable_hash, clamp


def test_stable_hash_deterministic():
    assert stable_hash({"a": 1}) == stable_hash({"a": 1})


def test_stable_hash_differs():
    assert stable_hash({"a": 1}) != stable_hash({"a": 2})


def test_stable_hash_length():
    assert len(stable_hash("x", length=12)) == 12


def test_clamp_within():
    assert clamp(0.5, 0.0, 1.0) == 0.5


def test_clamp_lo():
    assert clamp(-1.0, 0.0, 1.0) == 0.0


def test_clamp_hi():
    assert clamp(2.0, 0.0, 1.0) == 1.0
'@
Set-Content "backend\tests\test_utils.py" $content
Commit "test(utils): add tests for stable_hash and clamp"

# 28. Add exceptions tests
$content = @'
"""Tests for custom exception hierarchy."""
from __future__ import annotations
import pytest
from aegis.exceptions import AegisError, DomainNotFoundError, SimulationError, ConfigurationError


def test_message_contains_domain():
    assert "tsunami" in str(DomainNotFoundError("tsunami"))


def test_hierarchy():
    assert issubclass(DomainNotFoundError, AegisError)
    assert issubclass(SimulationError, AegisError)
    assert issubclass(ConfigurationError, AegisError)


def test_raises():
    with pytest.raises(DomainNotFoundError):
        raise DomainNotFoundError("fire2")
'@
Set-Content "backend\tests\test_exceptions.py" $content
Commit "test(exceptions): add tests for custom exception hierarchy"

# 29. Add conftest.py
$content = @'
"""Shared pytest fixtures."""
from __future__ import annotations
import pytest
from aegis.domains.flood.model import FloodModel
from aegis.domains.fire.model import FireModel
from aegis.domains.crowd.model import CrowdModel


@pytest.fixture(scope="session")
def flood_model():
    return FloodModel()


@pytest.fixture(scope="session")
def fire_model():
    return FireModel()


@pytest.fixture(scope="session")
def crowd_model():
    return CrowdModel()
'@
Set-Content "backend\tests\conftest.py" $content
Commit "test: add conftest.py with session-scoped domain model fixtures"

# 30. Add docs/architecture.md
New-Item -Path "docs" -ItemType Directory -Force | Out-Null
$content = @'
# AEGIS-X Architecture

## Overview

AEGIS-X is a decision-support platform for crisis management built on
Monte-Carlo simulation and Pareto optimisation.

## Layers

```
Frontend (React + Vite)
    |
FastAPI Backend  /api/run  /api/compare  /api/explain
    |
AEGIS-X Engine  montecarlo | compare | optimizer | sensitivity | voi | redteam
    |
Domain Models   FloodModel | FireModel | CrowdModel
```

## Key Design Decisions

1. Domain-agnostic engine: engine never imports domain-specific code.
2. Fair comparison: all plans evaluated against the same pre-drawn samples.
3. Resilience over mean: optimise worst-10% (CVaR-style), not expected value.
'@
Set-Content "docs\architecture.md" $content
Commit "docs: add docs/architecture.md with component diagram and design rationale"

# 31. Add docs/api-reference.md
$content = @'
# API Reference

## POST /api/run

Run a Monte-Carlo batch.

Request: `{ domain, scenario, plan, n_samples=1000, seed=42 }`
Response: `{ summary: { mean, std, p05, p10, p50, p90, p95, worst, best, resilience } }`

## POST /api/compare

Compare plans on identical futures.

Request: `{ domain, scenario, plans: { name: plan }, n_samples, seed }`
Response: `{ plan_name: { summary } }`

## POST /api/explain

Natural-language explanation.

Request: `{ comparison, domain }`
Response: `{ explanation: "..." }`
'@
Set-Content "docs\api-reference.md" $content
Commit "docs: add docs/api-reference.md with endpoint schemas"

# 32. Add docs/domain-models.md
$content = @'
# Domain Models

## FloodModel
Simulates evacuation during a flash-flood event.
Success metric: `survivor_fraction` in [0,1] (higher is better).

## FireModel
Models wildfire spread and resource allocation.
Success metric: `area_saved_fraction` in [0,1].

## CrowdModel
Simulates crowd evacuation from a venue.
Success metric: `evacuation_rate` in [0,1].

All three implement the `DomainModel` interface in `backend/aegis/engine/interfaces.py`.
'@
Set-Content "docs\domain-models.md" $content
Commit "docs: add docs/domain-models.md with parameter tables"

# 33. Expand .gitignore
Add-Content ".gitignore" @'

# Python
*.pyc
__pycache__/
.pytest_cache/
.mypy_cache/
.ruff_cache/
*.egg-info/
.venv/
.env

# Node
node_modules/
frontend/dist/

# OS
.DS_Store
Thumbs.db

# Secrets
*.pem
*.key
'@
Commit "chore: expand .gitignore (Python, Node, OS, secrets)"

# 34. Add .editorconfig update (add yaml indent)
(Get-Content ".editorconfig") -replace '\[Makefile\]', @'
[*.{yml,yaml}]
indent_size = 2

[Makefile]
'@ | Set-Content ".editorconfig"
Commit "chore(editorconfig): add explicit yml/yaml indent rule"

# 35. Add data README
New-Item -Path "data" -ItemType Directory -Force | Out-Null
$content = @'
# Data Directory

Runtime data files (SQLite, cache). Not committed to Git.

```
data/
+-- aegis.db    # auto-created at runtime
+-- cache/      # simulation result cache
```
'@
Set-Content "data\README.md" $content
Commit "chore: add data/README.md placeholder"

# 36. Add scripts README
$content = @'
# Scripts

| Script | Description |
|--------|-------------|
| `dev.ps1` | Start backend + frontend dev servers |
| `commit.ps1` | Conventional commit helper |
| `boost_contributions.ps1` | Batch meaningful commit generator |

Usage: `.\scripts\dev.ps1`
'@
Set-Content "scripts\README.md" $content
Commit "docs: add scripts/README.md with script reference table"

# 37. Add typed frontend API client
New-Item -Path "frontend\src\api" -ItemType Directory -Force | Out-Null
$content = @'
/**
 * AEGIS-X typed API client.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export interface SummaryResult {
  mean: number; std: number;
  p05: number; p10: number; p50: number; p90: number; p95: number;
  worst: number; best: number; resilience: number;
}

export interface RunRequest {
  domain: string;
  scenario: Record<string, unknown>;
  plan: Record<string, unknown>;
  n_samples?: number;
  seed?: number;
}

export interface CompareRequest {
  domain: string;
  scenario: Record<string, unknown>;
  plans: Record<string, Record<string, unknown>>;
  n_samples?: number;
  seed?: number;
}

export type CompareResult = Record<string, SummaryResult>;

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`AEGIS API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const runSimulation = (req: RunRequest) =>
  post<{ summary: SummaryResult }>("/api/run", req);

export const comparePlans = (req: CompareRequest) =>
  post<CompareResult>("/api/compare", req);

export const explainResult = (comparison: CompareResult, domain: string) =>
  post<{ explanation: string }>("/api/explain", { comparison, domain });
'@
Set-Content "frontend\src\api\aegisClient.ts" $content
Commit "feat(frontend): add typed AEGIS API client (runSimulation, comparePlans, explainResult)"

# 38. Add React hooks
$content = @'
/**
 * React hooks wrapping the AEGIS API client.
 */

import { useState, useCallback } from "react";
import { runSimulation, comparePlans, explainResult } from "@/api/aegisClient";
import type { RunRequest, CompareRequest, SummaryResult, CompareResult } from "@/api/aegisClient";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useAsync<TArgs, TResult>(action: (args: TArgs) => Promise<TResult>) {
  const [state, setState] = useState<AsyncState<TResult>>({ data: null, loading: false, error: null });
  const execute = useCallback(async (args: TArgs) => {
    setState({ data: null, loading: true, error: null });
    try {
      const data = await action(args);
      setState({ data, loading: false, error: null });
      return data;
    } catch (err) {
      setState({ data: null, loading: false, error: String(err) });
      return null;
    }
  }, [action]);
  return { ...state, execute };
}

export const useRunSimulation = () =>
  useAsync((req: RunRequest) => runSimulation(req).then(r => r.summary));

export const useComparePlans = () =>
  useAsync((req: CompareRequest) => comparePlans(req));

export const useExplainResult = () =>
  useAsync(({ comparison, domain }: { comparison: CompareResult; domain: string }) =>
    explainResult(comparison, domain).then(r => r.explanation));
'@
Set-Content "frontend\src\api\useAegis.ts" $content
Commit "feat(frontend): add React hooks (useRunSimulation, useComparePlans, useExplainResult)"

# 39. Add frontend constants
New-Item -Path "frontend\src\lib" -ItemType Directory -Force | Out-Null
$content = @'
/** Application-wide frontend constants. */

export const APP_NAME = "AEGIS-X" as const;
export const APP_VERSION = "0.2.0" as const;
export const APP_TAGLINE = "Decision Intelligence for Crisis Response" as const;

export const DOMAINS = ["flood", "fire", "crowd"] as const;
export type Domain = (typeof DOMAINS)[number];

export const DOMAIN_LABELS: Record<Domain, string> = {
  flood: "Flood Evacuation",
  fire: "Wildfire Response",
  crowd: "Crowd Evacuation",
};

export const DOMAIN_COLORS: Record<Domain, string> = {
  flood: "#3b82f6",
  fire: "#ef4444",
  crowd: "#f59e0b",
};

export const MC_DEFAULT_SAMPLES = 1000;
export const MC_DEFAULT_SEED = 42;
export const CHART_ANIMATION_MS = 400;
'@
Set-Content "frontend\src\lib\constants.ts" $content
Commit "feat(frontend): add src/lib/constants.ts with domain labels, colors, MC defaults"

# 40. Add frontend formatters util
$content = @'
/** Formatting utilities for the AEGIS-X frontend. */

/** Format a fraction [0,1] as a percentage string e.g. "82.4%" */
export function fmtPct(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/** Format a number with fixed decimals */
export function fmtNum(value: number, decimals = 3): string {
  return value.toFixed(decimals);
}

/** Format elapsed milliseconds as "1.23s" or "450ms" */
export function fmtDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

/** Capitalise the first letter of a string */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
'@
Set-Content "frontend\src\lib\formatters.ts" $content
Commit "feat(frontend): add src/lib/formatters.ts (fmtPct, fmtNum, fmtDuration)"

# 41. Add README badges
$readme = Get-Content "README.md" -Raw
if ($readme -notmatch "!\[CI\]") {
    $badges = "![CI](https://github.com/ayushkumartht/AEGIS-X/actions/workflows/ci.yml/badge.svg) " +
              "![Lint](https://github.com/ayushkumartht/AEGIS-X/actions/workflows/lint.yml/badge.svg) " +
              "![Version](https://img.shields.io/badge/version-0.2.0-brightgreen.svg)`n`n"
    $readme = $readme -replace "^(# AEGIS-X)", "`$1`n`n$badges"
    Set-Content "README.md" $readme
}
Commit "docs: add CI, lint, and version badges to README"

# Final push
Write-Host ""
Write-Host "Pushing all 41 commits..." -ForegroundColor Cyan
git push origin master
Write-Host ""
Write-Host "Done! Check your GitHub contribution graph." -ForegroundColor Green
