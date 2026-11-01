import os
from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    postgres_user: str = "postgres.nrdcvbtpetultmpvicee"
    postgres_password: str = "Omkar465011"
    postgres_db: str = "postgres"
    postgres_host: str = "aws-0-eu-west-1.pooler.supabase.com"
    postgres_port: int = 6543

    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_url: str | None = "https://044c5233-84a4-4c48-94c0-7d81b8786b16.us-west-2-0.aws.cloud.qdrant.io"
    qdrant_api_key: str | None = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIiwic3ViamVjdCI6ImFwaS1rZXk6NThjOGNmMmMtMTI4NS00OGQzLTkzZWEtM2MzY2MyOTRmYTIyIn0.lGJQX-97W82WudccTuHI6srutCi83FCXTdhUK9gK70Q"
    qdrant_collection: str = "rag_documents"

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    jwt_refresh_token_expire_days: int = 7

    gemini_api_key: str
    gemini_model: str = "gemini-2.5-flash"
    gemini_timeout_seconds: int = 30

    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    openai_timeout_seconds: int = 30

    app_env: str = "production"
    cors_origin: str = "https://nexus-rag-enterprise-ai-knowledge-s.vercel.app,http://localhost:5173"

    langchain_tracing_v2: bool = True
    langchain_api_key: str = ""
    langchain_project: str = "rag-enterprise"
    langchain_endpoint: str = "https://api.smith.langchain.com"

    model_config = SettingsConfigDict(
        env_file=(str(_ENV_PATH), ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def database_url(self) -> str:
        raw = os.getenv("DATABASE_URL")
        if raw:
            if raw.startswith("postgres://"):
                return raw.replace("postgres://", "postgresql+asyncpg://", 1)
            if raw.startswith("postgresql://") and not raw.startswith("postgresql+asyncpg://"):
                return raw.replace("postgresql://", "postgresql+asyncpg://", 1)
            return raw
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def langsmith_enabled(self) -> bool:
        return (
            self.app_env == "production"
            and self.langchain_tracing_v2
            and bool(self.langchain_api_key)
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


def configure_langsmith() -> None:
    s = get_settings()
    if s.langsmith_enabled:
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_API_KEY"] = s.langchain_api_key
        os.environ["LANGCHAIN_PROJECT"] = s.langchain_project
        os.environ["LANGCHAIN_ENDPOINT"] = s.langchain_endpoint
    else:
        os.environ["LANGCHAIN_TRACING_V2"] = "false"
        os.environ.pop("LANGCHAIN_API_KEY", None)
