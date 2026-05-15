from collections.abc import Iterable
from contextlib import contextmanager
from decimal import Decimal
from typing import Any

import psycopg2
import psycopg2.extras

from app.core.config import get_settings


def normalize_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def normalize_row(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {k: normalize_value(v) for k, v in dict(row).items()}


def normalize_rows(rows: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    return [normalize_row(row) or {} for row in rows]


@contextmanager
def get_connection():
    conn = psycopg2.connect(get_settings().database_url)
    try:
        yield conn
    finally:
        conn.close()


def fetch_one(sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return normalize_row(cur.fetchone())


def fetch_all(sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return normalize_rows(cur.fetchall())


def execute(sql: str, params: tuple[Any, ...] = ()) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        conn.commit()
