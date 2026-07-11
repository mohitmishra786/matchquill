"""
Test query parameter sanitization to prevent sensitive data logging.
"""

import logging

from starlette.datastructures import QueryParams, Headers

from app.utils.logger import (
    sanitize_query_params,
    sanitize_dict,
    sanitize_headers,
    is_sensitive_key,
    DEFAULT_SENSITIVE_KEYS,
)


class TestSanitizeQueryParams:
    """Tests for sanitize_query_params function."""

    def test_sanitize_password(self):
        """Test that password parameter is masked."""
        query = QueryParams({"password": "secret123", "user": "test"})
        result = sanitize_query_params(query)

        assert result is not None
        assert result["password"] == "***"
        assert result["user"] == "test"

    def test_sanitize_token(self):
        """Test that token parameter is masked."""
        query = QueryParams({"token": "abc123def456", "id": "123"})
        result = sanitize_query_params(query)

        assert result["token"] == "***"
        assert result["id"] == "123"

    def test_sanitize_api_key(self):
        """Test that api_key parameter is masked."""
        query = QueryParams({"api_key": "secret_api_key", "page": "1"})
        result = sanitize_query_params(query)

        assert result["api_key"] == "***"
        assert result["page"] == "1"

    def test_sanitize_multiple_sensitive_keys(self):
        """Test that multiple sensitive parameters are masked."""
        query = QueryParams({
            "password": "pass123",
            "access_token": "token123",
            "api_key": "key123",
            "user": "testuser",
        })
        result = sanitize_query_params(query)

        assert result["password"] == "***"
        assert result["access_token"] == "***"
        assert result["api_key"] == "***"
        assert result["user"] == "testuser"

    def test_sanitize_case_insensitive(self):
        """Test that key matching is case-insensitive."""
        query = QueryParams({
            "Password": "pass123",
            "TOKEN": "token123",
            "Api-Key": "key123",
        })
        result = sanitize_query_params(query)

        assert result["Password"] == "***"
        assert result["TOKEN"] == "***"
        assert result["Api-Key"] == "***"

    def test_sanitize_authorization_and_cookie(self):
        """Test authorization and cookie query params are masked."""
        query = QueryParams({
            "authorization": "Bearer super-secret",
            "cookie": "session=abc123",
            "page": "2",
        })
        result = sanitize_query_params(query)

        assert result["authorization"] == "***"
        assert result["cookie"] == "***"
        assert result["page"] == "2"

    def test_sanitize_auth_token_camel_case(self):
        """Test camelCase authToken is treated as sensitive."""
        query = QueryParams({"authToken": "jwt-value", "q": "search"})
        result = sanitize_query_params(query)

        assert result["authToken"] == "***"
        assert result["q"] == "search"

    def test_sanitize_long_values(self):
        """Test that long non-sensitive values are truncated."""
        query = QueryParams({"description": "a" * 150, "password": "secret"})
        result = sanitize_query_params(query)

        assert result["description"] == "a" * 100 + "..."
        assert result["password"] == "***"

    def test_sanitize_empty_query(self):
        """Test that empty query params return None."""
        query = QueryParams({})
        result = sanitize_query_params(query)

        assert result is None

    def test_sanitize_none_query(self):
        """Test that None query params return None."""
        result = sanitize_query_params(None)

        assert result is None


class TestIsSensitiveKey:
    """Tests for sensitive key detection used across logging."""

    def test_covers_token_authorization_password_cookie(self):
        for key in (
            "token",
            "Token",
            "authorization",
            "Authorization",
            "password",
            "Password",
            "cookie",
            "Cookie",
            "authToken",
            "auth_token",
            "access_token",
        ):
            assert is_sensitive_key(key), f"expected {key} to be sensitive"

    def test_non_sensitive_keys(self):
        for key in ("user", "page", "jobDescription", "path"):
            assert not is_sensitive_key(key), f"expected {key} not sensitive"

    def test_default_set_includes_required_keys(self):
        for required in ("token", "authorization", "password", "cookie"):
            assert required in DEFAULT_SENSITIVE_KEYS


class TestSanitizeHeaders:
    """Tests for sanitize_headers — never log auth headers/cookies."""

    def test_redacts_authorization_and_cookie(self):
        headers = Headers({
            "authorization": "Bearer secret-jwt",
            "cookie": "session=xyz; other=1",
            "user-agent": "pytest",
            "content-type": "application/json",
        })
        result = sanitize_headers(headers)

        assert result is not None
        # Presence flags only for sensitive headers — never raw values
        assert result.get("has_authorization") == "true"
        assert result.get("has_cookie") == "true"
        assert "authorization" not in result or result.get("authorization") == "***"
        assert "cookie" not in result or result.get("cookie") == "***"
        assert result["user-agent"] == "pytest"
        assert result["content-type"] == "application/json"
        assert "secret-jwt" not in str(result)
        assert "session=xyz" not in str(result)

    def test_drops_non_allowlisted_headers(self):
        headers = Headers({
            "x-custom-evil\ninjected": "value",
            "user-agent": "ok",
        })
        result = sanitize_headers(headers)
        assert result is not None
        assert result == {"user-agent": "ok"}
        assert "injected" not in str(result)

    def test_strips_newlines_from_values(self):
        headers = Headers({
            "user-agent": "Mozilla\r\nInjected-Header: evil",
        })
        result = sanitize_headers(headers)
        assert result is not None
        assert "\n" not in result["user-agent"]
        assert "\r" not in result["user-agent"]

    def test_none_headers(self):
        assert sanitize_headers(None) is None


class TestSanitizeDict:
    """Tests for sanitize_dict function."""

    def test_sanitize_dict_simple(self):
        """Test sanitization of simple dictionary."""
        data = {
            "username": "testuser",
            "password": "secret123",
            "email": "test@example.com",
        }
        result = sanitize_dict(data)

        assert result["username"] == "testuser"
        assert result["password"] == "***"
        assert result["email"] == "test@example.com"

    def test_sanitize_dict_nested(self):
        """Test sanitization of nested dictionary."""
        data = {
            "user": "testuser",
            "credentials": {
                "password": "secret123",
                "api_key": "key123",
            },
            "settings": {
                "theme": "dark",
            },
        }
        result = sanitize_dict(data)

        assert result["user"] == "testuser"
        assert result["credentials"]["password"] == "***"
        assert result["credentials"]["api_key"] == "***"
        assert result["settings"]["theme"] == "dark"

    def test_sanitize_dict_with_list(self):
        """Test sanitization of dictionary containing lists."""
        data = {
            "users": [
                {"name": "user1", "password": "pass1"},
                {"name": "user2", "password": "pass2"},
            ],
            "count": 2,
        }
        result = sanitize_dict(data)

        assert result["users"][0]["name"] == "user1"
        assert result["users"][0]["password"] == "***"
        assert result["users"][1]["password"] == "***"
        assert result["count"] == 2

    def test_sanitize_dict_custom_sensitive_keys(self):
        """Test sanitization with custom sensitive keys."""
        data = {
            "username": "test",
            "secret_value": "hidden",
            "public_value": "visible",
        }
        custom_keys = {"secret_value"}
        result = sanitize_dict(data, sensitive_keys=custom_keys)

        assert result["username"] == "test"
        assert result["secret_value"] == "***"
        assert result["public_value"] == "visible"

    def test_sanitize_auth_body_fields(self):
        """Auth body fields (authToken, password, cookie) must be redacted."""
        body = {
            "authToken": "jwt-should-not-log",
            "password": "p@ss",
            "cookie": "sid=1",
            "authorization": "Bearer x",
            "jobDescription": "A long enough job description here",
        }
        result = sanitize_dict(body)

        assert result["authToken"] == "***"
        assert result["password"] == "***"
        assert result["cookie"] == "***"
        assert result["authorization"] == "***"
        assert result["jobDescription"].startswith("A long enough")
        assert "jwt-should-not-log" not in str(result)

    def test_sanitize_dict_preserves_structure(self):
        """Test that sanitization preserves original structure."""
        data = {
            "level1": {
                "level2": {
                    "password": "secret",
                    "value": 123,
                },
            },
            "list": [
                {"token": "abc"},
                {"safe": "value"},
            ],
        }
        result = sanitize_dict(data)

        assert "level1" in result
        assert "level2" in result["level1"]
        assert result["level1"]["level2"]["password"] == "***"
        assert result["level1"]["level2"]["value"] == 123
        assert result["list"][0]["token"] == "***"
        assert result["list"][1]["safe"] == "value"


class TestLoggingMiddlewareNoAuthLeak:
    """Ensure LoggingMiddleware never logs Authorization/cookies/tokens."""

    def test_middleware_request_log_omits_auth_headers(self, client, caplog):
        """Request with Authorization + Cookie must not appear in app log data."""
        with caplog.at_level(logging.INFO, logger="cv-wiz"):
            response = client.get(
                "/?token=secret-query-token&page=1",
                headers={
                    "Authorization": "Bearer super-secret-jwt",
                    "Cookie": "session=leak-me",
                },
            )

        assert response.status_code == 200
        # Only assert against our app logger (httpx TestClient may log URLs)
        app_records = [r for r in caplog.records if r.name == "cv-wiz"]
        assert app_records, "expected cv-wiz log records"
        combined = " ".join(r.getMessage() for r in app_records)
        for rec in app_records:
            data = getattr(rec, "data", None)
            if data is not None:
                combined += " " + str(data)
        assert "super-secret-jwt" not in combined
        assert "session=leak-me" not in combined
        assert "secret-query-token" not in combined
        # Query token should be redacted if present in structured data
        for rec in app_records:
            data = getattr(rec, "data", None) or {}
            query = data.get("query") or {}
            if "token" in query:
                assert query["token"] == "***"
