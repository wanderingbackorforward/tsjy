from app.core.config import get_settings
from app.core.database import fetch_all


def list_events(section_id: str | None = None, limit: int = 20, ring_no: int | None = None, window: int = 8) -> list[dict]:
    sid = section_id or get_settings().default_section_id
    if ring_no is None:
        rows = fetch_all(
            """
            SELECT e.*, r.ring_no, rs.risk_name
            FROM event_log e
            LEFT JOIN ring_mileage_map r ON r.ring_id = e.ring_id
            LEFT JOIN risk_source rs ON rs.risk_source_id = e.risk_source_id
            WHERE e.section_id=%s::uuid
            ORDER BY e.event_time DESC LIMIT %s
            """,
            (sid, limit),
        )
    else:
        rows = fetch_all(
            """
            SELECT e.*, r.ring_no, rs.risk_name, ABS(r.ring_no - %s) AS ring_distance
            FROM event_log e
            LEFT JOIN ring_mileage_map r ON r.ring_id = e.ring_id
            LEFT JOIN risk_source rs ON rs.risk_source_id = e.risk_source_id
            WHERE e.section_id=%s::uuid AND (r.ring_no IS NULL OR ABS(r.ring_no - %s) <= %s)
            ORDER BY ring_distance NULLS LAST, e.event_time DESC LIMIT %s
            """,
            (ring_no, sid, ring_no, window, limit),
        )
    return [{
        "eventId": str(row["event_id"]),
        "ringNo": row.get("ring_no"),
        "riskName": row.get("risk_name"),
        "eventTime": row.get("event_time"),
        "eventType": row.get("event_type"),
        "severity": row.get("severity") or "info",
        "description": row.get("description"),
        "possibleCause": row.get("possible_cause"),
        "handlingAction": row.get("handling_action"),
        "closureResult": row.get("closure_result"),
        "responsibleParty": row.get("responsible_party"),
    } for row in rows]
