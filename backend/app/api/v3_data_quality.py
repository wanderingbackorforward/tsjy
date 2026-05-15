from __future__ import annotations

import os
from typing import Any

import psycopg2
from fastapi import APIRouter

router = APIRouter()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://shield_user:shield_pass_123@127.0.0.1:5432/shield_monitor",
)

CORE_TABLES = [
    "project",
    "tunnel_section",
    "ring_mileage_map",
    "risk_source",
    "monitoring_point",
    "monitoring_reading",
    "shield_ring_operation",
    "slurry_record",
    "grouting_record",
    "event_log",
    "source_document",
    "import_batch",
    "import_raw_row",
    "field_mapping",
    "standard_field",
    "field_alias",
]


def conn():
    return psycopg2.connect(DATABASE_URL)


def scalar(sql: str, params: tuple[Any, ...] = ()):
    with conn() as c:
        with c.cursor() as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            return row[0] if row else None


def table_exists(table: str) -> bool:
    return bool(scalar("SELECT to_regclass(%s)", (f"public.{table}",)))


@router.get("/data-quality/tables")
async def table_counts():
    rows = []
    for table in CORE_TABLES:
        exists = table_exists(table)
        count = 0
        if exists:
            try:
                count = int(scalar(f"SELECT COUNT(*) FROM {table}") or 0)
            except Exception:
                count = 0
        rows.append({
            "tableName": table,
            "exists": exists,
            "rowCount": count,
            "status": "ok" if exists and count > 0 else ("empty" if exists else "missing"),
        })

    required = [
        "ring_mileage_map",
        "risk_source",
        "shield_ring_operation",
        "monitoring_point",
        "monitoring_reading",
        "event_log",
    ]
    missing_or_empty = [
        row["tableName"]
        for row in rows
        if row["tableName"] in required and row["rowCount"] == 0
    ]

    return {
        "ok": True,
        "tables": rows,
        "requiredMissingOrEmpty": missing_or_empty,
        "diagnosis": "核心展示数据已具备" if not missing_or_empty else "部分分析页会空白，因为核心表缺数据或暂无真实资料接入",
    }
