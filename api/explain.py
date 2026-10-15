"""Groq narration layer — turns ALREADY-COMPUTED engine output into plain
language. Per the "math decides, the LLM explains" rule (see docs/
flood-evacuation-solution.md §1): this module is never asked to find a
weakness itself, only to phrase one that core/engine/redteam.py already
found. The prompt receives numbers; it must not receive "figure out if
this plan is risky" or any open-ended judgment call.
"""

from __future__ import annotations

import json
import os

from groq import Groq

_MODEL = "llama-3.3-70b-versatile"

_SYSTEM_PROMPT = """You narrate flood-evacuation decision-support analysis for an \
operations officer. You are given ONLY already-computed simulation results — \
Monte Carlo statistics, Red Team findings (worst-case futures, single points of \
failure), and sensitivity rankings. Your job is to phrase these findings in plain, \
concise language (3-5 sentences). Rules:
- Use ONLY the numbers and facts given to you. Never invent a number, a cause, or a \
finding that is not present in the data.
- If the data shows a single point of failure, name it and cite its drop_pct.
- If the data shows worst-case flagged variables, mention them.
- Do not recommend a specific fix unless the data itself implies one (e.g. "resource_\
availability_pct" flagged as extreme in worst cases implies more resources would help).
- Write for a decision-maker under time pressure: lead with the single most important \
finding."""


def _get_client() -> Groq:
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY is not set. Copy .env.example to .env and fill in your key, "
            "or export GROQ_API_KEY in your shell."
        )
    return Groq(api_key=api_key)


def explain_redteam(redteam_payload: dict) -> str:
    """Narrate a /flood/redteam response (worst_case_futures, single_points_of_failure,
    sensitivity). Returns a short plain-language paragraph."""
    client = _get_client()
    user_content = (
        "Here is the Red Team analysis data for the current flood evacuation plan:\n\n"
        + json.dumps(redteam_payload, indent=2)
    )
    response = client.chat.completions.create(
        model=_MODEL,
        temperature=0.2,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
    )
    return response.choices[0].message.content
