"""
Authentication Middleware
Validates JWT tokens for protected endpoints with database verification.
"""

import hashlib
import time
from typing import Dict, Optional, Tuple

import jwt
from jwt.exceptions import PyJWTError as JWTError
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import get_settings
from app.utils.logger import logger


# HTTP Bearer security scheme
security = HTTPBearer(auto_error=False)

# Short-lived cache for DB-validated tokens to avoid a frontend/session
# round-trip on every expensive AI/upload request. Keyed by token hash only.
_DB_AUTH_CACHE: Dict[str, Tuple[str, float]] = {}
_DB_AUTH_CACHE_TTL_SECONDS = 60.0
_DB_AUTH_CACHE_MAX_SIZE = 1024


def _token_cache_key(token: str) -> str:
    """Hash token for cache key (never store raw tokens)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _get_cached_user_id(token: str) -> Optional[str]:
    """Return cached user_id if still valid."""
    key = _token_cache_key(token)
    entry = _DB_AUTH_CACHE.get(key)
    if entry is None:
        return None
    user_id, expires_at = entry
    if time.monotonic() >= expires_at:
        _DB_AUTH_CACHE.pop(key, None)
        return None
    return user_id


def _set_cached_user_id(token: str, user_id: str) -> None:
    """Cache validated user_id with TTL; bound cache size."""
    if len(_DB_AUTH_CACHE) >= _DB_AUTH_CACHE_MAX_SIZE:
        # Drop expired entries first; if still full, clear all
        now = time.monotonic()
        expired = [k for k, (_, exp) in _DB_AUTH_CACHE.items() if now >= exp]
        for k in expired:
            _DB_AUTH_CACHE.pop(k, None)
        if len(_DB_AUTH_CACHE) >= _DB_AUTH_CACHE_MAX_SIZE:
            _DB_AUTH_CACHE.clear()
    _DB_AUTH_CACHE[_token_cache_key(token)] = (
        user_id,
        time.monotonic() + _DB_AUTH_CACHE_TTL_SECONDS,
    )


def clear_db_auth_cache() -> None:
    """Clear DB auth cache (for tests)."""
    _DB_AUTH_CACHE.clear()


async def verify_auth_token_with_db(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    """
    Verify JWT auth token from Authorization header with database validation.

    This enhanced version validates:
    1. JWT signature and expiration
    2. User exists in the database (via ProfileService)
    3. User account is active

    Results are cached briefly (by token hash) to avoid repeated session
    lookups on high-frequency AI/upload routes.

    Args:
        credentials: HTTP Bearer credentials

    Returns:
        User ID from token

    Raises:
        HTTPException: If token is invalid, missing, or user not found in database
    """
    if credentials is None:
        logger.warning("Auth failed: Missing credentials")
        raise HTTPException(
            status_code=401,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    settings = get_settings()

    try:
        # Decode JWT token
        # Note: NextAuth uses HS256 by default
        payload = jwt.decode(
            token,
            settings.nextauth_secret,
            algorithms=["HS256"],
        )

        user_id = payload.get("sub")
        if user_id is None:
            logger.warning("Auth failed: Token missing subject", {"token_prefix": token[:16]})
            raise HTTPException(
                status_code=401,
                detail="Invalid token: missing subject",
            )

        # Fast path: recently validated token
        cached_user_id = _get_cached_user_id(token)
        if cached_user_id is not None:
            if cached_user_id != user_id:
                clear_db_auth_cache()
                logger.warning("Auth cache mismatch; forcing revalidation", {
                    "token_user_id": user_id,
                    "cached_user_id": cached_user_id,
                })
            else:
                logger.debug("Auth success with database validation (cache hit)", {
                    "user_id": user_id,
                })
                return user_id

        # Database validation: verify user exists and is active
        from app.services.profile_service import ProfileService
        profile_service = ProfileService()

        try:
            validated_user_id = await profile_service.validate_token(token)

            if validated_user_id is None:
                logger.warning("Auth failed: User not found in database or inactive", {
                    "user_id": user_id,
                    "token_prefix": token[:16],
                })
                raise HTTPException(
                    status_code=401,
                    detail="User not found or account inactive",
                )

            # Ensure user IDs match
            if validated_user_id != user_id:
                logger.warning("Auth failed: User ID mismatch", {
                    "token_user_id": user_id,
                    "db_user_id": validated_user_id,
                })
                raise HTTPException(
                    status_code=401,
                    detail="Token user ID does not match database",
                )

            _set_cached_user_id(token, user_id)

            logger.debug("Auth success with database validation", {
                "user_id": user_id,
            })

            return user_id

        finally:
            await profile_service.close()

    except JWTError as e:
        logger.warning("Auth failed: Invalid JWT", {
            "error": str(e),
            "token_prefix": token[:16],
        })
        raise HTTPException(
            status_code=401,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Auth failed: Unexpected error", {
            "error": str(e),
            "token_prefix": token[:16],
        })
        raise HTTPException(
            status_code=500,
            detail="Authentication verification failed",
        )


async def verify_auth_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    """
    Verify JWT auth token from Authorization header (signature validation only).

    For endpoints that require JWT validation but not database verification.
    Use verify_auth_token_with_db for full validation including database check
    (preferred for AI, upload, and other sensitive/expensive routes).

    Args:
        credentials: HTTP Bearer credentials

    Returns:
        User ID from token

    Raises:
        HTTPException: If token is invalid or missing
    """
    if credentials is None:
        logger.warning("Auth failed: Missing credentials")
        raise HTTPException(
            status_code=401,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    settings = get_settings()

    try:
        # Decode JWT token
        # Note: NextAuth uses HS256 by default
        payload = jwt.decode(
            token,
            settings.nextauth_secret,
            algorithms=["HS256"],
        )

        user_id = payload.get("sub")
        if user_id is None:
            logger.warning("Auth failed: Token missing subject", {"token_prefix": token[:16]})
            raise HTTPException(
                status_code=401,
                detail="Invalid token: missing subject",
            )

        logger.debug("Auth success (JWT only)", {"user_id": user_id})
        return user_id

    except JWTError as e:
        logger.warning("Auth failed: Invalid JWT", {
            "error": str(e),
            "token_prefix": token[:16],
        })
        raise HTTPException(
            status_code=401,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def optional_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[str]:
    """
    Optionally verify auth token. Returns None if no token provided.
    Useful for endpoints that can work with or without auth.

    Args:
        credentials: HTTP Bearer credentials

    Returns:
        User ID if token is valid, None otherwise
    """
    if credentials is None:
        return None

    try:
        return await verify_auth_token(credentials)
    except HTTPException:
        return None


def get_user_id_from_token(token: str) -> Optional[str]:
    """
    Extract user ID from a JWT token (sync version for use in services).

    Args:
        token: JWT token string

    Returns:
        User ID if valid, None otherwise
    """
    settings = get_settings()

    try:
        payload = jwt.decode(
            token,
            settings.nextauth_secret,
            algorithms=["HS256"],
        )
        return payload.get("sub")
    except JWTError:
        return None
