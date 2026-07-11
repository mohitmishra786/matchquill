"""Tests for configuration URL format validation."""

import pytest
from app.config import (
    _is_valid_http_url,
    _is_valid_redis_url,
    _is_valid_database_url,
    Settings,
)


def test_http_url_validation() -> None:
    assert _is_valid_http_url("https://example.com") is True
    assert _is_valid_http_url("http://localhost:3000") is True
    assert _is_valid_http_url("ftp://bad") is False
    assert _is_valid_http_url("not-a-url") is False
    assert _is_valid_http_url("", allow_empty=True) is True


def test_redis_url_validation() -> None:
    assert _is_valid_redis_url("redis://localhost:6379") is True
    assert _is_valid_redis_url("rediss://user:pass@host:6380") is True
    assert _is_valid_redis_url("http://localhost") is False


def test_database_url_validation() -> None:
    assert _is_valid_database_url("postgresql://u:p@localhost:5432/db") is True
    assert _is_valid_database_url("postgres://u:p@localhost/db") is True
    assert _is_valid_database_url("mysql://localhost/db") is False


def test_settings_rejects_invalid_frontend_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost:5432/db")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379")
    monkeypatch.setenv("FRONTEND_URL", "not-valid")
    monkeypatch.setenv("NEXTAUTH_URL", "https://ok.example.com")
    with pytest.raises(Exception):
        Settings()
