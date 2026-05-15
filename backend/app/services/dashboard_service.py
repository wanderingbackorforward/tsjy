from datetime import datetime

from app.core.config import get_settings
from app.repositories.project_repository import get_project_summary
from app.repositories.ring_repository import get_current_ring, get_ring
from app.repositories.risk_repository import list_risk_sources
from app.repositories.shield_repository import get_operation_by_ring, list_operations
from app.repositories.monitoring_repository import summary as monitoring_summary
from app.repositories.event_repository import list_events


def build_dashboard_overview(section_id: str | None = None, ring_no: int | None = None) -> dict:
    settings = get_settings()
    sid = section_id or settings.default_section_id
    project = get_project_summary(sid)
    current_ring = get_current_ring(sid)
    view_ring = get_ring(sid, ring_no) if ring_no is not None else current_ring
    effective_ring_no = view_ring["ringNo"] if view_ring else settings.current_ring_no
    current_mileage_m = view_ring.get("endMileageM") if view_ring else None

    all_risks = list_risk_sources(sid, current_mileage_m)
    active = [item for item in all_risks if item["status"] in ("approaching", "inside")]
    operation = get_operation_by_ring(sid, effective_ring_no)
    trend = list_operations(sid, max(1, effective_ring_no - 36), effective_ring_no + 36)
    events = list_events(sid, 8, effective_ring_no, 10)

    start_m = 53695
    end_m = 59129
    progress = 0
    if view_ring and view_ring.get("endMileageM") is not None:
        progress = round((view_ring["endMileageM"] - start_m) / (end_m - start_m) * 100, 2)

    view_ring_card = view_ring.copy() if view_ring else None
    if view_ring_card:
        view_ring_card["progressPercent"] = progress

    return {
        "project": project,
        "currentRing": current_ring,
        "viewRing": view_ring_card,
        "viewMode": "selected" if ring_no is not None else "current",
        "activeRiskSources": active,
        "allRiskSources": all_risks,
        "operationSummary": operation,
        "operationTrend": trend,
        "monitoringSummary": monitoring_summary(sid, effective_ring_no),
        "recentEvents": events,
        "dataUpdatedAt": events[0]["eventTime"] if events else datetime.now().isoformat(),
    }
