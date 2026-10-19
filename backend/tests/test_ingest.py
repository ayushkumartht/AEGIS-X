import httpx
import pytest

from aegis.exceptions import DataError, OfflineError
from aegis.ingest import open_meteo, osm
from aegis.ingest.cache import cached_json
from aegis.ingest.district import list_districts, load_district
from aegis.ingest.http import use_transport
from aegis.ingest.shelters import load_shelters
from aegis.settings import Settings


def _counting_transport(payload):
    calls = []

    def handler(request):
        calls.append(str(request.url))
        return httpx.Response(200, json=payload)

    return httpx.MockTransport(handler), calls


def test_cache_fetches_once_then_reuses(data_dir):
    n = []
    fetch = lambda: n.append(1) or {"v": len(n)}  # noqa: E731
    assert cached_json("d", "src", {"a": 1}, fetch) == {"v": 1}
    assert cached_json("d", "src", {"a": 1}, fetch) == {"v": 1}
    assert cached_json("d", "src", {"a": 1}, fetch, refresh=True) == {"v": 2}
    assert len(n) == 2


def test_offline_uses_cache_and_raises_when_missing(data_dir, monkeypatch):
    cached_json("d", "src", {"a": 1}, lambda: {"v": 1})
    offline = Settings(_env_file=None, aegis_data_dir=data_dir, aegis_offline=True)
    monkeypatch.setattr("aegis.ingest.cache.get_settings", lambda: offline)
    assert cached_json("d", "src", {"a": 1}, lambda: pytest.fail("must not fetch")) == {"v": 1}
    with pytest.raises(OfflineError):
        cached_json("d", "src", {"a": 2}, lambda: {"v": 2})


def test_rain_ensemble_parses_members(data_dir):
    payload = {
        "daily": {
            "time": ["2026-10-19", "2026-10-20"],
            "precipitation_sum": [1.0, 2.0],
            "precipitation_sum_member01": [3.0, None],
        }
    }
    transport, calls = _counting_transport(payload)
    use_transport(transport)
    out = open_meteo.rain_ensemble("d", "p", 24.8, 92.7, days=2)
    assert out["dates"] == ["2026-10-19", "2026-10-20"]
    assert out["members"] == [[1.0, 2.0], [3.0, 0.0]]
    open_meteo.rain_ensemble("d", "p", 24.8, 92.7, days=2)
    assert len(calls) == 1  # second call served from the cache


def test_elevations_batches_of_100(data_dir):
    def handler(request):
        n = len(request.url.params["latitude"].split(","))
        return httpx.Response(200, json={"elevation": [20.0] * n})

    use_transport(httpx.MockTransport(handler))
    out = open_meteo.elevations("d", [(24.8 + i * 1e-4, 92.7) for i in range(230)])
    assert len(out) == 230 and set(out) == {20.0}


def test_overpass_falls_back_to_second_mirror(data_dir):
    def handler(request):
        if "overpass-api.de" in str(request.url):
            return httpx.Response(503, text="busy")
        return httpx.Response(200, json={"elements": [{"type": "node", "id": 1}]})

    use_transport(httpx.MockTransport(handler))
    assert osm.roads("d", (92.7, 24.7, 92.8, 24.8))["elements"][0]["id"] == 1


def test_http_failure_raises_data_error(data_dir):
    use_transport(httpx.MockTransport(lambda r: httpx.Response(500, text="x")))
    with pytest.raises(DataError):
        open_meteo.elevations("d", [(24.8, 92.7)])


def test_district_config_loads():
    assert "cachar" in list_districts()
    d = load_district("cachar")
    assert d.bbox[0] < d.bbox[2] and d.bbox[1] < d.bbox[3]
    assert d.forecast_points and d.staging_points
    with pytest.raises(DataError):
        load_district("nowhere")


def test_shelter_csv_validation(tmp_path):
    good = tmp_path / "s.csv"
    good.write_text("# comment\nid,name,lat,lon,capacity,type,source\ns1,A,24.8,92.7,200,school,DDMP p1\n", encoding="utf-8")
    assert load_shelters(str(good))[0].capacity == 200
    bad = tmp_path / "b.csv"
    bad.write_text("id,name,lat,lon,capacity,type,source\ns1,A,24.8,92.7,0,school,x\n", encoding="utf-8")
    with pytest.raises(DataError):
        load_shelters(str(bad))
    assert load_shelters("") == []
    assert load_shelters("data/reference/cachar_shelters.csv") == []  # header-only file
