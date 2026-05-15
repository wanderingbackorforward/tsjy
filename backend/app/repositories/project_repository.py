from app.core.database import fetch_one
from app.core.config import get_settings


def get_project_summary(section_id: str | None = None) -> dict | None:
    settings = get_settings()
    sid = section_id or settings.default_section_id
    row = fetch_one(
        """
        SELECT p.project_id, p.project_name, p.contractor_name,
               ts.section_id, ts.section_name, ts.start_mileage, ts.end_mileage,
               ts.length_m, ts.tunnel_form, ts.design_speed_kmh, ts.max_burial_depth_m
        FROM project p
        JOIN tunnel_section ts ON ts.project_id = p.project_id
        WHERE ts.section_id = %s::uuid
        LIMIT 1
        """,
        (sid,),
    )
    if not row:
        return None
    return {
        "projectId": str(row["project_id"]),
        "projectName": row["project_name"],
        "contractorName": row.get("contractor_name"),
        "sectionId": str(row["section_id"]),
        "sectionName": row["section_name"],
        "startMileage": row.get("start_mileage"),
        "endMileage": row.get("end_mileage"),
        "lengthM": row.get("length_m"),
        "tunnelForm": row.get("tunnel_form"),
        "designSpeedKmh": row.get("design_speed_kmh"),
        "maxBurialDepthM": row.get("max_burial_depth_m"),
    }
