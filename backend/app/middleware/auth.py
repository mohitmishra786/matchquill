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


def _jwt_secrets() -> list[str]:
    """
    Secrets to try when verifying service-to-service JWTs.

    Frontend (Next.js) signs with AUTH_SECRET || NEXTAUTH_SECRET.
    Railway must use the *same* value. We try both so a single platform
    that only sets one name still works, and temporary dual-set mismatches
    are easier to diagnose.
    """
    settings = get_settings()
    candidates = [
        (settings.auth_secret or "").strip(),
        (settings.nextauth_secret or "").strip(),
        (settings.effective_secret or "").strip(),
    ]
    # Preserve order, drop empties/duplicates
    seen: set[str] = set()
    secrets: list[str] = []
    for s in candidates:
        if s and s not in seen:
            seen.add(s)
            secrets.append(s)
    return secrets


def decode_service_jwt(token: str) -> dict:
    """
    Decode a HS256 JWT minted by the Next.js frontend.

    Tries AUTH_SECRET then NEXTAUTH_SECRET (same priority as frontend).
    """
    secrets = _jwt_secrets()
    if not secrets:
        raise JWTError("No AUTH_SECRET / NEXTAUTH_SECRET configured on backend")

    last_error: Optional[Exception] = None
    for secret in secrets:
        try:
            return jwt.decode(token, secret, algorithms=["HS256"])
        except JWTError as e:
            last_error = e
            continue
    # All candidates failed — re-raise the last decode error (never use assert:
    # Bandit flags assert, and optimized bytecode can strip it).
    if last_error is not None:
        raise last_error
    raise JWTError("JWT verification failed with all configured secrets")


async def verify_auth_token_with_db(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    """
    Verify JWT auth token from Authorization header for service-to-service calls.

    Validation steps:
    1. JWT signature + expiration (shared AUTH_SECRET / NEXTAUTH_SECRET)
    2. Require ``sub`` (user id) claim
    3. Optional soft-check via Next.js session API (cookie-only; usually N/A
       for Bearer service tokens minted by the frontend after login)

    Service tokens are minted by Vercel only after a valid NextAuth session, so
    a signature-verified JWT is sufficient proof of identity. Treating a null
    session soft-check as "user not found" was a production bug that blocked
    resume upload after secrets were aligned.

    Results are cached briefly (by token hash) to avoid repeat work on
    high-frequency AI/upload routes.
    """
    if credentials is None:
        logger.warning("Auth failed: Missing credentials")
        raise HTTPException(
            status_code=401,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        # Decode JWT — must match frontend AUTH_SECRET || NEXTAUTH_SECRET
        payload = decode_service_jwt(token)

        user_id = payload.get("sub")
        if user_id is None:
            logger.warning("Auth failed: Token missing subject", {"token_prefix": token[:16]})
            raise HTTPException(
                status_code=401,
                detail="Invalid token: missing subject",
            )
        user_id = str(user_id)

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

        # Soft session check (NextAuth cookie API — usually empty for Bearer JWTs)
        from app.services.profile_service import ProfileService
        profile_service = ProfileService()

        try:
            validated_user_id = await profile_service.validate_token(token)

            if validated_user_id is not None and str(validated_user_id) != user_id:
                logger.warning("Auth failed: User ID mismatch", {
                    "token_user_id": user_id,
                    "session_user_id": validated_user_id,
                })
                raise HTTPException(
                    status_code=401,
                    detail="Token user ID does not match database",
                )

            if validated_user_id is None:
                # Expected for service JWTs: /api/auth/session ignores Bearer.
                logger.info(
                    "Auth success with verified service JWT "
                    "(session soft-check unavailable for Bearer tokens)",
                    {"user_id": user_id},
                )
            else:
                logger.debug("Auth success with session soft-check", {
                    "user_id": user_id,
                })

            _set_cached_user_id(token, user_id)
            return user_id

        finally:
            await profile_service.close()

    except JWTError as e:
        err = str(e)
        logger.warning("Auth failed: Invalid JWT", {
            "error": err,
            "token_prefix": token[:16],
            "has_secrets": bool(_jwt_secrets()),
        })
        detail = f"Invalid token: {err}"
        if "Signature verification failed" in err:
            detail = (
                "Invalid token: Signature verification failed. "
                "Set the same NEXTAUTH_SECRET (or AUTH_SECRET) on both "
                "Vercel and Railway — values must match exactly."
            )
        raise HTTPException(
            status_code=401,
            detail=detail,
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

    try:
        payload = decode_service_jwt(token)

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
        err = str(e)
        logger.warning("Auth failed: Invalid JWT", {
            "error": err,
            "token_prefix": token[:16],
            "has_secrets": bool(_jwt_secrets()),
        })
        detail = f"Invalid token: {err}"
        if "Signature verification failed" in err:
            detail = (
                "Invalid token: Signature verification failed. "
                "Set the same NEXTAUTH_SECRET (or AUTH_SECRET) on both "
                "Vercel and Railway — values must match exactly."
            )
        raise HTTPException(
            status_code=401,
            detail=detail,
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
    try:
        payload = decode_service_jwt(token)
        return payload.get("sub")
    except JWTError:
        return None
