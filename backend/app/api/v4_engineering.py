from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from collections import deque
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

import psycopg2
import psycopg2.extras
from fastapi import APIRouter, Query

router = APIRouter()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://shield_user:shield_pass_123@127.0.0.1:5432/shield_monitor")
TBM_RECEIVER_BASE_URL = os.getenv("TBM_RECEIVER_BASE_URL", os.getenv("TBM_API_BASE", "http://127.0.0.1:19090"))
TBM_HISTORY_JSONL = os.getenv("TBM_HISTORY_JSONL", "/opt/tbm_receiver/history.jsonl")


def norm(v: Any) -> Any:
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, datetime):
        return v.isoformat(sep=" ")
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, UUID):
        return str(v)
    if isinstance(v, list):
        return [norm(x) for x in v]
    if isinstance(v, dict):
        return {k: norm(x) for k, x in v.items()}
    return v


def conn():
    return psycopg2.connect(DATABASE_URL)


def rows(sql: str, params: tuple[Any, ...] = ()):
    with conn() as c:
        with c.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return [norm(dict(r)) for r in cur.fetchall()]


def one(sql: str, params: tuple[Any, ...] = ()):
    rs = rows(sql, params)
    return rs[0] if rs else None


def safe_rows(sql: str, params: tuple[Any, ...] = ()):
    try:
        return rows(sql, params), None
    except Exception as e:
        return [], str(e)


def safe_one(sql: str, params: tuple[Any, ...] = ()):
    try:
        return one(sql, params), None
    except Exception as e:
        return None, str(e)


def table_exists(table_name: str) -> bool:
    try:
        r = one("SELECT to_regclass(%s) AS name", (table_name,))
        return bool(r and r.get("name"))
    except Exception:
        return False


def columns(table_name: str) -> set[str]:
    rs, _ = safe_rows(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        """,
        (table_name,),
    )
    return {str(r.get("column_name")) for r in rs if r.get("column_name")}


def lim(value: int, default: int = 100, max_value: int = 2000) -> int:
    try:
        n = int(value)
    except Exception:
        n = default
    return max(1, min(n, max_value))


def proxy_json(path: str, params: dict[str, Any] | None = None, timeout: int = 5):
    params = params or {}
    qs = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    url = TBM_RECEIVER_BASE_URL.rstrip("/") + path + (("?" + qs) if qs else "")
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8")), None
    except Exception as e:
        return None, str(e)


def ok(data: Any, source: str = "v4_engineering"):
    return {"code": 0, "data": data, "source": source}


def get_nested_fields(rec: dict[str, Any]) -> dict[str, Any]:
    """
    Compatible with:
    1. {"machine": {"fields": {...}}}
    2. {"data": {"machine": {"fields": {...}}}}
    3. {"fields": {...}}
    4. {"data": {"fields": {...}}}
    """
    if not isinstance(rec, dict):
        return {}
    data = rec.get("data") if isinstance(rec.get("data"), dict) else rec
    machine = data.get("machine") if isinstance(data.get("machine"), dict) else data
    fields = machine.get("fields") if isinstance(machine.get("fields"), dict) else data.get("fields")
    return fields if isinstance(fields, dict) else {}


def get_nested_meta(rec: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(rec, dict):
        return {}
    return rec.get("data") if isinstance(rec.get("data"), dict) else rec


def flatten_tbm_record(rec: dict[str, Any], device_id: str | None = None) -> dict[str, Any] | None:
    meta = get_nested_meta(rec)
    fields = get_nested_fields(rec)
    if not fields:
        return None

    if device_id and meta.get("deviceId") not in (None, device_id):
        return None

    keys = [
        "currentRing", "hydraulicOilTemp",
        "cutterStatus", "cutterSpeed", "cutterAngle", "cutterTorque",
        "advanceStatus", "advancePumpPressure", "advanceSpeed", "penetration", "totalThrust", "advanceSpeedSet",
        "chamberPressure1", "chamberPressure2", "chamberPressure3",
        "slurryOutDensity", "slurryOutFlow", "slurryInDensity", "slurryInFlow", "slurryInPressure",
        "shieldTailGap1", "shieldTailGap2", "shieldTailGap3",
        "propelPressureA", "propelPressureB", "propelPressureC", "propelPressureD", "propelPressureE", "propelPressureF",
        "groutTotal", "segmentPosition",
    ]

    item = {
        "deviceId": meta.get("deviceId") or device_id,
        "timestamp": meta.get("timestamp"),
        "receivedAt": meta.get("receivedAt"),
    }
    for k in keys:
        f = fields.get(k)
        if isinstance(f, dict):
            item[k] = f.get("displayValue")
            item[k + "RawValue"] = f.get("rawValue")
            item[k + "Status"] = f.get("status") or f.get("decodeStatus")
            item[k + "Unit"] = f.get("unit")
    return item


@router.get("/api/tbm/latest-view")
def api_tbm_latest_view(deviceId: str = "DZ1360"):
    data, err = proxy_json("/api/tbm/latest-view", {"deviceId": deviceId})
    if data is not None:
        return data
    return {"code": 502, "message": "failed to proxy tbm latest-view from 19090", "error": err}


@router.get("/api/tbm/latest")
def api_tbm_latest(deviceId: str = "DZ1360"):
    data, err = proxy_json("/api/tbm/latest", {"deviceId": deviceId})
    if data is not None:
        return data
    return {"code": 502, "message": "failed to proxy tbm latest from 19090", "error": err}


@router.get("/api/tbm/history")
def api_tbm_history(deviceId: str = "DZ1360", limit: int = 300):
    n = lim(limit, 300, 2000)

    # Prefer receiver history API if it exists.
    proxied, _ = proxy_json("/api/tbm/history", {"deviceId": deviceId, "limit": n}, timeout=4)
    if isinstance(proxied, dict) and isinstance(proxied.get("data"), dict):
        proxied_items = proxied["data"].get("items")
        if isinstance(proxied_items, list) and proxied_items:
            return ok(
                {"deviceId": deviceId, "historySource": "tbm_receiver", "count": len(proxied_items[-n:]), "items": proxied_items[-n:]},
                "tbm_receiver",
            )

    # Then read collector JSONL.
    items: list[dict[str, Any]] = []
    if os.path.exists(TBM_HISTORY_JSONL):
        try:
            with open(TBM_HISTORY_JSONL, "r", encoding="utf-8") as f:
                lines = deque(f, maxlen=n * 5)
            for line in lines:
                try:
                    rec = json.loads(line)
                except Exception:
                    continue
                flat = flatten_tbm_record(rec, deviceId)
                if flat:
                    items.append(flat)
        except Exception:
            items = []

    if items:
        return ok({"deviceId": deviceId, "historySource": "history_jsonl", "count": len(items[-n:]), "items": items[-n:]}, "history_jsonl")

    # Last fallback: latest-view as one snapshot.
    latest, latest_err = proxy_json("/api/tbm/latest-view", {"deviceId": deviceId}, timeout=4)
    if latest is None:
        latest, latest_err = proxy_json("/api/tbm/latest", {"deviceId": deviceId}, timeout=4)
    flat = flatten_tbm_record(latest or {}, deviceId)
    if flat:
        return ok(
            {"deviceId": deviceId, "historySource": "latest_only", "count": 1, "items": [flat], "warning": "未找到历史序列，仅返回最新快照"},
            "latest_only",
        )

    return ok({"deviceId": deviceId, "historySource": "missing", "count": 0, "items": [], "warning": latest_err}, "none")


@router.get("/api/tbm/guidance/latest")
def api_tbm_guidance_latest(deviceId: str = "DZ1360"):
    data, err = proxy_json("/api/tbm/latest-view", {"deviceId": deviceId})
    if data is None:
        return {"code": 502, "message": "failed to proxy latest-view", "error": err}
    meta = get_nested_meta(data)
    guidance = meta.get("guidance")
    if guidance:
        return ok({"deviceId": deviceId, "guidanceAvailable": True, "guidance": guidance}, "Data2Client")
    return ok({"deviceId": deviceId, "guidanceAvailable": False, "fields": None, "reason": "guidance is null; guidance interface is not connected"}, "Data2Client")


@router.get("/api/risk-sources")
def api_risk_sources():
    if not table_exists("risk_source"):
        return ok({"items": [], "warning": "risk_source 表不存在"}, "db")
    sql = """
    SELECT
      rs.risk_source_id AS "riskSourceId",
      rs.section_id AS "sectionId",
      rs.risk_name AS "riskName",
      rs.risk_type AS "riskType",
      rs.crossing_relation AS "crossingRelation",
      rs.start_mileage AS "startMileage",
      rs.end_mileage AS "endMileage",
      rs.start_mileage_m AS "startMileageM",
      rs.end_mileage_m AS "endMileageM",
      rs.protection_level AS "protectionLevel",
      rs.risk_level AS "riskLevel",
      COUNT(mp.point_id) AS "monitoringPointCount",
      COUNT(mp.point_id) AS "relatedPointCount"
    FROM risk_source rs
    LEFT JOIN monitoring_point mp ON mp.risk_source_id = rs.risk_source_id
    GROUP BY rs.risk_source_id
    ORDER BY rs.start_mileage_m NULLS LAST, rs.risk_name
    """
    items, warning = safe_rows(sql)
    return ok({"items": items, "warning": warning}, "db")


def get_ring_by_no(ring: int, section_id: Optional[str] = None):
    if section_id:
        sql = """
        SELECT
          ring_id AS "ringId",
          section_id AS "sectionId",
          ring_no AS "ring",
          work_date AS "workDate",
          start_mileage AS "startMileage",
          end_mileage AS "endMileage",
          start_mileage_m AS "startMileageM",
          end_mileage_m AS "endMileageM",
          construction_stage AS "constructionStage",
          is_actual AS "isActual"
        FROM ring_mileage_map
        WHERE section_id=%s::uuid AND ring_no=%s
        ORDER BY is_actual DESC, work_date DESC NULLS LAST
        LIMIT 1
        """
        return safe_one(sql, (section_id, ring))

    sql = """
    SELECT
      ring_id AS "ringId",
      section_id AS "sectionId",
      ring_no AS "ring",
      work_date AS "workDate",
      start_mileage AS "startMileage",
      end_mileage AS "endMileage",
      start_mileage_m AS "startMileageM",
      end_mileage_m AS "endMileageM",
      construction_stage AS "constructionStage",
      is_actual AS "isActual"
    FROM ring_mileage_map
    WHERE ring_no=%s
    ORDER BY is_actual DESC, work_date DESC NULLS LAST
    LIMIT 1
    """
    return safe_one(sql, (ring,))


def get_ring_bounds(section_id: Optional[str] = None):
    if section_id:
        return safe_one('SELECT MIN(ring_no) AS "minRing", MAX(ring_no) AS "maxRing", COUNT(*) AS count FROM ring_mileage_map WHERE section_id=%s::uuid', (section_id,))
    return safe_one('SELECT MIN(ring_no) AS "minRing", MAX(ring_no) AS "maxRing", COUNT(*) AS count FROM ring_mileage_map')


def get_nearest_ring(ring: int, section_id: Optional[str] = None):
    if section_id:
        sql = """
        SELECT
          ring_no AS "ring",
          start_mileage AS "startMileage",
          end_mileage AS "endMileage",
          start_mileage_m AS "startMileageM",
          end_mileage_m AS "endMileageM",
          ABS(ring_no - %s) AS "ringDistance"
        FROM ring_mileage_map
        WHERE section_id=%s::uuid
        ORDER BY ABS(ring_no - %s)
        LIMIT 1
        """
        return safe_one(sql, (ring, section_id, ring))

    sql = """
    SELECT
      ring_no AS "ring",
      start_mileage AS "startMileage",
      end_mileage AS "endMileage",
      start_mileage_m AS "startMileageM",
      end_mileage_m AS "endMileageM",
      ABS(ring_no - %s) AS "ringDistance"
    FROM ring_mileage_map
    ORDER BY ABS(ring_no - %s)
    LIMIT 1
    """
    return safe_one(sql, (ring, ring))


@router.get("/api/ring-context")
def api_ring_context(ring: int = Query(...), sectionId: Optional[str] = None):
    if not table_exists("ring_mileage_map"):
        data = {
            "ring": ring,
            "matched": False,
            "ringContext": None,
            "riskSources": [],
            "events": [],
            "availableRange": None,
            "ringRange": None,
            "nearestRing": None,
            "nearestEngineeringRing": None,
            "reason": "ring_mileage_map_not_found",
            "message": "工程环号与 DK 里程表尚未接入",
        }
        return ok(data, "db")

    bounds, w0 = get_ring_bounds(sectionId)
    ring_row, w1 = get_ring_by_no(ring, sectionId)
    nearest, w2 = get_nearest_ring(ring, sectionId)

    if not ring_row:
        data = {
            "ring": ring,
            "matched": False,
            "ringContext": None,
            "riskSources": [],
            "events": [],
            "availableRange": bounds,
            "ringRange": bounds,
            "nearestRing": nearest,
            "nearestEngineeringRing": nearest,
            "reason": "ring_not_found_in_ring_mileage_map",
            "message": "现场 PLC 环号尚未配准到工程环号与 DK 里程",
            "warning": w1 or w0 or w2,
        }
        return ok(data, "db")

    risks, w3 = safe_rows(
        """
        SELECT
          risk_source_id AS "riskSourceId",
          risk_name AS "riskName",
          risk_type AS "riskType",
          crossing_relation AS "crossingRelation",
          start_mileage AS "startMileage",
          end_mileage AS "endMileage",
          start_mileage_m AS "startMileageM",
          end_mileage_m AS "endMileageM",
          protection_level AS "protectionLevel",
          risk_level AS "riskLevel"
        FROM risk_source
        WHERE section_id=%s::uuid
          AND start_mileage_m IS NOT NULL
          AND end_mileage_m IS NOT NULL
          AND %s >= start_mileage_m
          AND %s <= end_mileage_m
        ORDER BY start_mileage_m
        """,
        (ring_row["sectionId"], ring_row.get("endMileageM"), ring_row.get("startMileageM")),
    )

    events, w4 = safe_rows(
        """
        SELECT
          e.event_id AS "eventId",
          e.event_time AS "eventTime",
          e.event_type AS "eventType",
          e.severity,
          e.description,
          e.possible_cause AS "possibleCause",
          e.handling_action AS "handlingAction",
          e.closure_result AS "closureResult",
          e.responsible_party AS "responsibleParty",
          e.is_shutdown AS "isShutdown",
          rs.risk_name AS "riskName",
          rs.risk_type AS "riskType",
          rs.risk_level AS "riskLevel"
        FROM event_log e
        LEFT JOIN risk_source rs ON e.risk_source_id = rs.risk_source_id
        WHERE e.ring_id=%s::uuid
        ORDER BY e.event_time DESC
        """,
        (ring_row["ringId"],),
    )

    data = {
        "ring": ring,
        "matched": True,
        "ringContext": ring_row,
        "riskSources": risks,
        "events": events,
        "availableRange": bounds,
        "ringRange": bounds,
        "nearestRing": nearest,
        "nearestEngineeringRing": nearest,
        "warning": w0 or w1 or w2 or w3 or w4,
    }
    return ok(data, "db")


@router.get("/api/events")
def api_events(limit: int = 50):
    n = lim(limit, 50, 500)
    if not table_exists("event_log"):
        return ok({"items": [], "warning": "event_log 表不存在"}, "db")
    sql = """
    SELECT
      e.event_id AS "eventId",
      e.event_time AS "eventTime",
      e.event_type AS "eventType",
      e.severity,
      e.description,
      e.possible_cause AS "possibleCause",
      e.handling_action AS "handlingAction",
      e.closure_result AS "closureResult",
      e.responsible_party AS "responsibleParty",
      e.is_shutdown AS "isShutdown",
      r.ring_no AS "ringNo",
      r.start_mileage AS "startMileage",
      r.end_mileage AS "endMileage",
      rs.risk_name AS "riskName",
      rs.risk_type AS "riskType",
      rs.risk_level AS "riskLevel"
    FROM event_log e
    LEFT JOIN ring_mileage_map r ON e.ring_id = r.ring_id
    LEFT JOIN risk_source rs ON e.risk_source_id = rs.risk_source_id
    ORDER BY e.event_time DESC
    LIMIT %s
    """
    items, warning = safe_rows(sql, (n,))
    return ok({"items": items, "warning": warning}, "db")


@router.get("/api/monitoring/summary")
def api_monitoring_summary():
    total, w0 = safe_one(
        """
        SELECT
          COUNT(*) AS "totalReadingCount",
          COUNT(*) FILTER (WHERE alert_level IN ('warning','alarm')) AS "abnormalCount",
          COUNT(*) FILTER (WHERE alert_level IN ('unknown','待确认')) AS "reviewCount",
          COUNT(*) FILTER (WHERE alert_level IN ('warning','alarm','unknown','待确认')) AS "concernCount",
          COUNT(DISTINCT point_id) AS "pointCount"
        FROM monitoring_reading
        """
    )
    level_count, w1 = safe_rows(
        """
        SELECT COALESCE(alert_level, 'unknown') AS "alertLevel", COUNT(*) AS count
        FROM monitoring_reading
        WHERE COALESCE(alert_level::text, '') NOT IN ('', 'normal', '正常')
        GROUP BY alert_level
        ORDER BY COUNT(*) DESC
        """
    )
    item_count, w2 = safe_rows(
        """
        SELECT COALESCE(p.monitoring_item, '未知') AS "monitoringItem", COUNT(*) AS count
        FROM monitoring_reading r
        JOIN monitoring_point p ON r.point_id=p.point_id
        WHERE COALESCE(r.alert_level::text, '') NOT IN ('', 'normal', '正常')
        GROUP BY p.monitoring_item
        ORDER BY COUNT(*) DESC
        """
    )
    date_count, w3 = safe_rows(
        """
        SELECT r.measured_at::date::text AS "date", COUNT(*) AS count
        FROM monitoring_reading r
        WHERE COALESCE(r.alert_level::text, '') NOT IN ('', 'normal', '正常')
        GROUP BY r.measured_at::date
        ORDER BY r.measured_at::date
        """
    )
    top, w4 = safe_rows(
        """
        WITH ranked AS (
          SELECT
            p.point_code,
            p.monitoring_item,
            r.measured_at,
            r.cumulative_change,
            r.current_value,
            r.change_rate,
            r.alert_level,
            r.source_id,
            COUNT(*) OVER (PARTITION BY p.point_code, p.monitoring_item) AS abnormal_count,
            ROW_NUMBER() OVER (
              PARTITION BY p.point_code, p.monitoring_item
              ORDER BY r.measured_at DESC NULLS LAST
            ) AS rn
          FROM monitoring_reading r
          JOIN monitoring_point p ON r.point_id=p.point_id
          WHERE COALESCE(r.alert_level::text, '') NOT IN ('', 'normal', '正常')
        )
        SELECT
          point_code AS "pointCode",
          monitoring_item AS "monitoringItem",
          abnormal_count AS "abnormalCount",
          measured_at AS "latestDate",
          cumulative_change AS "latestCumulativeChange",
          current_value AS "latestCurrentValue",
          change_rate AS "latestChangeRate",
          alert_level AS "latestAlertLevel",
          source_id AS "sourceId"
        FROM ranked
        WHERE rn = 1
        ORDER BY abnormal_count DESC, latestDate DESC NULLS LAST
        LIMIT 30
        """
    )
    return ok(
        {
            "total": total or {},
            "levelCount": level_count,
            "itemCount": item_count,
            "dateCount": date_count,
            "topAlarmPoints": top,
            "warning": w0 or w1 or w2 or w3 or w4,
        },
        "db",
    )


@router.get("/api/monitoring/point-trend")
def api_point_trend(pointCode: str, item: Optional[str] = None, limit: int = 500):
    n = lim(limit, 500, 5000)
    if item:
        sql = """
        SELECT
          r.reading_id AS "readingId",
          p.point_code AS "pointCode",
          p.monitoring_item AS "monitoringItem",
          p.unit,
          p.warning_threshold AS "warningThreshold",
          p.alarm_threshold AS "alarmThreshold",
          r.measured_at AS "measuredAt",
          r.current_value AS "currentValue",
          r.cumulative_change AS "cumulativeChange",
          r.change_rate AS "changeRate",
          r.alert_level AS "alertLevel",
          r.source_id AS "sourceId"
        FROM monitoring_reading r
        JOIN monitoring_point p ON r.point_id=p.point_id
        WHERE p.point_code=%s AND p.monitoring_item=%s
        ORDER BY r.measured_at
        LIMIT %s
        """
        params = (pointCode, item, n)
    else:
        sql = """
        SELECT
          r.reading_id AS "readingId",
          p.point_code AS "pointCode",
          p.monitoring_item AS "monitoringItem",
          p.unit,
          p.warning_threshold AS "warningThreshold",
          p.alarm_threshold AS "alarmThreshold",
          r.measured_at AS "measuredAt",
          r.current_value AS "currentValue",
          r.cumulative_change AS "cumulativeChange",
          r.change_rate AS "changeRate",
          r.alert_level AS "alertLevel",
          r.source_id AS "sourceId"
        FROM monitoring_reading r
        JOIN monitoring_point p ON r.point_id=p.point_id
        WHERE p.point_code=%s
        ORDER BY r.measured_at
        LIMIT %s
        """
        params = (pointCode, n)
    items, warning = safe_rows(sql, params)
    return ok({"pointCode": pointCode, "item": item, "count": len(items), "items": items, "warning": warning}, "db")


@router.get("/api/evidence/by-reading")
def api_evidence_by_reading(readingId: str):
    # Prefer staging evidence if present.
    if table_exists("stg_file_extraction_evidence"):
        items, warning = safe_rows(
            """
            SELECT
              evidence_id AS "evidenceId",
              source_document_id AS "sourceDocumentId",
              related_table AS "relatedTable",
              related_key AS "relatedKey",
              file_name AS "fileName",
              page_no AS "pageNo",
              table_index AS "tableIndex",
              row_index AS "rowIndex",
              raw_text AS "rawText",
              extraction_method AS "extractionMethod",
              confidence,
              created_at AS "createdAt"
            FROM stg_file_extraction_evidence
            WHERE related_table='monitoring_reading' AND related_key=%s
            ORDER BY page_no NULLS LAST, row_index NULLS LAST
            """,
            (readingId,),
        )
        if items or warning:
            return ok({"readingId": readingId, "items": items, "evidenceLevel": "row" if items else "source_only", "warning": warning}, "file_staging")

    # Fallback to formal extraction_evidence.
    if table_exists("extraction_evidence"):
        cols = columns("extraction_evidence")
        if "related_key" in cols and "related_table" in cols:
            sql = """
            SELECT
              e.evidence_id AS "evidenceId",
              e.source_id AS "sourceId",
              sd.file_name AS "fileName",
              sd.file_type AS "fileType",
              sd.document_date AS "documentDate",
              e.page_no AS "pageNo",
              e.table_index AS "tableIndex",
              e.row_index AS "rowIndex",
              e.raw_text AS "rawText",
              e.extraction_method AS "extractionMethod",
              e.confidence,
              e.created_at AS "createdAt"
            FROM extraction_evidence e
            LEFT JOIN source_document sd ON e.source_id = sd.source_id
            WHERE e.related_table='monitoring_reading' AND e.related_key=%s
            ORDER BY e.page_no NULLS LAST, e.row_index NULLS LAST
            LIMIT 80
            """
            items, warning = safe_rows(sql, (readingId,))
            return ok({"readingId": readingId, "items": items, "evidenceLevel": "row" if items else "source_only", "warning": warning}, "db")

    return ok({"readingId": readingId, "items": [], "evidenceLevel": "source_only", "warning": "未找到行级证据表或匹配记录"}, "db")


@router.get("/api/documents/{sourceId}/pages")
def api_document_pages(sourceId: str):
    if not table_exists("stg_file_extracted_page"):
        return ok({"sourceId": sourceId, "items": [], "warning": "stg_file_extracted_page 表不存在"}, "file_staging")
    items, warning = safe_rows(
        """
        SELECT
          source_document_id AS "sourceDocumentId",
          file_name AS "fileName",
          page_no AS "pageNo",
          sheet_name AS "sheetName",
          content_type AS "contentType",
          extraction_status AS "extractionStatus",
          extraction_error AS "extractionError",
          CASE WHEN table_json IS NULL THEN false ELSE true END AS "hasTableJson"
        FROM stg_file_extracted_page
        WHERE source_document_id=%s
        ORDER BY page_no NULLS LAST
        """,
        (sourceId,),
    )
    return ok({"sourceId": sourceId, "items": items, "warning": warning}, "file_staging")


@router.get("/api/documents/{sourceId}/pages/{pageNo}")
def api_document_page(sourceId: str, pageNo: int):
    if not table_exists("stg_file_extracted_page"):
        return {"code": 404, "data": None, "warning": "stg_file_extracted_page 表不存在", "source": "file_staging"}
    item, warning = safe_one(
        """
        SELECT
          source_document_id AS "sourceDocumentId",
          file_name AS "fileName",
          page_no AS "pageNo",
          sheet_name AS "sheetName",
          content_type AS "contentType",
          raw_text AS "rawText",
          table_json AS "tableJson",
          extraction_status AS "extractionStatus",
          extraction_error AS "extractionError"
        FROM stg_file_extracted_page
        WHERE source_document_id=%s AND page_no=%s
        LIMIT 1
        """,
        (sourceId, pageNo),
    )
    return {"code": 0 if item else 404, "data": item, "warning": warning, "source": "file_staging"}


@router.get("/api/data-gaps")
def api_data_gaps(deviceId: str = "DZ1360"):
    latest, _ = proxy_json("/api/tbm/latest-view", {"deviceId": deviceId})
    current_ring = None
    if latest:
        fields = get_nested_fields(latest)
        current_ring = (fields.get("currentRing") or {}).get("displayValue")

    matched = False
    if current_ring is not None and table_exists("ring_mileage_map"):
        row, _ = safe_one("SELECT ring_no FROM ring_mileage_map WHERE ring_no=%s LIMIT 1", (int(current_ring),))
        matched = bool(row)

    coverage = {}
    if table_exists("monitoring_point"):
        mp_cols = columns("monitoring_point")
        select_parts = ["COUNT(*) AS total"]
        if "mileage" in mp_cols:
            select_parts.append('COUNT(mileage) AS "mileageCount"')
        else:
            select_parts.append('0 AS "mileageCount"')
        if "mileage_m" in mp_cols:
            select_parts.append('COUNT(mileage_m) AS "mileageMCount"')
        else:
            select_parts.append('0 AS "mileageMCount"')
        if "relative_position" in mp_cols:
            select_parts.append('COUNT(relative_position) AS "relativePositionCount"')
        else:
            select_parts.append('0 AS "relativePositionCount"')
        if "geom" in mp_cols:
            select_parts.append('COUNT(geom) AS "geomCount"')
        else:
            select_parts.append('0 AS "geomCount"')
        coverage, _ = safe_one("SELECT " + ", ".join(select_parts) + " FROM monitoring_point")

    return ok(
        {
            "guidance": {"available": False, "reason": "guidance is null"},
            "realtimeRingMapping": {
                "available": matched,
                "currentRing": current_ring,
                "reason": None if matched else "currentRing does not exist in ring_mileage_map",
            },
            "monitoringLocation": {"available": "partial", "coverage": coverage or {}},
        },
        "db",
    )
