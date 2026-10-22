"""Hazard plugins. Flood is built; crowd and fire have slots so their alerts are already sorted."""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class Hazard:
    id: str
    name: str
    enabled: bool
    keywords: tuple[str, ...]  # words in an alert's event or headline that belong to this hazard
    note: str


HAZARDS: tuple[Hazard, ...] = (
    Hazard(
        "flood", "Flood", True,
        ("flood", "inundation", "heavy rain", "very heavy rain", "extremely heavy rain", "river", "dam", "cloudburst", "flash flood"),
        "Live: official alerts, CWC river gauges, GloFAS river forecasts, and the evacuation engine for built districts.",
    ),
    Hazard(
        "fire", "Fire", False,
        ("fire", "forest fire", "wildfire", "heat wave", "heatwave"),
        "Coming later: needs a NASA FIRMS key for satellite fire detections and a fire-spread model.",
    ),
    Hazard(
        "crowd", "Crowd safety", False,
        ("crowd", "stampede", "gathering", "mela"),
        "Coming later: needs event schedules and live crowd counts from a partner (police, venue or telecom).",
    ),
)
OTHER = "other"


def hazard_of(*texts: str) -> str:
    """The hazard an alert belongs to, from its event name and headline; "other" when none match."""
    text = " ".join(t.lower() for t in texts if t)
    for h in HAZARDS:
        if any(k in text for k in h.keywords):
            return h.id
    return OTHER


def describe() -> list[dict]:
    return [asdict(h) for h in HAZARDS]
