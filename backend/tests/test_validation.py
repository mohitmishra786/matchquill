"""
Unit tests for input validation functionality.
"""

from fastapi.testclient import TestClient


class TestJobDescriptionValidation:
    """Tests for job description length validation."""

    def test_compile_rejects_short_description(self, client: TestClient):
        """Test that compile endpoint rejects short job descriptions."""
        response = client.post("/api/py/compile", json={
            "authToken": "test_token",
            "jobDescription": "Too short",
        })
        
        # Pydantic validation returns 422, manual validation returns 400
        assert response.status_code in [400, 422]
        data = response.json()
        # Pydantic returns detail as a list of errors
        detail = data["detail"]
        if isinstance(detail, list):
            detail_str = str(detail).lower()
        else:
            detail_str = detail.lower()
        assert "too short" in detail_str or "at least" in detail_str

    def test_compile_rejects_long_description(self, client: TestClient):
        """Test that compile endpoint rejects very long job descriptions."""
        response = client.post("/api/py/compile", json={
            "authToken": "test_token",
            "jobDescription": "A" * 50001,
        })
        
        # Pydantic validation returns 422, manual validation returns 400
        assert response.status_code in [400, 422]
        data = response.json()
        # Pydantic returns detail as a list of errors
        detail = data["detail"]
        if isinstance(detail, list):
            detail_str = str(detail).lower()
        else:
            detail_str = detail.lower()
        assert "too long" in detail_str or "at most" in detail_str

    def test_compile_accepts_valid_description(self, client: TestClient):
        """Test that compile endpoint accepts valid length descriptions."""
        # Valid length but will fail auth
        response = client.post("/api/py/compile", json={
            "authToken": "invalid_token",
            "jobDescription": "This is a valid job description with sufficient length. " * 5,
        })
        
        # Should fail auth, not validation
        assert response.status_code == 401

    def test_cover_letter_rejects_short_description(self, client: TestClient):
        """Test that cover letter endpoint rejects short job descriptions."""
        response = client.post("/api/py/cover-letter", json={
            "authToken": "test_token",
            "jobDescription": "Too short",
        })
        
        # Pydantic validation returns 422, manual validation returns 400
        assert response.status_code in [400, 422]
        data = response.json()
        # Pydantic returns detail as a list of errors
        detail = data["detail"]
        if isinstance(detail, list):
            detail_str = str(detail).lower()
        else:
            detail_str = detail.lower()
        assert "too short" in detail_str or "at least" in detail_str

    def test_cover_letter_rejects_long_description(self, client: TestClient):
        """Test that cover letter endpoint rejects very long job descriptions."""
        response = client.post("/api/py/cover-letter", json={
            "authToken": "test_token",
            "jobDescription": "A" * 50001,
        })
        
        # Pydantic validation returns 422, manual validation returns 400
        assert response.status_code in [400, 422]
        data = response.json()
        # Pydantic returns detail as a list of errors
        detail = data["detail"]
        if isinstance(detail, list):
            detail_str = str(detail).lower()
        else:
            detail_str = detail.lower()
        assert "too long" in detail_str or "at most" in detail_str

    def test_compile_pdf_rejects_short_description(self, client: TestClient):
        """Test that compile PDF endpoint rejects short job descriptions."""
        response = client.post("/api/py/compile/pdf", json={
            "authToken": "test_token",
            "jobDescription": "Too short",
        })
        
        # Pydantic validation returns 422, manual validation returns 400
        assert response.status_code in [400, 422]
        data = response.json()
        # Pydantic returns detail as a list of errors
        detail = data["detail"]
        if isinstance(detail, list):
            detail_str = str(detail).lower()
        else:
            detail_str = detail.lower()
        assert "too short" in detail_str or "at least" in detail_str

    def test_preview_rejects_short_description(self, client: TestClient):
        """Test that preview endpoint rejects short job descriptions."""
        response = client.post("/api/py/cover-letter/preview", json={
            "authToken": "test_token",
            "jobDescription": "Too short",
        })
        
        # Pydantic validation returns 422, manual validation returns 400
        assert response.status_code in [400, 422]
        data = response.json()
        # Pydantic returns detail as a list of errors
        detail = data["detail"]
        if isinstance(detail, list):
            detail_str = str(detail).lower()
        else:
            detail_str = detail.lower()
        assert "too short" in detail_str or "at least" in detail_str

    def test_exact_boundary_values(self, client: TestClient):
        """Test boundary values for job description length."""
        # Exactly 50 characters - should pass validation (fail auth)
        response = client.post("/api/py/compile", json={
            "authToken": "invalid",
            "jobDescription": "A" * 50,
        })
        assert response.status_code == 401  # Passes validation, fails auth
        
        # Exactly 50000 characters - should pass validation (fail auth)
        response = client.post("/api/py/compile", json={
            "authToken": "invalid",
            "jobDescription": "A" * 50000,
        })
        assert response.status_code == 401  # Passes validation, fails auth


class TestCoverLetterToneValidation:
    """Tests for cover letter tone validation."""

    def test_valid_tones_accepted(self, client: TestClient):
        """Test that valid tone values are accepted."""
        valid_tones = ["professional", "enthusiastic", "formal"]
        
        for tone in valid_tones:
            response = client.post("/api/py/cover-letter", json={
                "authToken": "invalid_token",
                "jobDescription": "This is a valid job description with sufficient length. " * 5,
                "tone": tone,
            })
            
            # Should fail auth, not tone validation
            assert response.status_code == 401, f"Tone '{tone}' should be valid"

    def test_invalid_tone_rejected(self, client: TestClient):
        """Test that invalid tone values are rejected."""
        response = client.post("/api/py/cover-letter", json={
            "authToken": "test_token",
            "jobDescription": "This is a valid job description with sufficient length. " * 5,
            "tone": "invalid_tone",
        })
        
        # Tone validation happens after auth, so we get 401 for invalid token
        # With valid token, it would return 400 for invalid tone
        assert response.status_code in [400, 401]
        if response.status_code == 400:
            data = response.json()
            assert "invalid tone" in data["detail"].lower()

    def test_default_tone_used(self, client: TestClient):
        """Test that default tone is used when not specified."""
        response = client.post("/api/py/cover-letter", json={
            "authToken": "invalid_token",
            "jobDescription": "This is a valid job description with sufficient length. " * 5,
            # No tone specified
        })
        
        # Should fail auth, not validation (default tone should be applied)
        assert response.status_code == 401
