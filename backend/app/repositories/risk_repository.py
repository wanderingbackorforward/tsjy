from app.core.config import get_settings
from app.core.database import fetch_all


def _status(current_mileage_m: float | None, start_m: float | None, end_m: float | None) -> tuple[str, float | None, float | None]:
    if current_mileage_m is None or start_m is None or end_m is None:
        return "normal", None, None
    distance_start = round(start_m - current_mileage_m, 2)
    distance_end = round(end_m - current_mileage_m, 2)
    if start_m <= current_mileage_m <= end_m:
        return "inside", distance_start, distance_end
    if 0 <= start_m - current_mileage_m <= 100:
        return "approaching", distance_start, distance_end
    if current_mileage_m > end_m:
        return "passed", distance_start, distance_end
    return "normal", distance_start, distance_end


def list_risk_sources(section_id: str | None = None, current_mileage_m: float | None = None) -> list[dict]:
    sid = section_id or get_settings().default_section_id
    rows = fetch_all(
        """
        SELECT rs.*, COUNT(mp.point_id) AS monitoring_point_count
        FROM risk_source rs
        LEFT JOIN monitoring_point mp ON mp.risk_source_id = rs.risk_source_id
        WHERE rs.section_id = %s::uuid
        GROUP BY rs.risk_source_id
        ORDER BY rs.start_mileage_m
        """,
        (sid,),
    )
    items = []
    for row in rows:
        start_m = row.get("start_mileage_m")
        end_m = row.get("end_mileage_m")
        status, distance_start, distance_end = _status(current_mileage_m, start_m, end_m)
        alert_level = "warning" if status in ("approaching", "inside") and row.get("risk_level") == "high" else "normal"
        items.append({
            "riskSourceId": str(row["risk_source_id"]),
            "sectionId": str(row["section_id"]),
            "riskName": row["risk_name"],
            "riskType": row.get("risk_type"),
            "crossingRelation": row.get("crossing_relation"),
            "startMileage": row.get("start_mileage"),
            "endMileage": row.get("end_mileage"),
            "startMileageM": start_m,
            "endMileageM": end_m,
            "minHorizontalDistanceM": row.get("min_horizontal_distance_m"),
            "minVerticalDistanceM": row.get("min_vertical_distance_m"),
            "protectionLevel": row.get("protection_level"),
            "riskLevel": row.get("risk_level") or "medium",
            "status": status,
            "distanceToStartM": distance_start,
            "distanceToEndM": distance_end,
            "distanceToCurrentRingM": 0 if status == "inside" else distance_start,
            "alertLevel": alert_level,
            "monitoringPointCount": row.get("monitoring_point_count") or 0,
        })
    return items
