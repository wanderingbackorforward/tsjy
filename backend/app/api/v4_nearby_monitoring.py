from __future__ import annotations

import json
import os
import urllib.request
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

import psycopg2
import psycopg2.extras
from fastapi import APIRouter, Query

router = APIRouter()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://shield_user:shield_pass_123@127.0.0.1:5432/shield_monitor")
LOCAL_API_BASE = os.getenv("LOCAL_PLATFORM_API_BASE", "http://127.0.0.1:8100").rstrip("/")


def norm(v: Any) -> Any:
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    return v


def conn():
    return psycopg2.connect(DATABASE_URL)


def table_columns(table: str) -> list[str]:
    try:
        with conn() as c:
            with c.cursor() as cur:
                cur.execute(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema='public' AND table_name=%s
                    ORDER BY ordinal_position
                    """,
                    (table,),
                )
                return [r[0] for r in cur.fetchall()]
    except Exception:
        return []


def first(cols: list[str], names: list[str]) -> Optional[str]:
    s = set(cols)
    for n in names:
        if n in s:
            return n
    return None


def pick(row: dict[str, Any], names: list[str], default: Any = None) -> Any:
    for n in names:
        if n in row and row.get(n) is not None:
            return row.get(n)
    return default


def to_float(v: Any) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except Exception:
        return None


def get_position_context(device_id: str) -> dict[str, Any]:
    try:
        with urllib.request.urlopen(f"{LOCAL_API_BASE}/api/position-context?deviceId={device_id}", timeout=3) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return data.get("data") or {}
    except Exception as exc:
        return {"error": str(exc)}


def cn_level(v: Any) -> str:
    s = str(v or "").strip().lower()
    if not s:
        return "待复核"
    if "报警" in s or "alarm" in s or "critical" in s or s in {"red", "danger", "3"}:
        return "报警"
    if "预警" in s or "warning" in s or "warn" in s or s in {"yellow", "orange", "2"}:
        return "预警"
    if "复核" in s or "待" in s or "confirm" in s or "unknown" in s or s in {"1"}:
        return "待复核"
    if s in {"normal", "ok", "safe", "正常", "0"}:
        return "正常"
    return str(v)


def severity_rank(v: Any) -> int:
    level = cn_level(v)
    if level == "报警":
        return 0
    if level == "预警":
        return 1
    if level == "待复核":
        return 2
    return 3


def cn_item(v: Any) -> str:
    raw = str(v or "").strip()
    mapping = {
        "surface_settlement": "地表沉降",
        "ground_settlement": "地表沉降",
        "vertical_displacement": "竖向位移",
        "horizontal_displacement": "水平位移",
        "tunnel_horizontal_displacement": "隧道水平位移",
        "tunnel_vertical_displacement": "隧道竖向位移",
        "building_vertical_displacement": "建筑物竖向位移",
        "building_settlement": "建筑物沉降",
        "pipeline_settlement": "管线沉降",
        "unknown": "待归类",
    }
    return mapping.get(raw.lower(), raw or "待归类")


def fetch_rows(table: str, limit: int) -> tuple[list[dict[str, Any]], Optional[str]]:
    cols = table_columns(table)
    if not cols:
        return [], f"{table} 表不存在或不可访问"

    time_col = first(cols, ["reading_date", "monitoring_date", "measure_date", "date", "timestamp", "time", "created_at", "updated_at"])
    order_sql = f'ORDER BY "{time_col}" DESC NULLS LAST' if time_col else ""
    try:
        with conn() as c:
            with c.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(f'SELECT * FROM "{table}" {order_sql} LIMIT %s', (limit,))
                return [{k: norm(v) for k, v in dict(r).items()} for r in cur.fetchall()], None
    except Exception as exc:
        return [], str(exc)


def point_index() -> dict[str, dict[str, Any]]:
    rows, _ = fetch_rows("monitoring_point", 6000)
    idx: dict[str, dict[str, Any]] = {}
    for r in rows:
        keys = [
            pick(r, ["point_code", "point_no", "monitoring_point_code", "code", "name"]),
            pick(r, ["point_id", "monitoring_point_id", "id"]),
        ]
        for k in keys:
            if k is not None:
                idx[str(k)] = r
    return idx


def match_point(row: dict[str, Any], idx: dict[str, dict[str, Any]]) -> dict[str, Any]:
    keys = [
        pick(row, ["point_code", "point_no", "monitoring_point_code", "code", "name"]),
        pick(row, ["point_id", "monitoring_point_id", "id"]),
    ]
    for k in keys:
        if k is not None and str(k) in idx:
            return idx[str(k)]
    return {}


@router.get("/api/monitoring/nearby-alerts")
def nearby_alerts(deviceId: str = "DZ1360", limit: int = Query(36, ge=1, le=200)):
    pos = get_position_context(deviceId)
    head_m = to_float(pos.get("headMileageM"))

    matched = pos.get("matchedRiskSources") or []
    nearest = pos.get("nearestRiskSources") or []
    matched_names = {str(x.get("riskName") or "") for x in matched if x.get("riskName")}
    nearest_names = {str(x.get("riskName") or "") for x in nearest if x.get("riskName")}
    nearest_distance = {str(x.get("riskName") or ""): to_float(x.get("distanceM")) for x in nearest if x.get("riskName")}

    readings, warning = fetch_rows("monitoring_reading", 2500)
    pidx = point_index()

    items: list[dict[str, Any]] = []
    for r in readings:
        p = match_point(r, pidx)

        point_code = (
            pick(r, ["point_code", "point_no", "monitoring_point_code", "code", "name"])
            or pick(p, ["point_code", "point_no", "monitoring_point_code", "code", "name"])
            or pick(r, ["point_id", "monitoring_point_id", "id"])
            or pick(p, ["point_id", "monitoring_point_id", "id"])
            or "--"
        )

        raw_level = pick(r, ["alert_level", "alarm_level", "level", "status", "alert_status"])
        level = cn_level(raw_level)
        # If the source explicitly says normal, skip it in alert mode.
        if raw_level is not None and level == "正常":
            continue

        raw_item = (
            pick(r, ["monitoring_item", "item_type", "item_name", "project_type", "monitor_type"])
            or pick(p, ["monitoring_item", "item_type", "item_name", "project_type", "monitor_type"])
        )

        point_m = to_float(
            pick(p, ["mileage_m", "mileage", "chainage_m", "position_m", "start_mileage_m"])
            or pick(r, ["mileage_m", "mileage", "chainage_m", "position_m"])
        )
        risk_name = (
            pick(p, ["risk_name", "risk_source_name", "associated_risk_name"])
            or pick(r, ["risk_name", "risk_source_name", "associated_risk_name"])
            or ""
        )

        distance = None
        if point_m is not None and head_m is not None:
            distance = abs(point_m - head_m)
        elif risk_name and nearest_distance.get(str(risk_name)) is not None:
            distance = nearest_distance.get(str(risk_name))

        if risk_name in matched_names:
            risk_rank = 0
            reason = "当前风险源"
        elif risk_name in nearest_names:
            risk_rank = 1
            reason = "邻近风险源"
        elif distance is not None:
            risk_rank = 2
            reason = "测点里程距离"
        else:
            risk_rank = 3
            reason = "最新异常兜底"

        latest_time = pick(r, ["reading_date", "monitoring_date", "measure_date", "date", "timestamp", "time", "created_at", "updated_at"])
        items.append(
            {
                "pointCode": point_code,
                "pointId": pick(r, ["point_id", "monitoring_point_id", "id"]),
                "monitoringItem": raw_item,
                "monitoringItemCn": cn_item(raw_item),
                "alertLevel": raw_level,
                "alertLevelCn": level if level != "正常" else "待复核",
                "latestValue": pick(r, ["cumulative_change", "cumulative_value", "change_value", "value", "reading_value", "current_value"]),
                "changeRate": pick(r, ["change_rate", "rate", "velocity"]),
                "latestTime": latest_time,
                "sourceId": pick(r, ["source_document_id", "source_id", "document_id", "evidence_id"]),
                "pointMileageM": point_m,
                "riskName": risk_name,
                "distanceM": distance,
                "rankingReason": reason,
                "_rank": (risk_rank, 1 if distance is None else 0, 10**9 if distance is None else distance, severity_rank(raw_level), str(latest_time or "")),
            }
        )

    fallback_used = False
    # If alert filtering produced nothing, use latest readings as a visible fallback.
    if not items and readings:
        fallback_used = True
        for r in readings[:100]:
            p = match_point(r, pidx)
            point_code = (
                pick(r, ["point_code", "point_no", "monitoring_point_code", "code", "name"])
                or pick(p, ["point_code", "point_no", "monitoring_point_code", "code", "name"])
                or pick(r, ["point_id", "monitoring_point_id", "id"])
                or "--"
            )
            raw_item = (
                pick(r, ["monitoring_item", "item_type", "item_name", "project_type", "monitor_type"])
                or pick(p, ["monitoring_item", "item_type", "item_name", "project_type", "monitor_type"])
            )
            point_m = to_float(
                pick(p, ["mileage_m", "mileage", "chainage_m", "position_m", "start_mileage_m"])
                or pick(r, ["mileage_m", "mileage", "chainage_m", "position_m"])
            )
            distance = abs(point_m - head_m) if point_m is not None and head_m is not None else None
            latest_time = pick(r, ["reading_date", "monitoring_date", "measure_date", "date", "timestamp", "time", "created_at", "updated_at"])
            items.append(
                {
                    "pointCode": point_code,
                    "monitoringItem": raw_item,
                    "monitoringItemCn": cn_item(raw_item),
                    "alertLevel": "latest_fallback",
                    "alertLevelCn": "待复核",
                    "latestValue": pick(r, ["cumulative_change", "cumulative_value", "change_value", "value", "reading_value", "current_value"]),
                    "latestTime": latest_time,
                    "pointMileageM": point_m,
                    "riskName": pick(p, ["risk_name", "risk_source_name", "associated_risk_name"]) or "",
                    "distanceM": distance,
                    "rankingReason": "最新读数兜底",
                    "_rank": (2 if distance is not None else 3, 1 if distance is None else 0, 10**9 if distance is None else distance, 2, str(latest_time or "")),
                }
            )

    # Ascending puts current/nearby first, distance small first, severe first.
    items.sort(key=lambda x: x["_rank"])
    for item in items:
        item.pop("_rank", None)

    selected = items[:limit]
    level_counts: dict[str, int] = {}
    item_counts: dict[str, int] = {}
    for item in items:
        level_counts[item["alertLevelCn"]] = level_counts.get(item["alertLevelCn"], 0) + 1
        item_counts[item["monitoringItemCn"]] = item_counts.get(item["monitoringItemCn"], 0) + 1

    return {
        "code": 0,
        "data": {
            "deviceId": deviceId,
            "positionContext": pos,
            "rankingMode": "当前风险源/最近风险源/测点里程距离/报警等级/最新时间",
            "headMileageM": head_m,
            "headMileageText": pos.get("headMileageText"),
            "matchedRiskSources": matched,
            "nearestRiskSources": nearest,
            "items": selected,
            "levelCounts": level_counts,
            "itemCounts": item_counts,
            "totalCandidateCount": len(items),
            "fallbackUsed": fallback_used,
            "warning": warning,
        },
    }
