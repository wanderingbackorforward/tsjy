from fastapi import APIRouter, Query
from app.core.config import get_settings
from app.repositories.event_repository import list_events

router = APIRouter(prefix="/events", tags=["v2-events"])


@router.get("")
def events(section_id: str | None = Query(None), ring_no: int | None = Query(None), limit: int = 20):
    return {"items": list_events(section_id or get_settings().default_section_id, limit, ring_no)}
