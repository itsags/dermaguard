from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_env: str = 'development'
    app_version: str = '0.2.0'
    api_prefix: str = '/api/v1'
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    free_services_only: bool = True
    groq_api_key: str = ''
    groq_model: str = 'openai/gpt-oss-20b'
    chat_api_key: str = ''
    chat_model: str = 'gpt-4o-mini'
    model_mode: str = 'unavailable'
    model_version: str = ''
    max_upload_bytes: int = 10 * 1024 * 1024
    model_config = SettingsConfigDict(env_file=Path(__file__).resolve().parents[1] / ".env", extra="ignore")

settings = Settings()
