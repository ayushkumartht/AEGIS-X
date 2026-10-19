"""OpenStreetMap via the Overpass API: roads, river, and candidate shelter buildings."""

from __future__ import annotations

from aegis.ingest.cache import cache_path, cached_json
from aegis.ingest.http import post_form_json

OVERPASS_URLS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)
ROAD_CLASSES = "trunk|primary|secondary|tertiary|unclassified|residential"
SHELTER_TAGS = "school|college|university|community_centre|townhall"


def _bbox(bbox: tuple[float, float, float, float]) -> str:
    lon_min, lat_min, lon_max, lat_max = bbox
    return f"{lat_min},{lon_min},{lat_max},{lon_max}"


def _run(query: str) -> dict:
    last: Exception | None = None
    for url in OVERPASS_URLS:
        try:
            return post_form_json(url, {"data": query})
        except Exception as exc:  # noqa: BLE001 - try the next mirror
            last = exc
    raise last  # type: ignore[misc]


def roads(district: str, bbox: tuple[float, float, float, float]) -> dict:
    """Road ways with their node coordinates. {"elements": [...]} in Overpass JSON."""
    box = _bbox(bbox)
    query = f'[out:json][timeout:180];way["highway"~"^({ROAD_CLASSES})$"]({box});(._;>;);out body qt;'
    return cached_json(district, "osm_roads", {"bbox": box, "classes": ROAD_CLASSES}, lambda: _run(query))


def buildings_cached(district: str, bbox: tuple[float, float, float, float]) -> bool:
    return cache_path(district, "osm_buildings", {"bbox": _bbox(bbox)}).exists()


def buildings(district: str, bbox: tuple[float, float, float, float]) -> list[dict]:
    """Mapped building footprints: [{"ring": [[lon, lat], ...], "levels": int | None, "kind": str}]."""
    box = _bbox(bbox)
    query = f'[out:json][timeout:180];way["building"]({box});out tags geom;'

    def fetch() -> list[dict]:
        out = []
        for e in _run(query).get("elements", []):
            ring = [[round(p["lon"], 6), round(p["lat"], 6)] for p in e.get("geometry", [])]
            if len(ring) < 4:
                continue
            tags = e.get("tags", {})
            levels = tags.get("building:levels", "")
            out.append({"ring": ring, "levels": int(levels) if levels.isdigit() else None, "kind": tags.get("building", "yes")})
        return out

    return cached_json(district, "osm_buildings", {"bbox": box}, fetch)


def features(district: str, bbox: tuple[float, float, float, float], river_name: str) -> dict:
    """The named river (way geometry) and candidate shelter buildings and hospitals."""
    box = _bbox(bbox)
    query = (
        f'[out:json][timeout:180];('
        f'way["waterway"="river"]["name"~"{river_name}",i]({box});'
        f'nwr["amenity"~"^({SHELTER_TAGS}|hospital)$"]({box});'
        f');out center geom;'
    )
    return cached_json(district, "osm_features", {"bbox": box, "river": river_name, "tags": SHELTER_TAGS}, lambda: _run(query))
