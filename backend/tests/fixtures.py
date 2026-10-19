"""Small synthetic inputs for offline tests (OSM-shaped JSON, an elevation function, a district)."""

from __future__ import annotations

import numpy as np

from aegis.ingest.district import DistrictConfig, ForecastPoint, StagingPoint

BBOX = (92.74, 24.78, 92.76, 24.80)
STEP = 0.0009  # degrees, about 100 m
N = 12


def district() -> DistrictConfig:
    return DistrictConfig(
        id="test",
        name="Test district",
        bbox=BBOX,
        river_name="River",
        population_total=6000,
        population_note="test",
        forecast_points=(ForecastPoint("p", 24.79, 92.75),),
        staging_points=(StagingPoint("sp1", "Base A", 24.781, 92.743), StagingPoint("sp2", "Base B", 24.799, 92.759)),
        shelters_csv="",
        boats=8,
        vehicles=4,
    )


def roads_raw() -> dict:
    """A 12 x 12 street grid, plus a secondary road with a 4-node bridge along the top."""
    elements, nid = [], {}
    for i in range(N):
        for j in range(N):
            nid[(i, j)] = 1000 + i * N + j
            elements.append({"type": "node", "id": nid[(i, j)], "lat": BBOX[1] + 0.001 + j * STEP, "lon": BBOX[0] + 0.001 + i * STEP})
    wid = 1
    for j in range(N):
        elements.append({"type": "way", "id": wid, "nodes": [nid[(i, j)] for i in range(N)], "tags": {"highway": "residential"}})
        wid += 1
    for i in range(N):
        elements.append({"type": "way", "id": wid, "nodes": [nid[(i, j)] for j in range(N)], "tags": {"highway": "residential"}})
        wid += 1
    elements.append({"type": "way", "id": 900, "nodes": [nid[(i, 6)] for i in range(3, 9)], "tags": {"highway": "secondary", "bridge": "yes", "name": "Test Bridge"}})
    return {"elements": elements}


def features_raw() -> dict:
    river = [{"lat": BBOX[1] + 0.001 + j * STEP, "lon": BBOX[0] + 0.0005} for j in range(N)]
    return {
        "elements": [
            {"type": "way", "id": 5, "tags": {"waterway": "river", "name": "River"}, "geometry": river},
            {"type": "node", "id": 6, "lat": BBOX[1] + 0.009, "lon": BBOX[0] + 0.011, "tags": {"amenity": "school", "name": "North School"}},
            {"type": "way", "id": 7, "center": {"lat": BBOX[1] + 0.005, "lon": BBOX[0] + 0.010}, "tags": {"amenity": "college", "name": "East College"}},
            {"type": "node", "id": 8, "lat": BBOX[1] + 0.002, "lon": BBOX[0] + 0.011, "tags": {"amenity": "hospital", "name": "Not a shelter"}},
        ]
    }


def elevations(points):
    """Ground rises from west (river) to east: 16 m to 24 m across the area."""
    return [16.0 + 800.0 * (lon - BBOX[0]) for _, lon in points]
