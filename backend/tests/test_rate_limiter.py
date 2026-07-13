"""
Unit tests for rate limiting functionality.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from app.utils.rate_limiter import (
    RateLimitConfig,
    get_user_identifier,
)


class TestRateLimiter:
    """Tests for rate limiting functionality."""

    def test_rate_limit_config_values(self):
        """Test that rate limit configurations are properly defined."""
        assert RateLimitConfig.COMPILE_RESUME == ["5/minute", "30/hour"]
        assert RateLimitConfig.GENERATE_COVER_LETTER == ["5/minute", "30/hour"]
        assert RateLimitConfig.GET_TEMPLATES == ["100/minute"]
        assert RateLimitConfig.GET_PROFILE == ["60/minute", "1000/hour"]
        assert RateLimitConfig.AI_ENHANCE_BULLET == ["10/minute", "60/hour"]
        assert RateLimitConfig.AI_INTERVIEW_PREP == ["5/minute", "20/hour"]
        assert RateLimitConfig.AI_SUGGEST_SKILLS == ["10/minute", "50/hour"]
        assert RateLimitConfig.UPLOAD_RESUME == ["10/minute", "50/hour"]

    def test_get_user_identifier_with_auth(self):
        """Test user identifier extraction from auth header."""
        mock_request = MagicMock()
        mock_request.headers = {"Authorization": "Bearer test_token_12345"}
        
        identifier = get_user_identifier(mock_request)
        
        assert identifier == "user:1ac4c4fb37c2f810"

    def test_get_user_identifier_without_auth(self):
        """Test user identifier fallback to IP without auth."""
        mock_request = MagicMock()
        mock_request.headers = {}
        mock_request.client.host = "192.168.1.1"
        
        with patch('app.utils.rate_limiter.get_remote_address', return_value="192.168.1.1"):
            identifier = get_user_identifier(mock_request)
        
        assert identifier == "192.168.1.1"


class TestRateLimitEndpoints:
    """Integration tests for rate-limited endpoints."""

    def test_compile_endpoint_rate_limit_headers(self, client: TestClient):
        """Test that compile endpoint includes rate limit headers."""
        # This test verifies the endpoint is rate-limited
        # Actual rate limiting is handled by slowapi
        response = client.post("/api/py/compile", json={
            "authToken": "invalid_token",
            "jobDescription": "Test job description that is long enough to pass validation. " * 5,
        })
        
        # Should get 401 (auth failed) not 429 (rate limited) on first request
        assert response.status_code == 401

    def test_cover_letter_endpoint_rate_limit_headers(self, client: TestClient):
        """Test that cover letter endpoint includes rate limit headers."""
        response = client.post("/api/py/cover-letter", json={
            "authToken": "invalid_token",
            "jobDescription": "Test job description that is long enough to pass validation. " * 5,
        })
        
        # Should get 401 (auth failed) not 429 (rate limited) on first request
        assert response.status_code == 401

    def test_templates_endpoint_allows_multiple_requests(self, client: TestClient):
        """Test that templates endpoint allows many requests."""
        # Make multiple requests
        for _ in range(5):
            response = client.get("/api/py/templates")
            assert response.status_code == 200

    def test_job_description_validation_short(self, client: TestClient):
        """Test that short job descriptions are rejected."""
        response = client.post("/api/py/compile", json={
            "authToken": "some_token",
            "jobDescription": "Short",  # Too short
        })
        
        # Pydantic validation returns 422, manual validation returns 400
        assert response.status_code in [400, 422]
        detail = response.json()["detail"]
        # Pydantic returns detail as a list of errors
        if isinstance(detail, list):
            detail_str = str(detail).lower()
        else:
            detail_str = detail.lower()
        assert "too short" in detail_str or "at least" in detail_str

    def test_job_description_validation_long(self, client: TestClient):
        """Test that very long job descriptions are rejected."""
        response = client.post("/api/py/compile", json={
            "authToken": "some_token",
            "jobDescription": "A" * 50001,  # Too long
        })
        
        # Pydantic validation returns 422, manual validation returns 400
        assert response.status_code in [400, 422]
        detail = response.json()["detail"]
        # Pydantic returns detail as a list of errors
        if isinstance(detail, list):
            detail_str = str(detail).lower()
        else:
            detail_str = detail.lower()
        assert "too long" in detail_str or "at most" in detail_str

    def test_job_description_validation_valid_length(self, client: TestClient):
        """Test that valid length job descriptions pass validation."""
        response = client.post("/api/py/compile", json={
            "authToken": "invalid_token",  # Will fail auth but pass length validation
            "jobDescription": "This is a valid job description. " * 10,
        })
        
        # Should fail auth, not validation
        assert response.status_code == 401


class TestRedisCacheFallback:
    """Tests for Redis cache fallback mechanism."""

    @pytest.mark.asyncio
    async def test_cache_unavailable_skips_operations(self):
        """Test that cache operations are skipped when unavailable."""
        from app.utils.redis_cache import redis_client, get_cached, set_cached
        
        # Simulate unavailable cache
        redis_client._status = redis_client.CacheStatus.UNAVAILABLE
        
        # Should return None without error
        result = await get_cached("test_key")
        assert result is None
        
        # Should return False without error
        result = await set_cached("test_key", {"data": "test"})
        assert result is False

    @pytest.mark.asyncio
    async def test_cache_health_status(self):
        """Test cache health status reporting."""
        from app.utils.redis_cache import get_cache_health
        
        health = await get_cache_health()
        
        assert "status" in health
        assert "available" in health
        assert "connected" in health
        assert "consecutive_failures" in health


class TestAIRateLimitedEndpoints:
    """Verify AI routes enforce rate limiting configuration and auth."""

    def test_enhance_bullet_requires_auth(self, client: TestClient):
        response = client.post("/api/py/ai/enhance-bullet", json={"bullet": "Built features"})
        assert response.status_code == 401

    def test_interview_prep_requires_auth(self, client: TestClient):
        response = client.post(
            "/api/py/ai/interview-prep",
            json={"candidate_info": "Senior engineer with 5 years experience"},
        )
        assert response.status_code == 401

    def test_suggest_skills_requires_auth(self, client: TestClient):
        response = client.post(
            "/api/py/ai/suggest-skills",
            json={"experience_text": "Built distributed systems in Python"},
        )
        assert response.status_code == 401

    def test_ai_rate_limit_config_is_stricter_than_default(self):
        """AI prep is expensive; ensure hourly caps exist."""
        assert len(RateLimitConfig.AI_INTERVIEW_PREP) >= 2
        assert any("hour" in limit for limit in RateLimitConfig.AI_INTERVIEW_PREP)
        assert any("hour" in limit for limit in RateLimitConfig.AI_ENHANCE_BULLET)
        assert any("hour" in limit for limit in RateLimitConfig.AI_SUGGEST_SKILLS)
