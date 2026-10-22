"""A simulated flood scenario for drills and demos: "Brahmaputra and Barak in spate".

Everything here is made up and is labelled so everywhere it appears: the source is
"SIMULATED EXERCISE", alerts carry an `exercise:` id, the screen shows a banner, the brief says so
and decisions taken on it are stored with `exercise: true`. It is chosen per viewer (a query
parameter), never switched on for everyone, and never mixed with live data.

The scenario is shaped to look like a real monsoon spate: levels and gauge readings sit in the ranges
the real rivers reach, and the flood flows come from each district's own GloFAS record. Gauge
positions are the towns' real river gauge sites (approximate); every reading is invented.
"""

from __future__ import annotations

import zlib
from datetime import UTC, datetime, timedelta, timezone

TITLE = "Brahmaputra and Barak in spate (simulated exercise)"
SOURCE = "SIMULATED EXERCISE"
NOTICE = "All alerts and river levels in this scenario are simulated for an exercise. None of it is real."

# district id -> level in the scenario; districts not listed use their live indicator
LEVELS = {
    "cachar": "severe", "karimganj": "warning", "hailakandi": "watch",
    "dibrugarh": "warning", "dhemaji": "watch", "lakhimpur": "watch", "kamrup_metro": "watch", "goalpara": "watch",
    "gopalganj": "warning", "muzaffarpur": "watch", "supaul": "watch",
}
# share of ensemble members above the 2-, 5- and 20-year floods, and the median peak as a multiple of a flood flow
SHAPE = {
    "severe": ({"2": 0.98, "5": 0.84, "20": 0.43}, "20", 1.08),
    "warning": ({"2": 0.92, "5": 0.61, "20": 0.06}, "5", 1.10),
    "watch": ({"2": 0.55, "5": 0.12, "20": 0.0}, "2", 1.12),
}
# local rain (mm) fed to the engine for the districts that have an evacuation model
ENGINE_RAIN_MM = {"severe": 180.0, "warning": 120.0, "watch": 70.0}


def _jitter(district_id: str, salt: str, spread: float) -> float:
    """A stable pseudo-random factor in [1 - spread, 1 + spread] for this district."""
    h = zlib.crc32(f"{district_id}:{salt}".encode()) / 0xFFFFFFFF
    return 1.0 + (2.0 * h - 1.0) * spread


def _now() -> datetime:
    return datetime.now(UTC)


def indicators(live: dict[str, dict], now: datetime | None = None) -> dict[str, dict]:
    """District indicators for the scenario, built from each district's real flood flows.

    `live` is the latest real indicator per district (it supplies the 2-, 5- and 20-year flows and
    the river cell). Districts without one are left out, so they show as having no indicator.
    """
    now = now or _now()
    out: dict[str, dict] = {}
    for did, ind in live.items():
        level = LEVELS.get(did)
        if level is None or "flows" not in ind:
            out[did] = ind
            continue
        exceed, ref, mult = SHAPE[level]
        flows = ind["flows"]
        peak_day_offset = 1 + int(_jitter(did, "day", 0.9) * 1.4) % 3
        dates = [(now + timedelta(days=i)).date().isoformat() for i in range(7)]
        exc = {k: round(min(1.0, max(0.0, v * _jitter(did, "e" + k, 0.06))), 2) for k, v in exceed.items()}
        peak = flows[ref] * mult * _jitter(did, "peak", 0.05)
        years = {"severe": 20, "warning": 5, "watch": 2}[level]
        reason = f"{exc[str(years)] * 100:.0f}% of forecast members pass the {years}-year flood ({flows[str(years)]:.0f} m3/s)"
        out[did] = {
            **ind, "level": level, "reason": reason, "exceed": exc, "forecast_dates": dates,
            "peak_day": dates[peak_day_offset], "peak_median": round(peak), "today_median": round(flows["2"] * 0.78),
            "members": 51, "computed_at": now.isoformat(timespec="seconds"), "simulated": True,
        }
    return out


# (id, sender, event, severity, state, area, district_id, lat, lon, gauge(level, warning, danger, trend) | None,
#  minutes ago it was sent, hours until it expires, text)
_ALERTS = [
    ("cwc-barak-annapurnaghat", "CWC", "Flood", "Severe", "Assam", "Barak, Annapurnaghat, Cachar, Assam", "cachar", 24.8226, 92.7961,
     (21.86, 20.83, 21.43, "rising"), 40, 18,
     "River Barak at Annapurnaghat in Cachar district of Assam is flowing in severe flood situation at {t}."),
    ("cwc-barak-matijuri", "CWC", "Flood", "Severe", "Assam", "Barak, Matijuri, Hailakandi, Assam", "hailakandi", 24.7186, 92.5806,
     (14.73, 13.40, 14.30, "rising"), 55, 18,
     "River Barak at Matijuri in Hailakandi district of Assam is flowing in severe flood situation at {t}."),
    ("cwc-kushiyara-sheola", "CWC", "Flood", "Moderate", "Assam", "Kushiyara, Sheola, Karimganj, Assam", "karimganj", 24.7803, 92.2325,
     (14.04, 13.00, 14.20, "steady"), 95, 24,
     "River Kushiyara at Sheola in Karimganj district of Assam continues to flow in above normal flood situation at {t}."),
    ("cwc-brahmaputra-dibrugarh", "CWC", "Flood", "Moderate", "Assam", "Brahmaputra, Dibrugarh, Dibrugarh, Assam", "dibrugarh", 27.4783, 94.9082,
     (104.31, 103.70, 105.70, "rising"), 70, 24,
     "River Brahmaputra at Dibrugarh in Dibrugarh district of Assam is flowing in above normal flood situation at {t}."),
    ("cwc-brahmaputra-neamatighat", "CWC", "Flood", "Moderate", "Assam", "Brahmaputra, Neamatighat, Jorhat, Assam", None, 26.8636, 94.1962,
     (85.12, 84.80, 86.04, "rising"), 130, 24,
     "River Brahmaputra at Neamatighat in Jorhat district of Assam is flowing in above normal flood situation at {t}."),
    ("cwc-brahmaputra-guwahati", "CWC", "Flood", "Moderate", "Assam", "Brahmaputra, Guwahati, Kamrup Metropolitan, Assam", "kamrup_metro", 26.1840, 91.7458,
     (49.18, 48.68, 49.68, "steady"), 150, 24,
     "River Brahmaputra at Guwahati in Kamrup Metropolitan district of Assam continues to flow in above normal flood situation at {t}."),
    ("cwc-gandak-dumariaghat", "CWC", "Flood", "Moderate", "Bihar", "Gandak, Dumariaghat, Gopalganj, Bihar", "gopalganj", 26.4486, 84.4417,
     (62.05, 61.22, 62.22, "rising"), 200, 24,
     "River Gandak at Dumariaghat in Gopalganj district of Bihar is flowing in above normal flood situation at {t}."),
    ("cwc-kosi-baltara", "CWC", "Flood", "Minor", "Bihar", "Kosi, Baltara, Khagaria, Bihar", None, 25.5183, 86.7883,
     (33.42, 33.85, 34.85, "steady"), 260, 24, None),
    ("imd-guwahati-extreme-rain", "IMD Guwahati", "Extremely Heavy Rain", "Severe", "Assam", "Cachar, Hailakandi, Karimganj, Dima Hasao districts of Assam", "cachar", 24.83, 92.78,
     None, 25, 24,
     "Extremely heavy rainfall (more than 20 cm in 24 hours) is very likely at isolated places over Cachar, Hailakandi, Karimganj and Dima Hasao districts in the next 24 hours."),
    ("imd-guwahati-very-heavy-rain", "IMD Guwahati", "Very Heavy Rain", "Severe", "Assam", "Dibrugarh, Dhemaji, Lakhimpur, Tinsukia districts of Assam", "dibrugarh", 27.48, 94.91,
     None, 25, 24,
     "Very heavy rainfall (12 to 20 cm in 24 hours) is likely at isolated places over Dibrugarh, Dhemaji, Lakhimpur and Tinsukia districts in the next 24 hours."),
    ("imd-patna-heavy-rain", "IMD Patna", "Heavy Rain", "Moderate", "Bihar", "Gopalganj, Siwan, Saran, East Champaran districts of Bihar", "gopalganj", 26.47, 84.44,
     None, 80, 18,
     "Heavy rainfall (7 to 11 cm in 24 hours) is likely at isolated places over Gopalganj, Siwan, Saran and East Champaran districts."),
    ("asdma-cachar-flash-flood", "Assam SDMA", "Flash Flood", "Severe", "Assam", "Silchar town, Cachar, Assam", "cachar", 24.8333, 92.7789,
     None, 15, 12,
     "Water has entered low-lying wards of Silchar town. District administration advises residents of riverside and low-lying wards to move to relief camps."),
    ("asdma-karimganj-embankment", "Assam SDMA", "Flood", "Moderate", "Assam", "Karimganj district, Assam", "karimganj", 24.8691, 92.3590,
     None, 110, 24,
     "Embankment on the Kushiyara is under watch at two places. Water Resources officials are on site."),
    ("gdacs-india-ne-flood", "GDACS", "Flood", "Severe", "", "India (Assam, Meghalaya)", None, 25.60, 92.40,
     None, 300, 72, "Flood in India: Orange alert, large part of Assam and Meghalaya affected."),
]


IST = timezone(timedelta(hours=5, minutes=30))


def _fmt_time(now: datetime) -> str:
    """The latest three-hourly gauge reading time, for example "9:00 am today" (gauges report every 3 hours)."""
    hour = now.astimezone(IST).hour // 3 * 3
    return f"{hour % 12 or 12}:00 {'am' if hour < 12 else 'pm'} today"


def events(now: datetime | None = None) -> list[dict]:
    now = now or _now()
    out = []
    for (key, sender, event, sev, state, area, did, lat, lon, gauge, ago_min, hours, text) in _ALERTS:
        if text is None:
            text = "River {} is within the normal range.".format(area.split(",")[0])
        text = text.replace("{t}", _fmt_time(now))
        g = None
        if gauge:
            level, warn, danger, trend = gauge
            g = {"level_m": level, "warning_m": warn, "danger_m": danger, "highest_m": None, "trend": trend}
            text += (f" At {_fmt_time(now)}, it was flowing at a level of {level} m with {trend} trend which is "
                     f"{abs(round(level - warn, 2))} m {'above' if level >= warn else 'below'} its Warning Level of {warn} m "
                     f"and {abs(round(danger - level, 2))} m {'below' if danger >= level else 'above'} its Danger Level of {danger} m.")
        sent = now - timedelta(minutes=ago_min)
        out.append({
            "uid": f"exercise:{key}", "source": SOURCE, "hazard": "flood", "event": event, "severity": sev, "urgency": "Expected",
            "certainty": "Likely", "sender": sender, "state": state, "area": area, "headline": text.split(". At ")[0][:400],
            "description": text, "lat": lat, "lon": lon,
            "place_method": "gauge position, approximate (simulated)" if g else "area named in the simulated alert",
            "district_id": did, "effective": sent.isoformat(timespec="seconds"),
            "expires": (now + timedelta(hours=hours)).isoformat(timespec="seconds"), "sent": sent.isoformat(timespec="seconds"),
            "url": "", "gauge": g, "fetched_at": sent.isoformat(timespec="seconds"),
        })
    return out


def filter_events(rows: list[dict], *, hazard: str | None = None, severity: str | None = None, state: str | None = None,
                  active: bool | None = None, district_id: str | None = None) -> list[dict]:
    now = _now()
    keep = []
    for e in rows:
        if hazard and e["hazard"] != hazard or severity and e["severity"] != severity or district_id and e["district_id"] != district_id:
            continue
        if state and e["state"].lower() != state.lower():
            continue
        is_active = datetime.fromisoformat(e["expires"]) >= now
        if active is not None and is_active != active:
            continue
        keep.append(e)
    return sorted(keep, key=lambda e: e["sent"], reverse=True)


def week_over_week() -> dict:
    return {"this_week": 41, "last_week": 17, "change_pct": (41 - 17) / 17, "note": "Simulated counts; the number of alerts does not measure risk."}


def feeds(now: datetime | None = None) -> list[dict]:
    stamp = (now or _now()).isoformat(timespec="seconds")
    return [{"name": SOURCE, "last_attempt": stamp, "last_success": stamp, "last_error": None, "items": len(_ALERTS)}]


def engine_rain_mm(level: str) -> float | None:
    return ENGINE_RAIN_MM.get(level)
