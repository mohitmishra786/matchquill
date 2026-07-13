"""
FastAPI Main Application Entry Point
CV-Wiz Resume Compiler API
"""

import time
import psutil
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import get_settings
from app.constants import API_PREFIX
from app.utils.rate_limiter import apply_rate_limiting  # noqa: E402
from app.middleware.asgi_security import SecurityHeadersASGIMiddleware  # noqa: E402
from app.utils.redis_cache import redis_client  # noqa: E402
from app.utils.csrf_protection import CSRFProtectionMiddleware  # noqa: E402
from app.utils.logger import (  # noqa: E402
    logger,
    generate_request_id,
    set_request_context,
    clear_request_context,
    log_api_request,
    sanitize_query_params,
)

# Initialize Sentry
settings = get_settings()
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        integrations=[FastApiIntegration()],
        traces_sample_rate=1.0,
        profiles_sample_rate=1.0,
        environment=settings.environment,
    )


class SecurityMiddleware(BaseHTTPMiddleware):
    """Middleware to add security headers to all responses"""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none';"
        return response


class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log all requests with timing and correlation IDs.

    SECURITY: Never logs Authorization headers, cookies, tokens, or auth bodies.
    Query params are sanitized; request bodies are never logged here.
    """

    async def dispatch(self, request: Request, call_next):
        # Generate or extract request ID (safe header — not auth)
        request_id = request.headers.get("x-request-id") or generate_request_id()

        # Set request context for logging
        set_request_context(request_id=request_id)

        # Log request metadata only — never raw user-controlled header/query values
        # (CodeQL log-injection: path/method/UA from the client must not be interpolated)
        sanitized_query = sanitize_query_params(request.query_params)
        # CodeQL-recognized sanitization for log injection: strip CR/LF
        raw_path = request.url.path or ""
        safe_path = (
            raw_path.replace("\r\n", "").replace("\n", "").replace("\r", "")
        )[:200]
        method = request.method if request.method in {
            "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"
        } else "OTHER"
        logger.info("[REQUEST]", {
            "method": method,
            "path": safe_path,
            "query": sanitized_query,
            "client_ip": request.client.host if request.client else None,
            "has_authorization": "authorization" in request.headers,
            "has_cookie": "cookie" in request.headers,
            "has_user_agent": bool(request.headers.get("user-agent")),
        })

        start_time = time.time()

        try:
            response = await call_next(request)
            duration_ms = (time.time() - start_time) * 1000

            # Add request ID to response headers
            response.headers["x-request-id"] = request_id

            # Log response with already-sanitized method/path (no raw user input)
            log_api_request(
                method,
                safe_path,
                response.status_code,
                duration_ms,
            )

            return response

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            # Never include request headers/body in error logs
            logger.error("[REQUEST ERROR]", {
                "method": method,
                "path": safe_path,
                "duration_ms": round(duration_ms, 2),
                "error_type": type(e).__name__,
                # Exception type only — message may contain request data
            }, exc_info=True)
            raise
        finally:
            clear_request_context()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    settings = get_settings()
    logger.info("[STARTUP] CV-Wiz API starting", {
        "groq_model": settings.groq_model,
        "frontend_url": settings.effective_frontend_url,
        "database_url": "configured" if settings.database_url else "NOT SET",
        "redis_url": "configured" if settings.redis_url else "NOT SET",
        "upstash_rest_url": "configured" if settings.upstash_redis_rest_url else "not set",
    })

    # Schedule audit log retention cleanup (no-op until DB wiring is complete)
    try:
        from app.services.audit_retention import get_audit_retention_service
        retention = get_audit_retention_service()
        logger.info(
            "[STARTUP] Audit retention service ready",
            {"retention_days": retention.retention_days},
        )
    except Exception as e:
        logger.warning("[STARTUP] Audit retention init skipped", {"error": str(e)})
    
    yield
    
    # Shutdown
    await redis_client.close()
    
    # Close shared HTTP client
    from app.services.profile_service import close_shared_http_client
    await close_shared_http_client()
    
    logger.info("[SHUTDOWN] CV-Wiz API shutdown complete")



# Disable interactive API docs in production (CSP-safe; reduces attack surface)
_is_prod = (get_settings().environment or "").lower() in ("production", "prod")

app = FastAPI(
    title="CV-Wiz API",
    description="Career Resume Compiler - Generate tailored resumes and cover letters",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if _is_prod else f"{API_PREFIX}/docs",
    redoc_url=None if _is_prod else f"{API_PREFIX}/redoc",
    openapi_url=None if _is_prod else f"{API_PREFIX}/openapi.json",
)

# Initialize rate limiting BEFORE importing routers
apply_rate_limiting(app)

# Now import routers (after rate limiting is set up)
from app.routers import compile, cover_letter, upload, ai  # noqa: E402

# Add logging middleware FIRST
app.add_middleware(LoggingMiddleware)
# Pure ASGI security headers (avoids BaseHTTPMiddleware overhead)
app.add_middleware(SecurityHeadersASGIMiddleware)

# Add CSRF protection middleware
# Exempt health check and auth-related endpoints
app.add_middleware(
    CSRFProtectionMiddleware,
    exempt_paths=[
        f"{API_PREFIX}/health",
        f"{API_PREFIX}/",
        f"{API_PREFIX}",
    ],
)

# Configure CORS
# SECURITY: Never use "*" with allow_credentials=True - this is a security vulnerability
settings = get_settings()

# Build allowed origins list - only specific domains, no wildcards
_cors_origins = [
    settings.effective_frontend_url,
    settings.nextauth_url,
    settings.effective_frontend_api_url,
    "http://localhost:3000",
    "http://localhost:3001",
]

# Filter out empty strings and deduplicate
# SECURITY: Explicitly exclude "*" wildcard to prevent credential leakage
allowed_origins = list(set(origin for origin in _cors_origins if origin and origin != "*"))

if not allowed_origins:
    logger.warning("[CORS] No allowed origins configured, defaulting to localhost")
    allowed_origins = ["http://localhost:3000"]

logger.info("[CORS] Configured allowed origins", {"origins": allowed_origins})

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
    max_age=600,  # Cache preflight requests for 10 minutes
)

# Routes include API_PREFIX — Vercel forwards the full path (/api/py/...) to the function.
app.include_router(compile.router, prefix=API_PREFIX, tags=["Resume"])
app.include_router(cover_letter.router, prefix=API_PREFIX, tags=["Cover Letter"])
app.include_router(upload.router, prefix=API_PREFIX, tags=["Upload"])
app.include_router(ai.router, prefix=API_PREFIX, tags=["AI"])


@app.get(f"{API_PREFIX}/")
async def root():
    """Health check endpoint."""
    logger.debug("[HEALTH] Root endpoint called")
    return {"status": "healthy", "service": "cv-wiz-api", "version": "1.0.0"}


@app.get(f"{API_PREFIX}/health")
async def health_check():
    """Detailed health check with logging."""
    logger.info("[HEALTH] Health check requested")
    
    # Safely get system metrics
    system_metrics = {
        "cpu_percent": 0.0,
        "memory_percent": 0.0,
        "disk_usage_percent": 0.0
    }
    try:
        system_metrics["cpu_percent"] = psutil.cpu_percent()
        system_metrics["memory_percent"] = psutil.virtual_memory().percent
        system_metrics["disk_usage_percent"] = psutil.disk_usage('/').percent
    except Exception as e:
        # Do not interpolate exception text into the log message (log-injection)
        logger.warning(
            "[HEALTH] Failed to get system metrics",
            {"error_type": type(e).__name__},
        )

    health_status = {
        "status": "healthy",
        "timestamp": time.time(),
        "database": "unknown",
        "redis": "unknown",
        "system": system_metrics,
        "config": {
            "groq_api_key": "configured" if settings.groq_api_key else "NOT SET",
            "database_url": "configured" if settings.database_url else "NOT SET",
            "redis_url": "configured" if settings.redis_url else "NOT SET",
        }
    }
    
    # Check Redis connection
    try:
        if redis_client:
            await redis_client.ping()
            health_status["redis"] = "connected"
            logger.debug("[HEALTH] Redis connection OK")
    except Exception as e:
        # CodeQL py/stack-trace-exposure: never return exception details to clients
        health_status["redis"] = "error"
        logger.warning(
            "[HEALTH] Redis connection failed",
            {"error_type": type(e).__name__},
        )
    
    logger.info("[HEALTH] Health check complete", health_status)
    return health_status
