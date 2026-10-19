"""All runtime settings, read from environment variables and the repo-root .env file."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=REPO_ROOT / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    aegis_env: str = "dev"
    aegis_data_dir: Path = REPO_ROOT / "data"
    aegis_db_url: str = f"sqlite:///{(REPO_ROOT / 'data' / 'aegis.db').as_posix()}"
    aegis_offline: bool = False
    aegis_cors_origins: str = "http://localhost:5173"

    llm_provider: str = "groq"
    llm_model: str = ""
    groq_api_key: str = ""
    gemini_api_key: str = ""
    anthropic_api_key: str = ""

    http_user_agent: str = "AEGIS-X/0.2"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.aegis_cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
