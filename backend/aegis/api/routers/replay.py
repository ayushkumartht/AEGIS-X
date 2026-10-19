from __future__ import annotations

import json

import yaml
from fastapi import APIRouter, HTTPException

from aegis.settings import get_settings

router = APIRouter(tags=["replay"])


def _event_path(event_id: str):
    return get_settings().aegis_data_dir / "reference" / "events" / f"{event_id}.yaml"


@router.get("/replay/{event_id}")
def replay(event_id: str):
    """The precomputed replay of a past event plus its documented facts (see scripts/replay_event.py)."""
    path = _event_path(event_id)
    if not path.exists() or "/" in event_id or "\\" in event_id or ".." in event_id:
        raise HTTPException(status_code=404, detail=f"Unknown event {event_id!r}.")
    event = yaml.safe_load(path.read_text(encoding="utf-8"))
    result_path = get_settings().aegis_data_dir / "processed" / event["district"] / f"replay_{event_id}.json"
    if not result_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"No replay computed yet. Run: scripts/replay_event.py --event {event_id}",
        )
    return {"event": event, **json.loads(result_path.read_text(encoding="utf-8"))}
