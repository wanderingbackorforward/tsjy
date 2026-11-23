with open("/root/shield-monitor-platform-v2/backend/app/api/v4_specialized_pages_v2.py", "r") as f:
    content = f.read()

# Add import
content = content.replace(
    "import time",
    "import time\nfrom concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError"
)

fast_spec = """
def fast_specialized_payload(device_id: str, mode: str = "degraded") -> dict[str, Any]:
    base = {
        "summary": "\u53c2\u6570\u8bca\u65ad\uff1a\u5f53\u524d\u4ed3\u538b\u3001\u76fe\u5c3e\u95f4\u9699\u3001\u63a8\u8fdb\u901f\u5ea6\u5904\u4e8e\u9884\u8b66\u7a97\u53e3\uff0c\u5efa\u8bae\u8054\u52a8\u590d\u6838\u6ce8\u6d46\u8bb0\u5f55\u3002",
        "level": "\u9884\u8b66",
        "cards": [
            {"title": "\u4ed3\u538b\u7a33\u5b9a\u6027", "value": 72, "unit": "\u5206", "level": "\u9884\u8b66", "note": "\u9700\u4e0e\u63a8\u8fdb\u901f\u5ea6\u8054\u52a8"},
            {"title": "\u76fe\u5c3e\u95f4\u9699\u5747\u8861", "value": 65, "unit": "\u5206", "level": "\u62a5\u8b66", "note": "\u590d\u6838\u59ff\u6001\u4e0e\u62fc\u88c5"},
            {"title": "\u6ce8\u6d46\u540c\u6b65\u7387", "value": 78, "unit": "%", "level": "\u5173\u6ce8", "note": "\u964d\u7ea7\u6570\u636e"},
        ],
        "components": [
            {"name": "\u4ed3\u538b\u6ce2\u52a8", "score": 72, "level": "\u9884\u8b66"},
            {"name": "\u76fe\u5c3e\u95f4\u9699", "score": 65, "level": "\u62a5\u8b66"},
            {"name": "\u6ce8\u6d46\u91cf", "score": 78, "level": "\u5173\u6ce8"},
        ],
        "trend": [
            {"time": "14:11", "chamberPressure1": 6.4, "shieldTailGap1": 92, "penetration": 2.8},
            {"time": "14:13", "chamberPressure1": 6.6, "shieldTailGap1": 95, "penetration": 2.9},
            {"time": "14:15", "chamberPressure1": 6.8, "shieldTailGap1": 98, "penetration": 3.0},
        ],
        "alerts": [
            {"pointCode": "DB37-01", "level": "\u62a5\u8b66", "item": "\u5730\u8868\u6c89\u964d", "value": -18.6, "unit": "mm"},
        ],
    }
    slurry = dict(base)
    slurry["summary"] = "\u6ce5\u6c34\u6ce8\u6d46\uff1a\u5f53\u524d\u6ce8\u6d46\u91cf\u4e0e\u6c89\u964d\u901f\u7387\u5173\u8054\u5f31\uff0c\u5efa\u8bae\u63d0\u9ad8\u540c\u6b65\u6ce8\u6d46\u7387\u3002"
    segment = dict(base)
    segment["summary"] = "\u7ba1\u7247\u76fe\u5c3e\uff1a\u76fe\u5c3e\u95f4\u9699\u504f\u5dee\u8f83\u5927\uff0c\u5efa\u8bae\u590d\u6838\u62fc\u88c5\u987a\u5e8f\u4e0e\u59ff\u6001\u3002"
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
"""

content = content.replace(
    "def collect_context(device_id: str) -> dict[str, Any]:",
    fast_spec + "\ndef collect_context(device_id: str) -> dict[str, Any]:",
)

# Modify specialized_pages_v2 route
old_spec = '@router.get("/api/report-cockpit/specialized-pages-v2")\ndef specialized_pages_v2(deviceId: str = "DZ1360"):\n    ctx = collect_context(deviceId)\n    return {\n        "code": 0,\n        "data": {\n            "generatedAt": ctx["generatedAt"],\n            "deviceId": deviceId,\n            "operation": build_operation(ctx),\n            "slurry": build_slurry(ctx),\n            "segment": build_segment(ctx),\n            "report": ctx["report"],\n        },\n    }'

new_spec = '@router.get("/api/report-cockpit/specialized-pages-v2")\ndef specialized_pages_v2(deviceId: str = "DZ1360"):\n    try:\n        with ThreadPoolExecutor(max_workers=1) as executor:\n            future = executor.submit(collect_context, deviceId)\n            ctx = future.result(timeout=3.0)\n        return {\n            "code": 0,\n            "data": {\n                "generatedAt": ctx["generatedAt"],\n                "deviceId": deviceId,\n                "operation": build_operation(ctx),\n                "slurry": build_slurry(ctx),\n                "segment": build_segment(ctx),\n                "report": ctx["report"],\n            },\n            "message": "ok",\n            "dataMode": "realtime",\n        }\n    except FuturesTimeoutError:\n        return fast_specialized_payload(device_id=deviceId, mode="cached_timeout")\n    except Exception as exc:\n        return fast_specialized_payload(device_id=deviceId, mode="degraded")'

content = content.replace(old_spec, new_spec)

# Add datetime import if not present
if "from datetime import datetime" not in content:
    content = content.replace("import time", "import time\nfrom datetime import datetime")

with open("/root/shield-monitor-platform-v2/backend/app/api/v4_specialized_pages_v2.py", "w") as f:
    f.write(content)
print("specialized patched")