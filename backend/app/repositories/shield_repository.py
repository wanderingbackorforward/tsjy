from app.core.config import get_settings
from app.core.database import fetch_all, fetch_one


def to_operation(row: dict | None) -> dict | None:
    if not row:
        return None
    return {
        "operationId": str(row["operation_id"]),
        "ringNo": row.get("ring_no"),
        "recordedAt": row.get("recorded_at"),
        "advanceSpeed": row.get("advance_speed"),
        "facePressure": row.get("face_pressure"),
        "totalThrust": row.get("total_thrust"),
        "cutterTorque": row.get("cutter_torque"),
        "cutterRotationSpeed": row.get("cutter_rotation_speed"),
        "penetration": row.get("penetration"),
        "alertLevel": row.get("alert_level") or "unknown",
    }


def get_operation_by_ring(section_id: str, ring_no: int) -> dict | None:
    row = fetch_one(
        "SELECT * FROM shield_ring_operation WHERE section_id=%s::uuid AND ring_no=%s LIMIT 1",
        (section_id, ring_no),
    )
    return to_operation(row)


def list_operations(section_id: str | None = None, start_ring: int = 320, end_ring: int = 392) -> list[dict]:
    sid = section_id or get_settings().default_section_id
    rows = fetch_all(
        """
        SELECT * FROM shield_ring_operation
        WHERE section_id=%s::uuid AND ring_no BETWEEN %s AND %s
        ORDER BY ring_no
        """,
        (sid, start_ring, end_ring),
    )
    return [to_operation(row) for row in rows if row]
