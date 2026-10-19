"""Saving and loading a FloodScenario as JSON (data/processed/<district>/scenario.json)."""

from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path

import numpy as np

from aegis.domains.flood.types import Cluster, FloodScenario, Shelter, StagingPoint


def scenario_to_dict(s: FloodScenario) -> dict:
    return {
        "name": s.name,
        "metadata": s.metadata,
        "node_xy": np.round(s.node_xy, 1).tolist(),
        "node_latlon": np.round(s.node_latlon, 6).tolist(),
        "node_hand_m": np.round(s.node_hand_m, 2).tolist(),
        "edge_u": s.edge_u.tolist(),
        "edge_v": s.edge_v.tolist(),
        "edge_len_m": np.round(s.edge_len_m, 1).tolist(),
        "edge_hand_m": np.round(s.edge_hand_m, 2).tolist(),
        "edge_class": s.edge_class,
        "edge_bridge": s.edge_bridge.tolist(),
        "bridges": s.bridges,
        "bridge_names": s.bridge_names,
        "clusters": [asdict(c) for c in s.clusters],
        "shelters": [asdict(x) for x in s.shelters],
        "staging": [asdict(x) for x in s.staging],
        "river_latlon": s.river_latlon,
    }


def scenario_from_dict(d: dict) -> FloodScenario:
    return FloodScenario(
        name=d["name"],
        metadata=d["metadata"],
        node_xy=np.array(d["node_xy"]),
        node_latlon=np.array(d["node_latlon"]),
        node_hand_m=np.array(d.get("node_hand_m", [])),
        edge_u=np.array(d["edge_u"], dtype=int),
        edge_v=np.array(d["edge_v"], dtype=int),
        edge_len_m=np.array(d["edge_len_m"]),
        edge_hand_m=np.array(d["edge_hand_m"]),
        edge_class=d["edge_class"],
        edge_bridge=np.array(d["edge_bridge"], dtype=bool),
        bridges={k: list(v) for k, v in d["bridges"].items()},
        bridge_names=d["bridge_names"],
        clusters=[Cluster(**c) for c in d["clusters"]],
        shelters=[Shelter(**x) for x in d["shelters"]],
        staging=[StagingPoint(**x) for x in d["staging"]],
        river_latlon=d["river_latlon"],
    )


def save_scenario(s: FloodScenario, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(scenario_to_dict(s)), encoding="utf-8")


def load_scenario(path: Path) -> FloodScenario:
    return scenario_from_dict(json.loads(path.read_text(encoding="utf-8")))
