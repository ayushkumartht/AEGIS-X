"""Field reports: what each kind of source is worth, and a rule-based parser for free text.

The parser here needs no LLM. When an LLM is configured, llm/parse_report.py asks it first and
falls back to these rules if its answer does not validate.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

SOURCE_TYPES = ("field_team", "control_room", "official_feed", "public_call", "social_media")

# How much a report from each source is trusted: the probability that its claim is right.
RELIABILITY = {
    "field_team": 0.90,
    "official_feed": 0.85,
    "control_room": 0.70,
    "public_call": 0.60,
    "social_media": 0.55,
}

# Hours after which a report counts half as much, by what it describes.
HALF_LIFE_H = {"bridge": 6.0, "road": 6.0, "cluster": 12.0, "shelter": 24.0, "boats": 6.0, "network": 6.0}
DEFAULT_HALF_LIFE_H = 12.0

CLAIMS = ("closed", "open", "flooded", "dry", "boats_ready", "network_down", "unknown")
SUBJECT_TYPES = ("bridge", "road", "cluster", "shelter", "staging", "boats", "network", "other")


@dataclass
class ParsedReport:
    subject_type: str = "other"
    subject_name: str = ""
    claim: str = "unknown"
    value: float | None = None
    method: str = "rules"  # rules or llm

    def valid(self) -> bool:
        return self.subject_type in SUBJECT_TYPES and self.claim in CLAIMS


@dataclass
class FieldReport:
    id: int
    received_at: str
    source_type: str
    raw_text: str
    parsed: ParsedReport = field(default_factory=ParsedReport)


_CLOSED = ("closed", "blocked", "under water", "underwater", "submerged", "washed away", "collapsed", "cut off", "impassable")
_OPEN = ("open", "passable", "clear", "reopened", "usable")
_NETWORK = ("network", "signal", "tower", "phone", "internet", "connectivity")


def parse_rules(text: str, bridge_names: dict[str, str] | None = None) -> ParsedReport:
    """Understand a short report with keyword rules."""
    t = text.lower()
    boats = re.search(r"(\d+)\s+(?:rescue\s+)?boats?", t)
    if boats and ("ready" in t or "available" in t or "arrived" in t or "have" in t):
        return ParsedReport("boats", "", "boats_ready", float(boats.group(1)))
    if any(w in t for w in _NETWORK) and any(w in t for w in ("down", "lost", "dead", "not working", "no ")):
        return ParsedReport("network", "", "network_down", None)

    if any(w in t for w in _CLOSED):
        claim = "closed"
    elif any(w in t for w in _OPEN):
        claim = "open"
    else:
        claim = "unknown"

    subject_type, name = "other", ""
    for bid, bname in (bridge_names or {}).items():
        tokens = [w for w in re.findall(r"[a-z0-9]+", bname.lower()) if len(w) > 2 and w not in ("bridge", "road", "near")]
        if bname.lower() in t or bid.lower() in t or (tokens and sum(w in t for w in tokens) >= min(2, len(tokens))):
            return ParsedReport("bridge", bname, claim, None)
    if "bridge" in t:
        subject_type = "bridge"
    elif "road" in t or "highway" in t or "nh" in t.split():
        subject_type = "road"
    elif "shelter" in t or "camp" in t or "school" in t:
        subject_type = "shelter"
    return ParsedReport(subject_type, name, claim, None)
