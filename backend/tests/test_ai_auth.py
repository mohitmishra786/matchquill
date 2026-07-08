"""
Tests for AI Router with Authentication
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
def mock_groq_client():
    """Mock the Groq client."""
    mock = AsyncMock()
    mock.enhance_bullet.return_value = "Enhanced bullet point with better impact"
    mock.generate_interview_prep.return_value = [
        {
            "question": "Tell me about yourself",
            "suggested_answer": "I am a software engineer...",
            "key_points": ["Experience", "Skills"]
        }
    ]
    mock.suggest_skills.return_value = ["Python", "JavaScript", "React"]
    return mock


@pytest.fixture
def client(mock_groq_client):
    """Create test client with mocked dependencies."""
    with patch("app.routers.ai.GroqClient", return_value=mock_groq_client):
        with TestClient(app) as c:
            yield c


class TestAIAuthentication:
    """Tests for AI endpoint authentication."""
    
    def test_enhance_bullet_without_auth(self, client):
        """Test that enhance-bullet fails without authentication."""
        response = client.post(
            "/ai/enhance-bullet",
            json={"bullet": "Led a team of developers"},
        )
        
        assert response.status_code == 401
        assert "Missing authentication token" in response.json()["detail"]
    
    def test_enhance_bullet_with_valid_auth(self, client, valid_token, mock_groq_client):
        """Test that enhance-bullet succeeds with valid authentication."""
        response = client.post(
            "/ai/enhance-bullet",
            json={"bullet": "Led a team of developers"},
            headers={"Authorization": f"Bearer {valid_token}"},
        )
        
        assert response.status_code == 200
        assert "enhanced_bullet" in response.json()
        mock_groq_client.enhance_bullet.assert_called_once()
    
    def test_interview_prep_without_auth(self, client):
        """Test that interview-prep fails without authentication."""
        response = client.post(
            "/ai/interview-prep",
            json={"candidate_info": "Software engineer with 5 years experience"},
        )
        
        assert response.status_code == 401
    
    def test_interview_prep_with_valid_auth(self, client, valid_token, mock_groq_client):
        """Test that interview-prep succeeds with valid authentication."""
        response = client.post(
            "/ai/interview-prep",
            json={"candidate_info": "Software engineer with 5 years experience"},
            headers={"Authorization": f"Bearer {valid_token}"},
        )
        
        assert response.status_code == 200
        assert "questions" in response.json()
        mock_groq_client.generate_interview_prep.assert_called_once()
    
    def test_suggest_skills_without_auth(self, client):
        """Test that suggest-skills fails without authentication."""
        response = client.post(
            "/ai/suggest-skills",
            json={"experience_text": "Developed web applications using React and Node.js"},
        )
        
        assert response.status_code == 401
    
    def test_suggest_skills_with_valid_auth(self, client, valid_token, mock_groq_client):
        """Test that suggest-skills succeeds with valid authentication."""
        response = client.post(
            "/ai/suggest-skills",
            json={"experience_text": "Developed web applications using React and Node.js"},
            headers={"Authorization": f"Bearer {valid_token}"},
        )
        
        assert response.status_code == 200
        assert "skills" in response.json()
        mock_groq_client.suggest_skills.assert_called_once()
    
    def test_suggest_skills_validation(self, client, valid_token):
        """Test that suggest-skills validates input length."""
        response = client.post(
            "/ai/suggest-skills",
            json={"experience_text": "Too short"},
            headers={"Authorization": f"Bearer {valid_token}"},
        )
        
        assert response.status_code == 400
        assert "too short" in response.json()["detail"].lower()
