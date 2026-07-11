"""
Pure ASGI security middleware (no BaseHTTPMiddleware).

Avoids BaseHTTPMiddleware's known issues with streaming responses and
task context under high concurrency.
"""

from __future__ import annotations

from typing import Any, Awaitable, Callable, MutableMapping

Scope = MutableMapping[str, Any]
Message = MutableMapping[str, Any]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]
ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]

# Strict CSP for application routes
_STRICT_CSP = b"default-src 'self'; frame-ancestors 'none';"
# Looser CSP for OpenAPI docs UIs (Swagger/ReDoc need CDN assets + inline init)
_DOCS_CSP = (
    b"default-src 'self'; "
    b"script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    b"style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    b"img-src 'self' data: https://fastapi.tiangolo.com; "
    b"frame-ancestors 'none';"
)


def _path_from_scope(scope: Scope) -> str:
    raw = scope.get("path") or ""
    return raw if isinstance(raw, str) else ""


def _is_docs_path(path: str) -> bool:
    # Match FastAPI docs endpoints with or without root_path prefix
    return (
        path.endswith("/docs")
        or path.endswith("/redoc")
        or path.endswith("/openapi.json")
        or "/docs" == path
        or "/redoc" == path
        or path.endswith("/docs/")
        or path.endswith("/redoc/")
    )


class SecurityHeadersASGIMiddleware:
    """Add security headers to all HTTP responses via pure ASGI."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = _path_from_scope(scope)
        csp = _DOCS_CSP if _is_docs_path(path) else _STRICT_CSP

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers") or [])
                extra = [
                    (b"x-content-type-options", b"nosniff"),
                    (b"x-frame-options", b"DENY"),
                    (b"x-xss-protection", b"1; mode=block"),
                    (
                        b"strict-transport-security",
                        b"max-age=31536000; includeSubDomains",
                    ),
                    (b"content-security-policy", csp),
                ]
                # Avoid duplicates
                existing = {h[0].lower() for h in headers}
                for name, value in extra:
                    if name not in existing:
                        headers.append((name, value))
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_with_headers)
