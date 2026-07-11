"""
AI Router
Endpoints for LLM-powered resume helpers (bullet enhancement, interview prep, skill suggestions).

All routes require authentication and are rate-limited to control LLM cost and abuse.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.middleware.auth import verify_auth_token_with_db
from app.services.groq_client import GroqClient
from app.utils.logger import logger
from app.utils.rate_limiter import RateLimitConfig, limiter

router = APIRouter(prefix="/ai")


class EnhanceBulletRequest(BaseModel):
    bullet: str = Field(..., min_length=1, max_length=2000)
    job_description: Optional[str] = Field(default=None, max_length=20000)


class InterviewPrepRequest(BaseModel):
    candidate_info: str = Field(..., min_length=1, max_length=50000)
    job_description: Optional[str] = Field(default=None, max_length=50000)


class InterviewQuestion(BaseModel):
    question: str
    suggested_answer: str
    key_points: List[str]


class InterviewPrepResponse(BaseModel):
    questions: List[InterviewQuestion]


class SkillSuggestionRequest(BaseModel):
    experience_text: str = Field(..., min_length=1, max_length=10000)


class SkillSuggestionResponse(BaseModel):
    skills: List[str]


def _apply_limit(limit_value: object):  # type: ignore[no-untyped-def]
    """
    Apply slowapi limit decorator when available; otherwise no-op.

    Keeps routers importable in environments where slowapi is missing.
    """
    if limiter is None:
        def decorator(func):  # type: ignore[no-untyped-def]
            return func
        return decorator
    return limiter.limit(limit_value)


@router.post("/enhance-bullet")
@_apply_limit(RateLimitConfig.AI_ENHANCE_BULLET)
async def enhance_bullet(
    request: Request,
    body: EnhanceBulletRequest,
    user_id: str = Depends(verify_auth_token_with_db),
) -> dict:
    """Rewrite a resume bullet point to be more impactful and relevant."""
    logger.info("[AI] Enhancing bullet", {"user_id": user_id})
    try:
        client = GroqClient()
        enhanced_bullet = await client.enhance_bullet(
            bullet=body.bullet,
            job_description=body.job_description,
        )
        return {"enhanced_bullet": enhanced_bullet}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error enhancing bullet", {"user_id": user_id, "error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to enhance bullet") from e


@router.post("/interview-prep", response_model=InterviewPrepResponse)
@_apply_limit(RateLimitConfig.AI_INTERVIEW_PREP)
async def interview_prep(
    request: Request,
    body: InterviewPrepRequest,
    user_id: str = Depends(verify_auth_token_with_db),
) -> dict:
    """Generate interview questions and answers based on candidate info and job desc."""
    logger.info("[AI] Generating interview prep", {"user_id": user_id})
    try:
        client = GroqClient()
        questions = await client.generate_interview_prep(
            candidate_info=body.candidate_info,
            job_description=body.job_description,
        )
        return {"questions": questions}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error generating interview prep", {"user_id": user_id, "error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to generate interview prep") from e


@router.post("/suggest-skills", response_model=SkillSuggestionResponse)
@_apply_limit(RateLimitConfig.AI_SUGGEST_SKILLS)
async def suggest_skills(
    request: Request,
    body: SkillSuggestionRequest,
    user_id: str = Depends(verify_auth_token_with_db),
) -> dict:
    """Suggest skills based on experience description."""
    logger.info("[AI] Suggesting skills", {"user_id": user_id})
    if len(body.experience_text) < 10:
        raise HTTPException(status_code=400, detail="Experience text too short")

    try:
        client = GroqClient()
        skills = await client.suggest_skills(body.experience_text)
        return {"skills": skills}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error suggesting skills", {"user_id": user_id, "error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to suggest skills") from e
