"""
Comprehensive Logging Module for CV-Wiz Backend
Provides structured logging with request correlation IDs for debugging
"""

import logging
import json
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

# Standard set of sensitive keys to mask in logs
DEFAULT_SENSITIVE_KEYS: set = {
    "password", "passwd", "secret", "token", "api_key", "apikey",
    "access_token", "refresh_token", "auth_token", "authorization",
    "jwt", "key", "private_key", "secret_key", "credentials",
    "session_id", "csrf_token", "otp", "pin", "ssn",
}


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
        """Internal log method with data support"""
        extra = {'data': data} if data else {}
        self.logger.log(level, message, extra=extra, **kwargs)
    
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
        
        # Mask sensitive data in kwargs
        safe_kwargs = {k: "***" if k in ("password", "token", "secret", "api_key") else v 
                       for k, v in kwargs.items()}
        
        logger.debug(f"Calling {func_name}", {"args_count": len(args), "kwargs": list(safe_kwargs.keys())})
        
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
        
        # Mask sensitive data in kwargs
        safe_kwargs = {k: "***" if k in ("password", "token", "secret", "api_key") else v 
                       for k, v in kwargs.items()}
        
        logger.debug(f"Calling {func_name}", {"args_count": len(args), "kwargs": list(safe_kwargs.keys())})
        
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
    """Log API requests"""
    log_data = {
        "method": method,
        "path": path,
        "status_code": status_code,
        "duration_ms": round(duration_ms, 2),
        **(data or {})
    }
    level = logging.ERROR if status_code >= 500 else logging.WARNING if status_code >= 400 else logging.INFO
    logger._log(level, f"[API] {method} {path} -> {status_code}", log_data)


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
    
    Masks passwords, tokens, API keys, and other sensitive parameters.
    
    Args:
        query_params: Query parameters from FastAPI request
        
    Returns:
        Sanitized dictionary or None
    """
    if not query_params:
        return None
    
    sanitized = {}
    for key, value in dict(query_params).items():
        # Mask sensitive keys
        if key.lower() in DEFAULT_SENSITIVE_KEYS:
            sanitized[key] = "***"
        else:
            # For non-sensitive keys, still limit length
            str_value = str(value)
            if len(str_value) > 100:
                sanitized[key] = str_value[:100] + "..."
            else:
                sanitized[key] = str_value
    
    return sanitized if sanitized else None


def sanitize_dict(data: Dict[str, Any], sensitive_keys: Optional[set] = None) -> Dict[str, Any]:
    """
    Sanitize a dictionary by masking sensitive values.
    
    Args:
        data: Dictionary to sanitize
        sensitive_keys: Set of sensitive key names (defaults to standard set)
        
    Returns:
        Sanitized dictionary
    """
    if sensitive_keys is None:
        sensitive_keys = DEFAULT_SENSITIVE_KEYS
    
    sanitized = {}
    for key, value in data.items():
        if key.lower() in sensitive_keys:
            sanitized[key] = "***"
        elif isinstance(value, dict):
            sanitized[key] = sanitize_dict(value, sensitive_keys)
        elif isinstance(value, list):
            sanitized[key] = [
                sanitize_dict(item, sensitive_keys) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            sanitized[key] = value
    
    return sanitized
