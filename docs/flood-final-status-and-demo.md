# Flood Evacuation: final status, what is left, and how to demo it

Last checked: 22 Oct 2026. Ye file flood part ka last status hai: kya ban gaya, kya bacha hai, Groq kaise lagana hai, aur simulation ko kaise dikhana/samjhana hai.

---

## 1. Ek line mein

Hum ek flood ke time "kis area ko kab, kahan se nikalna hai" wale plan ko **hazaaron possible futures** (barish, nadi ka level, bridge fail, log kitna sunenge) par test karte hain, dikhate hain ki plan kahan toot-ta hai, aur **insaan decide karta hai**. Math decide karta hai, LLM sirf samjhata hai.

## 2. Abhi kya kaam kar raha hai (verified)

| Cheez | Status | Kaise check kiya |
|---|---|---|
| Engine (Monte Carlo, Red Team, Sensitivity, VOI, Optimiser) | Done | 89 backend tests pass |
| Flood model (time-stepped, 48 h, boats, shelters, bridges, compliance) | Done | tests + Cachar run |
| Real data: Silchar/Cachar (roads, river, bridges, settlements, shelters, rain, river discharge) | Done, cached | `data/processed/cachar/scenario.json` (6,655 nodes, 7,252 edges, 8 bridges, 196 clusters, 47 shelters) |
| Calibration (16 saal ka GloFAS record) + June 2022 replay | Done | `/replay/silchar_2022` |
| API (`/api/v1/...`) + WebSocket live progress | Done | backend `/api/v1/health` = ok |
| Frontend console: Situation, Plan, Results, Red Team, Check next, Options | Done | `tsc` clean |
| Decision bar (Accept / Edit / Reject) + Audit log (sqlite) | Done | `/audit` page |
| Field reports -> Bayesian beliefs (fusion) | Done | Situation tab "Field reports" |
| 3 views: 3D (real terrain, Cesium), 3D (lite, three.js), 2D map | Done | Console top-right toggle |
| Offline demo district (synthetic) | Done | `/demo` |
| LLM narration with guardrail (numbers match, template fallback) | Done, **key nahi laga hai** | health mein `llm_provider: "none"` |

## 3. Groq (ya Gemini) kaise lagana hai

Abhi `.env` file hai hi nahi, isliye LLM off hai aur Explain button template wala text deta hai.

1. Root folder mein `.env.example` ko copy karke `.env` banao.
2. Edit karo:
   ```
   LLM_PROVIDER=groq
   GROQ_API_KEY=gsk_...apni key...
   ```
   Gemini chahiye to `LLM_PROVIDER=gemini` aur `GEMINI_API_KEY=...`. Model badalna ho to `LLM_MODEL=` mein naam do (khali = default).
3. Backend restart karo (`.env` sirf start par padhi jaati hai).
4. Check: `http://localhost:8000/api/v1/health` mein `"llm_provider": "groq"` dikhna chahiye.
5. Console -> Results -> "In plain language" -> **Explain**.

Safety: `.env` gitignored hai, key kabhi commit mat karna. Agar LLM kuch aisa number likhe jo engine ke result mein nahi hai, guardrail use reject karke template text dikhata hai. Field report parsing bhi LLM se hoti hai, par usse bhi pehle rule parser chalta hai.

## 4. Kya bacha hai (priority order)

### A. Demo se pehle zaroori (chhota kaam)
1. ~~Groq key lagao~~: done (22 Oct), local `.env` mein. Key chat mein share hui thi, isliye live jaane se pehle **nayi key bana ke purani delete karo**.
2. ~~Latest 3D work commit/push~~: done.
3. **Ek baar full dry-run**: dev.ps1 se dono servers uthao, neeche ka demo script (section 5) ek baar start se end tak chalao, taaki live pe surprise na ho.
4. **Live karna**: [fullstack-deployment-plan.md](fullstack-deployment-plan.md) section 4 (Render + Vercel).

Done after this list was written (22 Oct): admin/officer login, Command Center (`/command`), rate limits, Docker/Render/Vercel files, CI, Cesium view mein hour-by-hour playback, Situation tab mein "Where this data comes from".

### B. Product ko pakka karne ke liye
4. **Shelters (22 Oct update)**: ab asli relief camps hain: Cachar DDMA ki 2024 flood report se 50 camps ke naam. 9 ki location OpenStreetMap/Nominatim se mili (3 exact building, 6 mohalle ke centre par). Baaki 41 kisi map par nahi hain, isliye unhe town ki oonchi zameen par rakha gaya hai aur map par "assumed location" label hai. Capacity 2024 ke asli average se: Silchar circle ke 124 camps mein 34,027 log the, yaani ~274 per camp (HS school/college 350, LP school 200). Phir bhi aadhi population cover karne ke liye 38 assumed assembly points hain. Kisi bhi camp ki exact location ya capacity mile to `data/reference/cachar_shelters.csv` mein daal ke `scripts/build_scenario.py` chalao.
5. **Population**: Census 2011 total 178,865 (Silchar municipality + outgrowths) ab use ho raha hai. Ward-wise data online nahi hai aur WorldPop API time-out ho raha hai, isliye areas mein baantwara road-length se hai (label ke saath).
5b. **Boats**: koi published inventory nahi mili. 2022 mein Army 9 boats lekar Silchar aayi thi, baaki NDRF/SDRF/Army/CRPF se pool hue (news reports). Model mein 12 boats assumed hain, aur Situation tab mein yeh note dikhta hai.
6. **Model assumptions ka asli check**: compliance (kitne log sunenge), boat speed, vehicle capacity, shelter fill-rate abhi reasonable assumptions hain, asli evacuation outcome data se calibrate nahi hain. Sirf nadi ka level 2022 ke record se calibrated hai.
7. ~~Cesium view mein hour-by-hour playback~~: done. Dono 3D views mein same controls hain.
8. **Weak laptop par lite 3D heavy**: Cachar par ~15,000 houses cap hai. Agar lag kare to house cap ya traffic kam karna hai.
9. ~~Docs sync~~: done.
10. **Tests**: frontend ke liye koi automated test nahi (sirf type-check). Ek chhota smoke/e2e test add kar sakte hain. API types hand-written hain (openapi-typescript install nahi ho paya).

### C. Baad mein (user ne khud "baad me" kaha)
11. ~~Admin-login Command Center~~: done (`/login`, `/command`).
12. **Army/Police**: Army ke liye flood module extend (helicopter, engineers, pontoon, convoy routing). Police ke liye `domains/crowd` banana (abhi stub hai). `domains/fire` bhi stub hai.
13. ~~Production auth/deploy~~: code ready; deploy steps tumhe karne hain (Render/Vercel account).

## 5. Demo script: simulation dikhana aur samjhana

Pehle servers: `.\scripts\dev.ps1` (ya jo already chal rahe hain). Browser: `http://localhost:5173/console/cachar`.

Field report aur Accept/Reject ke liye pehle `/login` par admin (ya officer) se sign in karo. Local admin `.env` mein hai (`AEGIS_ADMIN_EMAIL` / `AEGIS_ADMIN_PASSWORD`). Admin ko `/command` par Command Center bhi milta hai, demo ke end mein dikhao.

**Story (1 line pehle bolo):** "Silchar mein Barak nadi badh rahi hai. Humare paas 1 plan hai. Kya ye plan har tarah ki barish aur nadi ke level mein chalega? Aur kahan toot-ta hai?"

| Step | Kahan | Kya dikhana | Kya bolna |
|---|---|---|---|
| 1 | **Situation** tab | Forecast ranges (barish, river level), map par settlements/bridges/shelters | "Ye asli data hai: Open-Meteo forecast, GloFAS river discharge, OpenStreetMap roads." |
| 2 | Situation -> What if | Slider se barish badhao, ya ek bridge band karo | "Hum 'agar aisa hua to' bhi test kar sakte hain." |
| 3 | Situation -> Field reports | Likho: `Main bridge is under water` -> submit | "Ground se khabar aayi to us bridge ka probability badal jaata hai (Bayesian)." |
| 4 | **Plan** tab | "Who goes first" (Lowest ground first), boats, shelters, warning method | "Ye officer ka plan hai. Koi code nahi, sirf choices." |
| 5 | Plan -> **Run** | Progress bar (WebSocket), 500 futures ~6 sec | "Ek hi nahi, 500 alag possible kal simulate hue." |
| 6 | **Results** tab | Evacuated range, "plan vs baseline", Compare | "Average nahi, range dekho. Ye plan baseline se kitna behtar hai." |
| 7 | Results -> **Explain** | Groq ka plain-language paragraph | "LLM sirf samjhata hai. Number engine ke hi hain, guardrail check karta hai." |
| 8 | **Red Team** tab | Failure rate, single points of failure (konsa bridge/road gaya to plan toot-ta hai), failure boxes ("barish > X aur river > Y par fail"), smallest change that breaks it | "Ye humara USP: pehle plan ko todte hain, taaki asli me na toote." |
| 9 | **Check next** tab | VOI ranking: kaunsi cheez check karne se decision sabse zyada badal sakta hai | "Limited time mein pehle kya check karna hai." |
| 10 | **Options** tab | Suggested plans (Pareto: zyada log bachaye vs kam resource), Load into editor | "Optimiser alternatives deta hai, final choice insaan ki." |
| 11 | Top-right **3D (real terrain)** | Silchar ka satellite 3D, bridges, relief camps | "Ye wahi data hai, 3D mein." |
| 12 | **3D (lite)** -> "Play a bad day" | Paani badhta hai ghanta-ghanta, log shelters ki taraf chalte hain, popup par hover/click | "Ye ek future ka movie hai. Red = jahan log phase." |
| 13 | **Decision bar** | Accept / Edit / Reject + note | "Human-in-the-loop. System order nahi deta." |
| 14 | `/audit` | Decision log (kisne, kab, kaunsa run, seed) | "Har decision ka record, dobara chalaya ja sakta hai." |
| 15 | `/replay/silchar_2022` | June 2022 ki hour-by-hour advice | "Ye model 2022 ke asli event par bhi test hua." |

Fallback: net ya API slow ho to `/demo` (synthetic, fully offline) kholo, ya `.env` mein `AEGIS_OFFLINE=true`.

## 6. Judges ke sawaalon ke honest jawab

- **"Ye asli hai ya fake?"** Rain, river discharge, roads, bridges, buildings asli data hain. Shelter capacity aur population estimates hain, aur abhi disaster-plan se verify nahi hui.
- **"Model sahi hai?"** River level 16 saal ke record se calibrated hai aur 2022 event par replay hua. Evacuation behaviour ke parameters assumptions hain jo sliders se test hote hain.
- **"LLM galat bol de to?"** LLM numbers nahi banata. Guardrail har number engine se match karta hai, nahi mile to template text.
- **"Kaun decide karta hai?"** Insaan. Engine sirf options aur risk dikhata hai, har decision audit log mein jaata hai.
- **"Dusre disaster?"** Engine domain-agnostic hai (`simulate(scenario, plan, conditions)`). Fire aur crowd ke modules ka structure ready hai, model baad mein.

## 7. Useful commands

```powershell
.\scripts\dev.ps1                                   # backend :8000 + frontend :5173
cd backend; ..\.venv\Scripts\python.exe -m pytest -q   # 89 tests
cd frontend; npx tsc -b                             # type-check
cd frontend; npm run build                          # production build
..\.venv\Scripts\python.exe scripts\fetch_data.py --district cachar   # data refresh (network)
..\.venv\Scripts\python.exe scripts\build_scenario.py --district cachar
```

Useful URLs: API docs `http://localhost:8000/docs`, health `http://localhost:8000/api/v1/health`.
