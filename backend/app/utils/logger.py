"""
Comprehensive Logging Module for CV-Wiz Backend
Provides structured logging with request correlation IDs for debugging
"""

import logging
import json
import re
import sys
import uuid
import time
from datetime import datetime
from typing import Optional, Any, Dict
from functools import wraps
from contextvars import ContextVar

# Context variables for request-scoped data
request_id_var: ContextVar[str] = ContextVar('request_id', default='')
user_id_var: ContextVar[str] = ContextVar('user_id', default='')
session_id_var: ContextVar[str] = ContextVar('session_id', default='')

# Standard set of sensitive keys to mask in logs (exact match after normalize)
DEFAULT_SENSITIVE_KEYS: set = {
    "password", "passwd", "secret", "token", "api_key", "apikey", "api-key",
    "access_token", "refresh_token", "auth_token", "authtoken", "authorization",
    "jwt", "key", "private_key", "secret_key",
    "session_id", "csrf_token", "otp", "pin", "ssn",
    "cookie", "cookies", "set_cookie", "set-cookie",
    "x_api_key", "x-api-key", "bearer",
}

# Substrings that mark a key as sensitive (covers camelCase like authToken, cookieHeader)
_SENSITIVE_KEY_SUBSTRINGS: tuple = (
    "password",
    "passwd",
    "secret",
    "token",
    "authorization",
    "cookie",
    "api_key",
    "apikey",
    "private_key",
    "csrf",
    "session",
    "jwt",
    "bearer",
)


def is_sensitive_key(key: str, sensitive_keys: Optional[set] = None) -> bool:
    """
    Return True if a key name should be redacted in logs.

    Matches exact normalized names and common sensitive substrings so
    variants like authToken, Cookie, Authorization are covered.

    Custom ``sensitive_keys`` are *additive* to built-in exact and substring rules.
    """
    if not key:
        return False
    key_lower = key.lower()
    key_norm = key_lower.replace("-", "_")

    # Built-in exact matches always apply
    if key_lower in DEFAULT_SENSITIVE_KEYS or key_norm in DEFAULT_SENSITIVE_KEYS:
        return True

    # Optional custom keys are additive (exact match only for the custom set)
    if sensitive_keys is not None:
        if key_lower in sensitive_keys or key_norm in sensitive_keys:
            return True

    # Built-in substring rules still apply (password/token/cookie variants)
    for sub in _SENSITIVE_KEY_SUBSTRINGS:
        if sub in key_norm or sub in key_lower:
            return True
    return False


# Allowlisted request headers that may be reflected in logs (values still scrubbed).
# Anything not in this set is omitted entirely — never log arbitrary user-controlled keys.
_LOGGABLE_HEADER_NAMES: frozenset = frozenset({
    "user-agent",
    "content-type",
    "content-length",
    "accept",
    "accept-language",
    "x-request-id",
    "x-forwarded-for",
    "host",
})


def _safe_log_key(key: str) -> str:
    """
    Normalize a user-influenced key for safe structured logging.

    Strips control characters and non-printable content to prevent log injection
    via crafted header names (CodeQL: log-injection).
    """
    # Collapse to a conservative identifier alphabet only
    cleaned = re.sub(r"[^A-Za-z0-9_.\-]", "_", str(key))
    cleaned = cleaned[:64] if cleaned else "unknown"
    return cleaned or "unknown"


def _safe_log_value(value: Any, *, max_len: int = 100) -> str:
    """
    Coerce values to a single-line, length-capped string for logs.

    CodeQL py/log-injection recognizes str.replace of CR/LF as a sanitizer
    (see https://codeql.github.com/codeql-query-help/python/py-log-injection/).
    """
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)[:max_len]

    # Only accept real strings; do not str() arbitrary objects from requests
    if not isinstance(value, str):
        return ""

    # Official CodeQL-recognized sanitization: strip line breaks before logging
    cleaned = (
        value.replace("\r\n", "")
        .replace("\n", "")
        .replace("\r", "")
        .replace("\x00", "")
    )
    if len(cleaned) > max_len:
        cleaned = cleaned[:max_len]
    return cleaned


def sanitize_headers(headers: Any) -> Optional[Dict[str, str]]:
    """
    Sanitize HTTP headers for safe logging.

    Never logs raw header values from the client. Only fixed keys with
    presence flags (or lengths) are emitted — eliminates log-injection
    from user-controlled User-Agent / custom headers.
    """
    if not headers:
        return None

    try:
        items = dict(headers).items()
    except (TypeError, ValueError):
        return None

    lower_keys = {str(key).lower() for key, _ in items}

    sanitized: Dict[str, str] = {}

    # Presence-only flags — never echo values
    if any(k in lower_keys for k in ("authorization", "proxy-authorization")):
        sanitized["has_authorization"] = "true"
    if any(k in lower_keys for k in ("cookie", "set-cookie")):
        sanitized["has_cookie"] = "true"

    for name in _LOGGABLE_HEADER_NAMES:
        if name in lower_keys:
            # Presence only — do not log raw User-Agent / Host content
            sanitized[f"has_{name.replace('-', '_')}"] = "true"

    return sanitized if sanitized else None


class StructuredFormatter(logging.Formatter):
    """Format logs as structured JSON for easy parsing in Vercel/Railway"""
    
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add context variables
        request_id = request_id_var.get()
        user_id = user_id_var.get()
        session_id = session_id_var.get()
        
        if request_id:
            log_data["request_id"] = request_id
        if user_id:
            log_data["user_id"] = user_id
        if session_id:
            log_data["session_id"] = session_id
            
        # Add extra fields
        if hasattr(record, 'data') and record.data:
            log_data["data"] = record.data
            
        # Add exception info
        if record.exc_info:
            log_data["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": self.formatException(record.exc_info) if record.exc_info[2] else None,
            }
            
        return json.dumps(log_data, default=str)


class CVWizLogger:
    """Custom logger with structured logging and context support"""
    
    def __init__(self, name: str = "cv-wiz"):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.DEBUG)
        
        # Remove existing handlers
        self.logger.handlers = []
        
        # Add structured handler
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(StructuredFormatter())
        self.logger.addHandler(handler)
        
        # Prevent propagation to root logger
        self.logger.propagate = False
    
    def _log(self, level: int, message: str, data: Optional[Dict[str, Any]] = None, **kwargs):
        """
        Internal log method with data support.

        CodeQL py/log-injection: strip CR/LF from message strings (recognized
        sanitizer) and sanitize structured data before writing.
        See https://codeql.github.com/codeql-query-help/python/py-log-injection/
        """
        safe_message = (
            (message or "")
            .replace("\r\n", "")
            .replace("\n", "")
            .replace("\r", "")
        )
        safe_data = sanitize_dict(data) if isinstance(data, dict) else data
        extra = {"data": safe_data} if safe_data is not None else {}
        self.logger.log(level, safe_message, extra=extra, **kwargs)
    
    def debug(self, message: str, data: Optional[Dict[str, Any]] = None):
        self._log(logging.DEBUG, message, data)
    
    def info(self, message: str, data: Optional[Dict[str, Any]] = None):
        self._log(logging.INFO, message, data)
    
    def warning(self, message: str, data: Optional[Dict[str, Any]] = None):
        self._log(logging.WARNING, message, data)
    
    def error(self, message: str, data: Optional[Dict[str, Any]] = None, exc_info: bool = False):
        self._log(logging.ERROR, message, data, exc_info=exc_info)
    
    def critical(self, message: str, data: Optional[Dict[str, Any]] = None, exc_info: bool = False):
        self._log(logging.CRITICAL, message, data, exc_info=exc_info)
    
    def start_operation(self, operation: str, data: Optional[Dict[str, Any]] = None):
        """Log the start of an operation"""
        self.info(f"[START] {operation}", data)
    
    def end_operation(self, operation: str, duration_ms: Optional[float] = None, data: Optional[Dict[str, Any]] = None):
        """Log the successful end of an operation"""
        log_data = data or {}
        if duration_ms is not None:
            log_data["duration_ms"] = round(duration_ms, 2)
        self.info(f"[END] {operation}", log_data)
    
    def fail_operation(self, operation: str, error: Exception, data: Optional[Dict[str, Any]] = None):
        """Log an operation failure"""
        log_data = data or {}
        log_data["error_type"] = type(error).__name__
        log_data["error_message"] = str(error)
        self.error(f"[FAILED] {operation}", log_data, exc_info=True)


# Global logger instance
logger = CVWizLogger("cv-wiz")


def generate_request_id() -> str:
    """Generate a unique request ID"""
    timestamp = hex(int(time.time() * 1000))[2:]
    random_part = uuid.uuid4().hex[:8]
    return f"req_{timestamp}_{random_part}"


def set_request_context(request_id: Optional[str] = None, user_id: Optional[str] = None, session_id: Optional[str] = None):
    """Set request context for logging"""
    if request_id:
        request_id_var.set(request_id)
    if user_id:
        user_id_var.set(user_id)
    if session_id:
        session_id_var.set(session_id)


def clear_request_context():
    """Clear request context"""
    request_id_var.set('')
    user_id_var.set('')
    session_id_var.set('')


def get_request_id() -> str:
    """Get current request ID or generate new one"""
    request_id = request_id_var.get()
    if not request_id:
        request_id = generate_request_id()
        request_id_var.set(request_id)
    return request_id


def log_function_call(func):
    """Decorator to log function calls with timing"""
    @wraps(func)
    async def async_wrapper(*args, **kwargs):
        func_name = f"{func.__module__}.{func.__name__}"
        start_time = time.time()
        
        # Mask sensitive data in kwargs (never log tokens/passwords/auth bodies)
        safe_kwargs = {
            k: "***" if is_sensitive_key(k) else v
            for k, v in kwargs.items()
        }
        
        logger.debug(f"Calling {func_name}", {
            "args_count": len(args),
            "kwargs": list(safe_kwargs.keys()),
            "kwargs_redacted": sanitize_dict(safe_kwargs) if safe_kwargs else None,
        })
        
        try:
            result = await func(*args, **kwargs)
            duration_ms = (time.time() - start_time) * 1000
            logger.debug(f"Completed {func_name}", {"duration_ms": round(duration_ms, 2)})
            return result
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            logger.error(f"Failed {func_name}", {
                "duration_ms": round(duration_ms, 2),
                "error_type": type(e).__name__,
                "error_message": str(e)
            }, exc_info=True)
            raise
    
    @wraps(func)
    def sync_wrapper(*args, **kwargs):
        func_name = f"{func.__module__}.{func.__name__}"
        start_time = time.time()
        
        # Mask sensitive data in kwargs (never log tokens/passwords/auth bodies)
        safe_kwargs = {
            k: "***" if is_sensitive_key(k) else v
            for k, v in kwargs.items()
        }
        
        logger.debug(f"Calling {func_name}", {
            "args_count": len(args),
            "kwargs": list(safe_kwargs.keys()),
            "kwargs_redacted": sanitize_dict(safe_kwargs) if safe_kwargs else None,
        })
        
        try:
            result = func(*args, **kwargs)
            duration_ms = (time.time() - start_time) * 1000
            logger.debug(f"Completed {func_name}", {"duration_ms": round(duration_ms, 2)})
            return result
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            logger.error(f"Failed {func_name}", {
                "duration_ms": round(duration_ms, 2),
                "error_type": type(e).__name__,
                "error_message": str(e)
            }, exc_info=True)
            raise
    
    import asyncio
    if asyncio.iscoroutinefunction(func):
        return async_wrapper
    return sync_wrapper


def log_db_operation(operation: str, table: str, data: Optional[Dict[str, Any]] = None):
    """Log database operations"""
    log_data = {"table": table, **(data or {})}
    logger.info(f"[DB] {operation}", log_data)


def log_api_request(method: str, path: str, status_code: int, duration_ms: float, data: Optional[Dict[str, Any]] = None):
    """Log API requests.

    ``path`` may be request-derived; strip line breaks (CodeQL py/log-injection)
    before it is written to a log entry.
    """
    # CodeQL-recognized sanitizer: remove CR/LF from untrusted path segments
    safe_path = (
        (path or "")
        .replace("\r\n", "")
        .replace("\n", "")
        .replace("\r", "")
    )[:200]
    allowed_methods = {"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"}
    safe_method = method if method in allowed_methods else "OTHER"
    log_data = {
        "method": safe_method,
        "path": safe_path,
        "status_code": status_code,
        "duration_ms": round(duration_ms, 2),
        **(data or {})
    }
    level = logging.ERROR if status_code >= 500 else logging.WARNING if status_code >= 400 else logging.INFO
    # Keep message static; put user-derived fields only in structured data
    logger._log(level, "[API] request completed", log_data)


def log_llm_request(model: str, operation: str, tokens_in: int = 0, tokens_out: int = 0, duration_ms: float = 0, data: Optional[Dict[str, Any]] = None):
    """Log LLM API calls"""
    log_data = {
        "model": model,
        "operation": operation,
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
        "duration_ms": round(duration_ms, 2),
        **(data or {})
    }
    logger.info(f"[LLM] {operation}", log_data)


def log_cache_operation(operation: str, key: str, hit: bool = True, data: Optional[Dict[str, Any]] = None):
    """Log cache operations"""
    log_data = {
        "operation": operation,
        "key": key[:50] + "..." if len(key) > 50 else key,
        "hit": hit,
        **(data or {})
    }
    logger.debug(f"[CACHE] {operation}", log_data)


def log_auth_operation(operation: str, user_id: Optional[str] = None, success: bool = True, data: Optional[Dict[str, Any]] = None):
    """Log authentication operations"""
    log_data = {
        "operation": operation,
        "success": success,
        **(data or {})
    }
    if user_id:
        log_data["user_id"] = user_id
    
    level = logging.INFO if success else logging.WARNING
    logger._log(level, f"[AUTH] {operation}", log_data)


def sanitize_query_params(query_params: Any) -> Optional[Dict[str, str]]:
    """
    Sanitize query parameters by removing sensitive data.
    
    Masks passwords, tokens, API keys, cookies, authorization, and other
    sensitive parameters. Never logs raw auth credentials.
    
    Args:
        query_params: Query parameters from FastAPI request
        
    Returns:
        Sanitized dictionary or None
    """
    if not query_params:
        return None
    
    sanitized: Dict[str, str] = {}
    for key, value in dict(query_params).items():
        safe_key = _safe_log_key(str(key))
        # Mask sensitive keys; for others only log length (not raw content)
        if is_sensitive_key(str(key), None) or is_sensitive_key(safe_key, None):
            sanitized[safe_key] = "***"
        else:
            # Presence + length only — avoids log injection via query values
            length = len(str(value)) if value is not None else 0
            sanitized[safe_key] = f"<len={length}>"
    
    return sanitized if sanitized else None


def sanitize_dict(data: Dict[str, Any], sensitive_keys: Optional[set] = None) -> Dict[str, Any]:
    """
    Sanitize a dictionary by masking sensitive values.
    
    Covers request bodies with authToken, password, cookie, authorization, etc.
    Keys are normalized to block log-injection via crafted field names.
    
    Args:
        data: Dictionary to sanitize
        sensitive_keys: Optional set of additional exact sensitive key names
        
    Returns:
        Sanitized dictionary
    """
    sanitized: Dict[str, Any] = {}
    for key, value in data.items():
        safe_key = _safe_log_key(str(key))
        if is_sensitive_key(str(key), sensitive_keys) or is_sensitive_key(safe_key, sensitive_keys):
            sanitized[safe_key] = "***"
        elif isinstance(value, dict):
            sanitized[safe_key] = sanitize_dict(value, sensitive_keys)
        elif isinstance(value, list):
            sanitized[safe_key] = [
                sanitize_dict(item, sensitive_keys)
                if isinstance(item, dict)
                else (_safe_log_value(item, max_len=500) if isinstance(item, str) else item)
                for item in value
            ]
        else:
            # Scalar values: keep type when safe, coerce strings to single-line
            if isinstance(value, str):
                sanitized[safe_key] = _safe_log_value(value, max_len=500)
            else:
                sanitized[safe_key] = value
    
    return sanitized
