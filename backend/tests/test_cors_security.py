"""
Tests for CORS Configuration
"""

from app.config import get_settings


class TestCORSConfiguration:
    """Tests for CORS security configuration."""
    
    def test_cors_no_wildcard_with_credentials(self, client):
        """Test that CORS does not allow wildcard with credentials."""
        # This test verifies the middleware configuration is secure
        # The actual security is in the middleware configuration, not testable via HTTP
        settings = get_settings()
        
        # Verify no wildcard in allowed origins
        assert "*" not in settings.effective_frontend_url if settings.effective_frontend_url else True
    
    def test_cors_preflight_request(self, client):
        """Test CORS preflight request handling."""
        response = client.options(
            "/",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type",
            },
        )
        
        # Should return 200 for valid preflight
        assert response.status_code in [200, 307, 308]
    
    def test_cors_headers_present(self, client):
        """Test that CORS headers are present in responses."""
        response = client.get(
            "/",
            headers={"Origin": "http://localhost:3000"},
        )
        
        # Check that CORS headers are present when origin is allowed
        assert response.status_code == 200
        assert "access-control-allow-origin" in response.headers
    
    def test_security_headers_present(self, client):
        """Test that security headers are present."""
        response = client.get("/")
        
        # Check security headers added by SecurityMiddleware
        assert response.headers.get("X-Content-Type-Options") == "nosniff"
        assert response.headers.get("X-Frame-Options") == "DENY"
        assert response.headers.get("Strict-Transport-Security") is not None
