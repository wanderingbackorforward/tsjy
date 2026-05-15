from __future__ import annotations

import os
import math
from datetime import datetime
from decimal import Decimal
from typing import Any

import psycopg2
import psycopg2.extras
from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/v3/analysis", tags=["v3-evidence-analysis"])

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://shield_user:shield_pass_123@127.0.0.1:5432/shield_monitor",
)
DEFAULT_SECTION_ID = os.getenv("DEFAULT_SECTION_ID", "33333333-3333-3333-3333-333333333333")
CURRENT_RING_NO = int(os.getenv("CURRENT_RING_NO", "336"))


def _conn():
    return psycopg2.connect(DATABASE_URL)


def _all(sql: str, params: tuple[Any, ...] = ()): 
    with _conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]


def _one(sql: str, params: tuple[Any, ...] = ()): 
    rows = _all(sql, params)
    return rows[0] if rows else None


def _num(v: Any):
    if v is None:
        return None
    if isinstance(v, Decimal):
        return float(v)
    return v


def _iso(v: Any):
    if v is None:
        return None
    if hasattr(v, "isoformat"):
        return v.isoformat()
    return str(v)


def _pct(cur: float | None, base: float | None) -> float:
    if cur is None or base in (None, 0):
        return 0.0
    return round((cur - base) / base * 100, 2)


def _avg(values: list[float | None]) -> float | None:
    nums = [float(v) for v in values if v is not None]
    if not nums:
        return None
    return sum(nums) / len(nums)


def get_section(section_id: str):
    row = _one(
        """
        SELECT p.project_id, p.project_name, p.contractor_name,
               ts.section_id, ts.section_name, ts.start_mileage, ts.end_mileage,
               ts.length_m, ts.tunnel_form, ts.design_speed_kmh, ts.max_burial_depth_m
        FROM project p
        JOIN tunnel_section ts ON ts.project_id = p.project_id
        WHERE ts.section_id = %s::uuid
        LIMIT 1
        """,
        (section_id,),
    )
    if not row:
        return {}
    return {
        "projectId": str(row["project_id"]),
        "projectName": row["project_name"],
        "contractorName": row["contractor_name"],
        "sectionId": str(row["section_id"]),
        "sectionName": row["section_name"],
        "startMileage": row["start_mileage"],
        "endMileage": row["end_mileage"],
        "lengthM": _num(row["length_m"]),
        "tunnelForm": row["tunnel_form"],
        "designSpeedKmh": _num(row["design_speed_kmh"]),
        "maxBurialDepthM": _num(row["max_burial_depth_m"]),
    }


def get_ring(section_id: str, ring_no: int):
    row = _one(
        """SELECT * FROM ring_mileage_map
           WHERE section_id=%s::uuid AND ring_no=%s LIMIT 1""",
        (section_id, ring_no),
    )
    if not row:
        return None
    return {
        "ringId": str(row["ring_id"]),
        "sectionId": str(row["section_id"]),
        "ringNo": row["ring_no"],
        "workDate": _iso(row["work_date"]),
        "startMileage": row["start_mileage"],
        "endMileage": row["end_mileage"],
        "startMileageM": _num(row["start_mileage_m"]),
        "endMileageM": _num(row["end_mileage_m"]),
        "constructionStage": row["construction_stage"],
        "isActual": row["is_actual"],
    }


def operations(section_id: str, start_ring: int, end_ring: int):
    rows = _all(
        """
        SELECT * FROM shield_ring_operation
        WHERE section_id=%s::uuid AND ring_no BETWEEN %s AND %s
        ORDER BY ring_no
        """,
        (section_id, start_ring, end_ring),
    )
    return [
        {
            "operationId": str(r["operation_id"]),
            "ringNo": r["ring_no"],
            "recordedAt": _iso(r["recorded_at"]),
            "advanceSpeed": _num(r["advance_speed"]),
            "facePressure": _num(r["face_pressure"]),
            "totalThrust": _num(r["total_thrust"]),
            "cutterTorque": _num(r["cutter_torque"]),
            "cutterRotationSpeed": _num(r["cutter_rotation_speed"]),
            "penetration": _num(r["penetration"]),
            "slurryInDensity": _num(r["slurry_in_density"]),
            "slurryOutDensity": _num(r["slurry_out_density"]),
            "alertLevel": r["alert_level"],
        }
        for r in rows
    ]


def risks(section_id: str, current_mileage_m: float | None):
    rows = _all(
        """
        SELECT rs.*, COUNT(mp.point_id) AS monitoring_point_count
        FROM risk_source rs
        LEFT JOIN monitoring_point mp ON mp.risk_source_id=rs.risk_source_id
        WHERE rs.section_id=%s::uuid
        GROUP BY rs.risk_source_id
        ORDER BY rs.start_mileage_m
        """,
        (section_id,),
    )
    out = []
    for r in rows:
        start_m = _num(r["start_mileage_m"])
        end_m = _num(r["end_mileage_m"])
        status = "normal"
        distance = None
        if current_mileage_m is not None and start_m is not None and end_m is not None:
            distance = round(start_m - current_mileage_m, 2)
            if start_m <= current_mileage_m <= end_m:
                status = "inside"
            elif 0 <= start_m - current_mileage_m <= 100:
                status = "approaching"
            elif 0 < current_mileage_m - end_m <= 100:
                status = "post_effect"
            elif current_mileage_m > end_m:
                status = "passed"
        out.append({
            "riskSourceId": str(r["risk_source_id"]),
            "riskName": r["risk_name"],
            "riskType": r["risk_type"],
            "crossingRelation": r["crossing_relation"],
            "startMileage": r["start_mileage"],
            "endMileage": r["end_mileage"],
            "startMileageM": start_m,
            "endMileageM": end_m,
            "riskLevel": r["risk_level"],
            "status": status,
            "distanceToStartM": distance,
            "monitoringPointCount": int(r.get("monitoring_point_count") or 0),
            "minVerticalDistanceM": _num(r.get("min_vertical_distance_m")),
            "minHorizontalDistanceM": _num(r.get("min_horizontal_distance_m")),
        })
    return out


def monitoring(section_id: str, limit_points: int = 8):
    point_rows = _all(
        """
        SELECT mp.*, rs.risk_name
        FROM monitoring_point mp
        LEFT JOIN risk_source rs ON rs.risk_source_id=mp.risk_source_id
        WHERE mp.section_id=%s::uuid
        ORDER BY mp.point_code
        LIMIT %s
        """,
        (section_id, limit_points),
    )
    series = []
    for p in point_rows:
        readings = _all(
            """
            SELECT * FROM monitoring_reading
            WHERE point_id=%s::uuid
            ORDER BY measured_at
            """,
            (str(p["point_id"]),),
        )
        values = [
            {
                "measuredAt": _iso(r["measured_at"]),
                "cumulativeChange": _num(r["cumulative_change"]),
                "changeRate": _num(r["change_rate"]),
                "alertLevel": r["alert_level"],
            }
            for r in readings
        ]
        latest = values[-1] if values else None
        prev = values[-4:-1] if len(values) >= 4 else values[:-1]
        accelerating = False
        if latest and len(prev) >= 2:
            rates = [abs(v["changeRate"] or 0) for v in prev + [latest]]
            accelerating = rates[-1] >= rates[-2] >= rates[-3]
        alarm = _num(p["alarm_threshold"])
        latest_abs = abs(latest["cumulativeChange"]) if latest else 0
        margin = round((alarm or 0) - latest_abs, 2) if alarm else None
        series.append({
            "pointId": str(p["point_id"]),
            "pointCode": p["point_code"],
            "pointName": p["point_name"],
            "monitoringObject": p["monitoring_object"],
            "monitoringItem": p["monitoring_item"],
            "riskName": p["risk_name"],
            "warningThreshold": _num(p["warning_threshold"]),
            "alarmThreshold": alarm,
            "unit": p["unit"],
            "latest": latest,
            "marginToAlarm": margin,
            "isAccelerating": accelerating,
            "readings": values,
        })
    return series


def events(section_id: str, ring_no: int, radius: int = 10):
    rows = _all(
        """
        SELECT e.*, r.ring_no, rs.risk_name
        FROM event_log e
        LEFT JOIN ring_mileage_map r ON r.ring_id=e.ring_id
        LEFT JOIN risk_source rs ON rs.risk_source_id=e.risk_source_id
        WHERE e.section_id=%s::uuid
          AND (r.ring_no IS NULL OR r.ring_no BETWEEN %s AND %s)
        ORDER BY e.event_time DESC
        LIMIT 12
        """,
        (section_id, ring_no-radius, ring_no+radius),
    )
    return [
        {
            "eventId": str(r["event_id"]),
            "ringNo": r["ring_no"],
            "riskName": r["risk_name"],
            "eventTime": _iso(r["event_time"]),
            "eventType": r["event_type"],
            "severity": r["severity"],
            "description": r["description"],
            "possibleCause": r["possible_cause"],
            "handlingAction": r["handling_action"],
            "closureResult": r["closure_result"],
        }
        for r in rows
    ]


def grouting(section_id: str, start_ring: int, end_ring: int):
    rows = _all(
        """
        SELECT g.*, s.slurry_in_density, s.slurry_out_density, s.viscosity, s.sand_content
        FROM grouting_record g
        LEFT JOIN slurry_record s ON s.section_id=g.section_id AND s.ring_no=g.ring_no
        WHERE g.section_id=%s::uuid AND g.ring_no BETWEEN %s AND %s
        ORDER BY g.ring_no
        """,
        (section_id, start_ring, end_ring),
    )
    return [
        {
            "ringNo": r["ring_no"],
            "recordedAt": _iso(r["recorded_at"]),
            "groutingVolume": _num(r["grouting_volume"]),
            "groutingPressure": _num(r["grouting_pressure"]),
            "isSecondaryGrouting": r["is_secondary_grouting"],
            "slurryInDensity": _num(r["slurry_in_density"]),
            "slurryOutDensity": _num(r["slurry_out_density"]),
            "viscosity": _num(r["viscosity"]),
            "sandContent": _num(r["sand_content"]),
        }
        for r in rows
    ]


def webservice_source():
    return {
        "sourceName": "铁建重工 WebService 接口说明文档（集成服务版）",
        "sourceType": "real_project_interface_doc",
        "serviceUrlPattern": "http://IP:Port/Service.asmx?wsdl",
        "defaultPort": 80,
        "methods": [
            {
                "name": "getData",
                "definition": "public string[] getData(string flag,string mac,string psw)",
                "purpose": "读取盾构数据/其它子系统数据",
                "requiredFlag": "tbmData",
                "parameters": ["flag", "mac", "psw"],
                "returns": "string[]",
                "targetTables": ["raw_webservice_payload", "shield_ring_operation", "slurry_record", "grouting_record"],
            },
            {
                "name": "getTBM",
                "definition": "public string[] getTBM(string mac,string psw)",
                "purpose": "读取导向数据",
                "parameters": ["mac", "psw"],
                "returns": "string[]",
                "targetTables": ["raw_webservice_payload", "tbm_guidance_record", "ring_mileage_map"],
            },
        ],
        "integrationWarnings": [
            "文档只说明返回 string[]，没有给出数组下标与字段名的映射，不能直接当作标准掘进参数入库。",
            "mac/psw 属于设备编号和接口密钥，必须后端加密配置，不能写入前端。",
            "需要先抓取一份真实返回样例，进入 raw_webservice_payload，再由 field_mapping 确认字段顺序、单位和主键。",
        ],
        "evidence": [
            "工控机发布 Web 服务，通过 IP 调用提取设备实时数据。",
            "调用地址为 http://IP:Port/Service.asmx?wsdl，端口一般默认 80。",
            "盾构数据接口 getData 的 flag 固定为 tbmData，参数包括设备编号 mac 和密钥 psw。",
            "导向数据接口 getTBM 通过 mac 和 psw 读取，返回 string[]。",
        ],
        "pipeline": [
            "Service.asmx?wsdl",
            "getData(tbmData, mac, psw)",
            "raw_webservice_payload",
            "field_mapping + unit_conversion",
            "shield_ring_operation / slurry_record / grouting_record",
            "analysis_service + ECharts evidence dashboard",
        ],
    }


def build_analysis(section_id: str, ring_no: int):
    section = get_section(section_id)
    current_ring = get_ring(section_id, CURRENT_RING_NO) or get_ring(section_id, ring_no)
    selected_ring = get_ring(section_id, ring_no) or current_ring
    selected_no = selected_ring["ringNo"] if selected_ring else ring_no

    start_ring = max(1, selected_no - 55)
    end_ring = selected_no + 31
    ops = operations(section_id, start_ring, end_ring)
    sel_op = next((o for o in ops if o["ringNo"] == selected_no), ops[-1] if ops else None)
    before10 = [o for o in ops if selected_no - 10 <= o["ringNo"] < selected_no]
    before30 = [o for o in ops if selected_no - 30 <= o["ringNo"] < selected_no]

    def metric_stat(key: str, cn: str, unit: str, baseline: float | None = None):
        cur = sel_op.get(key) if sel_op else None
        avg10 = _avg([o.get(key) for o in before10])
        avg30 = _avg([o.get(key) for o in before30])
        return {
            "key": key,
            "name": cn,
            "unit": unit,
            "current": round(cur, 3) if isinstance(cur, (float, int)) else cur,
            "avg10": round(avg10, 3) if avg10 is not None else None,
            "avg30": round(avg30, 3) if avg30 is not None else None,
            "deviationVs10Pct": _pct(cur, avg10),
            "deviationVs30Pct": _pct(cur, avg30),
            "baseline": baseline,
            "deviationVsBaselinePct": _pct(cur, baseline) if baseline else None,
        }

    metric_stats = [
        metric_stat("facePressure", "切口压力", "bar", 0.54),
        metric_stat("totalThrust", "总推力", "kN", 38000),
        metric_stat("cutterTorque", "刀盘扭矩", "kN.m", 18000),
        metric_stat("advanceSpeed", "推进速度", "mm/min", 3.5),
    ]

    active_risks = risks(section_id, selected_ring["endMileageM"] if selected_ring else None)
    risk_focus = [r for r in active_risks if r["status"] in ("approaching", "inside", "post_effect")]
    mon = monitoring(section_id)
    evt = events(section_id, selected_no)
    grout = grouting(section_id, max(1, selected_no - 35), selected_no + 10)

    findings = []
    score = 28

    thrust_dev = next(m for m in metric_stats if m["key"] == "totalThrust")
    torque_dev = next(m for m in metric_stats if m["key"] == "cutterTorque")
    speed_dev = next(m for m in metric_stats if m["key"] == "advanceSpeed")
    pressure_dev = next(m for m in metric_stats if m["key"] == "facePressure")

    if thrust_dev["deviationVs10Pct"] > 8 and torque_dev["deviationVs10Pct"] > 8:
        score += 18
        findings.append({
            "type": "operation_combo",
            "level": "warning",
            "title": "推力与刀盘扭矩同步升高",
            "evidence": f"总推力较近10环均值偏离 {thrust_dev['deviationVs10Pct']}%，刀盘扭矩偏离 {torque_dev['deviationVs10Pct']}%。",
            "reason": "推力和扭矩同时升高常见于地层阻力增加、刀盘结泥饼或泥水循环效率下降。",
            "suggestion": "复核出浆密度、含砂率、刀盘扭矩波动和推进速度，不建议盲目提速。",
        })
    if speed_dev["deviationVs10Pct"] < -10 and pressure_dev["deviationVs10Pct"] > 5:
        score += 16
        findings.append({
            "type": "pressure_speed_mismatch",
            "level": "warning",
            "title": "压力上升但推进速度下降",
            "evidence": f"切口压力较近10环偏离 {pressure_dev['deviationVs10Pct']}%，推进速度偏离 {speed_dev['deviationVs10Pct']}%。",
            "reason": "稳压降速可能是风险源穿越控制动作，也可能反映掌子面阻力或排浆效率问题。",
            "suggestion": "结合风险源窗口判断是否为主动控制；若非主动控制，应复核泥水指标和设备负载。",
        })
    if risk_focus:
        score += 18 if any(r["riskLevel"] == "high" for r in risk_focus) else 10
        names = "、".join([r["riskName"] for r in risk_focus[:3]])
        findings.append({
            "type": "risk_window",
            "level": "warning" if any(r["riskLevel"] == "high" for r in risk_focus) else "info",
            "title": "当前环处于风险源影响窗口",
            "evidence": f"当前里程 {selected_ring['endMileage']}，关联风险源：{names}。",
            "reason": "风险源前后窗口内，沉降和参数扰动可能存在滞后，不应只看当前环瞬时值。",
            "suggestion": "按风险源穿越前/中/后分段复盘压力、速度、注浆和监测响应。",
        })
    accel_points = [p for p in mon if p.get("isAccelerating")]
    near_alarm = [p for p in mon if p.get("marginToAlarm") is not None and p["marginToAlarm"] <= 8]
    if accel_points:
        score += 14
        findings.append({
            "type": "monitoring_acceleration",
            "level": "warning",
            "title": "关联测点存在连续加速迹象",
            "evidence": "、".join([f"{p['pointCode']} 最新累计{p['latest']['cumulativeChange']}mm" for p in accel_points[:3] if p.get('latest')]),
            "reason": "监测变化率连续增大时，比单点累计值更早反映地层扰动发展。",
            "suggestion": "提高相关测点频率，结合当前环前后 10 环参数检查扰动来源。",
        })
    if near_alarm:
        score += 12
        findings.append({
            "type": "threshold_margin",
            "level": "alarm" if any((p.get("marginToAlarm") or 99) <= 3 for p in near_alarm) else "warning",
            "title": "部分测点距离报警阈值较近",
            "evidence": "、".join([f"{p['pointCode']} 距报警剩余 {p['marginToAlarm']}mm" for p in near_alarm[:3]]),
            "reason": "阈值剩余量小，若仍处风险源影响窗口，后续环号需要重点跟踪。",
            "suggestion": "核对测点复测值，必要时触发预警复核和现场巡查。",
        })
    if not findings:
        findings.append({
            "type": "normal_control",
            "level": "normal",
            "title": "当前环暂未命中明显异常组合",
            "evidence": "主要参数相对近10环均值偏离不大，风险源和监测响应未出现明显叠加异常。",
            "reason": "规则引擎未发现高风险组合，但仍需结合真实 WebService 数据持续校验。",
            "suggestion": "继续补齐真实字段映射和 WebService 返回样例，提升结论可信度。",
        })

    source = webservice_source()
    data_quality = {
        "score": 68,
        "items": [
            {"name": "环号-里程主轴", "score": 90, "status": "已具备"},
            {"name": "掘进参数曲线", "score": 75, "status": "演示数据，待接 WebService"},
            {"name": "监测时序", "score": 72, "status": "有时序，待核对真实测点"},
            {"name": "泥水注浆", "score": 58, "status": "有演示记录，需真实环报"},
            {"name": "WebService 实时接口", "score": 35, "status": "已有接口文档，缺返回样例"},
        ],
        "missing": [
            "getData 返回 string[] 的字段顺序/字段名映射",
            "getTBM 导向数据返回样例",
            "设备 mac 与密钥 psw 的后端安全配置",
            "真实环号-时间-PLC 采样频率说明",
        ],
    }
    confidence = max(35, min(86, data_quality["score"] - 8 + len([f for f in findings if f["level"] != "normal"])*3))
    level = "normal"
    if score >= 76:
        level = "alarm"
    elif score >= 48:
        level = "warning"
    elif score >= 35:
        level = "attention"

    chart_evidence = {
        "operationTrend": ops,
        "metricStats": metric_stats,
        "riskSources": active_risks,
        "monitoringSeries": mon,
        "events": evt,
        "slurryGrouting": grout,
        "webServiceSource": source,
        "dataQuality": data_quality,
    }

    recommendations = []
    for f in findings:
        if f.get("suggestion"):
            recommendations.append(f["suggestion"])
    recommendations += [
        "把铁建重工 WebService 的一组真实 getData/getTBM 返回样例导入 raw_webservice_payload。",
        "由工程人员确认 string[] 下标到标准字段的映射，再进入 shield_ring_operation。",
    ]

    return {
        "ok": True,
        "analysisVersion": "v3-echarts-evidence-0.2",
        "section": section,
        "currentRing": current_ring,
        "selectedRing": selected_ring,
        "score": min(score, 100),
        "riskLevel": level,
        "confidence": confidence,
        "summary": f"当前查看 {selected_no} 环，系统基于掘进参数趋势、风险源影响窗口、监测响应和数据可信度生成施工研判。",
        "findings": findings,
        "recommendations": recommendations[:8],
        "chartEvidence": chart_evidence,
    }


@router.get("/evidence-dashboard")
def evidence_dashboard(
    ring_no: int = Query(CURRENT_RING_NO),
    section_id: str = Query(DEFAULT_SECTION_ID),
):
    return build_analysis(section_id, ring_no)


@router.get("/webservice-source")
def webservice_source_endpoint():
    return webservice_source()
