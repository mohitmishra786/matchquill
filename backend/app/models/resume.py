"""
Resume Models
Pydantic models for resume compilation requests and responses.
"""

from typing import Optional, Literal
from pydantic import BaseModel, Field

from app.models.user import Experience, Project, Education, Skill, Publication


# Template types available
TemplateType = Literal[
    "experience-skills-projects",
    "education-research-skills",
    "projects-skills-experience",
    "compact-technical",
]


class ResumeRequest(BaseModel):
    """Request body for resume compilation endpoint."""
    
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
    template: Optional[TemplateType] = Field(
        default=None,
        description="Template to use. If not provided, uses user's saved preference.",
    )
    ats_type: Optional[str] = Field(
        default=None,
        alias="atsType",
        description=(
            "Job board / ATS identifier the description was extracted from "
            "(e.g. 'greenhouse', 'ashby', 'linkedin'). Optional metadata sent "
            "by the browser extension; not used in compilation logic."
        ),
    )

    class Config:
        populate_by_name = True


class ResumeSection(BaseModel):
    """A section in the compiled resume."""
    
    title: str
    items: list[dict]  # Generic items (experiences, skills, etc.)
    order: int


class CompiledResume(BaseModel):
    """
    The compiled resume structure before PDF generation.
    Contains only the selected, relevant items.
    """
    
    # Header info
    name: str
    email: str
    
    # Selected sections with ranked items
    experiences: list[Experience] = Field(default_factory=list)
    projects: list[Project] = Field(default_factory=list)
    educations: list[Education] = Field(default_factory=list)
    skills: list[Skill] = Field(default_factory=list)
    publications: list[Publication] = Field(default_factory=list)
    
    # Template used
    template: TemplateType
    
    # Metadata
    job_title: Optional[str] = Field(default=None, alias="jobTitle")
    company_name: Optional[str] = Field(default=None, alias="companyName")
    relevance_summary: Optional[str] = Field(
        default=None,
        alias="relevanceSummary",
        description="Brief summary of how profile matches job"
    )
    
    class Config:
        populate_by_name = True


class ResumeResponse(BaseModel):
    """Response from resume compilation endpoint."""
    
    success: bool
    pdf_base64: Optional[str] = Field(
        default=None,
        alias="pdfBase64",
        description="Base64 encoded PDF file"
    )
    resume_json: Optional[CompiledResume] = Field(
        default=None,
        alias="resumeJson",
        description="Structured resume data (for preview/debugging)"
    )
    error: Optional[str] = None
    
    class Config:
        populate_by_name = True
