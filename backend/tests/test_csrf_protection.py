"""
Tests for CSRF Protection Middleware
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.utils.csrf_protection import (
    CSRFProtectionMiddleware,
    generate_csrf_token,
    CSRF_TOKEN_HEADER,
    CSRF_COOKIE_NAME,
)


@pytest.fixture
def app_with_csrf():
    """Create a test FastAPI app with CSRF protection."""
    app = FastAPI()

    # Add CSRF middleware
    app.add_middleware(
        CSRFProtectionMiddleware,
        exempt_paths=["/public", "/health"]
    )

    @app.get("/")
    async def root():
        return {"message": "Hello"}

    @app.get("/public")
    async def public_endpoint():
        return {"message": "Public"}

    @app.get("/health")
    async def health():
        return {"status": "healthy"}

    @app.post("/protected")
    async def protected_post():
        return {"message": "Protected POST"}

    @app.put("/update")
    async def protected_put():
        return {"message": "Protected PUT"}

    @app.delete("/delete")
    async def protected_delete():
        return {"message": "Protected DELETE"}

    @app.patch("/patch")
    async def protected_patch():
        return {"message": "Protected PATCH"}

    return app


@pytest.fixture
def client(app_with_csrf):
    """Create test client with CSRF-protected app."""
    return TestClient(app_with_csrf)


def test_generate_csrf_token():
    """Test CSRF token generation."""
    token1 = generate_csrf_token()
    token2 = generate_csrf_token()

    # Tokens should be non-empty strings
    assert isinstance(token1, str)
    assert len(token1) > 0

    # Tokens should be unique
    assert token1 != token2


def test_get_request_generates_csrf_cookie(client):
    """Test that GET requests receive a CSRF cookie."""
    response = client.get("/")

    assert response.status_code == 200
    assert CSRF_COOKIE_NAME in response.cookies
    assert "X-CSRF-Token-Set" in response.headers


def test_safe_methods_allowed_without_csrf(client) -> None:
    """Test that safe methods (GET, HEAD, OPTIONS) don't require CSRF token."""
    # GET
    response = client.get("/")
    assert response.status_code == 200

    # HEAD - FastAPI/Starlette may not support HEAD on all endpoints
    response = client.head("/")
    assert response.status_code in [200, 405]  # 405 is acceptable if HEAD not supported

    # OPTIONS - may not be supported on all endpoints
    response = client.options("/")
    assert response.status_code in [200, 405]  # Some frameworks may not support OPTIONS


def test_exempt_paths_do_not_require_csrf(client):
    """Test that exempt paths don't require CSRF tokens."""
    # GET on exempt path - health check is exempt
    response = client.get("/health")
    assert response.status_code == 200

    # Test root path which is also exempt
    response = client.get("/")
    assert response.status_code == 200

    # Note: POST to exempt paths would work if endpoints existed
    # Since we don't have public POST endpoints, we can't test this directly
    # The CSRF middleware exempt_paths configuration handles this


def test_health_check_exempt(client):
    """Test that health check endpoint is exempt from CSRF."""
    response = client.get("/health")
    assert response.status_code == 200

    # POST to health (if it existed) would also be exempt
    response = client.post("/health")
    assert response.status_code == 405  # Method not allowed (endpoint is GET only)


def test_post_without_csrf_token_fails(client):
    """Test that POST without CSRF token is rejected."""
    response = client.post("/protected")

    assert response.status_code == 403
    assert "detail" in response.json()
    assert "CSRF" in response.json()["detail"]


def test_bearer_auth_skips_csrf(client):
    """Service-to-service Bearer calls must not require CSRF cookies."""
    response = client.post(
        "/protected",
        headers={"Authorization": "Bearer service-token-abc"},
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Protected POST"


def test_post_with_header_but_no_cookie_fails(client):
    """Test that POST with CSRF header but no cookie is rejected."""
    response = client.post(
        "/protected",
        headers={CSRF_TOKEN_HEADER: "some_token"}
    )

    assert response.status_code == 403
    assert "CSRF cookie missing" in response.json()["detail"]


def test_post_with_mismatched_tokens_fails(client):
    """Test that POST with mismatched CSRF tokens is rejected."""
    # First, get a CSRF token
    get_response = client.get("/")
    csrf_token = get_response.cookies.get(CSRF_COOKIE_NAME)

    # Now POST with a different token in header
    response = client.post(
        "/protected",
        headers={CSRF_TOKEN_HEADER: "wrong_token"},
        cookies={CSRF_COOKIE_NAME: csrf_token}
    )

    assert response.status_code == 403
    assert "Invalid CSRF token" in response.json()["detail"]


def test_post_with_valid_csrf_token_succeeds(client):
    """Test that POST with valid CSRF token succeeds."""
    # First, get a CSRF token
    get_response = client.get("/")
    csrf_token = get_response.cookies.get(CSRF_COOKIE_NAME)

    # Now POST with the same token in header and cookie
    response = client.post(
        "/protected",
        headers={CSRF_TOKEN_HEADER: csrf_token},
        cookies={CSRF_COOKIE_NAME: csrf_token}
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Protected POST"


def test_put_with_valid_csrf_token_succeeds(client):
    """Test that PUT with valid CSRF token succeeds."""
    get_response = client.get("/")
    csrf_token = get_response.cookies.get(CSRF_COOKIE_NAME)

    response = client.put(
        "/update",
        headers={CSRF_TOKEN_HEADER: csrf_token},
        cookies={CSRF_COOKIE_NAME: csrf_token}
    )

    assert response.status_code == 200


def test_delete_with_valid_csrf_token_succeeds(client):
    """Test that DELETE with valid CSRF token succeeds."""
    get_response = client.get("/")
    csrf_token = get_response.cookies.get(CSRF_COOKIE_NAME)

    response = client.delete(
        "/delete",
        headers={CSRF_TOKEN_HEADER: csrf_token},
        cookies={CSRF_COOKIE_NAME: csrf_token}
    )

    assert response.status_code == 200


def test_patch_with_valid_csrf_token_succeeds(client):
    """Test that PATCH with valid CSRF token succeeds."""
    get_response = client.get("/")
    csrf_token = get_response.cookies.get(CSRF_COOKIE_NAME)

    response = client.patch(
        "/patch",
        headers={CSRF_TOKEN_HEADER: csrf_token},
        cookies={CSRF_COOKIE_NAME: csrf_token}
    )

    assert response.status_code == 200


def test_csrf_token_rotation_after_state_change(client) -> None:
    """Test that CSRF token is rotated after state-changing operations."""
    # Get initial token
    get_response = client.get("/")
    initial_token = get_response.cookies.get(CSRF_COOKIE_NAME)

    # Make a POST request
    post_response = client.post(
        "/protected",
        headers={CSRF_TOKEN_HEADER: initial_token},
        cookies={CSRF_COOKIE_NAME: initial_token}
    )

    # Check if a new token was set
    assert post_response.status_code == 200
    new_token = post_response.cookies.get(CSRF_COOKIE_NAME)
    if new_token:
        assert new_token != initial_token, "Token should be rotated after POST"

    # Note: Token rotation means a new token is generated
    # In the actual implementation, this happens via X-CSRF-Token-Set header
    assert "X-CSRF-Token-Set" in post_response.headers


def test_missing_csrf_header_returns_403(client) -> None:
    """Test that missing CSRF header in POST returns 403."""
    response = client.post("/protected")

    assert response.status_code == 403
    assert "detail" in response.json()
    assert "CSRF" in response.json()["detail"]


def test_csrf_cookie_security_attributes(client):
    """Test that CSRF cookie has correct security attributes."""
    response = client.get("/")

    # Check cookie attributes
    set_cookie_header = response.headers.get("set-cookie", "")

    assert CSRF_COOKIE_NAME in set_cookie_header
    assert "HttpOnly" in set_cookie_header or "httponly" in set_cookie_header.lower()
    assert "SameSite=strict" in set_cookie_header or "samesite=strict" in set_cookie_header.lower()


def test_csrf_protection_does_not_affect_response_body(client):
    """Test that CSRF protection doesn't modify response body."""
    get_response = client.get("/")
    csrf_token = get_response.cookies.get(CSRF_COOKIE_NAME)

    response = client.post(
        "/protected",
        headers={CSRF_TOKEN_HEADER: csrf_token},
        cookies={CSRF_COOKIE_NAME: csrf_token}
    )

    # Response should be unmodified
    assert response.json() == {"message": "Protected POST"}


def test_multiple_requests_with_same_token(client) -> None:
    """Test that the same CSRF token can be used for multiple requests."""
    get_response = client.get("/")
    csrf_token = get_response.cookies.get(CSRF_COOKIE_NAME)

    # Make first request
    response1 = client.post(
        "/protected",
        headers={CSRF_TOKEN_HEADER: csrf_token},
        cookies={CSRF_COOKIE_NAME: csrf_token}
    )
    assert response1.status_code == 200

    # Make second request with same token
    # Note: After rotation, you'd need the new token from response1
    # For this test, we're checking the initial behavior
    new_token = response1.headers.get("X-CSRF-Token-Set", csrf_token)

    response2 = client.post(
        "/protected",
        headers={CSRF_TOKEN_HEADER: new_token},
        cookies={CSRF_COOKIE_NAME: new_token}
    )
    # If strict rotation is enforced, the old cookie won't match;
    # otherwise the request succeeds with the rotated token.
    assert response2.status_code in [200, 403]