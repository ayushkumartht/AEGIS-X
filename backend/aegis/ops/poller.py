"""Keeps the Command Center data fresh: alert feeds every 10 minutes, river risk every 3 hours.

Every attempt is recorded in ops_feed, so the screen can say when a feed last worked. A failing
feed never blanks out or fakes data: the previous rows stay, labelled with their age.
"""

from __future__ import annotations

import asyncio
import logging
import re
import time

from aegis.ingest import geocode
from aegis.ops import districts as watch
from aegis.ops import store
from aegis.ops.feeds import gdacs, sachet

logger = logging.getLogger(__name__)

ALERTS_EVERY_S = 600
RISK_EVERY_S = 3 * 3600
GEOCODE_PER_RUN = 15
INDIA_BBOX = (68.0, 6.0, 98.0, 38.0)
FEED_RISK = "GloFAS river forecast"


def _names(d: watch.WatchedDistrict) -> list[str]:
    names = {d.id.replace("_", " "), d.name.split("(")[0].strip()}
    inside = re.search(r"\(([^)]+)\)", d.name)
    if inside:
        names.add(inside.group(1))
    return [n.lower() for n in names if len(n) >= 4]


def match_district(event: dict) -> watch.WatchedDistrict | None:
    """The watched district named in the alert's area or headline (whole-word match)."""
    text = f"{event.get('area', '')} {event.get('headline', '')}".lower()
    for d in watch.load_config().districts:
        if any(re.search(rf"\b{re.escape(n)}\b", text) for n in _names(d)):
            return d
    return None


def _attach_district(events: list[dict]) -> None:
    for e in events:
        d = match_district(e)
        if d is None:
            continue
        e["district_id"] = d.id
        if e.get("lat") is None:
            e["lat"], e["lon"] = d.lat, d.lon
            e["place_method"] = f"centre of {d.name} (named in the alert)"


def _place_query(e: dict) -> str:
    """A geocoder query from the alert's area text: its first named place, plus the state."""
    area = e["area"]
    state = e.get("state") or ""
    tail = re.search(r"\bdistricts? of ([A-Za-z &]+)$", area, flags=re.I)
    if tail:
        state = tail.group(1).strip()
        area = area[: tail.start()]
    first = re.split(r"[,;]", area)[0].strip()
    first = re.sub(r"^[a-z]{2,4}-", "", first)  # SDMA codes such as "prk-" or "nlr-"
    first = re.sub(r"\s+(mandals?|districts?|taluks?|district of .*)$", "", first, flags=re.I)
    return f"{first}, {state}" if state else first


def locate_unlocated(limit: int = GEOCODE_PER_RUN) -> int:
    """Geocode the area text of alerts that carry no position (cached; Nominatim allows 1 request/s)."""
    found = 0
    for e in store.unlocated_events(limit):
        if not e["area"]:
            continue
        query = _place_query(e)
        try:
            hits = geocode.search("ops", query, INDIA_BBOX)
        except Exception as exc:  # noqa: BLE001 - a geocoder failure must not stop the refresh
            logger.info("geocode failed for %s: %s", query, exc)
            continue
        if hits:
            store.set_place(e["uid"], hits[0]["lat"], hits[0]["lon"], f"geocoded \"{query}\" (OpenStreetMap Nominatim)")
            found += 1
    return found


def refresh_alerts() -> dict:
    result = {}
    for name, fetch in (("NDMA SACHET", sachet.fetch_alerts), ("GDACS", gdacs.fetch_events)):
        try:
            events = fetch()
            _attach_district(events)
            new = store.upsert_events(events)
            store.feed_attempt(name, True, len(events))
            result[name] = {"ok": True, "items": len(events), "new": new}
        except Exception as exc:  # noqa: BLE001 - record any failure as feed health
            store.feed_attempt(name, False, error=f"{type(exc).__name__}: {exc}")
            result[name] = {"ok": False, "error": str(exc)}
    result["geocoded"] = locate_unlocated()
    return result


def refresh_risk(refresh: bool = False) -> dict:
    ok, failed = 0, []
    for d in watch.load_config().districts:
        try:
            ind, cell = watch.indicator(d, refresh=refresh)
        except Exception as exc:  # noqa: BLE001 - one district must not stop the others
            failed.append(f"{d.name}: {exc}")
            store.add_indicator(d.id, "unknown", {"reason": str(exc)})
            continue
        store.add_indicator(d.id, ind.level, {**ind.as_dict(), "cell": cell})
        ok += 1
    if ok:
        store.feed_attempt(FEED_RISK, True, ok)
    else:
        store.feed_attempt(FEED_RISK, False, error="; ".join(failed) or "no watched districts")
    return {"ok": ok, "failed": failed}


async def run_forever() -> None:
    last_risk = 0.0
    while True:
        try:
            await asyncio.to_thread(refresh_alerts)
            if time.monotonic() - last_risk >= RISK_EVERY_S or last_risk == 0.0:
                await asyncio.to_thread(refresh_risk)
                last_risk = time.monotonic()
        except Exception:  # noqa: BLE001 - keep polling whatever happens
            logger.exception("Command Center refresh failed")
        await asyncio.sleep(ALERTS_EVERY_S)
