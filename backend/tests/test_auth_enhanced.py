"""
Test enhanced authentication middleware with database validation.
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.middleware.auth import (
    verify_auth_token,
    verify_auth_token_with_db,
    optional_auth,
    get_user_id_from_token,
    clear_db_auth_cache,
)


@pytest.fixture
def mock_credentials():
    """Create mock HTTP credentials."""
    creds = Mock(spec=HTTPAuthorizationCredentials)
    creds.credentials = "test_token_12345"
    return creds


@pytest.fixture
def mock_settings():
    """Mock settings with JWT secret."""
    settings = Mock()
    settings.nextauth_secret = "test_secret"
    settings.auth_secret = ""
    settings.effective_secret = "test_secret"
    return settings


class TestVerifyAuthToken:
    """Tests for verify_auth_token function."""

    @pytest.mark.asyncio
    async def test_verify_auth_token_success(self, mock_credentials, mock_settings):
        """Test successful token verification."""
        with patch("app.middleware.auth.get_settings", return_value=mock_settings):
            with patch("app.middleware.auth.decode_service_jwt") as mock_decode:
                mock_decode.return_value = {"sub": "user123"}

                user_id = await verify_auth_token(mock_credentials)
                assert user_id == "user123"

    @pytest.mark.asyncio
    async def test_verify_auth_token_missing_credentials(self, mock_settings):
        """Test token verification with missing credentials."""
        with patch("app.middleware.auth.get_settings", return_value=mock_settings):
            with pytest.raises(HTTPException) as exc_info:
                await verify_auth_token(None)

            assert exc_info.value.status_code == 401
            assert "Missing authentication token" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_verify_auth_token_missing_subject(self, mock_credentials, mock_settings):
        """Test token verification when token has no subject."""
        with patch("app.middleware.auth.get_settings", return_value=mock_settings):
            with patch("app.middleware.auth.decode_service_jwt") as mock_decode:
                mock_decode.return_value = {}  # No "sub" field

                with pytest.raises(HTTPException) as exc_info:
                    await verify_auth_token(mock_credentials)

                assert exc_info.value.status_code == 401
                assert "missing subject" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_verify_auth_token_invalid_jwt(self, mock_credentials, mock_settings):
        """Test token verification with invalid JWT."""
        with patch("app.middleware.auth.get_settings", return_value=mock_settings):
            with patch("app.middleware.auth.decode_service_jwt") as mock_decode:
                from jwt.exceptions import PyJWTError

                mock_decode.side_effect = PyJWTError("Invalid token")

                with pytest.raises(HTTPException) as exc_info:
                    await verify_auth_token(mock_credentials)

                assert exc_info.value.status_code == 401
                assert "Invalid token" in exc_info.value.detail


class TestVerifyAuthTokenWithDB:
    """Tests for verify_auth_token_with_db (service JWT + soft session check)."""

    @pytest.fixture(autouse=True)
    def _clear_auth_cache(self):
        clear_db_auth_cache()
        yield
        clear_db_auth_cache()

    @pytest.mark.asyncio
    async def test_verify_auth_with_db_success(self, mock_credentials, mock_settings):
        """Test successful token verification with session soft-check match."""
        with patch("app.middleware.auth.get_settings", return_value=mock_settings):
            with patch("app.middleware.auth.decode_service_jwt") as mock_decode:
                mock_decode.return_value = {"sub": "user123"}

                mock_service = AsyncMock()
                mock_service.validate_token.return_value = "user123"
                mock_service.close = AsyncMock()

                with patch(
                    "app.services.profile_service.ProfileService",
                    return_value=mock_service,
                ):
                    user_id = await verify_auth_token_with_db(mock_credentials)
                    assert user_id == "user123"
                    mock_service.validate_token.assert_called_once_with("test_token_12345")
                    mock_service.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_verify_auth_with_db_accepts_jwt_when_session_null(
        self, mock_credentials, mock_settings
    ):
        """
        Bearer service JWTs get null from /api/auth/session — must still accept
        a signature-verified token (production resume-upload path).
        """
        with patch("app.middleware.auth.get_settings", return_value=mock_settings):
            with patch("app.middleware.auth.decode_service_jwt") as mock_decode:
                mock_decode.return_value = {"sub": "user123"}

                mock_service = AsyncMock()
                mock_service.validate_token.return_value = None
                mock_service.close = AsyncMock()

                with patch(
                    "app.services.profile_service.ProfileService",
                    return_value=mock_service,
                ):
                    user_id = await verify_auth_token_with_db(mock_credentials)
                    assert user_id == "user123"
                    mock_service.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_verify_auth_with_db_user_id_mismatch(
        self, mock_credentials, mock_settings
    ):
        """Test token verification when soft-check user ID doesn't match JWT."""
        with patch("app.middleware.auth.get_settings", return_value=mock_settings):
            with patch("app.middleware.auth.decode_service_jwt") as mock_decode:
                mock_decode.return_value = {"sub": "user123"}

                mock_service = AsyncMock()
                mock_service.validate_token.return_value = "user456"
                mock_service.close = AsyncMock()

                with patch(
                    "app.services.profile_service.ProfileService",
                    return_value=mock_service,
                ):
                    with pytest.raises(HTTPException) as exc_info:
                        await verify_auth_token_with_db(mock_credentials)

                    assert exc_info.value.status_code == 401
                    assert "does not match" in exc_info.value.detail.lower()
                    mock_service.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_verify_auth_with_db_uses_cache(self, mock_credentials, mock_settings):
        """Second call with same token should hit cache and skip ProfileService."""
        with patch("app.middleware.auth.get_settings", return_value=mock_settings):
            with patch("app.middleware.auth.decode_service_jwt") as mock_decode:
                mock_decode.return_value = {"sub": "user123"}

                mock_service = AsyncMock()
                mock_service.validate_token.return_value = "user123"
                mock_service.close = AsyncMock()

                with patch(
                    "app.services.profile_service.ProfileService",
                    return_value=mock_service,
                ) as mock_cls:
                    first = await verify_auth_token_with_db(mock_credentials)
                    second = await verify_auth_token_with_db(mock_credentials)

                    assert first == "user123"
                    assert second == "user123"
                    assert mock_cls.call_count == 1
                    mock_service.validate_token.assert_called_once()


class TestOptionalAuth:
    """Tests for optional_auth function."""

    @pytest.mark.asyncio
    async def test_optional_auth_with_token(self, mock_credentials, mock_settings):
        """Test optional auth with valid token."""
        with patch("app.middleware.auth.get_settings", return_value=mock_settings):
            with patch("app.middleware.auth.decode_service_jwt") as mock_decode:
                mock_decode.return_value = {"sub": "user123"}

                user_id = await optional_auth(mock_credentials)
                assert user_id == "user123"

    @pytest.mark.asyncio
    async def test_optional_auth_without_token(self, mock_settings):
        """Test optional auth without token."""
        with patch("app.middleware.auth.get_settings", return_value=mock_settings):
            user_id = await optional_auth(None)
            assert user_id is None

    @pytest.mark.asyncio
    async def test_optional_auth_invalid_token(self, mock_credentials, mock_settings):
        """Test optional auth with invalid token returns None."""
        with patch("app.middleware.auth.get_settings", return_value=mock_settings):
            with patch("app.middleware.auth.decode_service_jwt") as mock_decode:
                from jwt.exceptions import PyJWTError

                mock_decode.side_effect = PyJWTError("Invalid")

                user_id = await optional_auth(mock_credentials)
                assert user_id is None


class TestGetUserIdFromToken:
    """Tests for get_user_id_from_token helper."""

    def test_get_user_id_success(self, mock_settings):
        with patch("app.middleware.auth.get_settings", return_value=mock_settings):
            with patch("app.middleware.auth.decode_service_jwt") as mock_decode:
                mock_decode.return_value = {"sub": "user123"}
                assert get_user_id_from_token("tok") == "user123"

    def test_get_user_id_invalid(self, mock_settings):
        with patch("app.middleware.auth.get_settings", return_value=mock_settings):
            with patch("app.middleware.auth.decode_service_jwt") as mock_decode:
                from jwt.exceptions import PyJWTError

                mock_decode.side_effect = PyJWTError("bad")
                assert get_user_id_from_token("tok") is None
