"""GDACS (Global Disaster Alert and Coordination System): large floods and cyclones affecting India."""

from __future__ import annotations

from aegis.ingest.http import get_json
from aegis.ops.hazards import hazard_of

URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH"
EVENT_TYPES = {"FL": "Flood", "TC": "Tropical cyclone"}
SEVERITY = {"red": "Extreme", "orange": "Severe", "green": "Minor"}


def parse(collection: dict) -> list[dict]:
    out = []
    for f in collection.get("features") or []:
        p = f.get("properties", {})
        coords = (f.get("geometry") or {}).get("coordinates") or [None, None]
        kind = EVENT_TYPES.get(p.get("eventtype", ""), p.get("eventtype", "Event"))
        name = p.get("name") or kind
        description = p.get("description") or p.get("htmldescription") or ""
        out.append({
            "uid": f"gdacs:{p.get('eventtype')}{p.get('eventid')}:{p.get('episodeid')}",
            "source": "GDACS",
            "hazard": hazard_of(kind, name),
            "event": kind,
            "severity": SEVERITY.get(str(p.get("alertlevel", "")).lower(), "Unknown"),
            "urgency": "Unknown",
            "certainty": "Observed",
            "sender": "GDACS",
            "state": "",
            "area": p.get("country") or "India",
            "headline": name,
            "description": description if isinstance(description, str) else "",
            "lat": coords[1],
            "lon": coords[0],
            "place_method": "event position in the feed",
            "lgd_district": None,
            "effective": p.get("fromdate") or "",
            "expires": p.get("todate") or "",
            "sent": p.get("datemodified") or p.get("fromdate") or "",
            "gauge": None,
            "url": (p.get("url") or {}).get("report", "") if isinstance(p.get("url"), dict) else "",
        })
    return out


def fetch_events() -> list[dict]:
    return parse(get_json(URL, {"eventlist": ";".join(EVENT_TYPES), "country": "India"}))
