"""
Resume Compilation Router
API endpoint for generating tailored resumes.
"""

import time
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.models.resume import ResumeRequest, ResumeResponse
from app.services.profile_service import ProfileService
from app.services.resume_compiler import ResumeCompiler
from app.utils.logger import logger, get_request_id, log_auth_operation
from app.utils.rate_limiter import limiter, RateLimitConfig


router = APIRouter()

# HTTP Bearer security scheme for Authorization header
security = HTTPBearer(auto_error=False)


# Dependency injection for services
def get_profile_service() -> ProfileService:
    return ProfileService()


def get_resume_compiler() -> ResumeCompiler:
    return ResumeCompiler()


def get_auth_token(
    resume_request: ResumeRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """
    Extract auth token from Authorization header (preferred).

    Body ``authToken`` is deprecated and kept only for backward compatibility.
    New clients must send ``Authorization: Bearer <token>``.
    """
    if credentials and credentials.credentials:
        return credentials.credentials

    if resume_request.auth_token:
        # Non-standard: tokens in body can leak via logs/proxies — deprecate
        logger.warning(
            "DEPRECATED: authToken in request body is deprecated; "
            "use Authorization: Bearer header instead",
            {
                "auth_source": "body",
                "endpoint": "compile",
            },
        )
        return resume_request.auth_token

    raise HTTPException(
        status_code=401,
        detail=(
            "Missing authentication token. "
            "Provide via Authorization: Bearer header "
            "(body authToken is deprecated)."
        ),
    )


@router.post("/compile", response_model=ResumeResponse)
@limiter.limit(RateLimitConfig.COMPILE_RESUME)
async def compile_resume(
    request: Request,
    resume_request: ResumeRequest,
    auth_token: str = Depends(get_auth_token),
    profile_service: ProfileService = Depends(get_profile_service),
    compiler: ResumeCompiler = Depends(get_resume_compiler),
) -> ResumeResponse:
    """
    Compile a tailored resume based on user profile and job description.
    """
    request_id = get_request_id()
    start_time = time.time()
    
    # Validate job description length
    job_description_length = len(resume_request.job_description)
    if job_description_length < 50:
        logger.warning("Job description too short", {
            "request_id": request_id,
            "length": job_description_length,
        })
        raise HTTPException(
            status_code=400,
            detail=f"Job description is too short ({job_description_length} characters). Minimum required: 50 characters.",
        )
    
    if job_description_length > 50000:
        logger.warning("Job description too long", {
            "request_id": request_id,
            "length": job_description_length,
        })
        raise HTTPException(
            status_code=400,
            detail=f"Job description is too long ({job_description_length} characters). Maximum allowed: 50,000 characters.",
        )
    
    auth_source = "header" if auth_token != resume_request.auth_token else "body"
    logger.start_operation("compile_resume", {
        "request_id": request_id,
        "job_description_length": job_description_length,
        "template": resume_request.template,
        "auth_source": auth_source,
        "ats_type": resume_request.ats_type,
    })
    
    try:
        # Validate auth token and get user profile
        logger.info("Fetching user profile", {"request_id": request_id})
        profile = await profile_service.get_profile(auth_token)
        
        if profile is None:
            logger.warning("Profile fetch failed - invalid token", {"request_id": request_id})
            log_auth_operation("compile:auth_failed", success=False)
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired authentication token",
            )
        
        logger.info("Profile fetched successfully", {
            "request_id": request_id,
            "user_id": profile.id,
            "user_email": profile.email[:3] + "***" if profile.email else None,
            "experiences_count": len(profile.experiences) if profile.experiences else 0,
            "projects_count": len(profile.projects) if profile.projects else 0,
            "skills_count": len(profile.skills) if profile.skills else 0,
        })
        
        log_auth_operation("compile:auth_success", user_id=profile.id, success=True)
        
        # Check if profile has required data
        if not profile.experiences and not profile.projects and not profile.skills:
            logger.warning("Profile is empty - cannot compile", {
                "request_id": request_id,
                "user_id": profile.id,
            })
            raise HTTPException(
                status_code=400,
                detail="Profile is empty. Please add experiences, projects, or skills before generating a resume.",
            )
        
        # Compile resume
        logger.info("Starting resume compilation", {
            "request_id": request_id,
            "user_id": profile.id,
            "template": resume_request.template,
        })
        
        response = await compiler.compile(
            profile=profile,
            job_description=resume_request.job_description,
            template=resume_request.template,
        )
        
        duration_ms = (time.time() - start_time) * 1000
        logger.end_operation("compile_resume", duration_ms, {
            "request_id": request_id,
            "user_id": profile.id,
            "success": response.success,
            "has_pdf": bool(response.pdf_base64),
            "error": response.error,
        })
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.fail_operation("compile_resume", e, {"request_id": request_id, "duration_ms": duration_ms})
        raise HTTPException(status_code=500, detail=f"Resume compilation failed: {str(e)}")


@router.post("/compile/pdf")
@limiter.limit(RateLimitConfig.COMPILE_RESUME)
async def compile_resume_pdf(
    request: Request,
    resume_request: ResumeRequest,
    auth_token: str = Depends(get_auth_token),
    profile_service: ProfileService = Depends(get_profile_service),
    compiler: ResumeCompiler = Depends(get_resume_compiler),
) -> Response:
    """
    Compile and return resume as direct PDF download.
    """
    request_id = get_request_id()
    start_time = time.time()
    
    # Validate job description length
    job_description_length = len(resume_request.job_description)
    if job_description_length < 50:
        logger.warning("Job description too short for PDF", {
            "request_id": request_id,
            "length": job_description_length,
        })
        raise HTTPException(
            status_code=400,
            detail=f"Job description is too short ({job_description_length} characters). Minimum required: 50 characters.",
        )
    
    if job_description_length > 50000:
        logger.warning("Job description too long for PDF", {
            "request_id": request_id,
            "length": job_description_length,
        })
        raise HTTPException(
            status_code=400,
            detail=f"Job description is too long ({job_description_length} characters). Maximum allowed: 50,000 characters.",
        )
    
    logger.start_operation("compile_resume_pdf", {
        "request_id": request_id,
        "job_description_length": job_description_length,
    })
    
    try:
        # Validate auth token and get user profile
        profile = await profile_service.get_profile(auth_token)
        
        if profile is None:
            logger.warning("PDF compile failed - invalid token", {"request_id": request_id})
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired authentication token",
            )
        
        logger.info("Profile fetched for PDF", {"request_id": request_id, "user_id": profile.id})
        
        if not profile.experiences and not profile.projects and not profile.skills:
            logger.warning("Profile empty for PDF compile", {"request_id": request_id, "user_id": profile.id})
            raise HTTPException(
                status_code=400,
                detail="Profile is empty.",
            )
        
        # Compile resume
        response = await compiler.compile(
            profile=profile,
            job_description=resume_request.job_description,
            template=resume_request.template,
        )
        
        # Check if PDF generation was successful
        if not response.pdf_base64:
            if response.error and "PDF generation" in response.error:
                # PDF generation failed but compilation succeeded
                logger.error("PDF generation unavailable", {
                    "request_id": request_id,
                    "user_id": profile.id,
                    "error": response.error,
                })
                raise HTTPException(
                    status_code=503,
                    detail="PDF generation is currently unavailable. Please try again later or contact support if the issue persists.",
                )
            else:
                # General compilation failure
                logger.error("PDF compilation failed", {
                    "request_id": request_id,
                    "user_id": profile.id,
                    "error": response.error,
                })
                raise HTTPException(
                    status_code=500,
                    detail=response.error or "Resume compilation failed",
                )
        
        # Decode base64 to bytes
        import base64
        pdf_bytes = base64.b64decode(response.pdf_base64)
        
        # Generate filename
        name_slug = (profile.name or "resume").replace(" ", "_").lower()
        filename = f"{name_slug}_resume.pdf"
        
        duration_ms = (time.time() - start_time) * 1000
        logger.end_operation("compile_resume_pdf", duration_ms, {
            "request_id": request_id,
            "user_id": profile.id,
            "pdf_size_bytes": len(pdf_bytes),
            "filename": filename,
        })
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "X-Request-Id": request_id,
            },
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.fail_operation("compile_resume_pdf", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail=f"PDF compilation failed: {str(e)}")


@router.get("/templates")
@limiter.limit(RateLimitConfig.GET_TEMPLATES)
async def get_templates(
    request: Request,
    compiler: ResumeCompiler = Depends(get_resume_compiler),
) -> dict:
    """
    Get available resume templates with descriptions.
    """
    request_id = get_request_id()
    logger.debug("Templates requested", {"request_id": request_id})
    
    templates = compiler.get_available_templates()
    logger.info("Templates returned", {"request_id": request_id, "template_count": len(templates)})
    
    return {
        "templates": templates,
    }
