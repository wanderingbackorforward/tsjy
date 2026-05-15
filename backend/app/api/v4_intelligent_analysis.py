from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Body, Query

router = APIRouter()

LOCAL_API_BASE = os.getenv("LOCAL_PLATFORM_API_BASE", "http://127.0.0.1:8100").rstrip("/")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
DEEPSEEK_REASONER_MODEL = os.getenv("DEEPSEEK_REASONER_MODEL", "deepseek-reasoner")
DEEPSEEK_TIMEOUT_SECONDS = float(os.getenv("DEEPSEEK_TIMEOUT_SECONDS", "25"))


def now_text() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def safe_float(v: Any, default: Optional[float] = None) -> Optional[float]:
    if v is None or v == "":
        return default
    try:
        return float(v)
    except Exception:
        return default


def as_list(v: Any) -> list[Any]:
    if isinstance(v, list):
        return v
    if isinstance(v, dict):
        for key in ("items", "data", "records", "risks", "riskSources", "events"):
            if isinstance(v.get(key), list):
                return v.get(key) or []
        data = v.get("data")
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            return as_list(data)
    return []


def local_get(path: str, timeout: float = 4.0) -> dict[str, Any]:
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


def first_success(paths: list[str], list_expected: bool = False) -> dict[str, Any]:
    errors: list[str] = []
    for path in paths:
        resp = local_get(path)
        if resp.get("code") == -1:
            errors.append(f"{path}: {resp.get('error')}")
            continue
        data = unwrap(resp)
        if list_expected and not as_list(data):
            errors.append(f"{path}: empty")
            continue
        return {"path": path, "response": resp, "data": data, "error": None}
    return {"path": "", "response": None, "data": [] if list_expected else {}, "error": "; ".join(errors)}


def field_value(snapshot: dict[str, Any], key: str) -> Any:
    if not isinstance(snapshot, dict):
        return None
    fields = snapshot.get("fields")
    if isinstance(fields, dict):
        f = fields.get(key) or {}
        if isinstance(f, dict):
            return f.get("value", f.get("displayValue", f.get("rawValue")))
        return f
    if key in snapshot:
        return snapshot.get(key)
    tbm = snapshot.get("tbm")
    if isinstance(tbm, dict):
        return field_value(tbm, key)
    return None


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
        "pipeline_settlement": "管线沉降",
        "unknown": "待归类",
    }
    return mapping.get(raw.lower(), raw or "待归类")


def severity_rank(level: Any) -> int:
    s = str(level or "").lower()
    if "报警" in s or "alarm" in s or "critical" in s:
        return 3
    if "预警" in s or "warning" in s:
        return 2
    if "复核" in s or "待" in s or "confirm" in s:
        return 1
    return 0


def public_context(device_id: str = "DZ1360") -> dict[str, Any]:
    position = unwrap(local_get(f"/api/position-context?deviceId={device_id}")) or {}
    tbm = unwrap(local_get(f"/api/tbm/frontend-summary?deviceId={device_id}")) or {}
    history = unwrap(local_get(f"/api/tbm/history?deviceId={device_id}&limit=120")) or {}
    guidance = unwrap(local_get(f"/api/tbm/guidance/latest?deviceId={device_id}")) or {}
    nearby = unwrap(local_get(f"/api/monitoring/nearby-alerts?deviceId={device_id}&limit=60")) or {}
    gaps = unwrap(local_get("/api/data-gaps")) or {}

    risks = first_success(
        [
            "/api/risk-sources",
            "/api/risks",
            "/api/engineering/risk-sources",
            "/api/risk-replay/sources",
        ],
        list_expected=True,
    )
    events = first_success(
        [
            "/api/events",
            "/api/event-log",
            "/api/event-closure",
            "/api/events/list",
        ],
        list_expected=True,
    )

    return {
        "generatedAt": now_text(),
        "deviceId": device_id,
        "positionContext": position,
        "tbmSnapshot": tbm,
        "tbmHistory": history,
        "guidance": guidance,
        "monitoringAlerts": nearby,
        "riskSources": as_list(risks.get("data")),
        "riskSourcesMeta": {"path": risks.get("path"), "error": risks.get("error")},
        "events": as_list(events.get("data")),
        "eventsMeta": {"path": events.get("path"), "error": events.get("error")},
        "dataGaps": gaps,
        "sourceEndpoints": {
            "positionContext": "/api/position-context",
            "tbmSnapshot": "/api/tbm/frontend-summary",
            "tbmHistory": "/api/tbm/history",
            "guidance": "/api/tbm/guidance/latest",
            "monitoringAlerts": "/api/monitoring/nearby-alerts",
            "dataGaps": "/api/data-gaps",
            "riskSources": risks.get("path"),
            "events": events.get("path"),
        },
    }


def compact_history(history: Any) -> list[dict[str, Any]]:
    items = as_list(history)
    if isinstance(history, dict) and isinstance(history.get("items"), list):
        items = history.get("items") or []
    out: list[dict[str, Any]] = []
    for x in items[-80:]:
        if not isinstance(x, dict):
            continue
        out.append(
            {
                "time": str(x.get("timestamp") or x.get("receivedAt") or x.get("time") or "")[-8:],
                "advanceSpeed": safe_float(x.get("advanceSpeed"), 0),
                "penetration": safe_float(x.get("penetration"), 0),
                "chamberPressure1": safe_float(x.get("chamberPressure1"), 0),
                "shieldTailGap1": safe_float(x.get("shieldTailGap1"), 0),
                "cutterSpeed": safe_float(x.get("cutterSpeed"), 0),
                "cutterTorque": safe_float(x.get("cutterTorque"), 0),
            }
        )
    return out


def compact_alerts(alerts: Any) -> list[dict[str, Any]]:
    data = alerts if isinstance(alerts, dict) else {}
    items = data.get("items") if isinstance(data.get("items"), list) else as_list(alerts)
    out: list[dict[str, Any]] = []
    for x in items[:60]:
        if not isinstance(x, dict):
            continue
        out.append(
            {
                "pointCode": x.get("pointCode") or x.get("point_code") or "--",
                "level": x.get("alertLevelCn") or x.get("level") or "待复核",
                "item": cn_item(x.get("monitoringItemCn") or x.get("monitoringItem")),
                "latestValue": x.get("latestValue"),
                "distanceM": x.get("distanceM"),
                "reason": x.get("rankingReason") or "",
                "time": x.get("latestTime") or "",
                "riskName": x.get("riskName") or "",
            }
        )
    return out


def build_rule_diagnosis(ctx: dict[str, Any]) -> dict[str, Any]:
    pos = ctx.get("positionContext") or {}
    tbm = ctx.get("tbmSnapshot") or {}
    history = compact_history(ctx.get("tbmHistory") or {})
    guidance = ctx.get("guidance") or {}
    alerts = compact_alerts(ctx.get("monitoringAlerts") or {})
    gaps = ctx.get("dataGaps") or {}
    matched = pos.get("matchedRiskSources") or []
    nearest = pos.get("nearestRiskSources") or []

    matched_risk = matched[0] if matched else None
    alarm_count = sum(1 for x in alerts if str(x.get("level")) == "报警")
    warning_count = sum(1 for x in alerts if str(x.get("level")) == "预警")
    confirm_count = sum(1 for x in alerts if "复核" in str(x.get("level")))

    advance_speed = safe_float(field_value(tbm, "advanceSpeed"), 0) or 0
    penetration = safe_float(field_value(tbm, "penetration"), 0) or 0
    pressure1 = safe_float(field_value(tbm, "chamberPressure1"), 0) or 0
    gap1 = safe_float(field_value(tbm, "shieldTailGap1"), 0) or 0

    guidance_fields = guidance.get("fields") if isinstance(guidance.get("fields"), dict) else {}
    position_source = str(pos.get("positionSource") or "")
    guidance_ok = position_source == "guidance" or bool(guidance.get("guidanceAvailable"))

    level = "关注"
    if matched_risk and alarm_count >= 3:
        level = "报警"
    elif matched_risk and (alarm_count > 0 or warning_count > 0):
        level = "预警"
    elif not guidance_ok:
        level = "关注"
    elif alarm_count > 0:
        level = "预警"
    elif not alerts:
        level = "关注"

    findings: list[dict[str, Any]] = []

    if matched_risk:
        findings.append(
            {
                "title": "当前位置已进入重点风险窗口",
                "level": "warning" if level != "报警" else "alarm",
                "evidence": [
                    f"盾首里程 {pos.get('headMileageText') or '--'}",
                    f"风险源 {matched_risk.get('riskName') or '--'}：{matched_risk.get('startMileage') or '--'} - {matched_risk.get('endMileage') or '--'}",
                    f"穿越关系 {matched_risk.get('crossingRelation') or '待确认'}",
                ],
                "confidence": 0.86 if guidance_ok else 0.62,
            }
        )
    else:
        findings.append(
            {
                "title": "当前位置尚未命中风险窗口",
                "level": "attention",
                "evidence": [
                    f"盾首里程 {pos.get('headMileageText') or '--'}",
                    f"最近风险源数量 {len(nearest)}",
                ],
                "confidence": 0.7 if guidance_ok else 0.45,
            }
        )

    if alerts:
        top_points = [str(x.get("pointCode")) for x in alerts[:5]]
        item_counter: dict[str, int] = {}
        for x in alerts:
            item_counter[str(x.get("item") or "待归类")] = item_counter.get(str(x.get("item") or "待归类"), 0) + 1
        main_item = max(item_counter.items(), key=lambda kv: kv[1])[0] if item_counter else "待归类"
        findings.append(
            {
                "title": "监测异常集中在邻近优先列表",
                "level": "alarm" if alarm_count >= 3 else ("warning" if warning_count or alarm_count else "attention"),
                "evidence": [
                    f"报警 {alarm_count} 条，预警 {warning_count} 条，待复核 {confirm_count} 条",
                    f"主要监测项目：{main_item}",
                    f"优先测点：{', '.join(top_points)}",
                ],
                "confidence": 0.78,
            }
        )
    else:
        findings.append(
            {
                "title": "监测异常接口未返回有效列表",
                "level": "attention",
                "evidence": ["monitoringAlerts.items 为空或接口未接通"],
                "confidence": 0.5,
            }
        )

    param_evidence = [
        f"推进速度 {advance_speed:g} mm/min",
        f"贯入度 {penetration:g} mm/r",
        f"开挖仓压力1# {pressure1:g} bar",
        f"盾尾间隙1# {gap1:g} mm",
    ]
    param_level = "attention"
    if pressure1 >= 6 or gap1 >= 40 or advance_speed == 0:
        param_level = "warning"
    findings.append(
        {
            "title": "掘进参数需要组合复核",
            "level": param_level,
            "evidence": param_evidence,
            "confidence": 0.68,
        }
    )

    if guidance_fields:
        findings.append(
            {
                "title": "导向姿态字段已形成研判基础",
                "level": "normal",
                "evidence": [
                    f"导向字段数量 {len(guidance_fields)}",
                    f"导向环 {pos.get('guidanceRing') or guidance.get('position', {}).get('guidanceRing') or '--'}",
                    f"盾首/盾中/盾尾：{pos.get('headMileageText') or '--'} / {pos.get('middleMileageText') or '--'} / {pos.get('tailMileageText') or '--'}",
                ],
                "confidence": 0.82,
            }
        )
    else:
        findings.append(
            {
                "title": "导向姿态字段尚未完整进入上下文",
                "level": "attention",
                "evidence": ["guidance.fields 为空"],
                "confidence": 0.52,
            }
        )

    causal_chains: list[dict[str, Any]] = []
    if alerts:
        causal_chains.append(
            {
                "name": "风险窗口 → 掘进参数 → 监测响应",
                "nodes": ["当前风险源窗口", "推进/仓压/盾尾间隙", "邻近监测异常", "处置复核"],
                "evidence": [
                    f"当前位置 {pos.get('headMileageText') or '--'}",
                    f"风险源 {matched_risk.get('riskName') if matched_risk else '未命中'}",
                    f"优先异常测点 {', '.join([str(x.get('pointCode')) for x in alerts[:3]])}",
                ],
                "confidence": 0.72 if matched_risk else 0.55,
            }
        )
    causal_chains.append(
        {
            "name": "导向姿态 → 盾尾间隙 → 管片/沉降风险",
            "nodes": ["导向偏差", "盾尾间隙", "同步注浆/管片姿态", "地表或结构响应"],
            "evidence": [
                f"导向字段数量 {len(guidance_fields)}",
                f"盾尾间隙1# {gap1:g} mm",
                f"监测异常数量 {len(alerts)}",
            ],
            "confidence": 0.6 if guidance_fields else 0.42,
        }
    )

    actions: list[dict[str, Any]] = [
        {
            "action": "优先复核当前风险窗口内报警测点",
            "priority": "高" if alarm_count else "中",
            "reason": "当前位置已和风险源、监测异常联动，报警测点优先级最高。" if matched_risk else "当前未命中风险窗口，仍需按异常等级复核。",
        },
        {
            "action": "同步查看推进速度、仓压、盾尾间隙和导向偏差",
            "priority": "高" if param_level == "warning" else "中",
            "reason": "单一参数不足以判断施工风险，需看组合趋势和异常时段。",
        },
        {
            "action": "补齐监测点里程字段并校验测点与风险源绑定",
            "priority": "中",
            "reason": "若测点里程覆盖不足，邻近预警只能按当前风险源和最新异常兜底排序。",
        },
    ]

    data_gaps: list[dict[str, Any]] = []
    coverage = ((gaps.get("monitoringLocation") or {}).get("coverage") or {}) if isinstance(gaps, dict) else {}
    total = coverage.get("total")
    mileage_count = coverage.get("mileageMCount") or coverage.get("mileageCount")
    if total and mileage_count is not None and mileage_count < total:
        data_gaps.append(
            {
                "field": "monitoring_point.mileage_m",
                "impact": f"监测点里程覆盖 {mileage_count}/{total}，会影响邻近预警距离排序。",
            }
        )
    if not guidance_ok:
        data_gaps.append(
            {
                "field": "guidance.latest",
                "impact": "缺少实时导向里程会导致当前位置只能使用兜底推算。",
            }
        )
    if not ctx.get("events"):
        data_gaps.append(
            {
                "field": "event_log",
                "impact": "事件处置记录为空或接口未接通，会影响闭环建议可信度。",
            }
        )

    risk_windows: list[dict[str, Any]] = []
    for r in (matched + nearest)[:10]:
        if isinstance(r, dict):
            risk_windows.append(
                {
                    "riskName": r.get("riskName"),
                    "startMileage": r.get("startMileage"),
                    "endMileage": r.get("endMileage"),
                    "startMileageM": r.get("startMileageM"),
                    "endMileageM": r.get("endMileageM"),
                    "distanceM": r.get("distanceM"),
                    "level": r.get("protectionLevel") or r.get("riskLevel"),
                    "matched": bool(matched_risk and r.get("riskName") == matched_risk.get("riskName")),
                }
            )

    chart_data = {
        "riskWindow": {
            "headMileageM": pos.get("headMileageM"),
            "headMileageText": pos.get("headMileageText"),
            "items": risk_windows,
        },
        "monitoringAlerts": alerts[:40],
        "parameterTrend": history,
        "causalGraph": {
            "nodes": [
                {"name": "当前位置"},
                {"name": "风险源"},
                {"name": "掘进参数"},
                {"name": "导向姿态"},
                {"name": "监测异常"},
                {"name": "处置建议"},
            ],
            "links": [
                {"source": "当前位置", "target": "风险源"},
                {"source": "风险源", "target": "监测异常"},
                {"source": "掘进参数", "target": "监测异常"},
                {"source": "导向姿态", "target": "掘进参数"},
                {"source": "监测异常", "target": "处置建议"},
            ],
        },
    }

    summary = (
        f"当前盾首位于 {pos.get('headMileageText') or '未知里程'}，"
        f"{'命中' + str(matched_risk.get('riskName')) if matched_risk else '未命中明确风险源'}；"
        f"邻近异常中报警 {alarm_count} 条、预警 {warning_count} 条。"
    )

    return {
        "source": "rule",
        "generatedAt": now_text(),
        "deviceId": ctx.get("deviceId"),
        "overallLevel": level,
        "summary": summary,
        "keyFindings": findings,
        "causalChains": causal_chains,
        "recommendedActions": actions,
        "dataGaps": data_gaps,
        "chartData": chart_data,
        "evidenceIndex": {
            "positionSource": ctx.get("sourceEndpoints", {}).get("positionContext"),
            "tbmSource": ctx.get("sourceEndpoints", {}).get("tbmSnapshot"),
            "monitoringSource": ctx.get("sourceEndpoints", {}).get("monitoringAlerts"),
            "riskSource": ctx.get("sourceEndpoints", {}).get("riskSources"),
            "eventsSource": ctx.get("sourceEndpoints", {}).get("events"),
        },
    }


DIAGNOSIS_PROMPT = """你是盾构施工监控研判系统中的智能诊断模块。

你只能基于输入 JSON 中的事实进行分析，不允许编造不存在的数据、测点、阈值、地质条件、施工记录或处置结果。

输入数据包含：
1. positionContext：当前盾构位置、盾首/盾中/盾尾里程、导向环号、工程环号、当前风险源。
2. tbmSnapshot：当前 TBM 参数，包括推进速度、贯入度、总推力、刀盘转速、刀盘扭矩、开挖仓压力、盾尾间隙、泥水流量、注浆量等。
3. tbmHistory：近时段 TBM 参数历史。
4. guidance：导向系统字段，包括盾首/盾中/盾尾偏差、滚转角、俯仰角、水平/垂直趋势、前方预测偏差。
5. monitoringAlerts：当前风险源或当前位置附近的监测异常点。
6. riskSources：风险源台账。
7. events：事件和处置记录。
8. dataGaps：数据质量和字段缺口。

你的任务：
- 判断当前施工状态等级：正常 / 关注 / 预警 / 报警。
- 找出最重要的 3～5 个风险点。
- 建立可能的因果链条，例如：推进参数异常 → 姿态偏差 → 盾尾间隙变化 → 地表沉降响应。
- 对每个结论给出证据，不允许只给观点。
- 对每个结论给出 confidence，范围 0～1。
- 如果数据不足，必须明确写出缺什么数据。
- 输出必须是严格 JSON，不要 Markdown，不要解释 JSON 外的文字。

输出格式：
{
  "overallLevel": "正常|关注|预警|报警",
  "summary": "一句话总判断",
  "keyFindings": [
    {
      "title": "发现标题",
      "level": "normal|attention|warning|alarm",
      "evidence": ["证据1", "证据2"],
      "confidence": 0.0
    }
  ],
  "causalChains": [
    {
      "name": "因果链名称",
      "nodes": ["原因", "中间表现", "结果"],
      "evidence": ["证据1", "证据2"],
      "confidence": 0.0
    }
  ],
  "recommendedActions": [
    {
      "action": "建议动作",
      "priority": "高|中|低",
      "reason": "为什么建议"
    }
  ],
  "dataGaps": [
    {
      "field": "缺失字段",
      "impact": "影响什么判断"
    }
  ],
  "chartHints": {
    "riskWindow": "风险窗口图应突出当前盾首位置与命中风险源",
    "parameterTrend": "参数趋势图应突出异常时段",
    "monitoringAlerts": "监测异常图应按当前位置或风险源邻近优先"
  }
}
"""


def extract_json_from_text(text: str) -> dict[str, Any]:
    t = text.strip()
    if t.startswith("```"):
        t = t.strip("`")
        if t.lower().startswith("json"):
            t = t[4:].strip()
    try:
        return json.loads(t)
    except Exception:
        pass
    start = t.find("{")
    end = t.rfind("}")
    if start >= 0 and end > start:
        return json.loads(t[start : end + 1])
    raise ValueError("LLM did not return valid JSON")


def deepseek_diagnose(ctx: dict[str, Any], rule_result: dict[str, Any], model: str) -> tuple[Optional[dict[str, Any]], Optional[str]]:
    if not DEEPSEEK_API_KEY:
        return None, "DEEPSEEK_API_KEY not configured"

    payload_context = {
        "context": ctx,
        "ruleDiagnosis": rule_result,
    }
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": DIAGNOSIS_PROMPT},
            {"role": "user", "content": json.dumps(payload_context, ensure_ascii=False)[:24000]},
        ],
        "temperature": 0.1,
        "stream": False,
        "response_format": {"type": "json_object"} if model != DEEPSEEK_REASONER_MODEL else None,
    }
    # DeepSeek may not accept null response_format.
    body = {k: v for k, v in body.items() if v is not None}

    req = urllib.request.Request(
        f"{DEEPSEEK_BASE_URL}/chat/completions",
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=DEEPSEEK_TIMEOUT_SECONDS) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        parsed = extract_json_from_text(content)
        parsed["source"] = "ai"
        parsed["model"] = model
        parsed["generatedAt"] = now_text()
        # Preserve chartData/evidence from deterministic rule layer.
        parsed.setdefault("chartData", rule_result.get("chartData"))
        parsed.setdefault("evidenceIndex", rule_result.get("evidenceIndex"))
        return parsed, None
    except urllib.error.HTTPError as exc:
        try:
            detail = exc.read().decode("utf-8")
        except Exception:
            detail = str(exc)
        return None, f"DeepSeek HTTP {exc.code}: {detail[:500]}"
    except Exception as exc:
        return None, str(exc)


@router.get("/api/intelligent-analysis/health")
def health():
    return {
        "code": 0,
        "data": {
            "enabled": True,
            "localApiBase": LOCAL_API_BASE,
            "deepseekConfigured": bool(DEEPSEEK_API_KEY),
            "defaultModel": DEEPSEEK_MODEL,
            "reasonerModel": DEEPSEEK_REASONER_MODEL,
            "strategy": {
                "rule": "只使用本地接口和确定性规则，最稳定。",
                "ai": "基于规则诊断和本地上下文调用 DeepSeek，失败自动降级为 rule。",
                "reasoner": "调用 deepseek-reasoner，适合复杂归因，延迟更高，失败自动降级。",
            },
        },
    }


@router.get("/api/intelligent-analysis/context")
def context(deviceId: str = "DZ1360"):
    return {"code": 0, "data": public_context(deviceId)}


@router.get("/api/intelligent-analysis/rule-diagnosis")
def rule_diagnosis(deviceId: str = "DZ1360"):
    ctx = public_context(deviceId)
    result = build_rule_diagnosis(ctx)
    return {"code": 0, "data": result}


@router.get("/api/intelligent-analysis/diagnose")
def diagnose_get(
    deviceId: str = "DZ1360",
    mode: str = Query("rule", pattern="^(rule|ai|reasoner)$"),
):
    return diagnose_post({"deviceId": deviceId, "mode": mode})


@router.post("/api/intelligent-analysis/diagnose")
def diagnose_post(payload: dict[str, Any] = Body(default_factory=dict)):
    start = time.time()
    device_id = str(payload.get("deviceId") or "DZ1360")
    mode = str(payload.get("mode") or "rule")
    ctx = public_context(device_id)
    rule_result = build_rule_diagnosis(ctx)

    if mode == "rule":
        rule_result["latencyMs"] = int((time.time() - start) * 1000)
        return {"code": 0, "data": rule_result}

    model = DEEPSEEK_REASONER_MODEL if mode == "reasoner" else DEEPSEEK_MODEL
    ai_result, ai_error = deepseek_diagnose(ctx, rule_result, model)
    if ai_result is not None:
        ai_result["latencyMs"] = int((time.time() - start) * 1000)
        ai_result["fallbackUsed"] = False
        return {"code": 0, "data": ai_result}

    fallback = dict(rule_result)
    fallback["source"] = "rule_fallback"
    fallback["modeRequested"] = mode
    fallback["aiError"] = ai_error
    fallback["fallbackUsed"] = True
    fallback["latencyMs"] = int((time.time() - start) * 1000)
    return {"code": 0, "data": fallback}
