from functools import lru_cache
from pydantic import BaseModel
import os


class Settings(BaseModel):
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql://shield_user:shield_pass_123@127.0.0.1:5432/shield_monitor",
    )
    default_section_id: str = os.getenv(
        "DEFAULT_SECTION_ID", "33333333-3333-3333-3333-333333333333"
    )
    current_ring_no: int = int(os.getenv("CURRENT_RING_NO", "336"))
    cors_origins: list[str] = ["*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
