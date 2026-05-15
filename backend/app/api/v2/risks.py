from fastapi import APIRouter, Query
from app.core.config import get_settings
from app.repositories.ring_repository import get_current_ring, get_ring
from app.repositories.risk_repository import list_risk_sources

router = APIRouter(prefix="/risk-sources", tags=["v2-risks"])


@router.get("")
def risks(section_id: str | None = Query(None), ring_no: int | None = Query(None)):
    sid = section_id or get_settings().default_section_id
    ring = get_ring(sid, ring_no) if ring_no is not None else get_current_ring(sid)
    mileage = ring.get("endMileageM") if ring else None
    return {"items": list_risk_sources(sid, mileage)}
