"""
Tests for Upload Router with Authentication
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
import jwt
from datetime import datetime, timedelta

from app.main import app
from app.config import get_settings


@pytest.fixture
def valid_token():
    """Generate a valid JWT token for testing."""
    settings = get_settings()
    payload = {
        "sub": "test-user-id",
        "email": "test@example.com",
        "name": "Test User",
        "exp": datetime.utcnow() + timedelta(hours=1),
    }
    return jwt.encode(payload, settings.nextauth_secret, algorithm="HS256")


@pytest.fixture
def expired_token():
    """Generate an expired JWT token for testing."""
    settings = get_settings()
    payload = {
        "sub": "test-user-id",
        "email": "test@example.com",
        "name": "Test User",
        "exp": datetime.utcnow() - timedelta(hours=1),
    }
    return jwt.encode(payload, settings.nextauth_secret, algorithm="HS256")


@pytest.fixture
def mock_resume_parser():
    """Mock the resume parser."""
    mock = AsyncMock()
    mock.parse_file.return_value = {
        "name": "Test User",
        "experiences": [{"title": "Developer", "company": "Tech Corp"}],
        "skills": ["Python", "JavaScript"],
        "education": [{"degree": "BS", "field": "CS"}],
        "projects": [],
    }
    return mock


@pytest.fixture
def client(mock_resume_parser):
    """Create test client with mocked dependencies."""
    with patch("app.routers.upload.resume_parser", mock_resume_parser):
        with TestClient(app) as c:
            yield c


class TestUploadAuthentication:
    """Tests for upload endpoint authentication."""
    
    def test_upload_resume_without_auth(self, client):
        """Test that upload fails without authentication."""
        response = client.post(
            "/upload/resume",
            files={"file": ("test.pdf", b"PDF content", "application/pdf")},
        )
        
        assert response.status_code == 401
        assert "Missing authentication token" in response.json()["detail"]
    
    def test_upload_resume_with_valid_auth(self, client, valid_token, mock_resume_parser):
        """Test that upload succeeds with valid authentication."""
        response = client.post(
            "/upload/resume",
            files={"file": ("test.pdf", b"PDF content", "application/pdf")},
            headers={"Authorization": f"Bearer {valid_token}"},
        )
        
        assert response.status_code == 200
        assert response.json()["success"] is True
        # Verify parser was called
        mock_resume_parser.parse_file.assert_called_once()
    
    def test_upload_resume_with_invalid_token(self, client):
        """Test that upload fails with invalid token."""
        response = client.post(
            "/upload/resume",
            files={"file": ("test.pdf", b"PDF content", "application/pdf")},
            headers={"Authorization": "Bearer invalid-token"},
        )
        
        assert response.status_code == 401
        assert "Invalid token" in response.json()["detail"]
    
    def test_upload_resume_with_expired_token(self, client, expired_token):
        """Test that upload fails with expired token."""
        response = client.post(
            "/upload/resume",
            files={"file": ("test.pdf", b"PDF content", "application/pdf")},
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        
        assert response.status_code == 401


class TestParseResumeAuthentication:
    """Tests for parse-resume endpoint authentication."""
    
    def test_parse_resume_without_auth(self, client):
        """Test that parse-resume fails without authentication."""
        response = client.post(
            "/parse-resume",
            files={"file": ("test.pdf", b"PDF content", "application/pdf")},
        )
        
        assert response.status_code == 401
    
    def test_parse_resume_with_valid_auth(self, client, valid_token):
        """Test that parse-resume succeeds with valid authentication."""
        response = client.post(
            "/parse-resume",
            files={"file": ("test.pdf", b"PDF content", "application/pdf")},
            headers={"Authorization": f"Bearer {valid_token}"},
        )
        
        assert response.status_code == 200
        assert response.json()["success"] is True


class TestParseCoverLetterAuthentication:
    """Tests for parse-cover-letter endpoint authentication."""
    
    def test_parse_cover_letter_without_auth(self, client):
        """Test that parse-cover-letter fails without authentication."""
        response = client.post(
            "/parse-cover-letter",
            files={"file": ("test.pdf", b"PDF content", "application/pdf")},
        )
        
        assert response.status_code == 401
    
    def test_parse_cover_letter_with_valid_auth(self, client, valid_token):
        """Test that parse-cover-letter succeeds with valid authentication."""
        response = client.post(
            "/parse-cover-letter",
            files={"file": ("test.pdf", b"PDF content", "application/pdf")},
            headers={"Authorization": f"Bearer {valid_token}"},
        )
        
        assert response.status_code == 200
        assert response.json()["success"] is True


class TestUploadValidation:
    """Tests for upload endpoint validation (still works with auth)."""
    
    def test_upload_invalid_file_type(self, client, valid_token):
        """Test that invalid file types are rejected."""
        response = client.post(
            "/upload/resume",
            files={"file": ("test.exe", b"malicious content", "application/octet-stream")},
            headers={"Authorization": f"Bearer {valid_token}"},
        )
        
        assert response.status_code == 400
        assert "Invalid file type" in response.json()["detail"]
    
    def test_upload_empty_file(self, client, valid_token):
        """Test that empty files are rejected."""
        response = client.post(
            "/upload/resume",
            files={"file": ("test.pdf", b"", "application/pdf")},
            headers={"Authorization": f"Bearer {valid_token}"},
        )
        
        assert response.status_code == 400
        assert "File is empty" in response.json()["detail"]
    
    def test_upload_large_file(self, client, valid_token):
        """Test that oversized files are rejected."""
        # Create content larger than 10MB
        large_content = b"x" * (11 * 1024 * 1024)
        
        response = client.post(
            "/upload/resume",
            files={"file": ("test.pdf", large_content, "application/pdf")},
            headers={"Authorization": f"Bearer {valid_token}"},
        )
        
        assert response.status_code == 400
        assert "File too large" in response.json()["detail"]
