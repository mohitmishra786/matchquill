"""
Rate Limiting Utilities
Provides rate limiting for API endpoints using slowapi.
"""

from __future__ import annotations

import time
import warnings
from typing import TYPE_CHECKING

from fastapi import Request
from starlette.responses import JSONResponse

from app.utils.logger import logger

if TYPE_CHECKING:
    from fastapi import FastAPI

try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    SLOWAPI_AVAILABLE = True
except ImportError as e:
    SLOWAPI_AVAILABLE = False
    logger.warning("slowapi not available, rate limiting disabled", {"error": str(e)})
    Limiter = None
    RateLimitExceeded = Exception


def get_remote_address_fallback(request: Request) -> str:
    """Fallback function to get remote address if slowapi is not available."""
    return request.client.host if request.client else "unknown"


if SLOWAPI_AVAILABLE and Limiter:
    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=["100/minute"],  # Default global rate limit
    )
else:
    limiter = None
    warnings.warn("Rate limiting is disabled due to missing slowapi dependency")


def get_user_identifier(request: Request) -> str:
    """
    Get unique identifier for rate limiting.
    Uses auth token if available, falls back to IP address.
    """
    import hashlib
    
    # Try to get user ID from auth token
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[len("Bearer "):]
        # Use a hash of the token as identifier to avoid prefix collisions
        token_hash = hashlib.sha256(token.encode()).hexdigest()[:16]
        return f"user:{token_hash}"
    
    # Fall back to IP address
    if SLOWAPI_AVAILABLE:
        return get_remote_address(request)
    return get_remote_address_fallback(request)


class RateLimitConfig:
    """Rate limit configurations for different endpoint types."""
    
    # Strict limits for expensive operations
    COMPILE_RESUME = ["5/minute", "30/hour"]  # PDF generation is resource intensive
    GENERATE_COVER_LETTER = ["5/minute", "30/hour"]  # LLM API calls cost money
    
    # AI / LLM endpoints — tighter quotas to control cost and abuse
    AI_ENHANCE_BULLET = ["10/minute", "60/hour"]
    AI_INTERVIEW_PREP = ["5/minute", "20/hour"]
    AI_SUGGEST_SKILLS = ["10/minute", "50/hour"]
    
    # Moderate limits for standard operations
    GET_PROFILE = ["60/minute", "1000/hour"]
    UPDATE_PROFILE = ["30/minute", "500/hour"]
    
    # Lenient limits for read-only operations
    GET_TEMPLATES = ["100/minute"]
    HEALTH_CHECK = ["200/minute"]
    
    # Upload limits (file processing)
    UPLOAD_RESUME = ["10/minute", "50/hour"]


def rate_limit_exceeded_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Custom handler for rate limit exceeded errors.
    """
    if not SLOWAPI_AVAILABLE:
        return JSONResponse(status_code=200, content={})
    
    client_id = get_user_identifier(request)
    logger.warning("Rate limit exceeded", {
        "client_id": client_id[:50] if client_id else None,
        "path": request.url.path,
        "method": request.method,
    })
    
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please try again later."},
        headers={"Retry-After": "60"},
    )


def apply_rate_limiting(app: "FastAPI") -> None:
    """
    Apply rate limiting to FastAPI application.
    
    Args:
        app: FastAPI application instance
    """
    if not SLOWAPI_AVAILABLE or not limiter:
        logger.warning("Rate limiting not available, skipping initialization")
        app.state.limiter = None
        return
    
    # Add limiter state to app
    app.state.limiter = limiter
    
    # Add exception handler for rate limit exceeded
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
    
    logger.info("Rate limiting initialized")


class RateLimitMiddleware:
    """
    Middleware to track and log rate limit usage.
    """
    
    def __init__(self, app):
        self.app = app
        self.request_counts = {}
        self.window_size = 60  # 1 minute window
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        request = Request(scope, receive)
        client_id = get_user_identifier(request)
        
        # Track request (in production, use Redis)
        current_time = time.time()
        window_start = current_time - self.window_size
        
        if client_id not in self.request_counts:
            self.request_counts[client_id] = []
        
        # Clean old entries
        self.request_counts[client_id] = [
            t for t in self.request_counts[client_id] if t > window_start
        ]
        
        # Add current request
        self.request_counts[client_id].append(current_time)
        
        # Log high usage
        if len(self.request_counts[client_id]) > 50:
            logger.warning("High API usage detected", {
                "client_id": client_id[:50] if client_id else None,
                "requests_in_window": len(self.request_counts[client_id]),
                "path": request.url.path,
            })
        
        await self.app(scope, receive, send)


def get_rate_limit_status(client_id: str) -> dict:
    """
    Get current rate limit status for a client.
    
    Args:
        client_id: Client identifier
        
    Returns:
        Dictionary with rate limit status
    """
    # This would typically query Redis for accurate counts
    # For now, return placeholder
    return {
        "limit": "100/minute",
        "remaining": "unknown",
        "reset_time": None,
    }
