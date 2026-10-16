from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Root folder: D:\Neuro Scan AI\backend
BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """
    Application configuration loaded from backend/.env
    """

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --------------------------------------------------
    # Application
    # --------------------------------------------------
    app_name: str = "NeuroScan AI API"
    api_v1_prefix: str = "/api/v1"

    # --------------------------------------------------
    # CORS
    # --------------------------------------------------
    cors_origins: Any = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://192.168.29.121:5173",
    ]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> list[str]:
        default_origins = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://192.168.29.121:5173",
        ]
        if not value:
            return default_origins
        if isinstance(value, str):
            origins = [origin.strip().rstrip('/') for origin in value.split(',') if origin.strip()]
            valid_origins = [o for o in origins if o != "*"]
            for default in default_origins:
                if default not in valid_origins:
                    valid_origins.append(default)
            return valid_origins or default_origins
        if isinstance(value, list):
            cleaned = [str(o).strip().rstrip('/') for o in value if str(o).strip() and str(o) != "*"]
            for default in default_origins:
                if default not in cleaned:
                    cleaned.append(default)
            return cleaned or default_origins
        return default_origins

    # --------------------------------------------------
    # JWT
    # --------------------------------------------------
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12
    refresh_token_expire_days: int = 7

    # --------------------------------------------------
    # Database
    # --------------------------------------------------
    mongodb_uri: str | None = None

    supabase_url: str | None = None
    supabase_key: str | None = None
    supabase_db_url: str | None = None

    supabase_storage_bucket: str = "mri-images"
    supabase_model_bucket: str = "models"

    max_mri_upload_mb: int = 50
    min_mri_resolution: int = 128

    # --------------------------------------------------
    # Gemini
    # --------------------------------------------------
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"

    # --------------------------------------------------
    # Groq
    # --------------------------------------------------
    groq_api_key: str | None = None
    groq_model: str = "llama-3.3-70b-versatile"

    # --------------------------------------------------
    # Development
    # --------------------------------------------------
    debug: bool = True

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "prod", "production"}:
                return False
            if normalized in {"dev", "development"}:
                return True
        return value

    @property
    def data_dir(self) -> Path:
        return BASE_DIR / "data"

    @property
    def mock_storage_dir(self) -> Path:
        return self.data_dir / "mock_storage"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
