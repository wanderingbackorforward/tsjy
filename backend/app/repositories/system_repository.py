from app.core.database import fetch_all, fetch_one
from app.core.config import get_settings

CORE_TABLES = [
    "source_document", "import_batch", "import_raw_row", "field_mapping",
    "project", "tunnel_section", "ring_mileage_map", "risk_source",
    "monitoring_point", "monitoring_reading", "shield_ring_operation",
    "slurry_record", "grouting_record", "event_log"
]


def table_counts() -> list[dict]:
    items = []
    for table in CORE_TABLES:
        try:
            row = fetch_one(f"SELECT COUNT(*) AS count FROM {table}")
            items.append({"tableName": table, "rowCount": row["count"], "status": "ok"})
        except Exception as exc:
            items.append({"tableName": table, "rowCount": 0, "status": "error", "message": str(exc)})
    return items


def data_quality() -> dict:
    counts = {item["tableName"]: item["rowCount"] for item in table_counts()}
    checks = [
        {"key": "ring_mileage", "name": "环号-里程主轴", "ok": counts.get("ring_mileage_map", 0) > 0, "count": counts.get("ring_mileage_map", 0)},
        {"key": "risk_source", "name": "风险源台账", "ok": counts.get("risk_source", 0) > 0, "count": counts.get("risk_source", 0)},
        {"key": "shield_operation", "name": "盾构掘进参数", "ok": counts.get("shield_ring_operation", 0) > 0, "count": counts.get("shield_ring_operation", 0)},
        {"key": "monitoring", "name": "监测点与监测读数", "ok": counts.get("monitoring_point", 0) > 0 and counts.get("monitoring_reading", 0) > 0, "count": counts.get("monitoring_reading", 0)},
        {"key": "event", "name": "事件与报警", "ok": counts.get("event_log", 0) > 0, "count": counts.get("event_log", 0)},
    ]
    return {"checks": checks, "readyScore": round(sum(1 for c in checks if c["ok"]) / len(checks) * 100)}


def status() -> dict:
    return {
        "mode": "database-postgresql-v2",
        "sectionId": get_settings().default_section_id,
        "currentRingNo": get_settings().current_ring_no,
        "tableCounts": table_counts(),
        "dataQuality": data_quality(),
    }
