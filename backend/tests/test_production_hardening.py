"""
Hardening tests for already-fixed production issues:
- CORS never reflects "*" with credentials (#93 #103 #111 #228)
- Cover letter uses cover_request.job_description (#114)
- ResumeResponse field aliases (#115 related model params)
- AsyncGroq client usage (#168)
"""

import inspect
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.main import allowed_origins
from app.models.cover_letter import CoverLetterRequest, CoverLetterResponse
from app.models.resume import CompiledResume, ResumeRequest, ResumeResponse
from app.models.user import Experience, Skill, UserProfile, UserSettings
from app.routers.cover_letter import generate_cover_letter
from app.services.groq_client import GroqClient


class TestCORSRejectsWildcard:
    """CORS must never allow '*' with credentials."""

    def test_allowed_origins_never_contains_wildcard(self):
        assert "*" not in allowed_origins
        for origin in allowed_origins:
            assert origin != "*"
            assert "*" not in origin

    def test_disallowed_origin_does_not_get_star_header(self, client: TestClient):
        response = client.get(
            "/",
            headers={"Origin": "https://evil.example.com"},
        )
        assert response.status_code == 200
        acao = response.headers.get("access-control-allow-origin")
        # Must not echo wildcard; untrusted origins get no ACAO or not "*"
        assert acao != "*"
        if acao is not None:
            assert acao != "https://evil.example.com" or acao in allowed_origins

    def test_allowed_origin_is_exact_not_wildcard(self, client: TestClient):
        response = client.get(
            "/",
            headers={"Origin": "http://localhost:3000"},
        )
        assert response.status_code == 200
        acao = response.headers.get("access-control-allow-origin")
        assert acao == "http://localhost:3000"
        assert acao != "*"
        # Credentials allowed only with explicit origin
        assert response.headers.get("access-control-allow-credentials") == "true"

    def test_main_module_filters_wildcard(self):
        """Source-level guard: allowed_origins construction excludes '*'."""
        main_path = Path(__file__).resolve().parents[1] / "app" / "main.py"
        source = main_path.read_text(encoding="utf-8")
        assert 'origin != "*"' in source or "origin != '*'" in source
        assert "allow_credentials=True" in source


class TestCoverLetterUsesJobDescription:
    """Cover letter generation must pass cover_request.job_description (#114)."""

    def test_cover_letter_request_field_alias(self):
        req = CoverLetterRequest(
            jobDescription="Software engineer role requiring Python and FastAPI experience." * 2,
        )
        assert "Python" in req.job_description

    def test_generate_passes_job_description_to_generator(self):
        """Static inspection: generate endpoint uses cover_request.job_description."""
        source = inspect.getsource(generate_cover_letter)
        assert "cover_request.job_description" in source
        # Must not accidentally use resume_request or bare job_description vars incorrectly
        assert "resume_request" not in source

    @pytest.mark.asyncio
    async def test_endpoint_forwards_job_description(self):
        jd = (
            "We need a senior backend engineer with deep FastAPI and PostgreSQL "
            "experience building secure APIs."
        )
        profile = UserProfile(
            id="u1",
            email="t@example.com",
            name="Test",
            settings=UserSettings(selectedTemplate="experience-skills-projects"),
            experiences=[
                Experience(
                    id="e1",
                    company="Co",
                    title="Dev",
                    startDate="2022-01-01T00:00:00Z",
                    description="Work",
                    keywords=["Python"],
                )
            ],
            projects=[],
            skills=[Skill(id="s1", name="Python", category="Lang")],
            educations=[],
            publications=[],
        )

        mock_profile = MagicMock()
        mock_profile.get_profile = AsyncMock(return_value=profile)
        mock_gen = MagicMock()
        mock_gen.generate = AsyncMock(
            return_value=CoverLetterResponse(
                success=True,
                cover_letter="Letter",
                word_count=10,
                model_used="m",
            )
        )

        cover_request = CoverLetterRequest(jobDescription=jd)
        scope = {
            "type": "http",
            "method": "POST",
            "path": "/cover-letter",
            "headers": [],
            "client": ("testclient", 50000),
            "server": ("test", 80),
            "scheme": "http",
            "query_string": b"",
        }
        request = Request(scope)

        result = await generate_cover_letter(
            request=request,
            cover_request=cover_request,
            auth_token="tok",
            profile_service=mock_profile,
            generator=mock_gen,
        )

        assert result.success is True
        mock_gen.generate.assert_awaited_once()
        call_kwargs = mock_gen.generate.await_args.kwargs
        assert call_kwargs["job_description"] == jd


class TestResumeResponseFields:
    """ResumeResponse exposes success, pdfBase64, resumeJson, error (#115)."""

    def test_resume_response_aliases(self):
        compiled = CompiledResume(
            name="Ada",
            email="ada@example.com",
            template="experience-skills-projects",
        )
        resp = ResumeResponse(
            success=True,
            pdfBase64="abc123",
            resumeJson=compiled,
            error=None,
        )
        dumped = resp.model_dump(by_alias=True)
        assert dumped["success"] is True
        assert dumped["pdfBase64"] == "abc123"
        assert dumped["resumeJson"]["name"] == "Ada"
        assert "error" in dumped

    def test_resume_request_template_and_jd_params(self):
        req = ResumeRequest(
            jobDescription="Backend engineer building APIs with Python FastAPI Redis." * 2,
            template="compact-technical",
        )
        assert req.template == "compact-technical"
        assert len(req.job_description) >= 50

    def test_resume_response_failure_shape(self):
        resp = ResumeResponse(success=False, error="compile failed")
        dumped = resp.model_dump(by_alias=True)
        assert dumped["success"] is False
        assert dumped["error"] == "compile failed"
        assert dumped.get("pdfBase64") is None


class TestAsyncGroqAndModelParams:
    """GroqClient uses AsyncGroq and sensible model call params (#115 #168)."""

    def test_groq_client_uses_async_groq(self):
        from groq import AsyncGroq

        with patch("app.services.groq_client.AsyncGroq") as mock_cls:
            mock_cls.return_value = MagicMock(spec=AsyncGroq)
            client = GroqClient()
            assert mock_cls.called
            assert client.client is mock_cls.return_value

    def test_groq_client_instance_is_async_groq(self):
        from groq import AsyncGroq

        client = GroqClient()
        assert isinstance(client.client, AsyncGroq)

    @pytest.mark.asyncio
    async def test_cover_letter_api_params_include_model_temperature_max_tokens(self):
        with patch("app.services.groq_client.AsyncGroq") as mock_cls:
            mock_instance = MagicMock()
            mock_response = MagicMock()
            mock_response.choices = [
                MagicMock(message=MagicMock(content="Cover letter text"))
            ]
            mock_response.usage = MagicMock(prompt_tokens=10, completion_tokens=20)
            mock_instance.chat.completions.create = AsyncMock(return_value=mock_response)
            mock_cls.return_value = mock_instance

            with patch("app.services.groq_client.get_settings") as mock_settings:
                mock_settings.return_value.groq_api_key = "k"
                mock_settings.return_value.groq_model = "llama-test-model"
                client = GroqClient()
                # Bypass deduplicator path by calling internal
                text, model = await client._generate_cover_letter_internal(
                    "candidate",
                    "job description text here",
                    "professional",
                    400,
                )

            assert text == "Cover letter text"
            assert model == "llama-test-model"
            kwargs = mock_instance.chat.completions.create.await_args.kwargs
            assert kwargs["model"] == "llama-test-model"
            assert "temperature" in kwargs
            assert "max_tokens" in kwargs
            assert kwargs["max_tokens"] > 0
