import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query

router = APIRouter()

TBM_API_BASE = os.getenv("TBM_API_BASE", "http://127.0.0.1:19090").rstrip("/")
TBM_DEVICE_ID = os.getenv("TBM_DEVICE_ID", "DZ1360")
TBM_TIMEOUT_SECONDS = float(os.getenv("TBM_TIMEOUT_SECONDS", "3"))
FALLBACK_PATH = Path(os.getenv("TBM_FALLBACK_PATH", "/root/shield-monitor-platform-v2/backend/data/latest_fallback.json"))

STATUS_LABELS = {
    "confirmed": "已确认",
    "scale_checked": "已校准换算",
    "scale_pending": "比例待校准",
    "pending": "待解释",
}

FIELD_META: Dict[str, Dict[str, Any]] = {
    "currentRing": {"category": "基础信息", "nameCn": "当前环号", "group": "basic", "priority": 1},
    "hydraulicOilTemp": {"category": "基础信息", "nameCn": "液压油箱温度", "group": "basic", "priority": 2},

    "cutterStatus": {"category": "刀盘 / 主驱动", "nameCn": "刀盘工作状态", "group": "cutter", "priority": 20},
    "cutterSpeed": {"category": "刀盘 / 主驱动", "nameCn": "刀盘速度", "group": "cutter", "priority": 21},
    "cutterAngle": {"category": "刀盘 / 主驱动", "nameCn": "刀盘角度", "group": "cutter", "priority": 22},
    "cutterTorque": {"category": "刀盘 / 主驱动", "nameCn": "刀盘转矩", "group": "cutter", "priority": 23},

    "advanceStatus": {"category": "推进 / 掘进参数", "nameCn": "顶推工作状态", "group": "advance", "priority": 30},
    "advancePumpPressure": {"category": "推进 / 掘进参数", "nameCn": "推进泵出口压力", "group": "advance", "priority": 31},
    "advanceSpeed": {"category": "推进 / 掘进参数", "nameCn": "推进速度平均值", "group": "advance", "priority": 32},
    "penetration": {"category": "推进 / 掘进参数", "nameCn": "贯入度", "group": "advance", "priority": 33},
    "totalThrust": {"category": "推进 / 掘进参数", "nameCn": "总推进力", "group": "advance", "priority": 34},
    "advanceSpeedSet": {"category": "推进 / 掘进参数", "nameCn": "推进速度设置", "group": "advance", "priority": 35},

    "chamberPressure1": {"category": "仓压", "nameCn": "开挖仓压力1#", "group": "chamberPressure", "priority": 40},
    "chamberPressure2": {"category": "仓压", "nameCn": "开挖仓压力2#", "group": "chamberPressure", "priority": 41},
    "chamberPressure3": {"category": "仓压", "nameCn": "开挖仓压力3#", "group": "chamberPressure", "priority": 42},

    "slurryOutDensity": {"category": "泥浆环路", "nameCn": "排浆管路浆液密度", "group": "slurry", "priority": 50},
    "slurryOutFlow": {"category": "泥浆环路", "nameCn": "排浆管路浆液流量", "group": "slurry", "priority": 51},
    "slurryInDensity": {"category": "泥浆环路", "nameCn": "进浆管路浆液密度", "group": "slurry", "priority": 52},
    "slurryInFlow": {"category": "泥浆环路", "nameCn": "进浆管路浆液流量", "group": "slurry", "priority": 53},
    "slurryInPressure": {"category": "泥浆环路", "nameCn": "进浆管路浆液压力", "group": "slurry", "priority": 54},

    "shieldTailGap1": {"category": "盾尾间隙", "nameCn": "1#盾尾间隙", "group": "tailGap", "priority": 60},
    "shieldTailGap2": {"category": "盾尾间隙", "nameCn": "2#盾尾间隙", "group": "tailGap", "priority": 61},
    "shieldTailGap3": {"category": "盾尾间隙", "nameCn": "3#盾尾间隙", "group": "tailGap", "priority": 62},

    "propelPressureA": {"category": "推进分区压力", "nameCn": "A组推进泵口压力", "group": "propelPressure", "priority": 70},
    "propelPressureB": {"category": "推进分区压力", "nameCn": "B组推进泵口压力", "group": "propelPressure", "priority": 71},
    "propelPressureC": {"category": "推进分区压力", "nameCn": "C组推进泵口压力", "group": "propelPressure", "priority": 72},
    "propelPressureD": {"category": "推进分区压力", "nameCn": "D组推进泵口压力", "group": "propelPressure", "priority": 73},
    "propelPressureE": {"category": "推进分区压力", "nameCn": "E组推进泵口压力", "group": "propelPressure", "priority": 74},
    "propelPressureF": {"category": "推进分区压力", "nameCn": "F组推进泵口压力", "group": "propelPressure", "priority": 75},

    "groutTotal": {"category": "注浆 / 管片", "nameCn": "注浆总累积量", "group": "grouting", "priority": 80},
    "segmentPosition": {"category": "注浆 / 管片", "nameCn": "正在拼装的管片位置", "group": "segment", "priority": 90},
}

GROUP_NAMES = {
    "basic": "基础信息",
    "advance": "推进 / 掘进参数",
    "cutter": "刀盘 / 主驱动",
    "chamberPressure": "仓压",
    "slurry": "泥浆环路",
    "tailGap": "盾尾间隙",
    "propelPressure": "推进分区压力",
    "grouting": "同步注浆",
    "segment": "管片拼装",
    "other": "其他字段",
}


def _load_fallback() -> Optional[Dict[str, Any]]:
    if FALLBACK_PATH.exists():
        try:
            return json.loads(FALLBACK_PATH.read_text(encoding="utf-8"))
        except Exception:
            return None
    return None


def _request_json(path: str, device_id: str) -> Dict[str, Any]:
    url = f"{TBM_API_BASE}{path}?{urllib.parse.urlencode({'deviceId': device_id})}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=TBM_TIMEOUT_SECONDS) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _fetch_latest(device_id: str, include_raw: bool = False) -> Dict[str, Any]:
    # latest-view is the preferred front-end source; latest is only for raw/debug fallback.
    paths = ["/api/tbm/latest"] if include_raw else ["/api/tbm/latest-view", "/api/tbm/latest"]
    last_error: Optional[Exception] = None
    for path in paths:
        try:
            payload = _request_json(path, device_id)
            payload["_sourcePath"] = path
            return payload
        except Exception as exc:
            last_error = exc

    fallback = _load_fallback()
    if fallback is not None:
        fallback["_fallbackUsed"] = True
        fallback["_fetchError"] = str(last_error)
        fallback["_sourcePath"] = "fallback"
        return fallback

    raise RuntimeError(f"TBM API request failed: {last_error}") from last_error


def _payload_data(payload: Dict[str, Any]) -> Dict[str, Any]:
    if isinstance(payload, dict) and isinstance(payload.get("data"), dict):
        return payload["data"]
    return payload


def _machine_data(data: Dict[str, Any]) -> Dict[str, Any]:
    machine = data.get("machine")
    return machine if isinstance(machine, dict) else data


def _fields(data: Dict[str, Any]) -> Dict[str, Any]:
    machine = _machine_data(data)
    if isinstance(machine.get("fields"), dict):
        return machine["fields"]
    if isinstance(data.get("fields"), dict):
        return data["fields"]
    return {}


def _raw_values(data: Dict[str, Any]) -> Optional[List[Any]]:
    machine = _machine_data(data)
    raw_values = machine.get("rawValues")
    if raw_values is None:
        raw_values = data.get("rawValues")
    return raw_values if isinstance(raw_values, list) else None


def _raw_length(data: Dict[str, Any]) -> Optional[int]:
    machine = _machine_data(data)
    raw_length = machine.get("rawLength")
    if raw_length is None:
        raw_length = data.get("rawLength")
    raw_values = _raw_values(data)
    return raw_length or (len(raw_values) if raw_values else None)


def _normalize_field(key: str, field: Dict[str, Any]) -> Dict[str, Any]:
    meta = FIELD_META.get(key, {})
    status = field.get("status") or field.get("decodeStatus") or "pending"
    display_value = field.get("displayValue")
    return {
        "fieldKey": key,
        "key": field.get("key") or key,
        "nameCn": meta.get("nameCn", key),
        "category": meta.get("category", "未分类"),
        "group": meta.get("group", "other"),
        "priority": meta.get("priority", 999),
        "rawIndex": field.get("rawIndex"),
        "rawValue": field.get("rawValue"),
        "displayValue": display_value,
        "unit": field.get("unit") or "",
        "status": status,
        "decodeStatus": status,
        "qualityLabel": STATUS_LABELS.get(status, "待确认"),
        "frontendVisible": status in ("confirmed", "scale_checked", "scale_pending", "pending"),
        "analysisPrimary": status in ("confirmed", "scale_checked"),
        "isZero": display_value == 0,
    }


def _normalize(payload: Dict[str, Any], include_raw: bool = False) -> Dict[str, Any]:
    data = _payload_data(payload)
    machine = _machine_data(data)
    fields_in = _fields(data)
    raw_values = _raw_values(data)
    raw_length = _raw_length(data)
    guidance = data.get("guidance")

    fields: Dict[str, Any] = {}
    groups: Dict[str, List[Dict[str, Any]]] = {g: [] for g in GROUP_NAMES.keys()}
    quality = {"confirmed": 0, "scale_checked": 0, "scale_pending": 0, "pending": 0, "unknown": 0}
    warnings: List[str] = []

    for key, field in fields_in.items():
        if not isinstance(field, dict):
            continue
        normalized = _normalize_field(key, field)
        fields[key] = normalized
        status = normalized["status"]
        quality[status if status in quality else "unknown"] += 1
        groups.setdefault(normalized.get("group") or "other", []).append(normalized)
        if status == "scale_pending":
            warnings.append(f"{normalized['nameCn']}：比例待校准")
        elif status == "pending":
            warnings.append(f"{normalized['nameCn']}：字段待解释")

    for arr in groups.values():
        arr.sort(key=lambda x: x.get("priority", 999))

    result = {
        "deviceId": data.get("deviceId"),
        "timestamp": data.get("timestamp"),
        "receivedAt": data.get("receivedAt"),
        "machineSource": machine.get("source"),
        "rawLength": raw_length,
        "rawAvailable": isinstance(raw_values, list) and len(raw_values) > 0,
        "rawExpectedLength": 3250,
        "rawLengthOk": raw_length == 3250,
        "guidanceAvailable": isinstance(guidance, dict),
        "guidance": guidance,
        "guidanceStatus": "已预留，尚未接入真实导向数据" if guidance is None else "已接入",
        "fetchMeta": {
            "apiBase": TBM_API_BASE,
            "sourcePath": payload.get("_sourcePath"),
            "fallbackUsed": bool(payload.get("_fallbackUsed")),
            "fetchError": payload.get("_fetchError"),
            "serverTime": time.strftime("%Y-%m-%d %H:%M:%S"),
        },
        "decodeQuality": quality,
        "qualityWarnings": warnings,
        "fields": fields,
        "groups": groups,
        "groupNames": GROUP_NAMES,
    }

    if include_raw:
        result["rawValues"] = raw_values
    return result


def _frontend_summary(normalized: Dict[str, Any]) -> Dict[str, Any]:
    fields = normalized.get("fields") or {}
    wanted = [
        "currentRing", "hydraulicOilTemp",
        "advanceSpeed", "penetration", "totalThrust", "advancePumpPressure", "advanceSpeedSet", "advanceStatus",
        "cutterSpeed", "cutterTorque", "cutterAngle", "cutterStatus",
        "chamberPressure1", "chamberPressure2", "chamberPressure3",
        "slurryOutDensity", "slurryOutFlow", "slurryInDensity", "slurryInFlow", "slurryInPressure",
        "shieldTailGap1", "shieldTailGap2", "shieldTailGap3",
        "propelPressureA", "propelPressureB", "propelPressureC", "propelPressureD", "propelPressureE", "propelPressureF",
        "groutTotal", "segmentPosition",
    ]
    metrics = {k: fields[k] for k in wanted if k in fields}
    return {
        "deviceId": normalized.get("deviceId"),
        "timestamp": normalized.get("timestamp"),
        "receivedAt": normalized.get("receivedAt"),
        "machineSource": normalized.get("machineSource"),
        "rawLength": normalized.get("rawLength"),
        "rawLengthOk": normalized.get("rawLengthOk"),
        "rawAvailable": normalized.get("rawAvailable"),
        "guidanceAvailable": normalized.get("guidanceAvailable"),
        "guidanceStatus": normalized.get("guidanceStatus"),
        "currentRing": fields.get("currentRing"),
        "decodeQuality": normalized.get("decodeQuality"),
        "qualityWarnings": normalized.get("qualityWarnings"),
        "metrics": metrics,
        "groups": normalized.get("groups"),
        "groupNames": normalized.get("groupNames"),
        "fields": fields,
        "fetchMeta": normalized.get("fetchMeta"),
    }


@router.get("/health")
def health(deviceId: str = Query(TBM_DEVICE_ID)):
    try:
        normalized = _normalize(_fetch_latest(deviceId, include_raw=False), include_raw=False)
        return {
            "ok": True,
            "deviceId": normalized.get("deviceId"),
            "timestamp": normalized.get("timestamp"),
            "receivedAt": normalized.get("receivedAt"),
            "machineSource": normalized.get("machineSource"),
            "sourcePath": normalized.get("fetchMeta", {}).get("sourcePath"),
            "rawLength": normalized.get("rawLength"),
            "rawLengthOk": normalized.get("rawLengthOk"),
            "fieldCount": len(normalized.get("fields") or {}),
            "decodeQuality": normalized.get("decodeQuality"),
            "guidanceAvailable": normalized.get("guidanceAvailable"),
            "guidanceStatus": normalized.get("guidanceStatus"),
            "fallbackUsed": normalized.get("fetchMeta", {}).get("fallbackUsed"),
        }
    except Exception as exc:
        return {"ok": False, "deviceId": deviceId, "error": str(exc), "apiBase": TBM_API_BASE}


@router.get("/latest")
def latest(deviceId: str = Query(TBM_DEVICE_ID), include_raw: bool = Query(False)):
    try:
        return {"code": 0, "data": _normalize(_fetch_latest(deviceId, include_raw=include_raw), include_raw=include_raw)}
    except Exception as exc:
        return {"code": 500, "message": str(exc), "data": None}


@router.get("/frontend-summary")
def frontend_summary(deviceId: str = Query(TBM_DEVICE_ID)):
    try:
        return {"code": 0, "data": _frontend_summary(_normalize(_fetch_latest(deviceId, include_raw=False), include_raw=False))}
    except Exception as exc:
        return {"code": 500, "message": str(exc), "data": None}


@router.get("/fields")
def fields():
    return {
        "code": 0,
        "data": [
            {
                "fieldKey": key,
                "fieldNameCn": meta.get("nameCn", key),
                "category": meta.get("category", "未分类"),
                "group": meta.get("group", "other"),
                "priority": meta.get("priority", 999),
            }
            for key, meta in sorted(FIELD_META.items(), key=lambda kv: kv[1].get("priority", 999))
        ],
    }


@router.get("/raw")
def raw(deviceId: str = Query(TBM_DEVICE_ID)):
    try:
        normalized = _normalize(_fetch_latest(deviceId, include_raw=True), include_raw=True)
        return {
            "code": 0,
            "data": {
                "deviceId": normalized.get("deviceId"),
                "timestamp": normalized.get("timestamp"),
                "receivedAt": normalized.get("receivedAt"),
                "machineSource": normalized.get("machineSource"),
                "rawLength": normalized.get("rawLength"),
                "rawValues": normalized.get("rawValues"),
            },
        }
    except Exception as exc:
        return {"code": 500, "message": str(exc), "data": None}
