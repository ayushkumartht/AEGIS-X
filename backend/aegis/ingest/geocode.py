"""Place-name lookup with OpenStreetMap Nominatim, cached, limited to the district box.

Nominatim's usage policy allows at most one request per second with an identifying user agent;
`search` sleeps accordingly whenever it has to go to the network.
"""

from __future__ import annotations

import time

from aegis.ingest.cache import cached_json
from aegis.ingest.http import get_json

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
MIN_INTERVAL_S = 1.1


def search(district: str, query: str, bbox: tuple[float, float, float, float]) -> list[dict]:
    """Matches for `query` inside `bbox` (lon_min, lat_min, lon_max, lat_max): [{name, lat, lon, osm, type}]."""
    lon_min, lat_min, lon_max, lat_max = bbox
    params = {
        "q": query,
        "format": "jsonv2",
        "viewbox": f"{lon_min},{lat_max},{lon_max},{lat_min}",
        "bounded": 1,
        "limit": 3,
    }

    def fetch() -> list[dict]:
        time.sleep(MIN_INTERVAL_S)
        return [
            {
                "name": r.get("display_name", ""),
                "lat": float(r["lat"]),
                "lon": float(r["lon"]),
                "osm": f"{r.get('osm_type', '')}/{r.get('osm_id', '')}",
                "type": r.get("type", ""),
            }
            for r in get_json(NOMINATIM_URL, params)
        ]

    return cached_json(district, "nominatim", params, fetch)
