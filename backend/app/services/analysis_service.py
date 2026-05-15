import os
import math
from datetime import datetime, timedelta, date
from decimal import Decimal
from statistics import mean
from typing import Any, Dict, List, Optional, Tuple

import psycopg2
import psycopg2.extras

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://shield_user:shield_pass_123@127.0.0.1:5432/shield_monitor",
)
DEFAULT_SECTION_ID = os.getenv("DEFAULT_SECTION_ID", "33333333-3333-3333-3333-333333333333")
CURRENT_RING_NO = int(os.getenv("CURRENT_RING_NO", "336"))


def _conn():
    return psycopg2.connect(DATABASE_URL)


def _one(sql: str, params: Tuple[Any, ...] = ()) -> Optional[Dict[str, Any]]:
    with _conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            return dict(row) if row else None


def _all(sql: str, params: Tuple[Any, ...] = ()) -> List[Dict[str, Any]]:
    with _conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]


def _num(v: Any) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(v)
    except Exception:
        return None


def _iso(v: Any) -> Optional[str]:
    if v is None:
        return None
    if hasattr(v, "isoformat"):
        return v.isoformat()
    return str(v)


def _safe_mean(values: List[Optional[float]]) -> Optional[float]:
    clean = [v for v in values if v is not None]
    return round(mean(clean), 3) if clean else None


def _pct_delta(current: Optional[float], base: Optional[float]) -> Optional[float]:
    if current is None or base is None or abs(base) < 1e-9:
        return None
    return round((current - base) / abs(base) * 100, 2)


def _level_from_score(score: float) -> str:
    if score >= 80:
        return "critical"
    if score >= 60:
        return "high"
    if score >= 35:
        return "medium"
    return "low"


def _level_cn(level: str) -> str:
    return {
        "normal": "正常",
        "low": "低",
        "medium": "中",
        "high": "高",
        "critical": "严重",
        "warning": "预警",
        "alarm": "报警",
        "info": "提示",
    }.get(level, level)


def get_section(section_id: str = DEFAULT_SECTION_ID) -> Dict[str, Any]:
    row = _one(
        """
        SELECT p.project_id, p.project_name, p.contractor_name,
               ts.section_id, ts.section_name, ts.start_mileage, ts.end_mileage,
               ts.length_m, ts.tunnel_form, ts.design_speed_kmh, ts.max_burial_depth_m
        FROM tunnel_section ts
        JOIN project p ON p.project_id = ts.project_id
        WHERE ts.section_id = %s::uuid
        LIMIT 1
        """,
        (section_id,),
    ) or {}
    return {
        "projectId": str(row.get("project_id", "")),
        "projectName": row.get("project_name") or "盾构监控项目",
        "contractorName": row.get("contractor_name"),
        "sectionId": str(row.get("section_id", section_id)),
        "sectionName": row.get("section_name") or "盾构区间",
        "startMileage": row.get("start_mileage"),
        "endMileage": row.get("end_mileage"),
        "lengthM": _num(row.get("length_m")),
        "tunnelForm": row.get("tunnel_form"),
        "designSpeedKmh": _num(row.get("design_speed_kmh")),
        "maxBurialDepthM": _num(row.get("max_burial_depth_m")),
    }


def get_ring(section_id: str, ring_no: int) -> Optional[Dict[str, Any]]:
    row = _one(
        """
        SELECT * FROM ring_mileage_map
        WHERE section_id=%s::uuid AND ring_no=%s
        LIMIT 1
        """,
        (section_id, ring_no),
    )
    if not row:
        return None
    return {
        "ringId": str(row["ring_id"]),
        "sectionId": str(row["section_id"]),
        "ringNo": int(row["ring_no"]),
        "workDate": _iso(row.get("work_date")),
        "startMileage": row.get("start_mileage"),
        "endMileage": row.get("end_mileage"),
        "startMileageM": _num(row.get("start_mileage_m")),
        "endMileageM": _num(row.get("end_mileage_m")),
        "constructionStage": row.get("construction_stage"),
        "isActual": bool(row.get("is_actual")),
    }


def get_current_ring(section_id: str = DEFAULT_SECTION_ID) -> Optional[Dict[str, Any]]:
    return get_ring(section_id, CURRENT_RING_NO) or _latest_ring(section_id)


def _latest_ring(section_id: str) -> Optional[Dict[str, Any]]:
    row = _one(
        """
        SELECT ring_no FROM ring_mileage_map
        WHERE section_id=%s::uuid
        ORDER BY ring_no DESC LIMIT 1
        """,
        (section_id,),
    )
    return get_ring(section_id, int(row["ring_no"])) if row else None


def get_operation(section_id: str, ring_no: int) -> Optional[Dict[str, Any]]:
    row = _one(
        """
        SELECT * FROM shield_ring_operation
        WHERE section_id=%s::uuid AND ring_no=%s
        ORDER BY recorded_at DESC NULLS LAST
        LIMIT 1
        """,
        (section_id, ring_no),
    )
    if not row:
        return None
    return _operation_api(row)


def _operation_api(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "operationId": str(row.get("operation_id")),
        "ringNo": int(row.get("ring_no")),
        "recordedAt": _iso(row.get("recorded_at")),
        "advanceSpeed": _num(row.get("advance_speed")),
        "facePressure": _num(row.get("face_pressure")),
        "totalThrust": _num(row.get("total_thrust")),
        "cutterTorque": _num(row.get("cutter_torque")),
        "cutterRotationSpeed": _num(row.get("cutter_rotation_speed")),
        "penetration": _num(row.get("penetration")),
        "slurryInFlow": _num(row.get("slurry_in_flow")),
        "slurryOutFlow": _num(row.get("slurry_out_flow")),
        "slurryInDensity": _num(row.get("slurry_in_density")),
        "slurryOutDensity": _num(row.get("slurry_out_density")),
        "alertLevel": row.get("alert_level") or "normal",
    }


def operation_window(section_id: str, ring_no: int, before: int = 30, after: int = 0) -> List[Dict[str, Any]]:
    rows = _all(
        """
        SELECT * FROM shield_ring_operation
        WHERE section_id=%s::uuid AND ring_no BETWEEN %s AND %s
        ORDER BY ring_no
        """,
        (section_id, max(1, ring_no - before), ring_no + after),
    )
    return [_operation_api(r) for r in rows]


def risk_sources_for_mileage(section_id: str, mileage_m: Optional[float]) -> List[Dict[str, Any]]:
    rows = _all(
        """
        SELECT rs.*, COUNT(mp.point_id) AS monitoring_point_count
        FROM risk_source rs
        LEFT JOIN monitoring_point mp ON mp.risk_source_id = rs.risk_source_id
        WHERE rs.section_id=%s::uuid
        GROUP BY rs.risk_source_id
        ORDER BY rs.start_mileage_m
        """,
        (section_id,),
    )
    result = []
    for r in rows:
        start_m = _num(r.get("start_mileage_m"))
        end_m = _num(r.get("end_mileage_m"))
        status = "normal"
        distance = None
        influence = "outside"
        if mileage_m is not None and start_m is not None and end_m is not None:
            if start_m <= mileage_m <= end_m:
                status, influence, distance = "inside", "inside", 0
            elif 0 <= start_m - mileage_m <= 100:
                status, influence, distance = "approaching", "front_100m", round(start_m - mileage_m, 2)
            elif 0 <= mileage_m - end_m <= 100:
                status, influence, distance = "leaving", "post_100m", round(mileage_m - end_m, 2)
            elif mileage_m > end_m:
                status, influence, distance = "passed", "passed", round(mileage_m - end_m, 2)
            else:
                distance = round(start_m - mileage_m, 2)
        result.append({
            "riskSourceId": str(r.get("risk_source_id")),
            "riskName": r.get("risk_name"),
            "riskType": r.get("risk_type"),
            "crossingRelation": r.get("crossing_relation"),
            "startMileage": r.get("start_mileage"),
            "endMileage": r.get("end_mileage"),
            "startMileageM": start_m,
            "endMileageM": end_m,
            "riskLevel": r.get("risk_level") or "medium",
            "protectionLevel": r.get("protection_level"),
            "minHorizontalDistanceM": _num(r.get("min_horizontal_distance_m")),
            "minVerticalDistanceM": _num(r.get("min_vertical_distance_m")),
            "monitoringPointCount": int(r.get("monitoring_point_count") or 0),
            "status": status,
            "influenceWindow": influence,
            "distanceToCurrentMileageM": distance,
        })
    return result


def active_risks(section_id: str, mileage_m: Optional[float]) -> List[Dict[str, Any]]:
    return [r for r in risk_sources_for_mileage(section_id, mileage_m) if r["status"] in ("approaching", "inside", "leaving")]


# scheme-derived demo baselines; later can be replaced by planned_parameter_baseline table.
def baseline_for_ring(ring_no: int) -> Dict[str, Dict[str, Any]]:
    if 1 <= ring_no <= 50:
        stage = "试掘进基准"
        return {
            "stage": {"label": stage},
            "facePressure": {"min": 0.17, "max": 0.54, "unit": "bar", "source": "试掘进方案"},
            "advanceSpeed": {"min": 0, "max": 5.0, "unit": "mm/min", "source": "试掘进方案"},
            "totalThrust": {"min": 30000, "max": 40000, "unit": "kN", "source": "试掘进方案折算"},
            "cutterTorque": {"min": 12000, "max": 22000, "unit": "kN·m", "source": "设备能力与试掘进经验"},
            "slurryInDensity": {"min": 1.08, "max": 1.12, "unit": "g/cm³", "source": "泥水指标"},
            "slurryOutDensity": {"min": 1.15, "max": 1.20, "unit": "g/cm³", "source": "泥水指标"},
        }
    if 322 <= ring_no <= 392:
        stage = "下穿京沪高铁及阳澄环路控制基准"
        return {
            "stage": {"label": stage},
            "facePressure": {"min": 0.35, "max": 0.58, "unit": "bar", "source": "风险源穿越控制基准"},
            "advanceSpeed": {"min": 2.0, "max": 5.0, "unit": "mm/min", "source": "慢速均衡掘进"},
            "totalThrust": {"min": 32000, "max": 43000, "unit": "kN", "source": "风险源穿越经验基准"},
            "cutterTorque": {"min": 14000, "max": 24000, "unit": "kN·m", "source": "设备负载控制"},
            "slurryInDensity": {"min": 1.08, "max": 1.12, "unit": "g/cm³", "source": "泥水指标"},
            "slurryOutDensity": {"min": 1.15, "max": 1.25, "unit": "g/cm³", "source": "泥水指标"},
        }
    return {
        "stage": {"label": "正常掘进参考基准"},
        "facePressure": {"min": 0.25, "max": 0.62, "unit": "bar", "source": "正常掘进参考"},
        "advanceSpeed": {"min": 3.0, "max": 8.0, "unit": "mm/min", "source": "正常掘进参考"},
        "totalThrust": {"min": 28000, "max": 43000, "unit": "kN", "source": "正常掘进参考"},
        "cutterTorque": {"min": 12000, "max": 24000, "unit": "kN·m", "source": "正常掘进参考"},
        "slurryInDensity": {"min": 1.08, "max": 1.12, "unit": "g/cm³", "source": "泥水指标"},
        "slurryOutDensity": {"min": 1.15, "max": 1.25, "unit": "g/cm³", "source": "泥水指标"},
    }


def parameter_deviation(operation: Optional[Dict[str, Any]], window: List[Dict[str, Any]], ring_no: int) -> List[Dict[str, Any]]:
    if not operation:
        return []
    baseline = baseline_for_ring(ring_no)
    fields = [
        ("facePressure", "切口压力"),
        ("advanceSpeed", "推进速度"),
        ("totalThrust", "总推力"),
        ("cutterTorque", "刀盘扭矩"),
        ("slurryInDensity", "进浆比重"),
        ("slurryOutDensity", "出浆比重"),
    ]
    result = []
    for key, label in fields:
        current = operation.get(key)
        b = baseline.get(key)
        win10 = window[-10:] if window else []
        win30 = window[-30:] if window else []
        avg10 = _safe_mean([x.get(key) for x in win10])
        avg30 = _safe_mean([x.get(key) for x in win30])
        level = "normal"
        status = "基准内"
        over_pct = None
        if current is None or not b:
            level, status = "unknown", "缺数据"
        else:
            mn, mx = b["min"], b["max"]
            if current < mn:
                over_pct = round((mn - current) / max(abs(mn), 1e-9) * 100, 2)
                level = "alarm" if over_pct >= 20 else "warning"
                status = f"低于基准 {over_pct}%"
            elif current > mx:
                over_pct = round((current - mx) / max(abs(mx), 1e-9) * 100, 2)
                level = "alarm" if over_pct >= 20 else "warning"
                status = f"高于基准 {over_pct}%"
        result.append({
            "field": key,
            "label": label,
            "current": current,
            "unit": b.get("unit") if b else None,
            "baselineMin": b.get("min") if b else None,
            "baselineMax": b.get("max") if b else None,
            "baselineSource": b.get("source") if b else None,
            "avgLast10": avg10,
            "avgLast30": avg30,
            "deltaVsLast10Pct": _pct_delta(current, avg10),
            "deltaVsLast30Pct": _pct_delta(current, avg30),
            "level": level,
            "status": status,
        })
    return result


def latest_monitoring_features(section_id: str, ring: Dict[str, Any], active_risk_source_ids: List[str]) -> List[Dict[str, Any]]:
    # Pick monitoring points related to active risks first; fallback to all section points.
    params: Tuple[Any, ...]
    if active_risk_source_ids:
        rows = _all(
            """
            SELECT mp.*, rs.risk_name
            FROM monitoring_point mp
            LEFT JOIN risk_source rs ON rs.risk_source_id = mp.risk_source_id
            WHERE mp.section_id=%s::uuid AND mp.risk_source_id = ANY(%s::uuid[])
            ORDER BY mp.point_code
            """,
            (section_id, active_risk_source_ids),
        )
    else:
        rows = _all(
            """
            SELECT mp.*, rs.risk_name
            FROM monitoring_point mp
            LEFT JOIN risk_source rs ON rs.risk_source_id = mp.risk_source_id
            WHERE mp.section_id=%s::uuid
            ORDER BY mp.point_code
            LIMIT 12
            """,
            (section_id,),
        )
    features = []
    for mp in rows:
        readings = _all(
            """
            SELECT * FROM monitoring_reading
            WHERE point_id=%s::uuid
            ORDER BY measured_at DESC
            LIMIT 6
            """,
            (str(mp["point_id"]),),
        )
        readings = list(reversed(readings))
        changes = [_num(r.get("cumulative_change")) for r in readings]
        rates = [_num(r.get("change_rate")) for r in readings]
        latest = readings[-1] if readings else None
        latest_change = _num(latest.get("cumulative_change")) if latest else None
        warning = _num(mp.get("warning_threshold"))
        alarm = _num(mp.get("alarm_threshold"))
        abs_change = abs(latest_change) if latest_change is not None else None
        remaining_warning = round(warning - abs_change, 2) if warning is not None and abs_change is not None else None
        remaining_alarm = round(alarm - abs_change, 2) if alarm is not None and abs_change is not None else None
        accel = False
        if len(rates) >= 4 and all(v is not None for v in rates[-4:]):
            # settlement rates are often negative; acceleration means absolute rate increasing.
            last_abs = [abs(v) for v in rates[-4:]]
            accel = last_abs[-1] > last_abs[-2] > last_abs[-3]
        level = "normal"
        if latest and latest.get("alert_level") in ("warning", "alarm"):
            level = latest.get("alert_level")
        elif remaining_alarm is not None and remaining_alarm <= max(alarm * 0.2, 3):
            level = "warning"
        if remaining_alarm is not None and remaining_alarm <= 0:
            level = "alarm"
        features.append({
            "pointId": str(mp.get("point_id")),
            "pointCode": mp.get("point_code"),
            "pointName": mp.get("point_name"),
            "riskName": mp.get("risk_name"),
            "monitoringItem": mp.get("monitoring_item"),
            "monitoringObject": mp.get("monitoring_object"),
            "unit": mp.get("unit"),
            "latestMeasuredAt": _iso(latest.get("measured_at")) if latest else None,
            "latestCumulativeChange": latest_change,
            "latestChangeRate": _num(latest.get("change_rate")) if latest else None,
            "warningThreshold": warning,
            "alarmThreshold": alarm,
            "remainingToWarning": remaining_warning,
            "remainingToAlarm": remaining_alarm,
            "isAccelerating": accel,
            "level": level,
            "recentReadings": [
                {
                    "measuredAt": _iso(r.get("measured_at")),
                    "cumulativeChange": _num(r.get("cumulative_change")),
                    "changeRate": _num(r.get("change_rate")),
                    "alertLevel": r.get("alert_level") or "normal",
                }
                for r in readings
            ],
        })
    # Prioritize alarms/warnings/accelerating points.
    order = {"alarm": 0, "warning": 1, "normal": 2, "unknown": 3}
    features.sort(key=lambda x: (order.get(x["level"], 9), not x["isAccelerating"], x.get("pointCode") or ""))
    return features


def nearby_events(section_id: str, ring_no: int, radius: int = 8) -> List[Dict[str, Any]]:
    rows = _all(
        """
        SELECT e.*, r.ring_no, rs.risk_name
        FROM event_log e
        LEFT JOIN ring_mileage_map r ON r.ring_id = e.ring_id
        LEFT JOIN risk_source rs ON rs.risk_source_id = e.risk_source_id
        WHERE e.section_id=%s::uuid
          AND (r.ring_no IS NULL OR r.ring_no BETWEEN %s AND %s)
        ORDER BY ABS(COALESCE(r.ring_no, %s) - %s), e.event_time DESC
        LIMIT 8
        """,
        (section_id, ring_no - radius, ring_no + radius, ring_no, ring_no),
    )
    return [
        {
            "eventId": str(r.get("event_id")),
            "ringNo": r.get("ring_no"),
            "riskName": r.get("risk_name"),
            "eventTime": _iso(r.get("event_time")),
            "eventType": r.get("event_type"),
            "severity": r.get("severity"),
            "description": r.get("description"),
            "possibleCause": r.get("possible_cause"),
            "handlingAction": r.get("handling_action"),
            "closureResult": r.get("closure_result"),
            "responsibleParty": r.get("responsible_party"),
        }
        for r in rows
    ]


def data_quality(section_id: str) -> Dict[str, Any]:
    tables = [
        ("ring_mileage_map", "环号-里程-日期"),
        ("risk_source", "风险源台账"),
        ("shield_ring_operation", "盾构掘进参数"),
        ("monitoring_point", "监测点布设"),
        ("monitoring_reading", "监测日报"),
        ("slurry_record", "泥水记录"),
        ("grouting_record", "注浆记录"),
        ("event_log", "事件/报警闭环"),
    ]
    counts = []
    for table, name in tables:
        try:
            row = _one(f"SELECT COUNT(*) AS c FROM {table}") or {"c": 0}
            count = int(row.get("c") or 0)
        except Exception:
            count = 0
        counts.append({"tableName": table, "name": name, "rowCount": count, "ok": count > 0})
    required = ["ring_mileage_map", "risk_source", "shield_ring_operation", "monitoring_point", "monitoring_reading"]
    ok_required = sum(1 for c in counts if c["tableName"] in required and c["ok"])
    score = round(ok_required / len(required) * 100)
    missing = [c["name"] for c in counts if c["tableName"] in required and not c["ok"]]
    return {"readyScore": score, "checks": counts, "missingCriticalData": missing}


def build_findings(
    ring: Dict[str, Any],
    operation: Optional[Dict[str, Any]],
    deviations: List[Dict[str, Any]],
    risks: List[Dict[str, Any]],
    monitor_features: List[Dict[str, Any]],
    window: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], float]:
    findings: List[Dict[str, Any]] = []
    score = 20.0

    active_high = [r for r in risks if r.get("riskLevel") == "high"]
    active_inside = [r for r in risks if r.get("status") == "inside"]
    if active_inside:
        score += 20
        findings.append({
            "type": "risk_source",
            "level": "warning" if not active_high else "high",
            "title": "当前环位于风险源影响窗口",
            "evidence": "、".join([f"{r['riskName']}({r['status']}/{r['influenceWindow']})" for r in active_inside[:3]]),
            "reason": "风险源范围内施工对沉降控制、参数稳定和监测频率要求更高。",
            "suggestion": "按风险源专项方案执行低速、稳压、加强监测与事件闭环。",
        })
    elif risks:
        score += 10
        findings.append({
            "type": "risk_source",
            "level": "warning",
            "title": "当前环接近或离开风险源影响窗口",
            "evidence": "、".join([f"{r['riskName']} 距离 {r.get('distanceToCurrentMileageM')}m" for r in risks[:3]]),
            "reason": "风险源前后 100m 常出现参数调整和监测滞后响应。",
            "suggestion": "保持风险源穿越前后连续复盘，不只关注正下穿时刻。",
        })

    for d in deviations:
        if d["level"] in ("warning", "alarm"):
            score += 9 if d["level"] == "warning" else 16
            findings.append({
                "type": "parameter_deviation",
                "level": d["level"],
                "title": f"{d['label']}偏离控制基准",
                "evidence": f"当前 {d['current']} {d.get('unit') or ''}，基准 {d['baselineMin']}~{d['baselineMax']}，状态：{d['status']}。",
                "reason": "单项参数偏离可能反映掌子面支护、掘进负载、泥浆循环或同步注浆控制异常。",
                "suggestion": "结合近 10 环趋势与监测响应判断是否需要调参。",
                "metric": d,
            })

    if operation and len(window) >= 10:
        last10 = window[-10:]
        prev = window[:-10] or window
        thrust10 = _safe_mean([x.get("totalThrust") for x in last10])
        thrust_prev = _safe_mean([x.get("totalThrust") for x in prev])
        torque10 = _safe_mean([x.get("cutterTorque") for x in last10])
        torque_prev = _safe_mean([x.get("cutterTorque") for x in prev])
        speed10 = _safe_mean([x.get("advanceSpeed") for x in last10])
        speed_prev = _safe_mean([x.get("advanceSpeed") for x in prev])
        thrust_delta = _pct_delta(thrust10, thrust_prev)
        torque_delta = _pct_delta(torque10, torque_prev)
        speed_delta = _pct_delta(speed10, speed_prev)
        if thrust_delta is not None and torque_delta is not None and speed_delta is not None:
            if thrust_delta > 8 and torque_delta > 8 and speed_delta < -5:
                score += 18
                findings.append({
                    "type": "combined_operation_anomaly",
                    "level": "warning",
                    "title": "推力-扭矩升高且推进速度下降",
                    "evidence": f"近 10 环总推力较前段 {thrust_delta:+.1f}%，刀盘扭矩 {torque_delta:+.1f}%，推进速度 {speed_delta:+.1f}%。",
                    "reason": "该组合常见于地层阻力增大、刀盘结泥饼、排浆不畅或参数主动降速控制。",
                    "suggestion": "复核出浆密度、含砂率、刀盘扭矩波动、贯入度和地层变化；必要时降低扰动并加强冲刷。",
                })

    accel_points = [m for m in monitor_features if m.get("isAccelerating")]
    warn_points = [m for m in monitor_features if m.get("level") in ("warning", "alarm")]
    if warn_points:
        score += 18
        findings.append({
            "type": "monitoring_warning",
            "level": "alarm" if any(m["level"] == "alarm" for m in warn_points) else "warning",
            "title": "关联监测点接近或达到阈值",
            "evidence": "；".join([f"{m['pointCode']} 累计 {m['latestCumulativeChange']} {m.get('unit') or ''}，距报警 {m.get('remainingToAlarm')}" for m in warn_points[:3]]),
            "reason": "监测响应是判断施工扰动影响的关键证据，不能只看盾构机参数。",
            "suggestion": "提高相关测点频率，复核测点初始值和风险源保护要求，并检查注浆效果。",
        })
    elif accel_points:
        score += 10
        findings.append({
            "type": "monitoring_acceleration",
            "level": "warning",
            "title": "关联监测点存在连续加速趋势",
            "evidence": "；".join([f"{m['pointCode']} 变化率 {m['latestChangeRate']} {m.get('unit') or ''}/d" for m in accel_points[:3]]),
            "reason": "沉降加速往往比单次沉降值更早提示风险。",
            "suggestion": "将趋势异常测点加入重点观察清单，和相邻环注浆量、推进速度联动复核。",
        })

    if not operation:
        score += 15
        findings.append({
            "type": "missing_operation",
            "level": "warning",
            "title": "当前环缺少盾构掘进参数",
            "evidence": "shield_ring_operation 未查询到该环记录。",
            "reason": "缺少压力、推力、扭矩、速度时，无法形成可靠的施工参数诊断。",
            "suggestion": "补充盾构日报、环报或 PLC 导出。",
        })

    # cap and normalize
    score = min(100.0, score)
    return findings, score


def recommendations_from_findings(findings: List[Dict[str, Any]], quality: Dict[str, Any]) -> List[Dict[str, Any]]:
    recs: List[Dict[str, Any]] = []
    types = {f.get("type") for f in findings}
    if "combined_operation_anomaly" in types:
        recs.append({"priority": "P0", "action": "复核泥水循环和刀盘负载", "detail": "检查出浆密度、含砂率、贯入度、刀盘扭矩波动，判断是否存在排浆不畅或结泥饼风险。"})
    if "monitoring_warning" in types or "monitoring_acceleration" in types:
        recs.append({"priority": "P0", "action": "提高关联测点监测频率", "detail": "对风险源关联测点加密至不少于每日 2 次，并核对报警阈值与初始值。"})
    if "risk_source" in types:
        recs.append({"priority": "P1", "action": "执行风险源穿越专项复盘", "detail": "按穿越前、穿越中、穿越后分段复盘速度、压力、注浆、监测响应。"})
    if "parameter_deviation" in types:
        recs.append({"priority": "P1", "action": "形成参数调整闭环", "detail": "记录本环参数偏离原因、操作调整和下一环观察点。"})
    if quality.get("missingCriticalData"):
        recs.append({"priority": "P0", "action": "补齐关键数据", "detail": "缺失：" + "、".join(quality["missingCriticalData"])})
    if not recs:
        recs.append({"priority": "P2", "action": "保持当前参数并继续观察", "detail": "当前未命中显著异常规则，但仍需保持环号、监测和事件的连续记录。"})
    return recs


def analyze_ring(ring_no: int, section_id: str = DEFAULT_SECTION_ID) -> Dict[str, Any]:
    section = get_section(section_id)
    ring = get_ring(section_id, ring_no)
    if not ring:
        return {"ok": False, "message": f"ring {ring_no} not found", "ringNo": ring_no}
    current_ring = get_current_ring(section_id)
    operation = get_operation(section_id, ring_no)
    window = operation_window(section_id, ring_no, 30, 0)
    risks = active_risks(section_id, ring.get("endMileageM"))
    active_ids = [r["riskSourceId"] for r in risks if r.get("riskSourceId")]
    monitor_features = latest_monitoring_features(section_id, ring, active_ids)
    deviations = parameter_deviation(operation, window, ring_no)
    events = nearby_events(section_id, ring_no)
    quality = data_quality(section_id)
    findings, score = build_findings(ring, operation, deviations, risks, monitor_features, window)
    risk_level = _level_from_score(score)
    recommendations = recommendations_from_findings(findings, quality)
    confidence = round(min(0.95, 0.45 + quality["readyScore"] / 100 * 0.35 + min(len(window), 30) / 30 * 0.15), 2)
    summary_bits = []
    if risks:
        summary_bits.append("处于" + "、".join([r["riskName"] for r in risks[:2]]) + "影响窗口")
    if findings:
        summary_bits.append("命中" + str(len(findings)) + "项研判规则")
    if monitor_features:
        warn_count = sum(1 for m in monitor_features if m["level"] in ("warning", "alarm") or m["isAccelerating"])
        if warn_count:
            summary_bits.append(f"{warn_count}个关联测点需关注")
    if not summary_bits:
        summary_bits.append("未命中显著异常规则")
    summary = f"第 {ring_no} 环：" + "，".join(summary_bits) + f"。综合风险为{_level_cn(risk_level)}。"
    return {
        "ok": True,
        "analysisVersion": "v3-rule-engine-0.1",
        "section": section,
        "currentRing": current_ring,
        "selectedRing": ring,
        "ringNo": ring_no,
        "summary": summary,
        "riskScore": round(score, 1),
        "riskLevel": risk_level,
        "riskLevelCn": _level_cn(risk_level),
        "confidence": confidence,
        "baseline": baseline_for_ring(ring_no),
        "operation": operation,
        "operationWindow": window[-40:],
        "parameterDeviation": deviations,
        "activeRiskSources": risks,
        "monitoringFeatures": monitor_features,
        "nearbyEvents": events,
        "findings": findings,
        "recommendations": recommendations,
        "dataQuality": quality,
        "evidenceChain": build_evidence_chain(ring, operation, risks, monitor_features, events),
        "generatedAt": datetime.now().isoformat(),
    }


def build_evidence_chain(ring, operation, risks, monitor_features, events):
    chain = [
        {"step": "ring", "title": "环号定位", "content": f"{ring['ringNo']} 环，{ring.get('startMileage')}~{ring.get('endMileage')}，阶段：{ring.get('constructionStage')}。"},
    ]
    if risks:
        chain.append({"step": "risk", "title": "风险源匹配", "content": "；".join([f"{r['riskName']}：{r['status']} / {r['influenceWindow']}" for r in risks[:4]])})
    if operation:
        chain.append({"step": "operation", "title": "掘进参数", "content": f"切口压力 {operation.get('facePressure')}bar，总推力 {operation.get('totalThrust')}kN，刀盘扭矩 {operation.get('cutterTorque')}kN·m，速度 {operation.get('advanceSpeed')}mm/min。"})
    if monitor_features:
        chain.append({"step": "monitor", "title": "监测响应", "content": "；".join([f"{m['pointCode']} 累计 {m.get('latestCumulativeChange')}{m.get('unit') or ''}" for m in monitor_features[:3]])})
    if events:
        chain.append({"step": "event", "title": "事件闭环", "content": "；".join([f"{e.get('eventType')}：{e.get('description')}" for e in events[:2]])})
    return chain


def dashboard_analysis(section_id: str = DEFAULT_SECTION_ID, ring_no: Optional[int] = None) -> Dict[str, Any]:
    selected = ring_no or CURRENT_RING_NO
    ring_analysis = analyze_ring(selected, section_id)
    if not ring_analysis.get("ok"):
        return ring_analysis
    # Add compact lists for dashboard panels.
    all_risks = risk_sources_for_mileage(section_id, ring_analysis["selectedRing"].get("endMileageM"))
    return {
        **ring_analysis,
        "allRiskSources": all_risks,
        "dashboardFocus": {
            "title": "当前环施工研判" if selected == (ring_analysis.get("currentRing") or {}).get("ringNo") else "指定环施工复盘",
            "subtitle": "不是字段展示，而是基于风险源、参数偏离、监测趋势和事件闭环的综合研判。",
        },
    }
