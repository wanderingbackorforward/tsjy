from fastapi import APIRouter, Query
from app.core.config import get_settings
from app.repositories.shield_repository import list_operations

router = APIRouter(prefix="/shield", tags=["v2-shield"])


@router.get("/ring-operations")
def ring_operations(section_id: str | None = Query(None), start_ring: int = 320, end_ring: int = 392):
    return {"items": list_operations(section_id or get_settings().default_section_id, start_ring, end_ring)}
