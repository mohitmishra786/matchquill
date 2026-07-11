"""
Test rate limiter with graceful degradation when slowapi is unavailable.
"""

import pytest
from unittest.mock import Mock, patch
from fastapi import Request

from app.utils.rate_limiter import (
    limiter,
    SLOWAPI_AVAILABLE,
    get_user_identifier,
    apply_rate_limiting,
)


def test_slowapi_availability():
    """Test that slowapi availability flag is correctly set."""
    # This test verifies that the import graceful handling works
    if SLOWAPI_AVAILABLE:
        assert limiter is not None
    else:
        assert limiter is None


def test_get_user_identifier_with_token():
    """Test user identifier extraction from auth token."""
    mock_request = Mock(spec=Request)
    mock_request.headers = {"Authorization": "Bearer test_token_123456789"}
    
    identifier = get_user_identifier(mock_request)
    # Token is now hashed for security, so we just check it starts with "user:"
    assert identifier.startswith("user:")
    assert len(identifier) == 21  # "user:" + 16 char hash


def test_get_user_identifier_without_token():
    """Test user identifier extraction without auth token."""
    mock_request = Mock(spec=Request)
    mock_request.headers = {}
    mock_request.client = Mock(host="192.168.1.1")
    
    identifier = get_user_identifier(mock_request)
    assert identifier == "192.168.1.1"


def test_apply_rate_limiting_with_slowapi():
    """Test rate limiting application when slowapi is available."""
    if not SLOWAPI_AVAILABLE:
        pytest.skip("slowapi not available")
    
    mock_app = Mock()
    apply_rate_limiting(mock_app)
    
    if SLOWAPI_AVAILABLE:
        assert mock_app.state.limiter is not None
        assert mock_app.add_exception_handler.called


def test_apply_rate_limiting_without_slowapi():
    """Test graceful degradation when slowapi is not available."""
    with patch('app.utils.rate_limiter.SLOWAPI_AVAILABLE', False):
        mock_app = Mock()
        apply_rate_limiting(mock_app)
        
        assert mock_app.state.limiter is None


def test_rate_limit_config_limits():
    """Test that rate limit configurations are properly defined."""
    from app.utils.rate_limiter import RateLimitConfig
    
    # Test that all expected config attributes exist
    assert hasattr(RateLimitConfig, 'COMPILE_RESUME')
    assert hasattr(RateLimitConfig, 'GENERATE_COVER_LETTER')
    assert hasattr(RateLimitConfig, 'GET_PROFILE')
    assert hasattr(RateLimitConfig, 'UPDATE_PROFILE')
    assert hasattr(RateLimitConfig, 'GET_TEMPLATES')
    assert hasattr(RateLimitConfig, 'HEALTH_CHECK')
    assert hasattr(RateLimitConfig, 'UPLOAD_RESUME')
    assert hasattr(RateLimitConfig, 'AI_ENHANCE_BULLET')
    assert hasattr(RateLimitConfig, 'AI_INTERVIEW_PREP')
    assert hasattr(RateLimitConfig, 'AI_SUGGEST_SKILLS')
    
    # Test that limits are in expected format
    assert RateLimitConfig.COMPILE_RESUME == ["5/minute", "30/hour"]
    assert RateLimitConfig.GENERATE_COVER_LETTER == ["5/minute", "30/hour"]
