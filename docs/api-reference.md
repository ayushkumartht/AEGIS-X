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
