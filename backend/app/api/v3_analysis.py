from fastapi import APIRouter, Query

from app.services.analysis_service import DEFAULT_SECTION_ID, CURRENT_RING_NO, analyze_ring, dashboard_analysis

router = APIRouter()


@router.get("/dashboard")
async def get_analysis_dashboard(
    section_id: str = Query(DEFAULT_SECTION_ID),
    ring_no: int | None = Query(None),
):
    return dashboard_analysis(section_id=section_id, ring_no=ring_no)


@router.get("/rings/{ring_no}")
async def get_ring_analysis(
    ring_no: int,
    section_id: str = Query(DEFAULT_SECTION_ID),
):
    return analyze_ring(ring_no=ring_no, section_id=section_id)


@router.get("/current")
async def get_current_ring_analysis(section_id: str = Query(DEFAULT_SECTION_ID)):
    return analyze_ring(ring_no=CURRENT_RING_NO, section_id=section_id)
