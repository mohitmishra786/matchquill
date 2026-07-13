"""
Tests for CORS Configuration
"""

from app.config import get_settings
from app.main import allowed_origins


class TestCORSConfiguration:
    """Tests for CORS security configuration."""
    
    def test_cors_no_wildcard_with_credentials(self, client):
        """Test that CORS does not allow wildcard with credentials."""
        settings = get_settings()
        
        # Verify no wildcard in allowed origins
        assert "*" not in settings.effective_frontend_url if settings.effective_frontend_url else True
        assert "*" not in allowed_origins

    def test_cors_rejects_star_for_untrusted_origin(self, client):
        """Untrusted Origin must not receive Access-Control-Allow-Origin: *."""
        response = client.get("/api/py/",
            headers={"Origin": "https://malicious.example"},
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") != "*"
    
    def test_cors_preflight_request(self, client):
        """Test CORS preflight request handling."""
        response = client.options("/api/py/",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type",
            },
        )
        
        # Should return 200 for valid preflight
        assert response.status_code in [200, 307, 308]
        assert response.headers.get("access-control-allow-origin") != "*"
    
    def test_cors_headers_present(self, client):
        """Test that CORS headers are present in responses."""
        response = client.get("/api/py/",
            headers={"Origin": "http://localhost:3000"},
        )
        
        # Check that CORS headers are present when origin is allowed
        assert response.status_code == 200
        assert "access-control-allow-origin" in response.headers
        assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    
    def test_security_headers_present(self, client):
        """Test that security headers are present."""
        response = client.get("/api/py/")
        
        # Check security headers added by SecurityMiddleware
        assert response.headers.get("X-Content-Type-Options") == "nosniff"
        assert response.headers.get("X-Frame-Options") == "DENY"
        assert response.headers.get("Strict-Transport-Security") is not None


class TestCORSNoWildcardCredentials:
    """Regression: never pair allow_origins=['*'] with credentials."""

    def test_allowed_origins_exclude_wildcard(self, client):
        from app.main import allowed_origins
        assert "*" not in allowed_origins
        assert all(o.startswith("http") for o in allowed_origins)

    def test_disallowed_origin_not_reflected(self, client):
        response = client.get("/api/py/",
            headers={"Origin": "https://evil.example.com"},
        )
        # Starlette CORS should not echo disallowed origins
        acao = response.headers.get("access-control-allow-origin")
        assert acao != "https://evil.example.com"
        assert acao != "*"
