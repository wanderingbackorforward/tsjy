from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

import psycopg2
import psycopg2.extras
from fastapi import APIRouter, Query

router = APIRouter()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://shield_user:shield_pass_123@127.0.0.1:5432/shield_monitor")
DEFAULT_SECTION_ID = os.getenv("DEFAULT_SECTION_ID", "").strip() or None
TBM_RECEIVER_BASE_URL = os.getenv("TBM_RECEIVER_BASE_URL", "http://127.0.0.1:19090").rstrip("/")
TBM_TIMEOUT_SECONDS = float(os.getenv("TBM_TIMEOUT_SECONDS", "3"))


def norm(v: Any) -> Any:
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (datetime, date)):
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


def rows(sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    with conn() as c:
        with c.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return [norm(dict(r)) for r in cur.fetchall()]


def one(sql: str, params: tuple[Any, ...] = ()) -> Optional[dict[str, Any]]:
    rs = rows(sql, params)
    return rs[0] if rs else None


def safe_rows(sql: str, params: tuple[Any, ...] = ()) -> tuple[list[dict[str, Any]], Optional[str]]:
    try:
        return rows(sql, params), None
    except Exception as exc:
        return [], str(exc)


def safe_one(sql: str, params: tuple[Any, ...] = ()) -> tuple[Optional[dict[str, Any]], Optional[str]]:
    try:
        return one(sql, params), None
    except Exception as exc:
        return None, str(exc)


def proxy_json(path: str, params: dict[str, Any] | None = None, timeout: float | None = None) -> tuple[Optional[dict[str, Any]], Optional[str]]:
    params = params or {}
    qs = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    url = TBM_RECEIVER_BASE_URL + path
    if qs:
        url += "?" + qs
    try:
        with urllib.request.urlopen(url, timeout=timeout or TBM_TIMEOUT_SECONDS) as resp:
            return json.loads(resp.read().decode("utf-8")), None
    except Exception as exc:
        return None, str(exc)


def dk_text(m: Any) -> Optional[str]:
    if m is None:
        return None
    try:
        x = float(m)
    except Exception:
        return None
    km = int(x // 1000)
    meter = x - km * 1000
    if abs(meter - round(meter)) < 0.005:
        return f"DK{km}+{int(round(meter)):03d}"
    return f"DK{km}+{meter:06.2f}"



def guidance_field(guidance_data: dict[str, Any], key: str) -> Optional[dict[str, Any]]:
    f = ((guidance_data or {}).get("fields") or {}).get(key)
    if not isinstance(f, dict):
        return None
    return {
        "key": key,
        "nameCn": f.get("nameCn") or f.get("name") or key,
        "value": f.get("displayValue"),
        "rawValue": f.get("rawValue"),
        "unit": f.get("unit") or "",
        "status": f.get("status") or "guidance_table",
    }


def compact_guidance_metrics(guidance_data: dict[str, Any]) -> dict[str, Any]:
    keys = [
        "headHorizontalOffset", "headVerticalOffset",
        "middleHorizontalOffset", "middleVerticalOffset",
        "tailHorizontalOffset", "tailVerticalOffset",
        "roll", "pitch", "horizontalTrend", "verticalTrend",
        "tunnelHorizontalTrend", "tunnelVerticalTrend",
        "graphicsHorizontalTrend", "graphicsVerticalTrend",
    ]
    return {k: guidance_field(guidance_data, k) for k in keys if guidance_field(guidance_data, k) is not None}


def prediction_offsets(guidance_data: dict[str, Any]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for i in range(1, 6):
        h = guidance_field(guidance_data, f"next{i}mHorizontalOffset")
        v = guidance_field(guidance_data, f"next{i}mVerticalOffset")
        items.append({
            "distanceM": i,
            "horizontalOffset": h,
            "verticalOffset": v,
        })
    return items

def section_clause(section_id: Optional[str]) -> tuple[str, tuple[Any, ...]]:
    if section_id:
        return " AND section_id=%s::uuid ", (section_id,)
    return "", ()


@router.get("/api/tbm/guidance/schema")
def guidance_schema():
    data, err = proxy_json("/api/tbm/guidance/schema")
    if data is not None:
        return data
    return {"code": 502, "message": "failed to proxy guidance schema", "error": err}


@router.get("/api/tbm/guidance/latest")
def guidance_latest(deviceId: str = "DZ1360"):
    data, err = proxy_json("/api/tbm/guidance/latest", {"deviceId": deviceId})
    if data is not None:
        return data
    return {"code": 502, "message": "failed to proxy guidance latest", "error": err}


@router.get("/api/position-context")
def position_context(deviceId: str = "DZ1360", sectionId: Optional[str] = Query(DEFAULT_SECTION_ID)):
    guidance, g_err = proxy_json("/api/tbm/guidance/latest", {"deviceId": deviceId})
    guidance_data = (guidance or {}).get("data") or {}
    position = guidance_data.get("position") or {}

    head_mileage = position.get("headMileageM")
    middle_mileage = position.get("middleMileageM")
    tail_mileage = position.get("tailMileageM")
    live_guidance_ok = bool(guidance_data.get("guidanceAvailable") and head_mileage is not None)

    if live_guidance_ok:
        sec_sql, sec_params = section_clause(sectionId)

        risks, risk_warning = safe_rows(
            f"""
            SELECT risk_source_id AS "riskSourceId", section_id AS "sectionId",
                   risk_name AS "riskName", risk_type AS "riskType",
                   crossing_relation AS "crossingRelation",
                   start_mileage AS "startMileage", end_mileage AS "endMileage",
                   start_mileage_m AS "startMileageM", end_mileage_m AS "endMileageM",
                   protection_level AS "protectionLevel", risk_level AS "riskLevel"
            FROM risk_source
            WHERE start_mileage_m IS NOT NULL AND end_mileage_m IS NOT NULL
              {sec_sql}
              AND %s >= start_mileage_m AND %s <= end_mileage_m
            ORDER BY start_mileage_m
            """,
            (*sec_params, head_mileage, head_mileage),
        )

        nearest_risks, nearest_warning = safe_rows(
            f"""
            SELECT risk_source_id AS "riskSourceId", section_id AS "sectionId",
                   risk_name AS "riskName", risk_type AS "riskType",
                   start_mileage AS "startMileage", end_mileage AS "endMileage",
                   start_mileage_m AS "startMileageM", end_mileage_m AS "endMileageM",
                   protection_level AS "protectionLevel", risk_level AS "riskLevel",
                   LEAST(ABS(%s - start_mileage_m), ABS(%s - end_mileage_m)) AS "distanceM"
            FROM risk_source
            WHERE start_mileage_m IS NOT NULL AND end_mileage_m IS NOT NULL
              {sec_sql}
            ORDER BY LEAST(ABS(%s - start_mileage_m), ABS(%s - end_mileage_m))
            LIMIT 5
            """,
            (head_mileage, head_mileage, *sec_params, head_mileage, head_mileage),
        )

        ring, ring_warning = safe_one(
            f"""
            SELECT ring_id AS "ringId", section_id AS "sectionId",
                   ring_no AS "ringNo", work_date AS "workDate",
                   start_mileage AS "startMileage", end_mileage AS "endMileage",
                   start_mileage_m AS "startMileageM", end_mileage_m AS "endMileageM",
                   construction_stage AS "constructionStage", is_actual AS "isActual"
            FROM ring_mileage_map
            WHERE start_mileage_m IS NOT NULL AND end_mileage_m IS NOT NULL
              {sec_sql}
              AND %s >= start_mileage_m AND %s <= end_mileage_m
            ORDER BY is_actual DESC, ring_no DESC
            LIMIT 1
            """,
            (*sec_params, head_mileage, head_mileage),
        )

        return {
            "code": 0,
            "data": {
                "deviceId": deviceId,
                "matched": True,
                "positionSource": "guidance",
                "positionConfidence": "live_guidance_frame",
                "headMileageM": head_mileage,
                "headMileageText": position.get("headMileageText") or dk_text(head_mileage),
                "middleMileageM": middle_mileage,
                "middleMileageText": position.get("middleMileageText") or dk_text(middle_mileage),
                "tailMileageM": tail_mileage,
                "tailMileageText": position.get("tailMileageText") or dk_text(tail_mileage),
                "guidanceRing": position.get("guidanceRing"),
                "accumulatedMileageM": position.get("accumulatedMileageM"),
                "accumulatedMileageText": position.get("accumulatedMileageText"),
                "engineeringRing": ring,
                "matchedRiskSources": risks,
                "nearestRiskSources": nearest_risks,
                "guidanceMetrics": compact_guidance_metrics(guidance_data),
                "predictionOffsets": prediction_offsets(guidance_data),
                "guidance": guidance_data,
                "warning": risk_warning or nearest_warning or ring_warning,
            },
        }

    latest, l_err = proxy_json("/api/tbm/latest-view", {"deviceId": deviceId})
    fields = (((latest or {}).get("data") or {}).get("machine") or {}).get("fields") or {}
    current_ring = (fields.get("currentRing") or {}).get("displayValue")

    ring = None
    ring_warning = None
    if current_ring is not None:
        sec_sql, sec_params = section_clause(sectionId)
        ring, ring_warning = safe_one(
            f"""
            SELECT ring_id AS "ringId", section_id AS "sectionId",
                   ring_no AS "ringNo", work_date AS "workDate",
                   start_mileage AS "startMileage", end_mileage AS "endMileage",
                   start_mileage_m AS "startMileageM", end_mileage_m AS "endMileageM"
            FROM ring_mileage_map
            WHERE ring_no=%s {sec_sql}
            ORDER BY is_actual DESC, work_date DESC NULLS LAST
            LIMIT 1
            """,
            (int(current_ring), *sec_params),
        )

    return {
        "code": 0,
        "data": {
            "deviceId": deviceId,
            "matched": bool(ring),
            "positionSource": "guidance_missing_fallback_current_ring",
            "positionConfidence": "fallback_only",
            "currentRing": current_ring,
            "engineeringRing": ring,
            "matchedRiskSources": [],
            "nearestRiskSources": [],
            "reason": None if ring else "guidance mileage missing and currentRing is not mapped to engineering ring mileage",
            "guidanceError": g_err,
            "latestViewError": l_err,
            "warning": ring_warning,
        },
    }
