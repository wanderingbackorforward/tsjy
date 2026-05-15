import re


def normalize_header(value: str) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"[\s_\-（）()\[\]【】:/：]+", "", text)
    return text


DEFAULT_FIELD_ALIASES: dict[str, list[str]] = {
    "ring_no": ["环号", "施工环", "ring", "ringno"],
    "work_date": ["日期", "施工日期", "workdate", "date"],
    "recorded_at": ["时间", "记录时间", "timestamp", "recordedat"],
    "face_pressure": ["切口压力", "仓压", "掌子面压力", "泥水压力", "facepressure"],
    "advance_speed": ["推进速度", "掘进速度", "advancespeed"],
    "total_thrust": ["总推力", "推进力", "totalthrust"],
    "cutter_torque": ["刀盘扭矩", "扭矩", "cuttertorque"],
    "cutter_rotation_speed": ["刀盘转速", "转速", "cutterrotationspeed"],
    "point_code": ["测点编号", "点号", "测点", "pointcode"],
    "measured_at": ["监测时间", "测量时间", "观测时间", "measuredat"],
    "cumulative_change": ["累计变化量", "累计沉降", "累计位移", "cumulativechange"],
    "change_rate": ["变化速率", "速率", "changerate"],
}


def suggest_mapping(headers: list[str]) -> list[dict]:
    normalized_aliases = {
        normalize_header(alias): key
        for key, aliases in DEFAULT_FIELD_ALIASES.items()
        for alias in aliases
    }
    result = []
    for header in headers:
        norm = normalize_header(header)
        key = normalized_aliases.get(norm)
        if key:
            result.append({
                "sourceFieldName": header,
                "suggestedStandardField": key,
                "confidence": 0.98,
                "status": "matched",
            })
            continue
        fuzzy_key = None
        for alias_norm, standard_key in normalized_aliases.items():
            if alias_norm and (alias_norm in norm or norm in alias_norm):
                fuzzy_key = standard_key
                break
        result.append({
            "sourceFieldName": header,
            "suggestedStandardField": fuzzy_key,
            "confidence": 0.72 if fuzzy_key else 0.0,
            "status": "need_confirm" if fuzzy_key else "missing",
        })
    return result
