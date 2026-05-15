from app.core.config import get_settings
from app.core.database import fetch_all, fetch_one


def list_points(section_id: str | None = None, risk_source_id: str | None = None) -> list[dict]:
    sid = section_id or get_settings().default_section_id
    params: tuple = (sid,)
    where = "mp.section_id=%s::uuid"
    if risk_source_id:
        where += " AND mp.risk_source_id=%s::uuid"
        params = (sid, risk_source_id)
    rows = fetch_all(
        f"""
        SELECT mp.*, rs.risk_name, latest.alert_level
        FROM monitoring_point mp
        LEFT JOIN risk_source rs ON rs.risk_source_id = mp.risk_source_id
        LEFT JOIN LATERAL (
            SELECT alert_level FROM monitoring_reading mr
            WHERE mr.point_id = mp.point_id
            ORDER BY measured_at DESC LIMIT 1
        ) latest ON TRUE
        WHERE {where}
        ORDER BY mp.point_code
        """,
        params,
    )
    return [to_point(row) for row in rows]


def to_point(row: dict) -> dict:
    return {
        "pointId": str(row["point_id"]),
        "sectionId": str(row["section_id"]),
        "riskSourceId": str(row["risk_source_id"]) if row.get("risk_source_id") else None,
        "riskName": row.get("risk_name"),
        "pointCode": row.get("point_code"),
        "pointName": row.get("point_name"),
        "monitoringObject": row.get("monitoring_object"),
        "monitoringItem": row.get("monitoring_item"),
        "mileage": row.get("mileage"),
        "mileageM": row.get("mileage_m"),
        "relativePosition": row.get("relative_position"),
        "initialValue": row.get("initial_value"),
        "unit": row.get("unit"),
        "warningThreshold": row.get("warning_threshold"),
        "alarmThreshold": row.get("alarm_threshold"),
        "alertLevel": row.get("alert_level") or "unknown",
    }


def readings(point_id: str | None = None, point_code: str | None = None) -> dict:
    if point_id:
        point = fetch_one("SELECT mp.*, rs.risk_name FROM monitoring_point mp LEFT JOIN risk_source rs ON rs.risk_source_id=mp.risk_source_id WHERE point_id=%s::uuid", (point_id,))
    elif point_code:
        point = fetch_one("SELECT mp.*, rs.risk_name FROM monitoring_point mp LEFT JOIN risk_source rs ON rs.risk_source_id=mp.risk_source_id WHERE point_code=%s", (point_code,))
    else:
        point = fetch_one("SELECT mp.*, rs.risk_name FROM monitoring_point mp LEFT JOIN risk_source rs ON rs.risk_source_id=mp.risk_source_id ORDER BY point_code LIMIT 1")
    if not point:
        return {"point": None, "readings": []}
    rows = fetch_all("SELECT * FROM monitoring_reading WHERE point_id=%s::uuid ORDER BY measured_at", (str(point["point_id"]),))
    reading_items = [{
        "readingId": str(row["reading_id"]),
        "pointId": str(row["point_id"]),
        "measuredAt": row.get("measured_at"),
        "currentValue": row.get("current_value"),
        "cumulativeChange": row.get("cumulative_change"),
        "changeRate": row.get("change_rate"),
        "alertLevel": row.get("alert_level") or "unknown",
    } for row in rows]
    latest_alert = reading_items[-1]["alertLevel"] if reading_items else "unknown"
    return {"point": to_point({**point, "alert_level": latest_alert}), "readings": reading_items}


def summary(section_id: str | None = None, ring_no: int | None = None) -> dict:
    sid = section_id or get_settings().default_section_id
    row = fetch_one(
        """
        WITH latest AS (
          SELECT DISTINCT ON (mr.point_id) mr.point_id, mr.cumulative_change, mr.alert_level
          FROM monitoring_reading mr
          JOIN monitoring_point mp ON mp.point_id = mr.point_id
          LEFT JOIN ring_mileage_map r ON r.ring_id = mr.ring_id
          WHERE mp.section_id=%s::uuid AND (%s IS NULL OR r.ring_no <= %s)
          ORDER BY mr.point_id, mr.measured_at DESC
        )
        SELECT COUNT(mp.point_id) AS point_count,
               COUNT(*) FILTER (WHERE latest.alert_level='warning') AS warning_count,
               COUNT(*) FILTER (WHERE latest.alert_level='alarm') AS alarm_count,
               COALESCE(MIN(latest.cumulative_change), 0) AS max_settlement
        FROM monitoring_point mp
        LEFT JOIN latest ON latest.point_id = mp.point_id
        WHERE mp.section_id=%s::uuid
        """,
        (sid, ring_no, ring_no, sid),
    )
    return {
        "pointCount": row.get("point_count") or 0,
        "warningCount": row.get("warning_count") or 0,
        "alarmCount": row.get("alarm_count") or 0,
        "maxSettlement": row.get("max_settlement") or 0,
    }
