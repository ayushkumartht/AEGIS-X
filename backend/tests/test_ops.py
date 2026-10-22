"""Command Center: CAP parsing, flood-flow statistics, the poller and its feed health."""

import numpy as np
import pytest

from aegis.ops import districts as watch
from aegis.ops import hazards, poller, risk, store
from aegis.ops.feeds import gdacs, sachet
from aegis.settings import get_settings

CWC_ALERT = """<cap:alert xmlns:cap="urn:oasis:names:tc:emergency:cap:1.2">
<cap:identifier>IN-1_5</cap:identifier><cap:sender>CWC</cap:sender><cap:sent>2026-10-22T09:35:37+05:30</cap:sent>
<cap:info><cap:language>en-IN</cap:language><cap:category>Met</cap:category><cap:event>Flood</cap:event>
<cap:urgency>Future</cap:urgency><cap:severity>Severe</cap:severity><cap:certainty>Likely</cap:certainty>
<cap:effective>2026-10-22T06:00:00+05:30</cap:effective><cap:expires>2026-10-23T06:00:00+05:30</cap:expires>
<cap:headline>River Gandak at Dumariaghat in Gopalganj district of Bihar continues to flow in above normal flood situation.</cap:headline>
<cap:description>At 6:00 am, it was flowing at a level of 61.38 m with steady trend which is 0.16 m above its Warning Level of 61.22 m and 0.84 m below its Danger Level of 62.22 m.</cap:description>
<cap:area><cap:areaDesc>Gandak, Dumariaghat, Gopalganj, Bihar</cap:areaDesc><cap:altitude>26.35</cap:altitude><cap:ceiling>84.76</cap:ceiling></cap:area>
</cap:info></cap:alert>"""

SDMA_ALERT = """<cap:alert xmlns:cap="urn:oasis:names:tc:emergency:cap:1.2">
<cap:identifier>IN-2_8</cap:identifier><cap:sender>Andhra-Pradesh-SDMA</cap:sender><cap:sent>2026-10-22T12:37:51+05:30</cap:sent>
<cap:info><cap:language>en-IN</cap:language><cap:event>Lightning</cap:event><cap:urgency>Expected</cap:urgency>
<cap:severity>Severe</cap:severity><cap:certainty>Likely</cap:certainty><cap:headline>Lightning likely in your area.</cap:headline>
<cap:area><cap:areaDesc>prk-santhanuthalapadu, bpt-martur mandals</cap:areaDesc><cap:altitude>0.0</cap:altitude><cap:ceiling>0.0</cap:ceiling></cap:area></cap:info>
<cap:info><cap:language>TL</cap:language><cap:event>Lightning</cap:event><cap:headline>telugu text</cap:headline><cap:area><cap:areaDesc>x</cap:areaDesc></cap:area></cap:info>
</cap:alert>"""

RSS = """<rss version="2.0"><channel>
<item><title>t</title><link>https://sachet.example/Fetch?identifier=99</link><guid>99</guid>
<author>controlroom@ndma.gov.in (Andhra Pradesh SDMA)</author><pubDate>Thu, 22 Oct 2026 06:54:37 GMT</pubDate></item>
</channel></rss>"""


@pytest.fixture
def db(tmp_path, monkeypatch):
    monkeypatch.setenv("AEGIS_DB_URL", f"sqlite:///{(tmp_path / 'ops.db').as_posix()}")
    get_settings.cache_clear()
    watch.load_config.cache_clear()
    yield
    get_settings.cache_clear()
    watch.load_config.cache_clear()


def test_cwc_alert_gives_gauge_numbers_and_position():
    e = sachet.parse_cap(CWC_ALERT, "IN-1_5", "u")
    assert e["hazard"] == "flood" and e["severity"] == "Severe" and e["sender"] == "CWC"
    assert e["gauge"] == {"level_m": 61.38, "warning_m": 61.22, "danger_m": 62.22, "highest_m": None, "trend": "steady"}
    assert (e["lat"], e["lon"]) == (26.35, 84.76) and e["state"] == "Bihar"


def test_english_info_block_is_used_and_sdma_state_is_read():
    e = sachet.parse_cap(SDMA_ALERT, "IN-2_8", "u")
    assert e["headline"] == "Lightning likely in your area." and e["state"] == "Andhra Pradesh"
    assert e["lat"] is None and e["hazard"] == hazards.OTHER  # zero altitude/ceiling is not a position


def test_rss_items_carry_the_sender():
    (item,) = sachet.parse_rss(RSS)
    assert item["id"] == "99" and item["sender"] == "Andhra Pradesh SDMA"


def test_gdacs_features_are_normalised():
    fc = {"features": [{"geometry": {"coordinates": [78.6, 11.3]}, "properties": {
        "eventtype": "FL", "eventid": 7, "episodeid": 2, "name": "Flood in India", "alertlevel": "Orange",
        "fromdate": "2026-08-09T00:00:00", "country": "India"}}]}
    (e,) = gdacs.parse(fc)
    assert e["hazard"] == "flood" and e["severity"] == "Severe" and (e["lat"], e["lon"]) == (11.3, 78.6)


def test_hazard_registry_marks_crowd_and_fire_as_later():
    state = {h.id: h.enabled for h in hazards.HAZARDS}
    assert state == {"flood": True, "fire": False, "crowd": False}
    assert hazards.hazard_of("Forest Fire", "") == "fire" and hazards.hazard_of("Flash Flood", "") == "flood"


def test_gumbel_flows_increase_with_return_period_and_match_the_fit():
    rng = np.random.default_rng(1)
    maxima = list(rng.gumbel(1000.0, 200.0, size=400))
    q2, q20 = risk.gumbel_flow(maxima, 2), risk.gumbel_flow(maxima, 20)
    assert q2 < risk.gumbel_flow(maxima, 5) < q20
    assert q2 == pytest.approx(1000 - 200 * np.log(np.log(2)), rel=0.05)  # Gumbel median
    assert q20 == pytest.approx(1000 - 200 * np.log(-np.log(1 - 1 / 20)), rel=0.06)


def _record(years=15):
    dates = [f"{2000 + y}-{m:02d}-{d:02d}" for y in range(years) for m in range(1, 13) for d in range(1, 31)]
    values = [100.0 + (50.0 * (i % 360 == 100)) * (1 + 0.1 * (i // 360)) for i, _ in enumerate(dates)]
    return dates, values


def test_return_flows_need_enough_complete_years():
    dates, values = _record(years=15)
    assert risk.return_flows(dates, values, (2, 5, 20), 10)["n_years"] == 15
    assert risk.return_flows(dates[: 360 * 5], values[: 360 * 5], (2, 5, 20), 10) is None


def test_levels_follow_the_share_of_members_above_each_flood():
    history = {"flows": {2: 100.0, 5: 150.0, 20: 200.0}, "years": "2000-2014", "n_years": 15}
    dates = ["d1", "d2", "d3"]
    rule = risk.LevelRule()
    calm = [[50, 60, 55]] * 10
    assert risk.assess(dates, calm, history, rule).level == "normal"
    watch = [[50, 120, 60]] * 4 + calm[:6]  # 40% pass the 2-year flood
    assert risk.assess(dates, watch, history, rule).level == "watch"
    warning = [[50, 170, 60]] * 4 + calm[:6]
    got = risk.assess(dates, warning, history, rule)
    assert got.level == "warning" and got.peak_day == "d2" and got.exceed[5] == pytest.approx(0.4)
    severe = [[50, 250, 60]] * 4 + calm[:6]
    assert risk.assess(dates, severe, history, rule).level == "severe"
    assert risk.raise_level("watch", "warning") == "warning" and risk.raise_level("severe", "warning") == "severe"


def test_event_store_dedupes_filters_and_keeps_places(db):
    e = sachet.parse_cap(CWC_ALERT, "IN-1_5", "u")
    assert store.upsert_events([e]) == 1
    again = {**e, "lat": None, "lon": None, "place_method": "unlocated"}
    assert store.upsert_events([again]) == 0  # same uid: not new, and the known position is kept
    (stored,) = store.list_events(days=1, hazard="flood")
    assert stored["lat"] == 26.35 and stored["gauge"]["danger_m"] == 62.22
    assert store.list_events(days=1, hazard="fire") == [] and store.list_events(days=1, state="bihar")
    assert store.is_active({"expires": "2999-01-01T00:00:00+05:30"}) and not store.is_active({"expires": "2000-01-01T00:00:00+05:30"})
    assert store.is_active({"expires": ""})  # no expiry given: treated as active


def test_poller_records_a_failing_feed_without_dropping_data(db, monkeypatch):
    good = sachet.parse_cap(CWC_ALERT, "IN-1_5", "u")
    monkeypatch.setattr(sachet, "fetch_alerts", lambda: [good])
    monkeypatch.setattr(gdacs, "fetch_events", lambda: (_ for _ in ()).throw(RuntimeError("GDACS is down")))
    monkeypatch.setattr(poller, "locate_unlocated", lambda limit=15: 0)
    out = poller.refresh_alerts()
    assert out["NDMA SACHET"]["ok"] and not out["GDACS"]["ok"]
    feeds = {f["name"]: f for f in store.feeds()}
    assert feeds["NDMA SACHET"]["last_success"] and feeds["NDMA SACHET"]["items"] == 1
    assert feeds["GDACS"]["last_success"] is None and "GDACS is down" in feeds["GDACS"]["last_error"]
    assert len(store.list_events(days=1)) == 1  # the working feed's data is still there
    monkeypatch.setattr(sachet, "fetch_alerts", lambda: (_ for _ in ()).throw(RuntimeError("SACHET is down")))
    poller.refresh_alerts()
    assert len(store.list_events(days=1)) == 1  # a later failure keeps what was fetched earlier
    assert {f["name"]: f for f in store.feeds()}["NDMA SACHET"]["last_success"]


def test_alert_naming_a_watched_district_gets_its_place(db):
    e = {"area": "Cachar, Assam", "headline": "Heavy rain in Silchar", "lat": None}
    d = poller.match_district(e)
    assert d is not None and d.id == "cachar"
    assert poller.match_district({"area": "Pune", "headline": "rain"}) is None
    assert poller._place_query({"area": "Nicobars, North And Middle Andaman districts of Andaman and Nicobar Island", "state": ""}) == "Nicobars, Andaman and Nicobar Island"
    assert poller._place_query({"area": "prk-kandukur Mandal", "state": "Andhra Pradesh"}) == "kandukur, Andhra Pradesh"
