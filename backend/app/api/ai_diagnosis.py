from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Body, Query

router = APIRouter()


BACKEND_ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = BACKEND_ROOT / ".env"
LOCAL_API_BASE = os.getenv("LOCAL_PLATFORM_API_BASE", "http://127.0.0.1:8100").rstrip("/")


def format_dk_mileage(mileage_m: float) -> str:
    m = int(round(float(mileage_m)))
    km = m // 1000
    meter = abs(m - km * 1000)
    return f"DK{km}+{meter:03d}"


def derive_position_from_ring(ring_value: Any) -> dict[str, Any]:
    try:
        ring = float(ring_value)
    except Exception:
        ring = 5325.0
    anchor_ring = 1152.0
    anchor_mileage_m = 55998.0
    ring_width_m = 2.0
    mileage_m = anchor_mileage_m + (ring - anchor_ring) * ring_width_m
    return {
        "source": "derived_display_calibration",
        "ring": int(round(ring)),
        "mileageM": round(mileage_m, 3),
        "mileage": format_dk_mileage(mileage_m),
        "formula": f"DK55+998 + ({int(round(ring))} - 1152) × 2.0m = {format_dk_mileage(mileage_m)}",
        "confidence": "demo_calibrated_from_extracted_anchor",
        "note": "用于汇报展示和风险窗口联动；若数据库 ring_mileage_map 缺失，不应再表述为无法定位，而应说明采用演示标定公式。",
    }


def _load_env_file() -> dict[str, str]:
    data: dict[str, str] = {}
    if not ENV_PATH.exists():
        return data
    for raw in ENV_PATH.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        data[k.strip()] = v.strip().strip('"').strip("'")
    return data


def cfg(name: str, default: str = "") -> str:
    return os.getenv(name) or _load_env_file().get(name) or default


def mask_key(value: str | None) -> str:
    if not value:
        return ""
    value = str(value)
    if len(value) <= 12:
        return "***"
    return value[:6] + "..." + value[-4:]


def enabled() -> bool:
    return cfg("AI_DIAGNOSIS_ENABLED", "true").lower() not in ("0", "false", "no", "off")


def deepseek_endpoint() -> str:
    base = cfg("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
    if base.endswith("/chat/completions"):
        return base
    return base + "/chat/completions"


def local_get(path: str, params: dict[str, Any] | None = None, timeout: float = 3.0) -> dict[str, Any]:
    params = params or {}
    query = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    url = LOCAL_API_BASE + path + (("?" + query) if query else "")
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        return {"ok": True, "url": path, "data": payload.get("data", payload)}
    except Exception as exc:
        return {"ok": False, "url": path, "error": str(exc)}


def slim_tbm(data: dict[str, Any]) -> dict[str, Any]:
    d = data or {}
    fields = d.get("fields") or {}
    def fv(key: str) -> Any:
        f = fields.get(key)
        if isinstance(f, dict):
            return {
                "name": f.get("nameCn") or key,
                "value": f.get("displayValue"),
                "unit": f.get("unit") or "",
                "status": f.get("status") or f.get("decodeStatus"),
            }
        return None

    keys = [
        "currentRing", "advanceSpeed", "penetration", "totalThrust",
        "cutterSpeed", "cutterTorque",
        "chamberPressure1", "chamberPressure2", "chamberPressure3",
        "slurryInFlow", "slurryOutFlow", "slurryInPressure",
        "slurryInDensity", "slurryOutDensity", "groutTotal",
        "shieldTailGap1", "shieldTailGap2", "shieldTailGap3",
        "segmentPosition",
    ]
    return {
        "deviceId": d.get("deviceId"),
        "timestamp": d.get("timestamp"),
        "rawLength": d.get("rawLength"),
        "rawLengthOk": d.get("rawLengthOk"),
        "decodeQuality": d.get("decodeQuality"),
        "fields": {k: fv(k) for k in keys if fv(k) is not None},
        "warnings": (d.get("qualityWarnings") or [])[:12],
    }


def slim_history(data: dict[str, Any], limit: int = 20) -> dict[str, Any]:
    items = data.get("items") if isinstance(data, dict) else []
    if not isinstance(items, list):
        items = []
    keep = []
    for x in items[-limit:]:
        if not isinstance(x, dict):
            continue
        keep.append({
            "timestamp": x.get("timestamp") or x.get("receivedAt"),
            "currentRing": x.get("currentRing"),
            "advanceSpeed": x.get("advanceSpeed"),
            "penetration": x.get("penetration"),
            "chamberPressure1": x.get("chamberPressure1"),
            "slurryInFlow": x.get("slurryInFlow"),
            "slurryOutFlow": x.get("slurryOutFlow"),
            "groutTotal": x.get("groutTotal"),
            "shieldTailGap1": x.get("shieldTailGap1"),
        })
    return {"count": data.get("count") if isinstance(data, dict) else len(items), "items": keep}


def build_context(device_id: str = "DZ1360", point_code: str | None = None) -> dict[str, Any]:
    tbm = local_get("/api/tbm/frontend-summary", {"deviceId": device_id})
    history = local_get("/api/tbm/history", {"deviceId": device_id, "limit": 80})
    monitoring = local_get("/api/monitoring/summary")
    risks = local_get("/api/risk-sources")
    events = local_get("/api/events", {"limit": 8})
    gaps = local_get("/api/data-gaps")
    position_ctx = local_get("/api/position-context", {"deviceId": device_id})

    point = None
    if point_code:
        point = local_get("/api/monitoring/point-trend", {"pointCode": point_code, "limit": 80})

    tbm_slim = slim_tbm(tbm.get("data") if tbm.get("ok") else {})
    current_ring = ((tbm_slim.get("fields") or {}).get("currentRing") or {}).get("value")
    derived_position = derive_position_from_ring(current_ring)

    data_gaps = gaps.get("data") if gaps.get("ok") else {"error": gaps.get("error")}
    if isinstance(data_gaps, dict):
        data_gaps = dict(data_gaps)
        data_gaps["positionHandling"] = "数据库映射缺失时，页面采用 derivedPosition 演示标定公式；AI 不应输出“无法定位”为最终结论。"

    return {
        "generatedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
        "deviceId": device_id,
        "derivedPosition": derived_position,
        "tbm": tbm_slim,
        "history": slim_history(history.get("data") if history.get("ok") else {}),
        "monitoringSummary": monitoring.get("data") if monitoring.get("ok") else {"error": monitoring.get("error")},
        "riskSources": (risks.get("data", {}).get("items") if risks.get("ok") and isinstance(risks.get("data"), dict) else [])[:12],
        "events": (events.get("data", {}).get("items") if events.get("ok") and isinstance(events.get("data"), dict) else [])[:8],
        "positionContext": position_ctx.get("data") if position_ctx.get("ok") else {"error": position_ctx.get("error")},
        "dataGaps": data_gaps,
        "pointTrend": (point.get("data") if point and point.get("ok") else None),
        "apiErrors": [x for x in [tbm, history, monitoring, risks, events, gaps, position_ctx, point] if x and not x.get("ok")],
    }


def rule_diagnosis(mode: str, ctx: dict[str, Any]) -> dict[str, Any]:
    tbm = ctx.get("tbm") or {}
    fields = tbm.get("fields") or {}
    q = tbm.get("decodeQuality") or {}
    monitoring = ctx.get("monitoringSummary") or {}
    total = monitoring.get("total") or {}
    risks = ctx.get("riskSources") or []
    events = ctx.get("events") or []

    def val(key: str) -> Any:
        return (fields.get(key) or {}).get("value")

    current_ring = val("currentRing")
    derived_position = ctx.get("derivedPosition") or derive_position_from_ring(current_ring)
    speed = val("advanceSpeed")
    penetration = val("penetration")
    chamber = [val("chamberPressure1"), val("chamberPressure2"), val("chamberPressure3")]
    gaps = [val("shieldTailGap1"), val("shieldTailGap2"), val("shieldTailGap3")]
    warnings: list[str] = []
    suggestions: list[str] = []

    try:
        ch_nums = [float(x) for x in chamber if x is not None]
        if ch_nums and max(ch_nums) - min(ch_nums) > 1:
            warnings.append("开挖仓 1#/2#/3# 压差偏大，需要复核仓压均衡。")
    except Exception:
        pass

    try:
        gap_nums = [float(x) for x in gaps if x is not None]
        if gap_nums and max(gap_nums) - min(gap_nums) > 35:
            warnings.append("盾尾间隙差偏大，需要复核姿态纠偏和同步注浆。")
    except Exception:
        pass

    if speed in (0, "0", None):
        warnings.append("推进速度当前为 0，需确认是否处于停机、拼装或采集字段异常。")
    if (q.get("pending") or 0) > 0 or (q.get("scale_pending") or 0) > 0:
        suggestions.append("待解释/待校准字段仍存在，AI 结论只作为复核建议，不作为强判定。")

    abnormal = total.get("abnormalCount") or total.get("concernCount") or 0
    alarm = 0
    for r in monitoring.get("levelCount") or []:
        if str(r.get("alertLevel")).lower() == "alarm":
            alarm = r.get("count") or 0

    suggestions.extend([
        "优先复核报警测点的最新累计变化和源文件证据。",
        "联动查看推进速度、仓压、盾尾间隙、进排浆流量和注浆累计量是否同一时段波动。",
        "对风险源窗口内测点提高监测频率，并记录处置闭环。",
    ])

    summary = (
        f"当前设备 {ctx.get('deviceId')}，现场环号 {current_ring}，"
        f"按演示标定公式推算位置为 {derived_position.get('mileage')}。"
        f"历史监测需关注读数约 {abnormal} 条，其中报警约 {alarm} 条。"
        f"风险源台账 {len(risks)} 个，事件记录 {len(events)} 条。"
    )

    if mode == "slurry":
        summary += " 本次重点关注泥水循环、仓压和同步注浆对沉降响应的影响。"
    elif mode == "segment":
        summary += " 本次重点关注盾尾间隙、管片拼装位置和注浆状态。"
    elif mode == "operation":
        summary += " 本次重点关注推进、贯入、仓压、刀盘和盾尾姿态组合。"
    elif mode == "monitoring":
        summary += " 本次重点关注报警/预警测点、日期趋势和单点曲线。"
    else:
        summary += " 本次为平台总览研判。"

    return {
        "summary": summary,
        "warnings": warnings,
        "suggestions": suggestions,
        "confidence": "中等：基于规则和当前已接入接口生成，字段待校准时需人工复核。",
    }


def call_deepseek(messages: list[dict[str, str]], *, model: str | None = None) -> dict[str, Any]:
    api_key = cfg("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY not configured")

    payload = {
        "model": model or cfg("DEEPSEEK_MODEL", "deepseek-chat"),
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": int(cfg("DEEPSEEK_MAX_TOKENS", "1400")),
    }
    req = urllib.request.Request(
        deepseek_endpoint(),
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    timeout = float(cfg("DEEPSEEK_TIMEOUT_SECONDS", "25"))
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def build_prompt(mode: str, ctx: dict[str, Any], question: str | None = None) -> list[dict[str, str]]:
    system = (
        "你是盾构施工监控研判助手。必须基于给定平台接口上下文做工程复核建议，"
        "不能编造未提供的数据，不能把待校准字段当成强结论。"
        "如果 context.positionContext.positionSource 是 guidance，必须优先使用该实时导向里程和导向环号。"
        "只有没有 guidance 时，才使用 context.derivedPosition 演示标定公式。"
        "如果 context.derivedPosition 存在，必须把它作为当前展示位置，"
        "不要再把 ring_mileage_map 缺失表述为无法定位；只能说数据库正式映射待补，展示采用演示标定公式。"
        "输出中文，面向汇报大屏，不要写过长。严格按四段输出："
        "1）当前结论；2）主要证据；3）风险点；4）建议动作。"
        "每段最多3条，每条不超过45字。建议动作要具体到施工参数、监测复核、风险源窗口或处置闭环。"
    )
    user = {
        "mode": mode,
        "question": question or "",
        "context": ctx,
    }
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": json.dumps(user, ensure_ascii=False)[:18000]},
    ]


@router.get("/api/ai-diagnosis/health")
def ai_health():
    api_key = cfg("DEEPSEEK_API_KEY")
    return {
        "code": 0,
        "data": {
            "enabled": enabled(),
            "provider": "deepseek",
            "baseUrl": cfg("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
            "endpoint": deepseek_endpoint(),
            "model": cfg("DEEPSEEK_MODEL", "deepseek-chat"),
            "keyConfigured": bool(api_key),
            "keyMasked": mask_key(api_key),
            "timeoutSeconds": float(cfg("DEEPSEEK_TIMEOUT_SECONDS", "25")),
            "strategy": {
                "rule": "只用本地接口上下文和规则，不调用 DeepSeek，最稳定。",
                "ai": "调用 DeepSeek，总结研判，失败自动返回规则兜底。",
                "reasoner": "调用 deepseek-reasoner，适合复杂归因，但延迟更高。",
            },
        },
    }


@router.get("/api/ai-diagnosis/context")
def ai_context(deviceId: str = Query("DZ1360"), pointCode: str | None = Query(None)):
    return {"code": 0, "data": build_context(deviceId, pointCode)}


@router.post("/api/ai-diagnosis/diagnose")
def diagnose(payload: dict[str, Any] = Body(default_factory=dict)):
    mode = str(payload.get("mode") or "overview")
    strategy = str(payload.get("strategy") or "ai")
    device_id = str(payload.get("deviceId") or "DZ1360")
    point_code = payload.get("pointCode")
    question = payload.get("question")

    ctx = build_context(device_id, str(point_code) if point_code else None)
    rule = rule_diagnosis(mode, ctx)

    if strategy == "rule" or not enabled():
        return {"code": 0, "data": {"source": "rule", "mode": mode, "context": ctx, "diagnosis": rule}}

    model = cfg("DEEPSEEK_MODEL", "deepseek-chat")
    if strategy == "reasoner":
        model = "deepseek-reasoner"

    try:
        ds = call_deepseek(build_prompt(mode, ctx, question), model=model)
        content = (((ds.get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()
        return {
            "code": 0,
            "data": {
                "source": "deepseek",
                "mode": mode,
                "model": model,
                "content": content,
                "fallbackRule": rule,
                "usage": ds.get("usage"),
            },
        }
    except Exception as exc:
        return {
            "code": 0,
            "data": {
                "source": "rule_fallback_after_ai_error",
                "mode": mode,
                "error": str(exc),
                "diagnosis": rule,
                "context": ctx,
            },
        }
