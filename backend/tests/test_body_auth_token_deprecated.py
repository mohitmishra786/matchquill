"""
Tests for deprecated body authToken fallback on compile/cover-letter.

Prefer Authorization header; body token remains for backward compatibility
but emits a deprecation warning.
"""

import logging
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.cover_letter import CoverLetterResponse
from app.models.resume import CompiledResume, ResumeResponse
from app.models.user import Experience, Skill, UserProfile, UserSettings
from app.routers.compile import (
    get_auth_token as compile_get_auth_token,
    get_profile_service as get_ps_compile,
    get_resume_compiler,
)
from app.routers.cover_letter import (
    get_auth_token as cl_get_auth_token,
    get_profile_service as get_ps_cl,
    get_cover_letter_generator,
)
from app.models.resume import ResumeRequest
from app.models.cover_letter import CoverLetterRequest
from fastapi.security import HTTPAuthorizationCredentials


@pytest.fixture
def sample_profile() -> UserProfile:
    return UserProfile(
        id="u1",
        email="test@example.com",
        name="Test User",
        settings=UserSettings(selectedTemplate="experience-skills-projects"),
        experiences=[
            Experience(
                id="e1",
                company="Tech Corp",
                title="Dev",
                startDate="2022-01-01T00:00:00Z",
                description="Desc",
                keywords=["Python"],
            )
        ],
        projects=[],
        skills=[Skill(id="s1", name="Python", category="Lang")],
        educations=[],
        publications=[],
    )


@pytest.fixture
def client(sample_profile: UserProfile):
    mock_profile_service = MagicMock()
    mock_profile_service.get_profile = AsyncMock(return_value=sample_profile)

    mock_compiler = MagicMock()
    mock_compiler.compile = AsyncMock(
        return_value=ResumeResponse(
            success=True,
            pdf_base64="base64pdf",
            resume_json=CompiledResume(
                name="Test",
                email="test",
                template="experience-skills-projects",
            ),
        )
    )
    mock_compiler.get_available_templates.return_value = {
        "template1": {"description": "desc"}
    }

    mock_cl_generator = MagicMock()
    mock_cl_generator.generate = AsyncMock(
        return_value=CoverLetterResponse(
            success=True,
            cover_letter="My Cover Letter",
            word_count=100,
            model_used="model",
            profile_fields_used=["experiences"],
        )
    )

    app.dependency_overrides[get_ps_compile] = lambda: mock_profile_service
    app.dependency_overrides[get_ps_cl] = lambda: mock_profile_service
    app.dependency_overrides[get_resume_compiler] = lambda: mock_compiler
    app.dependency_overrides[get_cover_letter_generator] = lambda: mock_cl_generator

    with TestClient(app) as c:
        yield c

    app.dependency_overrides = {}


class TestGetAuthTokenPreference:
    """Unit tests for get_auth_token header preference."""

    def test_header_preferred_over_body_compile(self):
        request = ResumeRequest(
            authToken="body-token",
            jobDescription="A" * 60,
        )
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="header-token")
        token = compile_get_auth_token(request, creds)
        assert token == "header-token"

    def test_body_fallback_compile_emits_warning(self, caplog):
        request = ResumeRequest(
            authToken="body-only-token",
            jobDescription="A" * 60,
        )
        with caplog.at_level(logging.WARNING, logger="cv-wiz"):
            token = compile_get_auth_token(request, None)
        assert token == "body-only-token"
        assert any("DEPRECATED" in r.getMessage() for r in caplog.records if r.name == "cv-wiz")

    def test_missing_token_raises(self):
        from fastapi import HTTPException

        request = ResumeRequest(jobDescription="A" * 60)
        with pytest.raises(HTTPException) as exc_info:
            compile_get_auth_token(request, None)
        assert exc_info.value.status_code == 401
        assert "Authorization" in exc_info.value.detail
        assert "deprecated" in exc_info.value.detail.lower()

    def test_header_preferred_over_body_cover_letter(self):
        request = CoverLetterRequest(
            authToken="body-token",
            jobDescription="A" * 60,
        )
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="header-token")
        token = cl_get_auth_token(request, creds)
        assert token == "header-token"

    def test_body_fallback_cover_letter_emits_warning(self, caplog):
        request = CoverLetterRequest(
            authToken="body-only-token",
            jobDescription="A" * 60,
        )
        with caplog.at_level(logging.WARNING, logger="cv-wiz"):
            token = cl_get_auth_token(request, None)
        assert token == "body-only-token"
        assert any("DEPRECATED" in r.getMessage() for r in caplog.records if r.name == "cv-wiz")


class TestOptionalBodyAuthToken:
    """Models accept requests with header-only auth (no body authToken)."""

    def test_resume_request_auth_token_optional(self):
        req = ResumeRequest(jobDescription="A" * 60)
        assert req.auth_token is None

    def test_cover_letter_request_auth_token_optional(self):
        req = CoverLetterRequest(jobDescription="A" * 60)
        assert req.auth_token is None

    def test_compile_header_only_auth(self, client):
        response = client.post(
            "/api/py/compile",
            json={"jobDescription": "A" * 60},
            headers={"Authorization": "Bearer header-only-token"},
        )
        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_cover_letter_header_only_auth(self, client):
        response = client.post(
            "/api/py/cover-letter",
            json={"jobDescription": "A" * 60, "tone": "professional"},
            headers={"Authorization": "Bearer header-only-token"},
        )
        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_compile_body_token_still_works(self, client, caplog):
        with caplog.at_level(logging.WARNING, logger="cv-wiz"):
            response = client.post(
                "/api/py/compile",
                json={"authToken": "legacy-body-token", "jobDescription": "A" * 60},
            )
        assert response.status_code == 200
        assert any(
            "DEPRECATED" in r.getMessage()
            for r in caplog.records
            if r.name == "cv-wiz"
        )
