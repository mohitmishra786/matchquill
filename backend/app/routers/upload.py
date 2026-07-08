"""
Resume Upload Router
API endpoint for uploading and parsing resume/cover letter files.
"""

import time
import asyncio
import tempfile
import os
import traceback
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Request
from fastapi.responses import JSONResponse
from typing import Optional

from app.services.resume_parser import resume_parser
from app.utils.logger import logger, get_request_id
from app.middleware.auth import verify_auth_token
from app.utils.rate_limiter import limiter


# Semaphore to limit concurrent parsing operations (prevents resource exhaustion)
MAX_CONCURRENT_PARSES = 3
parse_semaphore = asyncio.Semaphore(MAX_CONCURRENT_PARSES)


router = APIRouter()


# Allowed file types and max size
ALLOWED_TYPES = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "text/plain": ".txt",
    "text/markdown": ".md",
}
# Also allow by extension for files where MIME type detection fails
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".md", ".markdown"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def validate_filename(filename: str, request_id: str) -> None:
    """Validate filename to prevent path traversal and ensure safety."""
    if not filename:
        raise HTTPException(
            status_code=400,
            detail="Filename is required",
        )
    
    # Check for path traversal attempts
    if ".." in filename or "/" in filename or "\\" in filename:
        logger.warning("[Upload] Path traversal attempt detected", {
            "request_id": request_id,
            "filename": filename,
        })
        raise HTTPException(
            status_code=400,
            detail="Invalid filename: path traversal detected",
        )
    
    # Check for null bytes
    if "\x00" in filename:
        logger.warning("[Upload] Null byte in filename", {
            "request_id": request_id,
            "filename": filename,
        })
        raise HTTPException(
            status_code=400,
            detail="Invalid filename: null byte detected",
        )
    
    # Check length (max 255 characters)
    if len(filename) > 255:
        logger.warning("[Upload] Filename too long", {
            "request_id": request_id,
            "filename_length": len(filename),
        })
        raise HTTPException(
            status_code=400,
            detail="Invalid filename: too long (max 255 characters)",
        )
    
    # Check for control characters
    if any(ord(c) < 32 for c in filename):
        logger.warning("[Upload] Control characters in filename", {
            "request_id": request_id,
            "filename": filename,
        })
        raise HTTPException(
            status_code=400,
            detail="Invalid filename: control characters detected",
        )
    
    # Check for safe characters (alphanumeric, spaces, dots, dashes, underscores)
    safe_chars = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ._-()")
    if not all(c in safe_chars for c in filename.rsplit(".", 1)[0]):
        logger.warning("[Upload] Unsafe characters in filename", {
            "request_id": request_id,
            "filename": filename,
        })
        raise HTTPException(
            status_code=400,
            detail="Invalid filename: unsafe characters detected",
        )


def validate_file(file: UploadFile, request_id: str) -> None:
    """Validate file type and filename."""
    filename = file.filename or ""
    
    # Validate filename first
    validate_filename(filename, request_id)
    
    extension = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    
    # Check by content type first
    content_type_valid = file.content_type in ALLOWED_TYPES
    
    # Also check by extension
    extension_valid = extension in ALLOWED_EXTENSIONS
    
    if not content_type_valid and not extension_valid:
        logger.warning("[Upload] Invalid file type", {
            "request_id": request_id,
            "content_type": file.content_type,
            "extension": extension,
            "allowed_types": list(ALLOWED_TYPES.keys()),
            "allowed_extensions": list(ALLOWED_EXTENSIONS),
        })
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{extension}' (MIME: {file.content_type}). Allowed: PDF, DOCX, TXT, MD",
        )


@router.post("/upload/resume")
@limiter.limit("10/minute")
async def upload_resume(
    request: Request,
    file: UploadFile = File(...),
    file_type: Optional[str] = Form(default="resume"),
    user_id: str = Depends(verify_auth_token),
) -> JSONResponse:
    """
    Upload and parse a resume file.
    
    Accepts PDF, DOCX, TXT, and MD files up to 10MB.
    Returns structured resume data including experiences, education, skills, and projects.
    
    Args:
        file: The uploaded file
        file_type: "resume" or "cover-letter"
    """
    request_id = get_request_id()
    start_time = time.time()
    
    logger.start_operation("upload_resume", {
        "request_id": request_id,
        "user_id": user_id,
        "filename": file.filename,
        "content_type": file.content_type,
        "file_type": file_type,
    })
    
    try:
        # Validate file type
        validate_file(file, request_id)
        
        # Use semaphore to limit concurrent parsing operations
        async with parse_semaphore:
            # Validate file size BEFORE reading into memory
            actual_size = getattr(file, "size", None)
            if actual_size is not None and actual_size > MAX_FILE_SIZE:
                logger.warning("[Upload] File too large (pre-check)", {
                    "request_id": request_id,
                    "size_bytes": actual_size,
                    "max_bytes": MAX_FILE_SIZE,
                })
                raise HTTPException(
                    status_code=400,
                    detail=f"File too large ({actual_size // 1024 // 1024}MB). Maximum size is {MAX_FILE_SIZE // 1024 // 1024}MB",
                )

            # Stream file to temporary file instead of reading all into memory
            # This prevents OOM for large files and allows memory-efficient processing
            temp_file = None
            temp_path = None  # Initialize for finally block
            try:
                # Create a temporary file
                with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename or "upload").suffix) as temp_file:
                    temp_path = temp_file.name
                    file_size = 0
                    chunk_size = 8192  # 8KB chunks
                    
                    logger.info("[Upload] Starting file stream to temp file", {
                        "request_id": request_id,
                        "filename": file.filename,
                    })
                    
                    # Stream file content in chunks
                    while True:
                        chunk = await file.read(chunk_size)
                        if not chunk:
                            break
                        file_size += len(chunk)
                        
                        # Check size limit while streaming
                        if file_size > MAX_FILE_SIZE:
                            logger.warning("[Upload] File too large (during stream)", {
                                "request_id": request_id,
                                "size_bytes": file_size,
                                "max_bytes": MAX_FILE_SIZE,
                            })
                            raise HTTPException(
                                status_code=400,
                                detail=f"File too large ({file_size // 1024 // 1024}MB). Maximum size is {MAX_FILE_SIZE // 1024 // 1024}MB",
                            )
                        
                        temp_file.write(chunk)
                
                logger.info("[Upload] File streamed successfully", {
                    "request_id": request_id,
                    "filename": file.filename,
                    "size_bytes": file_size,
                    "temp_path": temp_path,
                })
                
                if file_size == 0:
                    logger.warning("[Upload] Empty file", {"request_id": request_id})
                    raise HTTPException(
                        status_code=400,
                        detail="File is empty",
                    )
                
                # Parse the file from temp path
                logger.info("[Upload] Starting file parsing", {
                    "request_id": request_id,
                    "filename": file.filename,
                    "file_type": file_type,
                    "temp_path": temp_path,
                })
                
                result = await resume_parser.parse_file(
                    temp_path,
                    file.filename or "unknown",
                    file_type=file_type or "resume",
                    is_file_path=True,  # Indicate that we're passing a file path
                )
                
            finally:
                # Clean up temporary file
                if temp_path and os.path.exists(temp_path):
                    try:
                        os.unlink(temp_path)
                        logger.debug("[Upload] Cleaned up temp file", {
                            "request_id": request_id,
                            "temp_path": temp_path,
                        })
                    except Exception as cleanup_error:
                        logger.warning("[Upload] Failed to clean up temp file", {
                            "request_id": request_id,
                            "temp_path": temp_path,
                            "error": str(cleanup_error),
                        })
        
        duration_ms = (time.time() - start_time) * 1000
        
        if "error" in result:
            logger.warning("[Upload] Parsing returned error", {
                "request_id": request_id,
                "error": result["error"],
                "duration_ms": round(duration_ms, 2),
            })
            return JSONResponse(
                status_code=200,
                content={
                    "success": False,
                    "error": result["error"],
                    "data": result,
                    "request_id": request_id,
                },
            )
        
        logger.end_operation("upload_resume", duration_ms, {
            "request_id": request_id,
            "filename": file.filename,
            "file_type": file_type,
            "experiences_count": len(result.get("experiences", [])),
            "projects_count": len(result.get("projects", [])),
            "skills_count": len(result.get("skills", [])),
            "education_count": len(result.get("education", [])),
            "extraction_method": result.get("extraction_method"),
            "chunks_processed": result.get("chunks_processed", 1),
        })
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "data": result,
                "request_id": request_id,
            },
        )
        
    except HTTPException:
        raise
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        error_traceback = traceback.format_exc()
        
        logger.error("[Upload] Unexpected error", {
            "request_id": request_id,
            "error_type": type(e).__name__,
            "error_message": str(e),
            "traceback": error_traceback,
            "duration_ms": round(duration_ms, 2),
        })
        logger.fail_operation("upload_resume", e, {
            "request_id": request_id,
            "duration_ms": round(duration_ms, 2),
        })
        
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"Failed to process file: {str(e)}",
                "error_type": type(e).__name__,
                "request_id": request_id,
            },
        )


@router.post("/parse-resume")
@limiter.limit("10/minute")
async def parse_resume_alt(
    request: Request,
    file: UploadFile = File(...),
    user_id: str = Depends(verify_auth_token),
) -> JSONResponse:
    """
    Alternative endpoint for resume parsing (for compatibility).
    Same functionality as /upload/resume.
    """
    return await upload_resume(request, file=file, file_type="resume", user_id=user_id)


@router.post("/parse-cover-letter")
@limiter.limit("10/minute")
async def parse_cover_letter(
    request: Request,
    file: UploadFile = File(...),
    user_id: str = Depends(verify_auth_token),
) -> JSONResponse:
    """
    Parse a cover letter file and extract text content.
    
    Accepts PDF, DOCX, TXT, and MD files.
    Returns text content of cover letter.
    """
    return await upload_resume(request, file=file, file_type="cover-letter", user_id=user_id)
