"""Map layers (GeoJSON) for the frontend, and the flood state at a given water level."""

from __future__ import annotations

import numpy as np

from aegis.domains.flood.types import FloodScenario


def _fc(features: list[dict]) -> dict:
    return {"type": "FeatureCollection", "features": features}


def _point(lat: float, lon: float, props: dict) -> dict:
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]}, "properties": props}


def scenario_layers(s: FloodScenario) -> dict:
    ll = s.node_latlon
    bridge_of = {e: b for b, edges in s.bridges.items() for e in edges}
    roads = []
    for i in range(len(s.edge_u)):
        a, b = ll[s.edge_u[i]], ll[s.edge_v[i]]
        roads.append(
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": [[round(a[1], 6), round(a[0], 6)], [round(b[1], 6), round(b[0], 6)]]},
                "properties": {
                    "i": i,
                    "hand": round(float(s.edge_hand_m[i]), 2),
                    "h0": round(float(s.node_hand_m[s.edge_u[i]]), 2) if len(s.node_hand_m) else 0.0,
                    "h1": round(float(s.node_hand_m[s.edge_v[i]]), 2) if len(s.node_hand_m) else 0.0,
                    "cls": s.edge_class[i],
                    "bridge": bool(s.edge_bridge[i]),
                    "key": bridge_of.get(i, ""),
                },
            }
        )
    river = (
        [{"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[round(lo, 6), round(la, 6)] for la, lo in s.river_latlon]}, "properties": {}}]
        if len(s.river_latlon) > 1
        else []
    )
    return {
        "roads": _fc(roads),
        "river": _fc(river),
        "clusters": _fc([_point(c.lat, c.lon, {"id": c.id, "name": c.name, "population": c.population, "hand": round(c.hand_m, 2)}) for c in s.clusters]),
        "shelters": _fc([_point(x.lat, x.lon, {"id": x.id, "name": x.name, "capacity": x.capacity, "kind": x.kind, "hand": round(x.hand_m, 2), "source": x.source}) for x in s.shelters]),
        "staging": _fc([_point(x.lat, x.lon, {"id": x.id, "name": x.name}) for x in s.staging]),
        "bridges": [{"id": b, "name": s.bridge_names.get(b, b), "edges": edges} for b, edges in s.bridges.items()],
        "bounds": [float(ll[:, 1].min()), float(ll[:, 0].min()), float(ll[:, 1].max()), float(ll[:, 0].max())] if len(ll) else [0, 0, 0, 0],
        "metadata": s.metadata,
        "totals": {"population": s.total_population, "clusters": len(s.clusters), "shelters": len(s.shelters), "edges": int(len(s.edge_u))},
    }


def terrain_grid(s: FloodScenario, n: int = 140) -> dict:
    """Ground height above the river's normal level on an n x n lat/lon grid, for the 3D view.

    Interpolated from the road-node heights (linear inside the network, nearest outside it).
    The river line is pinned to 0 so the channel shows.
    """
    from scipy.interpolate import griddata

    pts = s.node_latlon[:, ::-1]  # lon, lat
    vals = s.node_hand_m
    if len(s.river_latlon) > 1:
        river = np.array(s.river_latlon)[:, ::-1]
        pts = np.vstack([pts, river])
        vals = np.concatenate([vals, np.zeros(len(river))])
    lon0, lat0 = pts[:, 0].min(), pts[:, 1].min()
    lon1, lat1 = pts[:, 0].max(), pts[:, 1].max()
    gx, gy = np.meshgrid(np.linspace(lon0, lon1, n), np.linspace(lat0, lat1, n))
    z = griddata(pts, vals, (gx, gy), method="linear")
    near = griddata(pts, vals, (gx, gy), method="nearest")
    z = np.where(np.isnan(z), near, z)
    return {
        "n": n,
        "bounds": [float(lon0), float(lat0), float(lon1), float(lat1)],
        "heights": np.round(np.maximum(z, 0.0), 2).ravel().tolist(),  # row-major, south to north
        "max": float(np.nanmax(z)),
    }


def flood_state(s: FloodScenario, level_m: float, closed_bridges: list[str] | None = None) -> dict:
    """What is cut or flooded when the water is `level_m` metres above normal."""
    cut = s.edge_hand_m < level_m
    for b in closed_bridges or []:
        cut[s.bridges.get(b, [])] = True
    return {
        "level_m": float(level_m),
        "cut_edges": np.nonzero(cut)[0].tolist(),
        "flooded_clusters": [c.id for c in s.clusters if c.hand_m < level_m],
        "flooded_shelters": [x.id for x in s.shelters if x.hand_m < level_m],
        "people_in_flooded_clusters": int(sum(c.population for c in s.clusters if c.hand_m < level_m)),
    }
