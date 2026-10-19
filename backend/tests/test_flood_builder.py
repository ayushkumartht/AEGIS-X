import numpy as np
import pytest

from aegis.domains.flood.builder import MIN_HAND_M, build_scenario
from aegis.domains.flood.geojson import flood_state, scenario_layers
from aegis.domains.flood.serialize import load_scenario, save_scenario
from tests import fixtures


@pytest.fixture(scope="module")
def scenario():
    return build_scenario(fixtures.district(), fixtures.roads_raw(), fixtures.features_raw(), fixtures.elevations)


def test_graph_is_connected_and_simplified(scenario):
    n = len(scenario.node_xy)
    assert 100 <= n <= 144 and len(scenario.edge_u) >= n - 1
    assert scenario.edge_hand_m.min() >= MIN_HAND_M
    assert scenario.edge_len_m.min() > 0


def test_population_is_scaled_to_the_district_total(scenario):
    assert scenario.total_population == pytest.approx(6000, rel=0.02)
    assert all(c.hand_m >= MIN_HAND_M for c in scenario.clusters)


def test_low_ground_near_the_river_floods_first(scenario):
    ordered = sorted(scenario.clusters, key=lambda c: c.lon)
    assert len(ordered) >= 2
    assert ordered[0].hand_m < ordered[-1].hand_m  # westmost (river side) floods before eastmost


def test_key_bridge_found_and_its_deck_is_above_road_level(scenario):
    assert len(scenario.bridges) == 1
    (bid, edges), = scenario.bridges.items()
    assert scenario.bridge_names[bid] == "Test Bridge"
    assert scenario.edge_hand_m[edges].min() > scenario.edge_hand_m[~scenario.edge_bridge].min()


def test_shelters_from_osm_exclude_hospitals_and_get_assembly_points(scenario):
    names = {s.name for s in scenario.shelters}
    assert {"North School", "East College"} <= names and "Not a shelter" not in names
    assert len(scenario.shelters) >= 3
    assert any(s.kind == "assumed_assembly_point" for s in scenario.shelters)
    assert scenario.metadata["river_base_method"].startswith("25th percentile")


def test_staging_points_are_snapped_to_graph_nodes(scenario):
    assert [sp.id for sp in scenario.staging] == ["sp1", "sp2"]
    assert all(0 <= sp.node < len(scenario.node_xy) for sp in scenario.staging)


def test_save_and_load_round_trip(scenario, tmp_path):
    path = tmp_path / "s.json"
    save_scenario(scenario, path)
    loaded = load_scenario(path)
    assert loaded.total_population == scenario.total_population
    assert np.allclose(loaded.edge_hand_m, scenario.edge_hand_m, atol=0.01)
    assert loaded.bridges == scenario.bridges and len(loaded.shelters) == len(scenario.shelters)


def test_layers_and_flood_state(scenario):
    layers = scenario_layers(scenario)
    assert len(layers["roads"]["features"]) == len(scenario.edge_u)
    assert layers["totals"]["population"] == scenario.total_population
    low, high = flood_state(scenario, 0.5), flood_state(scenario, 6.0)
    assert len(low["cut_edges"]) <= len(high["cut_edges"])
    assert low["people_in_flooded_clusters"] <= high["people_in_flooded_clusters"]
    bid = next(iter(scenario.bridges))
    assert set(scenario.bridges[bid]) <= set(flood_state(scenario, 0.0, [bid])["cut_edges"])
