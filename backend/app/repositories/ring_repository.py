from app.core.config import get_settings
from app.core.database import fetch_one


def to_ring(row: dict | None) -> dict | None:
    if not row:
        return None
    return {
        "ringId": str(row["ring_id"]),
        "sectionId": str(row["section_id"]),
        "ringNo": row["ring_no"],
        "workDate": row.get("work_date"),
        "startMileage": row.get("start_mileage"),
        "endMileage": row.get("end_mileage"),
        "startMileageM": row.get("start_mileage_m"),
        "endMileageM": row.get("end_mileage_m"),
        "constructionStage": row.get("construction_stage"),
        "isActual": bool(row.get("is_actual")),
    }


def get_ring(section_id: str, ring_no: int) -> dict | None:
    return to_ring(fetch_one(
        "SELECT * FROM ring_mileage_map WHERE section_id=%s::uuid AND ring_no=%s LIMIT 1",
        (section_id, ring_no),
    ))


def get_current_ring(section_id: str | None = None) -> dict | None:
    settings = get_settings()
    sid = section_id or settings.default_section_id
    row = fetch_one(
        "SELECT * FROM ring_mileage_map WHERE section_id=%s::uuid AND ring_no=%s LIMIT 1",
        (sid, settings.current_ring_no),
    )
    if not row:
        row = fetch_one(
            "SELECT * FROM ring_mileage_map WHERE section_id=%s::uuid ORDER BY ring_no DESC LIMIT 1",
            (sid,),
        )
    return to_ring(row)
