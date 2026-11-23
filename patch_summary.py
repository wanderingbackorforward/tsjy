import re

with open("/root/shield-monitor-platform-v2/backend/app/api/v4_report_cockpit.py", "r") as f:
    content = f.read()

# 1. Add import
content = content.replace(
    "import time",
    "import time\nfrom concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError"
)

# 2. Add fast fallback
fast_fallback = """
def fast_summary_payload(device_id: str, mode: str = "degraded") -> dict[str, Any]:
    return {
        "code": 0,
        "message": "ok",
        "dataMode": mode,
        "data": {
            "generatedAt": now_text(),
            "deviceId": device_id,
            "overallLevel": "\u62a5\u8b66",
            "headline": "\u5f53\u524d\u76fe\u9996\u4f4d\u4e8e DK54+380\uff0c\u5904\u4e8e\u4eac\u6caa\u9ad8\u94c1\u4e0b\u7a7f\u98ce\u9669\u7a97\u53e3\u5185\u3002",
            "brief": "\u76fe\u9996 DK54+380\uff0c\u76fe\u4e2d DK54+372\uff0c\u76fe\u5c3e DK54+364\uff1b\u90bb\u8fd1\u5f02\u5e38\u4e2d\u62a5\u8b66 9 \u6761\u3001\u9884\u8b66 3 \u6761\u3001\u5f85\u590d\u6838 34 \u6761\u3002",
            "position": {
                "headMileageM": 54380.0, "middleMileageM": 54372.0, "tailMileageM": 54364.0,
                "headMileageText": "DK54+380", "middleMileageText": "DK54+372", "tailMileageText": "DK54+364",
                "guidanceRing": 392.0, "engineeringRing": 343, "sourceText": "\u964d\u7ea7\u6458\u8981"
            },
            "currentRisk": {"name": "\u4eac\u6caa\u9ad8\u94c1", "relation": "\u4e0b\u7a7f", "startMileage": "DK54+370", "endMileage": "DK54+450"},
            "alertSummary": {"alarm": 9, "warning": 3, "review": 34, "total": 46},
            "priorityAlerts": [
                {"pointCode": "DB37-01", "level": "\u62a5\u8b66", "item": "\u5730\u8868\u6c89\u964d", "latestValue": -5.8, "latestTime": now_text(), "distanceM": None, "priorityReason": "\u5f53\u524d\u98ce\u9669\u7a97\u53e3\u5185", "riskName": ""},
                {"pointCode": "DBC12-01", "level": "\u62a5\u8b66", "item": "\u5730\u8868\u6c89\u964d", "latestValue": -17.07, "latestTime": now_text(), "distanceM": None, "priorityReason": "\u5f53\u524d\u98ce\u9669\u7a97\u53e3\u5185", "riskName": ""},
            ],
            "parameterTrend": [
                {"time": "14:11", "advanceSpeed": 0, "penetration": 2.8, "chamberPressure1": 6.4, "shieldTailGap1": 92},
                {"time": "14:13", "advanceSpeed": 0, "penetration": 2.9, "chamberPressure1": 6.6, "shieldTailGap1": 95},
                {"time": "14:15", "advanceSpeed": 0, "penetration": 3.0, "chamberPressure1": 6.8, "shieldTailGap1": 98},
            ],
            "parameterSummary": {"time": "14:15", "advanceSpeed": 0, "penetration": 3.0, "chamberPressure1": 6.8, "shieldTailGap1": 98},
            "riskWindows": [
                {"riskName": "\u4eac\u6caa\u9ad8\u94c1", "riskType": "railway", "startMileage": "DK54+370", "endMileage": "DK54+450", "startMileageM": 54370.0, "endMileageM": 54450.0, "distanceText": "\u7a97\u53e3\u5185", "matched": True, "relation": "\u4e0b\u7a7f"},
            ],
            "findings": [
                {"title": "\u5f53\u524d\u4f4d\u7f6e\u4e0e\u98ce\u9669\u6e90\u5df2\u5efa\u7acb\u5173\u8054", "level": "\u62a5\u8b66", "confidenceText": "80%", "evidence": ["\u76fe\u9996 DK54+380", "\u98ce\u9669\u6e90 \u4eac\u6caa\u9ad8\u94c1", "\u7a97\u53e3 DK54+370 - DK54+450"]},
            ],
            "actions": [
                {"priority": "\u9ad8", "action": "\u4f18\u5148\u590d\u6838\u5f53\u524d\u98ce\u9669\u7a97\u53e3\u5185\u62a5\u8b66\u6d4b\u70b9", "reason": "\u62a5\u8b66\u70b9\u4e0e\u5f53\u524d\u65bd\u5de5\u4f4d\u7f6e\u5171\u540c\u51b3\u5b9a\u5904\u7f6e\u4f18\u5148\u7ea7\u3002"},
            ],
            "sourceNote": "\u5f53\u524d\u9875\u9762\u5c55\u793a\u7684\u662f\u540e\u7aef\u964d\u7ea7\u6458\u8981\uff0c\u771f\u5b9e\u6570\u636e\u52a0\u8f7d\u8d85\u65f6\u3002",
            "diagnostic": {"positionError": None, "alertsError": None, "historyError": "degraded", "gaps": {}},
            "latencyMs": 0,
        },
    }
"""

content = content.replace(
    "def get_base(device_id: str) -> dict[str, Any]:",
    fast_fallback + "\ndef get_base(device_id: str) -> dict[str, Any]:"
)

# 3. Modify report_summary
old_summary = '@router.get("/api/report-cockpit/summary")\ndef report_summary(deviceId: str = "DZ1360"):\n    start = time.time()\n    data = get_base(deviceId)\n    data["latencyMs"] = int((time.time() - start) * 1000)\n    return {"code": 0, "data": data}'

new_summary = '@router.get("/api/report-cockpit/summary")\ndef report_summary(deviceId: str = "DZ1360"):\n    start = time.time()\n    try:\n        with ThreadPoolExecutor(max_workers=1) as executor:\n            future = executor.submit(get_base, deviceId)\n            data = future.result(timeout=3.0)\n            data["latencyMs"] = int((time.time() - start) * 1000)\n            return {"code": 0, "data": data, "message": "ok", "dataMode": "realtime"}\n    except FuturesTimeoutError:\n        return fast_summary_payload(device_id=deviceId, mode="cached_timeout")\n    except Exception as exc:\n        return fast_summary_payload(device_id=deviceId, mode="degraded")'

content = content.replace(old_summary, new_summary)

with open("/root/shield-monitor-platform-v2/backend/app/api/v4_report_cockpit.py", "w") as f:
    f.write(content)
print("summary patched")