from __future__ import annotations

import json
import math
import os
import statistics
import urllib.request
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from datetime import datetime
from typing import Any

from fastapi import APIRouter

router = APIRouter()

LOCAL_API_BASE = os.getenv("LOCAL_PLATFORM_API_BASE", "http://127.0.0.1:8100").rstrip("/")


def now_text() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def local_get(path: str, timeout: float = 6.0) -> dict[str, Any]:
    url = path if path.startswith("http") else f"{LOCAL_API_BASE}{path}"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        return {"code": -1, "error": str(exc), "url": url}


def unwrap(resp: Any) -> Any:
    if isinstance(resp, dict) and "data" in resp:
        return resp.get("data")
    return resp


def as_list(v: Any) -> list[Any]:
    if isinstance(v, list):
        return v
    if isinstance(v, dict):
        for k in ("items", "records", "data", "events", "history"):
            x = v.get(k)
            if isinstance(x, list):
                return x
            if isinstance(x, dict):
                y = as_list(x)
                if y:
                    return y
    return []


def fnum(v: Any, default: float | None = 0.0) -> float | None:
    try:
        if v is None or v == "":
            return default
        x = float(v)
        if math.isfinite(x):
            return x
        return default
    except Exception:
        return default


def clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def level_from_score(score: float) -> str:
    if score >= 80:
        return "报警"
    if score >= 60:
        return "预警"
    if score >= 40:
        return "关注"
    return "正常"


def severity(level: str) -> int:
    return {"报警": 3, "预警": 2, "关注": 1, "待复核": 1, "正常": 0}.get(level, 1)


def field_value(fields: dict[str, Any], names: list[str]) -> Any:
    for name in names:
        if name in fields:
            x = fields[name]
            if isinstance(x, dict):
                return x.get("value", x.get("rawValue", x.get("displayValue")))
            return x
    lower_names = [x.lower() for x in names]
    for k, x in fields.items():
        lk = str(k).lower()
        if any(n in lk for n in lower_names):
            if isinstance(x, dict):
                return x.get("value", x.get("rawValue", x.get("displayValue")))
            return x
    return None


def metric(title: str, value: Any, unit: str = "", status: str = "待复核", note: str = "", score: float = 0.0) -> dict[str, Any]:
    return {
        "title": title,
        "value": fnum(value, 0) or 0,
        "unit": unit,
        "status": status,
        "note": note,
        "score": round(clamp(score), 1),
    }


def cn_item(v: Any) -> str:
    s = str(v or "").strip()
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
    return mapping.get(s.lower(), s or "待归类")


def cn_level(v: Any) -> str:
    s = str(v or "").strip()
    low = s.lower()
    if "报警" in s or "alarm" in low or "critical" in low:
        return "报警"
    if "预警" in s or "warning" in low or "warn" in low:
        return "预警"
    if "复核" in s or "待" in s or "confirm" in low:
        return "待复核"
    if "正常" in s or low in {"ok", "normal", "safe"}:
        return "正常"
    return s or "待复核"


def normalize_alerts(raw: Any) -> list[dict[str, Any]]:
    report_rank = {"报警": 3, "预警": 2, "待复核": 1}
    by_point: dict[str, dict[str, Any]] = {}
    for x in as_list(raw):
        if not isinstance(x, dict):
            continue
        point = str(x.get("pointCode") or x.get("point_code") or x.get("pointNo") or x.get("point_id") or "--")
        level = cn_level(x.get("level") or x.get("alertLevelCn") or x.get("alertLevel") or x.get("status"))
        item = cn_item(x.get("item") or x.get("monitoringItemCn") or x.get("monitoringItem") or x.get("project_type"))
        reason = str(x.get("priorityReason") or x.get("rankingReason") or x.get("reason") or "")
        distance = x.get("distanceM")
        if distance is not None:
            reason_text = f"距盾首 {fnum(distance, 0):.0f}m"
        elif "当前风险源" in reason:
            reason_text = "当前风险窗口内"
        elif "邻近风险源" in reason:
            reason_text = "邻近风险源"
        elif "最新" in reason:
            reason_text = "按最新异常排序"
        else:
            reason_text = "按报警等级排序"
        obj = {
            "pointCode": point,
            "level": level,
            "item": item,
            "latestValue": x.get("latestValue"),
            "latestTime": x.get("latestTime") or x.get("time") or x.get("date") or "",
            "distanceM": distance,
            "priorityReason": reason_text,
            "riskName": x.get("riskName") or "",
        }
        old = by_point.get(point)
        if not old or report_rank.get(level, 0) > report_rank.get(old.get("level"), 0):
            by_point[point] = obj
    out = list(by_point.values())
    out.sort(key=lambda x: (-report_rank.get(x.get("level"), 0), 999999 if x.get("distanceM") is None else fnum(x.get("distanceM"), 999999), str(x.get("latestTime") or "")))
    return out


def normalize_history(raw: Any, fields: dict[str, Any]) -> list[dict[str, Any]]:
    rows = as_list(raw)
    out: list[dict[str, Any]] = []
    for x in rows[-160:]:
        if not isinstance(x, dict):
            continue
        out.append(
            {
                "time": str(x.get("timestamp") or x.get("receivedAt") or x.get("time") or "")[-8:],
                "advanceSpeed": fnum(x.get("advanceSpeed"), 0) or 0,
                "penetration": fnum(x.get("penetration"), 0) or 0,
                "totalThrust": fnum(x.get("totalThrust"), 0) or 0,
                "cutterSpeed": fnum(x.get("cutterSpeed"), 0) or 0,
                "cutterTorque": fnum(x.get("cutterTorque"), 0) or 0,
                "chamberPressure1": fnum(x.get("chamberPressure1"), 0) or 0,
                "shieldTailGap1": fnum(x.get("shieldTailGap1"), 0) or 0,
            }
        )
    if not out:
        out.append(
            {
                "time": now_text()[-8:],
                "advanceSpeed": fnum(field_value(fields, ["advanceSpeed", "推进速度"]), 0) or 0,
                "penetration": fnum(field_value(fields, ["penetration", "贯入度"]), 0) or 0,
                "totalThrust": fnum(field_value(fields, ["totalThrust", "总推力", "推进力"]), 0) or 0,
                "cutterSpeed": fnum(field_value(fields, ["cutterSpeed", "刀盘速度"]), 0) or 0,
                "cutterTorque": fnum(field_value(fields, ["cutterTorque", "刀盘扭矩", "刀盘转矩"]), 0) or 0,
                "chamberPressure1": fnum(field_value(fields, ["chamberPressure1", "开挖仓压力1"]), 0) or 0,
                "shieldTailGap1": fnum(field_value(fields, ["shieldTailGap1", "盾尾间隙1"]), 0) or 0,
            }
        )
    return out


def series_stats(rows: list[dict[str, Any]], key: str) -> dict[str, Any]:
    vals = [fnum(x.get(key), None) for x in rows if fnum(x.get(key), None) is not None]
    vals = [v for v in vals if v is not None]
    if not vals:
        return {"key": key, "count": 0, "latest": None, "avg": None, "std": None, "min": None, "max": None, "slope": 0, "deviationPct": None, "trend": "无数据"}
    latest = vals[-1]
    avg = statistics.fmean(vals)
    std = statistics.pstdev(vals) if len(vals) >= 2 else 0.0
    min_v, max_v = min(vals), max(vals)
    first = vals[0]
    slope = (latest - first) / max(1, len(vals) - 1)
    deviation = None
    if abs(avg) > 1e-9:
        deviation = (latest - avg) / abs(avg) * 100
    trend = "平稳"
    if len(vals) >= 4:
        last3 = statistics.fmean(vals[-3:])
        first3 = statistics.fmean(vals[:3])
        if last3 - first3 > max(0.1, abs(avg) * 0.12):
            trend = "上升"
        elif first3 - last3 > max(0.1, abs(avg) * 0.12):
            trend = "下降"
    return {
        "key": key,
        "count": len(vals),
        "latest": latest,
        "avg": avg,
        "std": std,
        "min": min_v,
        "max": max_v,
        "slope": slope,
        "deviationPct": deviation,
        "trend": trend,
    }


def get_pressures(fields: dict[str, Any]) -> list[dict[str, Any]]:
    keys = [
        (["chamberPressure1", "开挖仓压力1"], "仓压1#"),
        (["chamberPressure2", "开挖仓压力2"], "仓压2#"),
        (["chamberPressure3", "开挖仓压力3"], "仓压3#"),
        (["chamberPressure4", "开挖仓压力4"], "仓压4#"),
    ]
    out = []
    for aliases, label in keys:
        val = field_value(fields, aliases)
        if val is not None:
            v = fnum(val, 0) or 0
            score = 0
            if v >= 7:
                score = 85
            elif v >= 5.5:
                score = 62
            elif v <= 0:
                score = 45
            out.append(metric(label, v, "bar", level_from_score(score), "仓压监测", score))
    return out


def get_tail_gaps(fields: dict[str, Any]) -> list[dict[str, Any]]:
    keys = [
        (["shieldTailGap1", "盾尾间隙1", "tailGapTop"], "盾尾间隙1#"),
        (["shieldTailGap2", "盾尾间隙2", "tailGapBottom"], "盾尾间隙2#"),
        (["shieldTailGap3", "盾尾间隙3", "tailGapLeft"], "盾尾间隙3#"),
        (["shieldTailGap4", "盾尾间隙4", "tailGapRight"], "盾尾间隙4#"),
    ]
    out = []
    for aliases, label in keys:
        val = field_value(fields, aliases)
        if val is not None:
            v = fnum(val, 0) or 0
            score = 0
            if v <= 20 or v >= 80:
                score = 90
            elif v <= 30 or v >= 65:
                score = 65
            elif v <= 35 or v >= 55:
                score = 35
            out.append(metric(label, v, "mm", level_from_score(score), "间隙复核", score))
    return out



def fast_specialized_payload(device_id: str, mode: str = "degraded") -> dict[str, Any]:
    base = {
        "summary": "参数诊断：当前仓压、盾尾间隙、推进速度处于预警窗口，建议联动复核注浆记录。",
        "level": "预警",
        "cards": [
            {"title": "仓压稳定性", "value": 72, "unit": "分", "level": "预警", "note": "需与推进速度联动"},
            {"title": "盾尾间隙均衡", "value": 65, "unit": "分", "level": "报警", "note": "复核姿态与拼装"},
            {"title": "注浆同步率", "value": 78, "unit": "%", "level": "关注", "note": "降级数据"},
        ],
        "components": [
            {"name": "仓压波动", "score": 72, "level": "预警"},
            {"name": "盾尾间隙", "score": 65, "level": "报警"},
            {"name": "注浆量", "score": 78, "level": "关注"},
        ],
        "trend": [
            {"time": "14:11", "chamberPressure1": 6.4, "shieldTailGap1": 92, "penetration": 2.8},
            {"time": "14:13", "chamberPressure1": 6.6, "shieldTailGap1": 95, "penetration": 2.9},
            {"time": "14:15", "chamberPressure1": 6.8, "shieldTailGap1": 98, "penetration": 3.0},
        ],
        "alerts": [
            {"pointCode": "DB37-01", "level": "报警", "item": "地表沉降", "value": -18.6, "unit": "mm"},
        ],
    }
    slurry = dict(base)
    slurry["summary"] = "泥水注浆：当前注浆量与沉降速率关联弱，建议提高同步注浆率。"
    segment = dict(base)
    segment["summary"] = "管片盾尾：盾尾间隙偏差较大，建议复核拼装顺序与姿态。"
    return {
        "code": 0,
        "message": "ok",
        "dataMode": mode,
        "data": {
            "generatedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "deviceId": device_id,
            "operation": base,
            "slurry": slurry,
            "segment": segment,
            "report": {},
        },
    }

def collect_context(device_id: str) -> dict[str, Any]:
    report = unwrap(local_get(f"/api/report-cockpit/summary?deviceId={device_id}", timeout=8)) or {}
    ai_ctx = unwrap(local_get(f"/api/ai-diagnosis/context?deviceId={device_id}", timeout=8)) or {}
    guidance = unwrap(local_get(f"/api/tbm/guidance/latest?deviceId={device_id}", timeout=5)) or {}
    history_raw = unwrap(local_get(f"/api/tbm/history?deviceId={device_id}&limit=160", timeout=5)) or {}
    alerts_raw = unwrap(local_get(f"/api/monitoring/nearby-alerts?deviceId={device_id}&limit=80", timeout=5)) or {}

    fields = {}
    if isinstance(ai_ctx, dict):
        tbm = ai_ctx.get("tbm") if isinstance(ai_ctx.get("tbm"), dict) else {}
        if isinstance(tbm.get("fields"), dict):
            fields = tbm.get("fields") or {}
        elif isinstance(ai_ctx.get("fields"), dict):
            fields = ai_ctx.get("fields") or {}

    alerts = normalize_alerts(report.get("priorityAlerts") or alerts_raw)
    history = normalize_history(report.get("parameterTrend") or history_raw, fields)
    return {
        "deviceId": device_id,
        "generatedAt": now_text(),
        "report": report if isinstance(report, dict) else {},
        "fields": fields,
        "guidance": guidance if isinstance(guidance, dict) else {},
        "history": history,
        "alerts": alerts,
    }


def alert_score(alerts: list[dict[str, Any]], settlement_only: bool = False) -> tuple[float, list[dict[str, Any]]]:
    rows = [a for a in alerts if (not settlement_only or "沉降" in str(a.get("item")))]
    alarm = sum(1 for a in rows if a.get("level") == "报警")
    warning = sum(1 for a in rows if a.get("level") == "预警")
    score = clamp(alarm * 12 + warning * 6, 0, 100)
    return score, rows


def component(name: str, score: float, level: str, evidence: list[str], suggestion: str) -> dict[str, Any]:
    return {
        "name": name,
        "score": round(clamp(score), 1),
        "level": level,
        "evidence": evidence,
        "suggestion": suggestion,
    }


def build_operation(ctx: dict[str, Any]) -> dict[str, Any]:
    fields, history, alerts, report = ctx["fields"], ctx["history"], ctx["alerts"], ctx["report"]
    stats = {k: series_stats(history, k) for k in ["advanceSpeed", "penetration", "totalThrust", "cutterSpeed", "cutterTorque", "chamberPressure1", "shieldTailGap1"]}
    latest = history[-1] if history else {}
    pressures = get_pressures(fields)
    tail_gaps = get_tail_gaps(fields)

    advance = fnum(latest.get("advanceSpeed"), 0) or 0
    penetration = fnum(latest.get("penetration"), 0) or 0
    thrust = fnum(latest.get("totalThrust"), 0) or 0
    cutter_speed = fnum(latest.get("cutterSpeed"), 0) or 0
    cutter_torque = fnum(latest.get("cutterTorque"), 0) or 0
    pressure_vals = [m["value"] for m in pressures] or [fnum(latest.get("chamberPressure1"), 0) or 0]
    pressure_spread = max(pressure_vals) - min(pressure_vals) if pressure_vals else 0
    max_pressure = max(pressure_vals) if pressure_vals else 0
    gap_vals = [m["value"] for m in tail_gaps] or [fnum(latest.get("shieldTailGap1"), 0) or 0]
    gap_spread = max(gap_vals) - min(gap_vals) if gap_vals else 0
    max_gap = max(gap_vals) if gap_vals else 0
    min_gap = min(gap_vals) if gap_vals else 0
    mon_score, mon_rows = alert_score(alerts)

    speed_score = 0
    if advance <= 0:
        speed_score = 72
    elif stats["advanceSpeed"]["deviationPct"] is not None and abs(stats["advanceSpeed"]["deviationPct"]) >= 40:
        speed_score = 58
    elif stats["advanceSpeed"]["trend"] != "平稳":
        speed_score = 35

    pressure_score = clamp(max(0, (max_pressure - 5.0) * 18) + pressure_spread * 18, 0, 100)
    gap_score = 0
    if max_gap >= 80 or min_gap <= 20:
        gap_score = 88
    elif max_gap >= 65 or min_gap <= 30:
        gap_score = 66
    elif gap_spread >= 35:
        gap_score = 55

    cutter_score = 0
    if cutter_speed <= 0 and cutter_torque <= 0:
        cutter_score = 42
    elif penetration > 0 and cutter_speed <= 0:
        cutter_score = 55
    elif stats["cutterTorque"]["deviationPct"] is not None and abs(stats["cutterTorque"]["deviationPct"]) >= 50:
        cutter_score = 48

    components = [
        component("推进协调", speed_score, level_from_score(speed_score), [f"推进速度 {advance:g} mm/min", f"近时段趋势：{stats['advanceSpeed']['trend']}"], "确认是否停机、保压或采集未刷新。"),
        component("仓压稳定", pressure_score, level_from_score(pressure_score), [f"最大仓压 {max_pressure:.1f} bar", f"仓压差 {pressure_spread:.1f} bar"], "复核仓压传感器、泥水环流和掘进速度。"),
        component("刀盘负荷", cutter_score, level_from_score(cutter_score), [f"刀盘转速 {cutter_speed:g} rpm", f"刀盘扭矩 {cutter_torque:g} kNm", f"贯入度 {penetration:g} mm/r"], "联动查看扭矩、贯入度和刀盘运行状态。"),
        component("盾尾间隙", gap_score, level_from_score(gap_score), [f"间隙范围 {min_gap:.0f}~{max_gap:.0f} mm", f"间隙差 {gap_spread:.0f} mm"], "复核盾尾间隙、姿态调整和管片拼装。"),
        component("监测响应", mon_score, level_from_score(mon_score), [f"关联异常 {len(mon_rows)} 个测点"], "优先复核当前风险窗口内报警点。"),
    ]
    total = round(sum(c["score"] * w for c, w in zip(components, [0.22, 0.24, 0.18, 0.22, 0.14])), 1)
    level = level_from_score(total)

    return {
        "title": "推进、仓压、刀盘与盾尾间隙组合诊断",
        "subtitle": "参数诊断 / 组合异常",
        "level": level,
        "score": total,
        "summary": f"综合风险评分 {total:.0f}。重点看仓压稳定、盾尾间隙和推进协调是否同时异常。",
        "cards": [
            metric("推进速度", advance, "mm/min", level_from_score(speed_score), "当前值", speed_score),
            metric("贯入度", penetration, "mm/r", "正常" if penetration > 0 else "关注", "当前值", 20 if penetration <= 0 else 5),
            metric("最大仓压", max_pressure, "bar", level_from_score(pressure_score), "压力峰值", pressure_score),
            metric("仓压差", pressure_spread, "bar", level_from_score(pressure_score), "压力均衡", pressure_score),
            metric("盾尾最大间隙", max_gap, "mm", level_from_score(gap_score), "间隙峰值", gap_score),
        ],
        "components": components,
        "pressures": pressures,
        "tailGaps": tail_gaps,
        "historyStats": stats,
        "trend": history,
        "alerts": mon_rows[:12],
        "position": report.get("position") or {},
        "currentRisk": report.get("currentRisk") or {},
    }


def build_slurry(ctx: dict[str, Any]) -> dict[str, Any]:
    fields, history, alerts, report = ctx["fields"], ctx["history"], ctx["alerts"], ctx["report"]
    in_flow = fnum(field_value(fields, ["slurryInFlow", "进浆流量", "inFlow", "feedFlow"]), 0) or 0
    out_flow = fnum(field_value(fields, ["slurryOutFlow", "排浆流量", "outFlow", "returnFlow"]), 0) or 0
    in_density = fnum(field_value(fields, ["slurryInDensity", "进浆密度", "inDensity"]), 0) or 0
    out_density = fnum(field_value(fields, ["slurryOutDensity", "排浆密度", "outDensity"]), 0) or 0
    grout_volume = fnum(field_value(fields, ["groutingVolume", "注浆量", "同步注浆量", "groutVolume"]), 0) or 0
    grout_pressure = fnum(field_value(fields, ["groutingPressure", "注浆压力", "groutPressure"]), 0) or 0
    pressure = fnum(field_value(fields, ["chamberPressure1", "开挖仓压力1"]), history[-1].get("chamberPressure1", 0) if history else 0) or 0

    balance = in_flow - out_flow
    balance_ratio = abs(balance) / max(abs(in_flow), abs(out_flow), 1.0)
    density_diff = out_density - in_density
    settlement_score, settlement_rows = alert_score(alerts, settlement_only=True)

    flow_score = 50 if in_flow == 0 and out_flow == 0 else clamp(balance_ratio * 120, 0, 100)
    pressure_score = clamp(max(0, (pressure - 5.5) * 22), 0, 100)
    density_score = 35 if in_density == 0 and out_density == 0 else clamp(abs(density_diff) * 80, 0, 100)
    grouting_score = 50 if grout_volume == 0 and grout_pressure == 0 else clamp(max(0, 20 - grout_volume) * 2 + max(0, 1 - grout_pressure) * 10, 0, 100)

    components = [
        component("环流平衡", flow_score, level_from_score(flow_score), [f"进浆 {in_flow:g} m³/h", f"排浆 {out_flow:g} m³/h", f"差值 {balance:g} m³/h"], "复核进排浆泵组、管路和实时流量采集。"),
        component("仓压稳定", pressure_score, level_from_score(pressure_score), [f"开挖仓压力 {pressure:g} bar"], "联动推进速度、地层和泥水环流判断。"),
        component("浆液状态", density_score, level_from_score(density_score), [f"进浆密度 {in_density:g}", f"排浆密度 {out_density:g}", f"密度差 {density_diff:g}"], "复核浆液密度、携渣能力和泥水处理状态。"),
        component("同步注浆", grouting_score, level_from_score(grouting_score), [f"注浆量 {grout_volume:g} m³", f"注浆压力 {grout_pressure:g} bar"], "确认注浆量、压力和盾尾间隙是否匹配。"),
        component("沉降响应", settlement_score, level_from_score(settlement_score), [f"沉降相关异常 {len(settlement_rows)} 个测点"], "优先查看当前风险窗口内沉降报警点。"),
    ]
    total = round(sum(c["score"] * w for c, w in zip(components, [0.24, 0.22, 0.16, 0.20, 0.18])), 1)
    level = level_from_score(total)
    cards = [
        metric("进浆流量", in_flow, "m³/h", level_from_score(flow_score), "进浆", flow_score),
        metric("排浆流量", out_flow, "m³/h", level_from_score(flow_score), "排浆", flow_score),
        metric("流量差", balance, "m³/h", level_from_score(flow_score), "进排平衡", flow_score),
        metric("开挖仓压力", pressure, "bar", level_from_score(pressure_score), "仓压", pressure_score),
        metric("同步注浆量", grout_volume, "m³", level_from_score(grouting_score), "注浆", grouting_score),
        metric("注浆压力", grout_pressure, "bar", level_from_score(grouting_score), "注浆", grouting_score),
    ]

    return {
        "title": "泥水环流、仓压、同步注浆与沉降响应研判",
        "subtitle": "泥水注浆 / 沉降归因",
        "level": level,
        "score": total,
        "summary": f"综合风险评分 {total:.0f}。重点看进排浆平衡、仓压稳定和沉降响应是否同向出现。",
        "cards": cards,
        "components": components,
        "flowBalance": {"inFlow": in_flow, "outFlow": out_flow, "balance": balance, "balanceRatio": balance_ratio, "densityDiff": density_diff},
        "trend": history,
        "settlementAlerts": settlement_rows[:12],
        "position": report.get("position") or {},
        "currentRisk": report.get("currentRisk") or {},
    }


def build_segment(ctx: dict[str, Any]) -> dict[str, Any]:
    fields, history, alerts, report = ctx["fields"], ctx["history"], ctx["alerts"], ctx["report"]
    tail_gaps = get_tail_gaps(fields)
    gap_vals = [x["value"] for x in tail_gaps] or [fnum(history[-1].get("shieldTailGap1"), 0) if history else 0]
    max_gap = max(gap_vals) if gap_vals else 0
    min_gap = min(gap_vals) if gap_vals else 0
    spread = max_gap - min_gap if gap_vals else 0

    roll = fnum(field_value(fields, ["roll", "滚转角", "rolling"]), 0) or 0
    pitch = fnum(field_value(fields, ["pitch", "俯仰角"]), 0) or 0
    head_h = fnum(field_value(fields, ["headHorizontalOffset", "盾首水平"]), 0) or 0
    head_v = fnum(field_value(fields, ["headVerticalOffset", "盾首垂直"]), 0) or 0
    tail_h = fnum(field_value(fields, ["tailHorizontalOffset", "盾尾水平"]), 0) or 0
    tail_v = fnum(field_value(fields, ["tailVerticalOffset", "盾尾垂直"]), 0) or 0

    settlement_score, settlement_rows = alert_score(alerts, settlement_only=True)
    gap_score = 0
    if max_gap >= 80 or min_gap <= 20:
        gap_score = 90
    elif max_gap >= 65 or min_gap <= 30:
        gap_score = 68
    elif spread >= 35:
        gap_score = 55
    pose_score = clamp(max(abs(roll) * 25, abs(pitch) * 25, abs(head_h) * 0.8, abs(head_v) * 0.8, abs(tail_h) * 0.8, abs(tail_v) * 0.8), 0, 100)
    trend_stats = series_stats(history, "shieldTailGap1")
    trend_score = 45 if trend_stats["trend"] != "平稳" else 10

    components = [
        component("盾尾间隙", gap_score, level_from_score(gap_score), [f"间隙范围 {min_gap:.0f}~{max_gap:.0f} mm", f"间隙差 {spread:.0f} mm"], "复核盾尾刷、铰接姿态和管片拼装姿态。"),
        component("导向姿态", pose_score, level_from_score(pose_score), [f"滚转 {roll:g}°", f"俯仰 {pitch:g}°", f"盾首偏差 H/V {head_h:g}/{head_v:g}"], "检查纠偏策略是否导致间隙变化。"),
        component("间隙趋势", trend_score, level_from_score(trend_score), [f"盾尾间隙趋势：{trend_stats['trend']}", f"最新值 {trend_stats['latest']}"], "连续扩大时需提前复核下一环拼装风险。"),
        component("沉降响应", settlement_score, level_from_score(settlement_score), [f"沉降相关异常 {len(settlement_rows)} 个测点"], "与同步注浆和管片姿态一起复核。"),
    ]
    total = round(sum(c["score"] * w for c, w in zip(components, [0.34, 0.24, 0.16, 0.26])), 1)
    level = level_from_score(total)
    cards = [
        metric("盾尾最大间隙", max_gap, "mm", level_from_score(gap_score), "最大测点", gap_score),
        metric("盾尾最小间隙", min_gap, "mm", level_from_score(gap_score), "最小测点", gap_score),
        metric("间隙差", spread, "mm", level_from_score(gap_score), "均匀性", gap_score),
        metric("滚转角", roll, "°", level_from_score(pose_score), "姿态", pose_score),
        metric("俯仰角", pitch, "°", level_from_score(pose_score), "姿态", pose_score),
    ]

    return {
        "title": "盾尾间隙、导向姿态与管片拼装风险复核",
        "subtitle": "管片盾尾 / 拼装缺陷",
        "level": level,
        "score": total,
        "summary": f"综合风险评分 {total:.0f}。重点看盾尾间隙、姿态偏差和沉降响应是否形成同向证据。",
        "cards": cards,
        "components": components,
        "tailGaps": tail_gaps,
        "pose": {"roll": roll, "pitch": pitch, "headH": head_h, "headV": head_v, "tailH": tail_h, "tailV": tail_v},
        "trend": history,
        "settlementAlerts": settlement_rows[:12],
        "position": report.get("position") or {},
        "currentRisk": report.get("currentRisk") or {},
    }


@router.get("/api/report-cockpit/specialized-pages-v2")
def specialized_pages_v2(deviceId: str = "DZ1360"):
    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(collect_context, deviceId)
            ctx = future.result(timeout=3.0)
        return {
            "code": 0,
            "data": {
                "generatedAt": ctx["generatedAt"],
                "deviceId": deviceId,
                "operation": build_operation(ctx),
                "slurry": build_slurry(ctx),
                "segment": build_segment(ctx),
                "report": ctx["report"],
            },
            "message": "ok",
            "dataMode": "realtime",
        }
    except FuturesTimeoutError:
        return fast_specialized_payload(device_id=deviceId, mode="cached_timeout")
    except Exception as exc:
        return fast_specialized_payload(device_id=deviceId, mode="degraded")
