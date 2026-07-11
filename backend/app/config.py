"""
Configuration module for CV-Wiz backend.
Loads environment variables and provides typed settings.
Fails loudly if required environment variables are missing.
Validates URL formats for configuration endpoints.
"""

import os
from functools import lru_cache
from urllib.parse import urlparse
from pydantic_settings import BaseSettings
from pydantic import Field, model_validator, field_validator


def _is_valid_http_url(value: str, *, allow_empty: bool = True) -> bool:
    """Return True if value is empty (when allowed) or a valid http(s) URL."""
    if not value:
        return allow_empty
    try:
        parsed = urlparse(value)
        return parsed.scheme in ("http", "https") and bool(parsed.netloc)
    except Exception:
        return False


def _is_valid_redis_url(value: str, *, allow_empty: bool = True) -> bool:
    if not value:
        return allow_empty
    try:
        parsed = urlparse(value)
        return parsed.scheme in ("redis", "rediss") and bool(parsed.netloc)
    except Exception:
        return False


def _is_valid_database_url(value: str, *, allow_empty: bool = True) -> bool:
    if not value:
        return allow_empty
    try:
        parsed = urlparse(value)
        return parsed.scheme in (
            "postgresql",
            "postgres",
            "postgresql+asyncpg",
            "postgresql+psycopg2",
        ) and bool(parsed.netloc)
    except Exception:
        return False


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Database - REQUIRED in production
    database_url: str = Field(
        default="",
        validation_alias="DATABASE_URL"
    )
    
    # Redis - REQUIRED in production
    redis_url: str = Field(
        default="",
        validation_alias="REDIS_URL"
    )
    
    # Upstash Redis REST API (alternative to redis URL)
    upstash_redis_rest_url: str = Field(default="", validation_alias="UPSTASH_REDIS_RES_KV_REST_API_URL")
    upstash_redis_rest_token: str = Field(default="", validation_alias="UPSTASH_REDIS_RES_KV_REST_API_TOKEN")
    
    # Groq LLM
    groq_api_key: str = Field(default="", validation_alias="GROQ_API_KEY")
    groq_model: str = "llama-3.3-70b-versatile"
    
    # Auth
    nextauth_secret: str = Field(default="", validation_alias="NEXTAUTH_SECRET")
    auth_secret: str = Field(default="", validation_alias="AUTH_SECRET")  # NextAuth v5 uses AUTH_SECRET
    nextauth_url: str = Field(default="", validation_alias="NEXTAUTH_URL")
    
    # Frontend URLs - REQUIRED in production
    frontend_url: str = Field(default="", validation_alias="FRONTEND_URL")
    frontend_api_url: str = Field(default="", validation_alias="FRONTEND_API_URL")

    # Service-to-service shared secret for internal API calls (optional but recommended)
    internal_api_secret: str = Field(default="", validation_alias="INTERNAL_API_SECRET")

    # Feature flags (comma-separated names that are enabled)
    feature_flags: str = Field(default="", validation_alias="FEATURE_FLAGS")
    
    # Cache TTL (seconds) — overridable via env for ops tuning
    cache_ttl: int = Field(default=300, validation_alias="CACHE_TTL")
    cache_ttl_short: int = Field(default=60, validation_alias="CACHE_TTL_SHORT")
    cache_ttl_long: int = Field(default=3600, validation_alias="CACHE_TTL_LONG")
    
    # PDF settings
    max_resume_pages: int = Field(default=1, validation_alias="MAX_RESUME_PAGES")
    
    # Monitoring
    sentry_dsn: str = Field(default="", validation_alias="SENTRY_DSN")
    environment: str = Field(default="development", validation_alias="APP_ENV")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # Allow extra fields from .env
        populate_by_name = True  # Allow using either field name or alias

    @field_validator("frontend_url", "nextauth_url", "frontend_api_url", "sentry_dsn")
    @classmethod
    def validate_http_urls(cls, v: str) -> str:
        if v and not _is_valid_http_url(v, allow_empty=False):
            raise ValueError(f"Invalid HTTP(S) URL: {v!r}")
        return v

    @field_validator("redis_url")
    @classmethod
    def validate_redis_url(cls, v: str) -> str:
        if v and not _is_valid_redis_url(v, allow_empty=False):
            raise ValueError(f"Invalid Redis URL (expected redis:// or rediss://): {v!r}")
        return v

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if v and not _is_valid_database_url(v, allow_empty=False):
            raise ValueError(f"Invalid DATABASE_URL (expected postgresql://...): {v!r}")
        return v

    @field_validator("upstash_redis_rest_url")
    @classmethod
    def validate_upstash_url(cls, v: str) -> str:
        if v and not _is_valid_http_url(v, allow_empty=False):
            raise ValueError(f"Invalid Upstash REST URL: {v!r}")
        return v
    
    @model_validator(mode='after')
    def validate_required_settings(self) -> 'Settings':
        """Validate that required settings are configured in production."""
        missing = []
        
        if not self.database_url:
            missing.append("DATABASE_URL")
        
        if not self.redis_url and not self.upstash_redis_rest_url:
            missing.append("REDIS_URL (or UPSTASH_REDIS_RES_KV_REST_API_URL)")
        
        if not self.nextauth_url and not self.frontend_url:
            missing.append("NEXTAUTH_URL or FRONTEND_URL")
        
        if missing:
            raise ValueError(
                f"[CV-Wiz Config] Missing required environment variables: {', '.join(missing)}. "
                "Set these in your deployment environment (e.g., Railway, Vercel)."
            )
        
        return self
    
    @property
    def effective_secret(self) -> str:
        """Get the effective auth secret (AUTH_SECRET or NEXTAUTH_SECRET)."""
        return self.auth_secret or self.nextauth_secret
    
    @property
    def effective_redis_url(self) -> str:
        """Get Redis URL, preferring direct URL over REST API."""
        return self.redis_url if self.redis_url else ""
    
    @property
    def effective_frontend_url(self) -> str:
        """Get the effective frontend URL for CORS."""
        return self.frontend_url or self.nextauth_url

    def is_feature_enabled(self, flag: str) -> bool:
        """Check if a named feature flag is enabled via FEATURE_FLAGS env."""
        if not self.feature_flags or not flag:
            return False
        enabled = {f.strip().lower() for f in self.feature_flags.split(",") if f.strip()}
        return flag.strip().lower() in enabled


def _get_env_with_fallbacks(primary: str, *fallbacks: str, default: str = "") -> str:
    """Get environment variable with fallback options."""
    value = os.getenv(primary)
    if value:
        return value
    for fallback in fallbacks:
        value = os.getenv(fallback)
        if value:
            return value
    return default


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance with environment variable fallbacks."""
    # Handle custom env var names before creating settings
    env_mappings = {
        "DATABASE_URL": ["CV_DATABASE_DATABASE_URL", "DATABASE_POSTGRES_URL", "DATABASE_URL"],
        "REDIS_URL": ["UPSTASH_REDIS_RES_REDIS_URL", "UPSTASH_REDIS_RES_KV_URL", "REDIS_URL"],
        "FRONTEND_URL": ["FRONTEND_URL", "NEXTAUTH_URL"],
    }
    
    for target, sources in env_mappings.items():
        if not os.getenv(target):
            for source in sources:
                value = os.getenv(source)
                if value:
                    os.environ[target] = value
                    break
    
    return Settings()

