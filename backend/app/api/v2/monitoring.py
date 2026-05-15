from fastapi import APIRouter, Query
from app.core.config import get_settings
from app.repositories.monitoring_repository import list_points, readings

router = APIRouter(prefix="/monitoring", tags=["v2-monitoring"])


@router.get("/points")
def points(section_id: str | None = Query(None), risk_source_id: str | None = Query(None)):
    return {"items": list_points(section_id or get_settings().default_section_id, risk_source_id)}


@router.get("/readings")
def monitoring_readings(point_id: str | None = Query(None), point_code: str | None = Query(None)):
    return readings(point_id, point_code)
