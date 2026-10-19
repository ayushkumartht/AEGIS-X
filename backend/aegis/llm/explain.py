"""Narration of engine results. The LLM only phrases numbers it is given.

Guardrail: any number in the generated text that is not present in the input data makes the
text unusable, and the deterministic template narration is returned instead.
"""

from __future__ import annotations

import json
import re

from aegis.llm.base import LLMError, LLMProvider
from aegis.llm.prompts import EXPLAIN_SYSTEM

_NUMBER = re.compile(r"(?<![\w.])-?\d+(?:\.\d+)?(?![\w])")


def _numbers_in(obj) -> list[float]:
    return [float(x) for x in _NUMBER.findall(json.dumps(obj, default=str))]


def numbers_are_grounded(text: str, data) -> bool:
    """True when every number in `text` matches some number in `data` (after rounding)."""
    allowed = _numbers_in(data) + [10.0]  # "worst 10%" is a fixed definition, not a finding
    allowed +=[v * 100 for v in allowed if abs(v) <= 1.5]  # fractions shown as percentages
    for token in _NUMBER.findall(text):
        value = float(token)
        if not any(abs(value - a) <= max(0.51, abs(a) * 0.005) for a in allowed):
            return False
    return True


def _pct(x: float) -> str:
    return f"{x * 100:.0f}%" if abs(x) <= 1.0 else f"{x:.0f}%"


def template_narration(payload: dict) -> str:
    """Deterministic fallback text built straight from the numbers."""
    parts: list[str] = []
    summary = payload.get("summary")
    if summary:
        parts.append(
            f"Across the simulated futures, the plan evacuates {_pct(summary['mean'])} of people at risk "
            f"on average, and {_pct(payload.get('resilience_worst_10pct', summary['p10']))} in the "
            f"worst 10% of futures."
        )
    spofs = payload.get("single_points_of_failure") or []
    if spofs and spofs[0].get("drop_pct", 0) > 0:
        top = spofs[0]
        parts.append(
            f"The biggest single point of failure is {top['element_id']}: losing it cuts the "
            f"result by {top['drop_pct']:.0f}%."
        )
    boxes = payload.get("failure_boxes") or []
    if boxes:
        parts.append(f"The plan tends to fail when {boxes[0]['description']}.")
    sens = payload.get("sensitivity") or []
    if sens:
        parts.append(f"The most influential uncertainty is {sens[0]['variable']}.")
    checks = payload.get("check_next") or []
    if checks:
        parts.append(
            f"Check first: {checks[0]['action']} (expected gain {checks[0]['voi_pct']:.0f}%)."
        )
    return " ".join(parts) if parts else "No findings to report for this analysis."


def narrate(payload: dict, provider: LLMProvider) -> dict:
    """Return {"text", "source"} where source is the provider name or "template"."""
    if provider.name == "none":
        return {"text": template_narration(payload), "source": "template"}
    try:
        text = provider.complete(EXPLAIN_SYSTEM, json.dumps(payload, default=str, indent=1)).strip()
    except LLMError:
        return {"text": template_narration(payload), "source": "template"}
    if not text or not numbers_are_grounded(text, payload):
        return {"text": template_narration(payload), "source": "template"}
    return {"text": text, "source": provider.name}
