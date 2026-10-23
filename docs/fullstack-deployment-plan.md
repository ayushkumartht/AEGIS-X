# Going live: Vercel (frontend) and Render (API)

Updated 23 Oct 2026. There are no accounts or logins; if you expose the app publicly and want to restrict who can use it, put it behind your own access control (for example your host's password protection or an identity-aware proxy).

## Why two hosts

| Part | Host | Why |
|---|---|---|
| Frontend (React + Vite build) | **Vercel** | Static build, CDN, deploys from GitHub. `frontend/vercel.json` rewrites every path to `index.html`, so `/command` and `/console/cachar` survive a reload. |
| API (FastAPI, numpy / scipy) | **Render**, Docker web service | Monte Carlo runs take seconds of CPU, simulations stream over WebSockets, and the audit log needs a disk. Serverless functions are short-lived and have none of that. |
| Database | SQLite on a Render persistent disk (`/var/data/aegis.db`) | No extra service. Without a disk the decision log resets on each deploy. |
| AI | Groq (`GROQ_API_KEY` set on the API only) | The browser never sees the key. |

```
Browser --HTTPS--> Vercel (static React app)
   └--HTTPS / WSS--> Render: FastAPI --> Groq (narration, briefs)
                          ├-> Open-Meteo, NDMA SACHET, GDACS (live data)
                          ├-> /var/data/aegis.db (runs, reports, decisions, events)
                          └-> /app/data (built Cachar scenario and cached sources, shipped in the image)
```

The API image is plain Docker (`backend/Dockerfile`), so it also runs on Railway, Fly.io or a VPS.

## Steps

1. **API on Render.** New > Blueprint > pick the repository. Render reads `render.yaml`. Set the secrets it asks for: `GROQ_API_KEY` and `AEGIS_CORS_ORIGINS` (your Vercel URL). Open `https://<api>/api/v1/health`: it should show `"status": "ok"` and `"llm_provider": "groq"`.
2. **Frontend on Vercel.** New Project > import the repository > Root Directory `frontend` > Framework Vite. Add `VITE_API_URL=https://<api>` and deploy.
3. Put the Vercel URL into the API's `AEGIS_CORS_ORIGINS` (and, for preview deploys, `AEGIS_CORS_ORIGIN_REGEX`, for example `https://aegis-x-.*\.vercel\.app`) and redeploy the API.
4. Check `/command` (try **Exercise**), `/console/cachar` (test a plan), and `/audit`.

## Environment variables

API (Render):

| Name | Example | Notes |
|---|---|---|
| `AEGIS_ENV` | `prod` | |
| `AEGIS_CORS_ORIGINS` | `https://aegis-x.vercel.app` | required |
| `AEGIS_CORS_ORIGIN_REGEX` | `https://aegis-x-.*\.vercel\.app` | optional |
| `AEGIS_DB_URL` | `sqlite:////var/data/aegis.db` | set by `render.yaml` |
| `LLM_PROVIDER`, `GROQ_API_KEY`, `LLM_MODEL` | `groq`, `gsk_...` | the Groq default model is `openai/gpt-oss-120b` |
| `AEGIS_OPS_POLL` | `true` | live alert polling; run it in one process only |
| `AEGIS_RATE_LIMIT_PER_MIN`, `AEGIS_MAX_HEAVY_JOBS` | `30`, `2` | protects the heavy endpoints on a public site |

Frontend (Vercel): `VITE_API_URL` (the API's URL).

## Known limits after launch

- Render's free plan sleeps after 15 minutes idle (the first request then takes about a minute) and has no persistent disk. A paid instance stays awake and keeps the decision log.
- Heavy endpoints are rate limited per visitor IP and run at most `AEGIS_MAX_HEAVY_JOBS` at once. The first Cachar brief runs the evacuation engine and can take up to a minute; the result is then cached for 30 minutes.
- Model parameters for people's behaviour (compliance, speeds) are assumptions shown as sliders, not calibrated against evacuation records.
- Never commit `.env`. If a key has been pasted anywhere public, rotate it.
