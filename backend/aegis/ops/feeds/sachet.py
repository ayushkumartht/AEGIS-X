"""NDMA SACHET: India's official Common Alerting Protocol feed (IMD, CWC, state SDMAs).

The RSS lists the latest alerts; each links to a CAP 1.2 XML document. An alert can carry
several <info> blocks in different languages: the English one (en-IN) is used. CWC river alerts
put the gauge position in <altitude>/<ceiling> (latitude, longitude) and the water level,
warning level and danger level in the description; those are parsed into `gauge`.
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

from aegis.exceptions import DataError
from aegis.ingest.cache import cached_json
from aegis.ingest.http import get_text
from aegis.ops.hazards import hazard_of

RSS_URL = "https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml"
CAP = "{urn:oasis:names:tc:emergency:cap:1.2}"
CACHE = "ops"
WORKERS = 8
INDIA = (6.0, 38.0, 68.0, 98.0)  # lat_min, lat_max, lon_min, lon_max

_LEVEL = re.compile(r"(?:flowing at|at) a level of ([\d.]+) ?m", re.I)
_TREND = re.compile(r"with (\w+) trend", re.I)
_WARNING = re.compile(r"Warning Level of ([\d.]+) ?m", re.I)
_DANGER = re.compile(r"Danger Level of ([\d.]+) ?m", re.I)
_HFL = re.compile(r"Highest Flood Level of ([\d.]+) ?m", re.I)


def parse_rss(xml_text: str) -> list[dict]:
    """The RSS items: id, CAP link, sender (from the author field), published time."""
    out = []
    for item in ET.fromstring(xml_text).iter("item"):
        link = item.findtext("link") or ""
        guid = item.findtext("guid") or link.rsplit("=", 1)[-1]
        author = item.findtext("author") or ""
        sender = author.split("(", 1)[1].rstrip(")") if "(" in author else author
        out.append({"id": guid.strip(), "link": link.strip(), "sender": sender.strip(), "pub_date": item.findtext("pubDate") or ""})
    return out


def _t(el: ET.Element | None, tag: str) -> str:
    return (el.findtext(CAP + tag) or "").strip() if el is not None else ""


def _float(text: str) -> float | None:
    try:
        return float(text)
    except ValueError:
        return None


def _gauge(text: str) -> dict | None:
    level, warning, danger = (_LEVEL.search(text), _WARNING.search(text), _DANGER.search(text))
    if not level or not (warning or danger):
        return None
    trend, hfl = _TREND.search(text), _HFL.search(text)
    return {
        "level_m": float(level.group(1)),
        "warning_m": float(warning.group(1)) if warning else None,
        "danger_m": float(danger.group(1)) if danger else None,
        "highest_m": float(hfl.group(1)) if hfl else None,
        "trend": trend.group(1).lower() if trend else "",
    }


def state_of(sender: str, area: str) -> str:
    """Best-effort state name: from an SDMA sender ("Andhra-Pradesh-SDMA") or the area's last part."""
    if sender.upper().endswith("SDMA"):
        return sender[: -len("SDMA")].strip("- ").replace("-", " ")
    parts = [p.strip() for p in area.split(",") if p.strip()]
    return parts[-1] if len(parts) >= 2 else ""


def parse_cap(xml_text: str, alert_id: str, url: str) -> dict | None:
    """One normalised event from a CAP document, or None when it has no usable info block."""
    root = ET.fromstring(xml_text)
    infos = root.findall(CAP + "info")
    if not infos:
        return None
    info = next((i for i in infos if _t(i, "language").lower().startswith("en")), infos[0])
    area_el = info.find(CAP + "area")
    area = _t(area_el, "areaDesc")
    sender = _t(root, "sender")
    headline, description, event = _t(info, "headline"), _t(info, "description"), _t(info, "event")
    lat = lon = None
    method = "unlocated"
    alt, ceil = _float(_t(area_el, "altitude")), _float(_t(area_el, "ceiling"))
    if alt is not None and ceil is not None and INDIA[0] <= alt <= INDIA[1] and INDIA[2] <= ceil <= INDIA[3]:
        lat, lon, method = alt, ceil, "gauge position in the alert"
    lgd = None
    if area_el is not None:
        for g in area_el.findall(CAP + "geocode"):
            if "district" in _t(g, "valueName").lower():
                lgd = _t(g, "value")
    return {
        "uid": f"sachet:{alert_id}",
        "source": "NDMA SACHET",
        "hazard": hazard_of(event, headline),
        "event": event or "Alert",
        "severity": _t(info, "severity") or "Unknown",
        "urgency": _t(info, "urgency") or "Unknown",
        "certainty": _t(info, "certainty") or "Unknown",
        "sender": sender.replace("-", " "),
        "state": state_of(sender, area),
        "area": area,
        "headline": headline,
        "description": description,
        "lat": lat,
        "lon": lon,
        "place_method": method,
        "lgd_district": lgd,
        "effective": _t(info, "effective"),
        "expires": _t(info, "expires"),
        "sent": _t(root, "sent"),
        "gauge": _gauge(f"{headline} {description}"),
        "url": url,
    }


def _load(item: dict) -> dict | None:
    """One alert's CAP document, fetched once and then read from the cache; None if it cannot be read."""
    try:
        xml_text = cached_json(CACHE, "sachet_cap", {"id": item["id"]}, lambda: get_text(item["link"]))
        return parse_cap(xml_text, item["id"], item["link"])
    except (ET.ParseError, DataError):
        return None  # one bad or unreachable document must not drop the others


def fetch_alerts(limit: int | None = None) -> list[dict]:
    """Latest alerts from the RSS. The CAP documents are fetched in parallel (each takes a second or two)."""
    items = [i for i in parse_rss(get_text(RSS_URL))[:limit] if i["link"]]
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        return [e for e in pool.map(_load, items) if e]
