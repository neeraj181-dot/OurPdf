import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Easy PDF API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"

    PORT: int = 8000
    DATABASE_URL: str = "sqlite:///./easypdf.db"
    SECRET_KEY: str = "easypdf_super_secret_jwt_key_2026_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours

    STORAGE_DIR: str = str(Path(__file__).resolve().parent.parent.parent / "storage")

    AI_API_KEY: str = ""
    AI_MODEL_NAME: str = "gemini-3.6-flash"
    FRONTEND_URL: str = "http://localhost:3000"
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
