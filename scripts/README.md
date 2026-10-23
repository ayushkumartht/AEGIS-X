# Scripts

Run from the repository root with the project's Python (`.venv`).

| Script | What it does |
|---|---|
| `dev.ps1` | Starts the API (port 8000) and the frontend (port 5173) together on Windows. |
| `fetch_data.py --district cachar` | Downloads and caches the district's raw data (OpenStreetMap, Open-Meteo, GloFAS). A second run uses only the cache. |
| `build_scenario.py --district cachar` | Builds the road graph, flood thresholds, people, shelters and boat bases into `data/processed/<district>/scenario.json`. |
| `replay_event.py --event silchar_2022` | Calibrates the river rating curve on the discharge record and computes the day-by-day replay of a past flood. |
| `geocode_relief_camps.py --district cachar` | Locates the relief camps named in `data/reference/<district>_relief_camps_2024.csv` and writes `<district>_shelters.csv`. |
