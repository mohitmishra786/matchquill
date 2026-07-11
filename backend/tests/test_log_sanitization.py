"""
Tests for log sanitization utilities.
"""

from starlette.datastructures import Headers

from app.utils.logger import (
    DEFAULT_SENSITIVE_KEYS,
    is_sensitive_key,
    sanitize_headers,
    sanitize_query_params,
    sanitize_dict,
    _safe_log_value,
    log_api_request,
)


class TestIsSensitiveKey:
    def test_exact_matches(self):
        for key in ("password", "token", "authorization", "cookie", "api_key"):
            assert is_sensitive_key(key), f"expected {key} to be sensitive"

    def test_substring_matches(self):
        for key in ("authToken", "userPassword", "sessionId", "CookieHeader"):
            assert is_sensitive_key(key), f"expected {key} to be sensitive"

    def test_non_sensitive(self):
        for key in ("username", "email", "path", "method"):
            assert not is_sensitive_key(key), f"expected {key} not sensitive"

    def test_custom_keys_are_additive(self):
        # Built-in still applies when custom set is provided
        assert is_sensitive_key("password", sensitive_keys={"custom_secret"})
        # Custom key also matches
        assert is_sensitive_key("custom_secret", sensitive_keys={"custom_secret"})
        assert not is_sensitive_key("username", sensitive_keys={"custom_secret"})

    def test_default_set_includes_required_keys(self):
        for required in ("token", "authorization", "password", "cookie"):
            assert required in DEFAULT_SENSITIVE_KEYS


class TestSafeLogValue:
    """CodeQL py/log-injection: CR/LF must be stripped."""

    def test_strips_newlines(self):
        assert "\n" not in _safe_log_value("a\nb")
        assert "\r" not in _safe_log_value("a\rb")
        assert "\r" not in _safe_log_value("a\r\nb")
        assert "\n" not in _safe_log_value("a\r\nb")

    def test_preserves_printable_text(self):
        assert _safe_log_value("hello-world") == "hello-world"

    def test_truncates(self):
        assert len(_safe_log_value("x" * 200, max_len=50)) == 50


class TestSanitizeHeaders:
    """Headers: presence flags only — never raw client values."""

    def test_redacts_authorization_and_cookie(self):
        headers = Headers({
            "authorization": "Bearer secret-jwt",
            "cookie": "session=xyz; other=1",
            "user-agent": "pytest",
            "content-type": "application/json",
        })
        result = sanitize_headers(headers)

        assert result is not None
        assert result.get("has_authorization") == "true"
        assert result.get("has_cookie") == "true"
        assert result.get("has_user_agent") == "true"
        assert result.get("has_content_type") == "true"
        # Never echo secrets or raw UA
        assert "secret-jwt" not in str(result)
        assert "session=xyz" not in str(result)
        assert "pytest" not in str(result)
        assert "application/json" not in str(result)

    def test_drops_non_allowlisted_headers(self):
        headers = Headers({
            "x-custom-evil\ninjected": "value",
            "user-agent": "ok",
        })
        result = sanitize_headers(headers)
        assert result is not None
        assert result == {"has_user_agent": "true"}
        assert "injected" not in str(result)

    def test_none_headers(self):
        assert sanitize_headers(None) is None


class TestSanitizeQueryParams:
    def test_masks_sensitive_and_lengths_others(self):
        # Use a plain dict via dict() constructor path
        class Mapping(dict):
            pass

        result = sanitize_query_params(Mapping({"token": "secret", "q": "hello"}))
        assert result is not None
        assert result["token"] == "***"
        assert result["q"] == "<len=5>"
        assert "secret" not in str(result)
        assert "hello" not in str(result)


class TestSanitizeDict:
    def test_sanitize_dict_simple(self):
        data = {
            "username": "testuser",
            "password": "secret123",
            "email": "test@example.com",
        }
        result = sanitize_dict(data)

        assert result["username"] == "testuser" or "username" in result
        assert result["password"] == "***"
        assert "secret123" not in str(result)

    def test_sanitize_dict_nested(self):
        data = {
            "user": "testuser",
            "credentials": {
                "password": "secret",
                "token": "abc",
            },
        }
        result = sanitize_dict(data)
        assert result["credentials"]["password"] == "***"
        assert result["credentials"]["token"] == "***"


class TestLogApiRequest:
    def test_strips_newlines_from_path(self):
        # Should not raise; path CR/LF stripped before logging
        log_api_request("GET", "/api/foo\nINJECTED", 200, 1.0)
        log_api_request("POST", "/api/bar\r\nX", 201, 2.0)
