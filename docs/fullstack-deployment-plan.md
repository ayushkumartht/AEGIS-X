# AEGIS-X full-stack launch plan (Vercel + backend host)

Date: 22 Oct 2026. Goal: AEGIS-X ko public website ki tarah live karna, sab features asli backend ke saath, koi dummy data ya fake button nahi.

This plan builds on [flood-final-status-and-demo.md](flood-final-status-and-demo.md) (what already works) and [final-implementation-plan.md](final-implementation-plan.md) (architecture).

**Status (22 Oct 2026):** Phases 1, 2, 3 and 5 are built, tested and pushed. Phase 4.3 is built (the Situation tab lists every source and marks estimates). Phases 4.1 and 4.2 need official data that is not online in machine-readable form: the district's relief-camp list with capacities, its boat inventory, and ward-level population. Until then those inputs stay labelled as estimates. What is left for you: the go-live steps in section 4.

---

## 1. Hosting decision

| Part | Where | Why |
|---|---|---|
| Frontend (React + Vite build) | **Vercel** | Static build, global CDN, free, auto deploy from GitHub. |
| Backend (FastAPI + numpy/scipy) | **Render** (Docker web service) | Monte Carlo runs take 5-30 s of CPU, WebSockets stream progress, and the audit log needs a disk. Vercel serverless functions are short-lived, have no WebSockets and no lasting disk, so the engine does not belong there. |
| Database | SQLite on a Render **persistent disk** (`/var/data/aegis.db`) | No extra service, already tested. Without a disk (Render free plan) everything still works but the audit log resets when the server restarts. |
| LLM | Groq (`GROQ_API_KEY` set in Render env vars) | Key stays on the server. The browser never sees it. |

The backend image is plain Docker, so the same image also runs on Railway, Fly.io or a VPS without changes.

```
Browser ──HTTPS──> Vercel (static React app)
   │
   └──HTTPS / WSS──> Render: FastAPI (uvicorn) ──> Groq API (narration)
                         │                     └─> Open-Meteo (live forecast)
                         └─ /var/data: aegis.db (runs, reports, decisions, users)
                         └─ /app/data: Cachar scenario + cached source data (shipped in the image)
```

## 2. What has to change (and status)

### Phase 1: deploy-ready (must have)
| # | Work | Files |
|---|---|---|
| 1.1 | Ship the built Cachar scenario, replay and source cache in git, so the server does not need to rebuild from Overpass at boot | `.gitignore`, `data/processed/`, `data/raw/` |
| 1.2 | Backend Dockerfile + `.dockerignore`; listens on `$PORT` | `backend/Dockerfile`, `.dockerignore` |
| 1.3 | `render.yaml` blueprint (web service, disk, env vars) | `render.yaml` |
| 1.4 | CORS: exact origins plus an optional regex for Vercel preview URLs | `settings.py`, `api/main.py` |
| 1.5 | Frontend `vercel.json` (SPA rewrites so `/console/cachar` reloads work) and `VITE_API_URL` | `frontend/vercel.json`, `.env.example` |
| 1.6 | Simulation falls back from WebSocket to plain HTTP if a proxy blocks WebSockets | `frontend/src/api/client.ts` |
| 1.7 | Public-site protection: per-IP rate limit on heavy endpoints and a cap on concurrent heavy jobs, so one visitor cannot freeze the server or burn the Groq quota | `api/limits.py` |
| 1.8 | Remove the unused `groq` pip dependency (providers use httpx) | `pyproject.toml` |

### Phase 2: accounts and Command Center
| # | Work | Files |
|---|---|---|
| 2.1 | Auth: PBKDF2 password hashes (stdlib), signed expiring tokens (HMAC-SHA256), roles `admin` / `officer` / `viewer`. First admin comes from `AEGIS_ADMIN_EMAIL` + `AEGIS_ADMIN_PASSWORD` env vars | `aegis/auth.py`, `storage/db.py` (user table), `api/routers/auth.py` |
| 2.2 | Recording a decision needs an `officer` or `admin` login; the author is taken from the token, not typed by the client. Exploring and running simulations stays public | `routers/workflow.py`, `DecisionBar.tsx` |
| 2.3 | Admin can add officers and viewers | `routers/auth.py` |
| 2.4 | Command Center page `/command` (admin only): system health, LLM status, live forecast per district, run history, field reports, decision log, user management. All numbers come from the database | `pages/CommandCenterPage.tsx`, `routers/admin.py` |
| 2.5 | Login page, auth store, header shows who is signed in | `pages/LoginPage.tsx`, `state/authStore.ts` |

### Phase 3: simulation you can watch
| # | Work |
|---|---|
| 3.1 | Hour-by-hour playback ("typical future", "bad day") in the Cesium real-terrain view too: water level rises over the real terrain, settlements turn red/green, shelters fill |
| 3.2 | Same timeline control in both 3D views |

### Phase 4: data honesty
| # | Work |
|---|---|
| 4.1 | Population: replace the road-length proxy with WorldPop counts when the WorldPop stats API is reachable; keep the proxy only as a labelled fallback |
| 4.2 | Shelters: `data/reference/cachar_shelters.csv` is filled only from a citable source (DDMP Cachar). Until then the UI labels shelters as "from OpenStreetMap" and assembly points as "assumed" |
| 4.3 | Every layer and number in the UI shows its source |

### Phase 5: finish
| # | Work |
|---|---|
| 5.1 | Tests for auth, admin, rate limit, HTTP fallback |
| 5.2 | CI runs backend tests + frontend type-check/build |
| 5.3 | Update the old status table in `final-implementation-plan.md` |

## 3. Environment variables

### Backend (Render)
| Name | Example | Required |
|---|---|---|
| `AEGIS_ENV` | `prod` | yes |
| `AEGIS_CORS_ORIGINS` | `https://aegis-x.vercel.app` | yes |
| `AEGIS_CORS_ORIGIN_REGEX` | `https://aegis-x-.*\.vercel\.app` | optional (preview deploys) |
| `AEGIS_DB_URL` | `sqlite:////var/data/aegis.db` | yes with a disk |
| `AEGIS_SECRET_KEY` | long random string | yes (signs login tokens) |
| `AEGIS_ADMIN_EMAIL` / `AEGIS_ADMIN_PASSWORD` | your admin login | yes (first boot creates the admin) |
| `LLM_PROVIDER` | `groq` | yes |
| `GROQ_API_KEY` | `gsk_...` | yes |
| `AEGIS_RATE_LIMIT_PER_MIN` | `20` | optional |

### Frontend (Vercel)
| Name | Example |
|---|---|
| `VITE_API_URL` | `https://aegis-x-api.onrender.com` |

## 4. Go-live steps

1. **Backend on Render**: New > Blueprint > pick the GitHub repo. Render reads `render.yaml`. Fill the secret env vars (`GROQ_API_KEY`, `AEGIS_SECRET_KEY`, `AEGIS_ADMIN_PASSWORD`, `AEGIS_CORS_ORIGINS`). Wait for the deploy, then open `https://<api>/api/v1/health`. It should show `"status": "ok"` and `"llm_provider": "groq"`.
2. **Frontend on Vercel**: New Project > import the repo > Root Directory `frontend` > Framework Vite. Add `VITE_API_URL=https://<api>` > Deploy.
3. Put the Vercel URL into Render's `AEGIS_CORS_ORIGINS` and redeploy the backend.
4. Open `https://<vercel-url>/console/cachar`, run a plan, open the Red Team tab, sign in at `/login`, record a decision, check `/command`.
5. **Rotate the Groq key** that was shared in chat: create a new key in the Groq console, put it in Render and local `.env`, delete the old one.

## 5. Known limits after launch
- Render free plan sleeps after 15 min idle; the first request then takes ~1 min. A paid instance stays awake.
- Without a persistent disk, the audit log and users reset on each deploy.
- Model parameters for people's behaviour (compliance, speeds) are assumptions shown as sliders, not calibrated against evacuation records.
