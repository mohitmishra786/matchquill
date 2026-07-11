"""
Tests for AI Router Endpoints
Updated to require authentication for all endpoints
"""
import pytest
import jwt
from datetime import datetime, timedelta, timezone
from typing import Generator
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.config import get_settings


@pytest.fixture
def valid_token() -> str:
    """Generate a valid JWT token for testing."""
    settings = get_settings()
    payload = {
        "sub": "test-user-id",
        "email": "test@example.com",
        "name": "Test User",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    return jwt.encode(payload, settings.nextauth_secret, algorithm="HS256")


@pytest.fixture
def mock_groq_client() -> AsyncMock:
    """Mock the GroqClient for testing."""
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
def mock_db_auth() -> Generator[AsyncMock, None, None]:
    """Mock DB user validation used by verify_auth_token_with_db."""
    from app.middleware.auth import clear_db_auth_cache
    clear_db_auth_cache()
    mock_service = AsyncMock()
    mock_service.validate_token.return_value = "test-user-id"
    mock_service.close = AsyncMock()
    with patch("app.services.profile_service.ProfileService", return_value=mock_service):
        yield mock_service
    clear_db_auth_cache()


@pytest.fixture
def client(mock_groq_client: AsyncMock, mock_db_auth: AsyncMock) -> Generator[TestClient, None, None]:
    """Create test client with mocked GroqClient and DB auth."""
    with patch("app.routers.ai.GroqClient", return_value=mock_groq_client):
        with TestClient(app) as c:
            yield c


def test_enhance_bullet_validation(client: TestClient) -> None:
    """Test validation error for enhance-bullet - requires auth first."""
    response = client.post("/ai/enhance-bullet", json={})
    assert response.status_code == 401  # Auth required before validation


def test_enhance_bullet_success(client: TestClient, valid_token: str, mock_groq_client: AsyncMock) -> None:
    """Test successful bullet enhancement with authentication."""
    response = client.post(
        "/ai/enhance-bullet",
        json={"bullet": "Worked on stuff"},
        headers={"Authorization": f"Bearer {valid_token}"}
    )
    assert response.status_code == 200
    assert response.json()["enhanced_bullet"] == "Enhanced bullet point with better impact"
    mock_groq_client.enhance_bullet.assert_called_once()


def test_interview_prep_success(client: TestClient, valid_token: str, mock_groq_client: AsyncMock) -> None:
    """Test successful interview prep generation with authentication."""
    response = client.post(
        "/ai/interview-prep",
        json={"candidate_info": "Some info"},
        headers={"Authorization": f"Bearer {valid_token}"}
    )
    assert response.status_code == 200
    assert len(response.json()["questions"]) == 1
    assert response.json()["questions"][0]["question"] == "Tell me about yourself"
    mock_groq_client.generate_interview_prep.assert_called_once()


def test_suggest_skills_success(client: TestClient, valid_token: str, mock_groq_client: AsyncMock) -> None:
    """Test successful skill suggestion with authentication."""
    response = client.post(
        "/ai/suggest-skills",
        json={"experience_text": "I coded in Python"},
        headers={"Authorization": f"Bearer {valid_token}"}
    )
    assert response.status_code == 200
    assert "Python" in response.json()["skills"]
    mock_groq_client.suggest_skills.assert_called_once()


def test_suggest_skills_too_short(client: TestClient, valid_token: str) -> None:
    """Test validation for short text with authentication."""
    response = client.post(
        "/ai/suggest-skills",
        json={"experience_text": "Short"},
        headers={"Authorization": f"Bearer {valid_token}"}
    )
    assert response.status_code == 400
    assert "too short" in response.json()["detail"].lower()
