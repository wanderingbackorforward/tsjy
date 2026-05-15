import re


def parse_mileage(value: str | None) -> float | None:
    if not value:
        return None
    text = str(value).strip().upper().replace(" ", "")
    match = re.search(r"(?:DK)?(\d+(?:\.\d+)?)\+(\d+(?:\.\d+)?)", text)
    if not match:
        return None
    return float(match.group(1)) * 1000 + float(match.group(2))


def format_mileage(meters: float | None) -> str | None:
    if meters is None:
        return None
    km = int(meters // 1000)
    m = meters - km * 1000
    return f"DK{km}+{m:03.0f}"
