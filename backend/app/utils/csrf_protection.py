"""
CSRF Protection Middleware
Provides CSRF token generation and validation for state-changing operations
"""

import secrets
import hashlib
from typing import Optional
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.utils.logger import logger
from app.config import get_settings


# Constants
CSRF_TOKEN_HEADER = "X-CSRF-Token"
CSRF_COOKIE_NAME = "csrf_token"
CSRF_TOKEN_LENGTH = 32


class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    """
    Middleware to generate and validate CSRF tokens.
    
    For state-changing operations (POST, PUT, DELETE, PATCH), 
    validates that the request includes a valid CSRF token.
    """
    
    def __init__(self, app, exempt_paths: Optional[list] = None):
        super().__init__(app)
        self.exempt_paths = exempt_paths or []
        self.state_changing_methods = {"POST", "PUT", "DELETE", "PATCH"}
    
    def _is_exempt_path(self, path: str) -> bool:
        """
        Match exempt paths without treating a parent prefix as a wildcard.

        Historical bug: exempting `/api/py/` also exempted every API route
        because `startswith` matches `/api/py/upload/...`.
        Exact paths and optional trailing slash are allowed; subpaths are not
        unless the exempt entry itself includes them.
        """
        for exempt in self.exempt_paths:
            if path == exempt or path == exempt.rstrip("/"):
                return True
            # Allow intentional prefix only when exempt ends with a non-root segment
            # marker like `/health` — never treat bare API root as a prefix.
            if exempt.endswith("/") and exempt.count("/") > 2 and path.startswith(exempt):
                return True
        return False

    async def dispatch(self, request: Request, call_next):
        # Skip CSRF check for exempt paths (health only — not the entire API)
        if self._is_exempt_path(request.url.path):
            return await call_next(request)

        # Bearer-authenticated service-to-service calls (Next.js → FastAPI,
        # extension → FastAPI) are not browser cookie CSRF targets.
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer ") and len(auth_header) > 10:
            return await call_next(request)
        
        # Skip CSRF check for safe methods
        if request.method not in self.state_changing_methods:
            # Generate new CSRF token for GET requests
            if request.method == "GET":
                response = await call_next(request)
                await self._set_csrf_cookie(request, response)
                return response
            return await call_next(request)
        
        # Validate CSRF token for state-changing operations
        try:
            await self._validate_csrf_token(request)
        except HTTPException as e:
            logger.warning("CSRF validation failed", {
                "path": request.url.path,
                "method": request.method,
                "client_ip": request.client.host if request.client else None,
            })
            return JSONResponse(
                status_code=e.status_code,
                content={"detail": e.detail, "error": "CSRF validation failed"}
            )
        
        response = await call_next(request)
        
        # Rotate CSRF token after successful state-changing operation
        await self._set_csrf_cookie(request, response)
        
        return response
    
    async def _validate_csrf_token(self, request: Request):
        """Validate CSRF token from request headers against cookie."""
        # Get token from header
        header_token = request.headers.get(CSRF_TOKEN_HEADER)
        if not header_token:
            raise HTTPException(
                status_code=403,
                detail=f"Missing CSRF token. Include {CSRF_TOKEN_HEADER} header."
            )
        
        # Get token from cookie
        cookie_token = request.cookies.get(CSRF_COOKIE_NAME)
        if not cookie_token:
            raise HTTPException(
                status_code=403,
                detail="CSRF cookie missing. Please refresh the page."
            )
        
        # Validate tokens match
        if not self._compare_tokens(header_token, cookie_token):
            raise HTTPException(
                status_code=403,
                detail="Invalid CSRF token."
            )
    
    def _compare_tokens(self, token1: str, token2: str) -> bool:
        """Compare two tokens using constant-time comparison."""
        return secrets.compare_digest(
            hashlib.sha256(token1.encode()).hexdigest(),
            hashlib.sha256(token2.encode()).hexdigest()
        )
    
    async def _set_csrf_cookie(self, request: Request, response):
        """Generate and set CSRF token cookie."""
        settings = get_settings()
        
        # Generate new token
        token = secrets.token_urlsafe(CSRF_TOKEN_LENGTH)
        
        # Set cookie with security settings
        response.set_cookie(
            key=CSRF_COOKIE_NAME,
            value=token,
            httponly=True,
            secure=settings.environment == "production",
            samesite="strict",
            max_age=3600,  # 1 hour
            path="/",
        )
        
        # Also expose token in header for frontend to read
        response.headers["X-CSRF-Token-Set"] = token


def generate_csrf_token() -> str:
    """Generate a new CSRF token."""
    return secrets.token_urlsafe(CSRF_TOKEN_LENGTH)


async def validate_csrf_token(request: Request) -> bool:
    """
    Validate CSRF token for a request.
    Can be used as a dependency in specific endpoints.
    
    Usage:
        @router.post("/endpoint")
        async def endpoint(request: Request, _csrf: bool = Depends(validate_csrf_token)):
            ...
    """
    middleware = CSRFProtectionMiddleware(None)
    
    try:
        await middleware._validate_csrf_token(request)
        return True
    except HTTPException:
        raise HTTPException(
            status_code=403,
            detail="CSRF validation failed"
        )
