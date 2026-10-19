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
