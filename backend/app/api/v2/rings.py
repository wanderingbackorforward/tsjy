from fastapi import APIRouter, HTTPException, Query
from app.core.config import get_settings
from app.repositories.ring_repository import get_current_ring, get_ring

router = APIRouter(prefix="/rings", tags=["v2-rings"])


@router.get("/current")
def current_ring(section_id: str | None = Query(None)):
    row = get_current_ring(section_id or get_settings().default_section_id)
    if not row:
        raise HTTPException(status_code=404, detail="current ring not found")
    return row


@router.get("/{ring_no}")
def ring_detail(ring_no: int, section_id: str | None = Query(None)):
    row = get_ring(section_id or get_settings().default_section_id, ring_no)
    if not row:
        raise HTTPException(status_code=404, detail="ring not found")
    return row
