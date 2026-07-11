"""
Cover Letter Models
Pydantic models for cover letter generation requests and responses.
"""

from typing import Optional
from pydantic import BaseModel, Field


class CoverLetterRequest(BaseModel):
    """Request body for cover letter generation endpoint."""
    
    auth_token: Optional[str] = Field(
        default=None,
        description=(
            "DEPRECATED: Prefer Authorization: Bearer <token> header. "
            "Body authToken is accepted for backward compatibility only."
        ),
        alias="authToken",
        deprecated=True,
    )
    job_description: str = Field(
        ...,
        description="Job description text extracted from job posting",
        alias="jobDescription",
        min_length=50,
        max_length=50000,
    )
    tone: Optional[str] = Field(
        default="professional",
        description="Desired tone: professional, enthusiastic, formal"
    )
    max_words: Optional[int] = Field(
        default=400,
        alias="maxWords",
        description="Maximum word count for the cover letter",
        ge=100,
        le=1000,
    )
    
    class Config:
        populate_by_name = True


class CoverLetterResponse(BaseModel):
    """Response from cover letter generation endpoint."""
    
    success: bool
    cover_letter: Optional[str] = Field(
        default=None,
        alias="coverLetter",
        description="Generated cover letter text"
    )
    word_count: Optional[int] = Field(
        default=None,
        alias="wordCount"
    )
    error: Optional[str] = None
    
    # Metadata for transparency
    model_used: Optional[str] = Field(
        default=None,
        alias="modelUsed",
        description="LLM model used for generation"
    )
    profile_fields_used: Optional[list[str]] = Field(
        default=None,
        alias="profileFieldsUsed",
        description="Which profile sections were included in the prompt"
    )
    
    class Config:
        populate_by_name = True
