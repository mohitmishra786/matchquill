import pytest
from fastapi.testclient import TestClient

from app.constants import API_PREFIX
from app.main import app


@pytest.fixture
def client():
    """Test client for FastAPI app."""
    return TestClient(app)


@pytest.fixture
def api_prefix() -> str:
    """Public API path prefix used in production (Vercel)."""
    return API_PREFIX