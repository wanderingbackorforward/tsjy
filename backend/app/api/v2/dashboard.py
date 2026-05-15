from fastapi import APIRouter, Query
from app.core.config import get_settings
from app.services.dashboard_service import build_dashboard_overview

router = APIRouter(prefix="/dashboard", tags=["v2-dashboard"])


@router.get("/overview")
def dashboard_overview(section_id: str | None = Query(None), ring_no: int | None = Query(None)):
    return build_dashboard_overview(section_id or get_settings().default_section_id, ring_no)
