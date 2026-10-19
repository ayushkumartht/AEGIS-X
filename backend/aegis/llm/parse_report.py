"""Free-text field report to a structured ParsedReport. The LLM answer must validate."""

from __future__ import annotations

import json

from aegis.fusion.reports import ParsedReport, parse_rules
from aegis.llm.base import LLMError, LLMProvider
from aegis.llm.prompts import PARSE_REPORT_SYSTEM


def parse_report(text: str, provider: LLMProvider, bridge_names: dict[str, str] | None = None) -> ParsedReport:
    """Ask the LLM to structure the report; fall back to keyword rules when it cannot."""
    if provider.name != "none":
        try:
            data = json.loads(provider.complete(PARSE_REPORT_SYSTEM, text, json_mode=True, temperature=0.0))
            value = data.get("value")
            parsed = ParsedReport(
                subject_type=str(data.get("subject_type", "other")),
                subject_name=str(data.get("subject_name", "")),
                claim=str(data.get("claim", "unknown")),
                value=float(value) if isinstance(value, (int, float)) else None,
                method="llm",
            )
            if parsed.valid():
                return parsed
        except (LLMError, ValueError, TypeError, AttributeError):
            pass
    return parse_rules(text, bridge_names)
