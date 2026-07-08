"""
Groq LLM Client
Wrapper for the Groq API for generating cover letters.
"""

import time
import json
from typing import Optional, List, Dict, Any
from groq import AsyncGroq

from app.config import get_settings
from app.utils.logger import logger, get_request_id, log_llm_request
from app.utils.request_deduplicator import get_deduplicator


class GroqClient:
    """
    Client for interacting with Groq's LLM API.
    Uses the OpenAI-compatible chat completions endpoint.
    """
    
    def __init__(self):
        """Initialize Groq client."""
        settings = get_settings()
        self.client = AsyncGroq(api_key=settings.groq_api_key)
        self.model = settings.groq_model
        logger.info("GroqClient initialized", {
            "model": self.model,
            "api_key_configured": bool(settings.groq_api_key),
        })
    
    async def generate_cover_letter(
        self,
        candidate_info: str,
        job_description: str,
        tone: str = "professional",
        max_words: int = 400,
    ) -> tuple[str, str]:
        """
        Generate a cover letter using Groq's LLM.
        Uses request deduplication to prevent duplicate API calls.
        """
        deduplicator = get_deduplicator()
        
        # Use deduplication to prevent duplicate API calls
        return await deduplicator.execute(
            "cover_letter",
            self._generate_cover_letter_internal,
            candidate_info,
            job_description,
            tone,
            max_words,
        )
    
    async def _generate_cover_letter_internal(
        self,
        candidate_info: str,
        job_description: str,
        tone: str,
        max_words: int,
    ) -> tuple[str, str]:
        """Internal method for actual cover letter generation."""
        request_id = get_request_id()
        start_time = time.time()
        
        logger.start_operation("GroqClient.generate_cover_letter", {
            "request_id": request_id,
            "model": self.model,
            "tone": tone,
            "max_words": max_words,
            "candidate_info_length": len(candidate_info),
            "job_description_length": len(job_description),
        })
        
        try:
            system_prompt = self._build_system_prompt(tone, max_words)
            user_prompt = self._build_user_prompt(candidate_info, job_description)
            
            total_prompt_length = len(system_prompt) + len(user_prompt)
            logger.debug("Prompts built", {
                "request_id": request_id,
                "system_prompt_length": len(system_prompt),
                "user_prompt_length": len(user_prompt),
                "total_length": total_prompt_length,
            })
            
            logger.info("Calling Groq API", {
                "request_id": request_id,
                "model": self.model,
                "estimated_tokens": total_prompt_length // 4,
            })
            
            api_start = time.time()
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.7,
                max_tokens=1500,
                top_p=0.95,
            )
            api_duration = (time.time() - api_start) * 1000
            
            generated_text = (response.choices[0].message.content or "").strip()
            total_duration = (time.time() - start_time) * 1000
            
            # Log LLM usage
            usage = response.usage if hasattr(response, 'usage') else None
            tokens_in = usage.prompt_tokens if usage else total_prompt_length // 4
            tokens_out = usage.completion_tokens if usage else len(generated_text) // 4
            
            log_llm_request(
                model=self.model,
                operation="generate_cover_letter",
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                duration_ms=api_duration,
            )
            
            logger.end_operation("GroqClient.generate_cover_letter", total_duration, {
                "request_id": request_id,
                "model": self.model,
                "tokens_in": tokens_in,
                "tokens_out": tokens_out,
                "api_duration_ms": round(api_duration, 2),
                "generated_length": len(generated_text),
                "word_count": len(generated_text.split()),
            })
            
            return generated_text, self.model
            
        except Exception as e:
            total_duration = (time.time() - start_time) * 1000
            logger.fail_operation("GroqClient.generate_cover_letter", e, {
                "request_id": request_id,
                "model": self.model,
                "duration_ms": total_duration,
            })
            raise

    async def enhance_bullet(self, bullet: str, job_description: Optional[str] = None) -> str:
        """Rewrite a resume bullet point to be more impactful. Uses request deduplication."""
        deduplicator = get_deduplicator()
        return await deduplicator.execute(
            "enhance_bullet",
            self._enhance_bullet_internal,
            bullet,
            job_description,
        )
    
    async def _enhance_bullet_internal(self, bullet: str, job_description: Optional[str] = None) -> str:
        """Internal method for bullet enhancement."""
        request_id = get_request_id()
        
        system_prompt = "You are an expert resume writer. Rewrite the user's bullet point to be more impactful, outcome-oriented, and professional. Use strong action verbs. Keep it concise (one sentence)."
        if job_description:
            system_prompt += f" Tailor it slightly to match this job description if relevant: {job_description}"
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": bullet},
                ],
                temperature=0.5,
                max_tokens=150,
            )
            return (response.choices[0].message.content or "").strip()
        except Exception as e:
            logger.error(f"Groq enhance_bullet error: {str(e)}", {"request_id": request_id})
            return bullet

    async def generate_interview_prep(self, candidate_info: str, job_description: Optional[str] = None) -> List[Dict[str, Any]]:
        """Generate interview questions and suggested answers. Uses request deduplication."""
        deduplicator = get_deduplicator()
        return await deduplicator.execute(
            "interview_prep",
            self._generate_interview_prep_internal,
            candidate_info,
            job_description,
        )
    
    async def _generate_interview_prep_internal(self, candidate_info: str, job_description: Optional[str] = None) -> List[Dict[str, Any]]:
        """Internal method for interview prep generation."""
        request_id = get_request_id()
        
        system_prompt = """You are an expert interviewer. Based on the candidate's profile and the job description, generate 5 relevant interview questions.
For each question, provide a suggested answer and 3 key points the candidate should emphasize.
Return the result as a JSON array of objects with keys: "question", "suggested_answer", "key_points" (list of strings)."""

        user_content = f"CANDIDATE INFO:\n{candidate_info}"
        if job_description:
            user_content += f"\n\nJOB DESCRIPTION:\n{job_description}"

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                temperature=0.7,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content or "{}"
            data = json.loads(content)
            # Expecting {"questions": [...]}
            return data.get("questions", [])
        except Exception as e:
            logger.error(f"Groq generate_interview_prep error: {str(e)}", {"request_id": request_id})
            return []

    async def suggest_skills(self, experience_text: str) -> List[str]:
        """Suggest skills based on work experience description. Uses request deduplication."""
        deduplicator = get_deduplicator()
        return await deduplicator.execute(
            "suggest_skills",
            self._suggest_skills_internal,
            experience_text,
        )
    
    async def _suggest_skills_internal(self, experience_text: str) -> List[str]:
        """Internal method for skill suggestions."""
        request_id = get_request_id()
        
        system_prompt = """You are a career expert. Analyze the provided work experience and extract/infer relevant technical and soft skills.
Return the result as a JSON object with a key "skills" containing a list of strings. Limit to top 15 most relevant skills."""
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"EXPERIENCE:\n{experience_text}"},
                ],
                temperature=0.5,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content or "{}"
            data = json.loads(content)
            return data.get("skills", [])
        except Exception as e:
            logger.error(f"Groq suggest_skills error: {str(e)}", {"request_id": request_id})
            return []
    
    def _build_system_prompt(self, tone: str, max_words: int) -> str:
        """Build system prompt for cover letter generation."""
        tone_descriptions = {
            "professional": "professional, confident, and polished",
            "enthusiastic": "enthusiastic, energetic, and passionate",
            "formal": "formal, respectful, and traditional",
        }
        
        tone_desc = tone_descriptions.get(tone, tone_descriptions["professional"])
        
        return f"""You are an expert career coach and professional resume writer.
Your task is to write compelling, ATS-friendly cover letters that:

1. STRICTLY use ONLY the information provided about the candidate
2. DO NOT invent, assume, or hallucinate any facts not in the provided data
3. Match the candidate's actual experience to the job requirements
4. Use a {tone_desc} tone
5. Follow standard cover letter structure:
   - Opening paragraph: Express interest and mention specific role
   - Body paragraphs: Connect relevant experience to job requirements
   - Closing paragraph: Call to action and gratitude
6. Keep the letter under {max_words} words
7. Be ATS-friendly: avoid tables, images, or unusual formatting
8. Use specific examples from the candidate's background
9. If a skill or experience is not in the candidate data, DO NOT mention it

IMPORTANT: You must only include facts that are explicitly stated in the candidate information.
Never add qualifications, experiences, or skills that are not provided."""
    
    def _build_user_prompt(self, candidate_info: str, job_description: str) -> str:
        """Build user prompt with candidate info and job description."""
        return f"""Please write a cover letter for this candidate applying to the position described below.

## CANDIDATE INFORMATION (use ONLY this data):
{candidate_info}

## JOB DESCRIPTION:
{job_description}

## INSTRUCTIONS:
Write a compelling cover letter that:
- Connects the candidate's ACTUAL experience to this specific role
- Uses concrete examples from their background
- Shows enthusiasm for the opportunity
- Avoids generic phrases
- NEVER includes information not in the candidate data above

Write the cover letter now:"""
    
    def format_candidate_info(
        self,
        name: str,
        email: str,
        experiences: list,
        projects: list,
        skills: list,
        educations: list,
    ) -> str:
        """
        Format candidate information for the LLM prompt.
        """
        request_id = get_request_id()
        logger.debug("Formatting candidate info", {
            "request_id": request_id,
            "name": name,
            "experiences_count": len(experiences),
            "projects_count": len(projects),
            "skills_count": len(skills),
            "educations_count": len(educations),
        })
        
        lines = [
            f"Name: {name}",
            f"Email: {email}",
            "",
            "### WORK EXPERIENCE:",
        ]
        
        for exp in experiences:
            lines.append(f"- {exp.title} at {exp.company}")
            if exp.location:
                lines.append(f"  Location: {exp.location}")
            lines.append(f"  Duration: {exp.start_date.strftime('%b %Y')} - {'Present' if exp.current else exp.end_date.strftime('%b %Y') if exp.end_date else 'N/A'}")
            if exp.highlights:
                for highlight in exp.highlights[:3]:
                    lines.append(f"  • {highlight}")
            lines.append("")
        
        if projects:
            lines.append("### PROJECTS:")
            for proj in projects:
                lines.append(f"- {proj.name}")
                if proj.technologies:
                    lines.append(f"  Technologies: {', '.join(proj.technologies)}")
                if proj.highlights:
                    for highlight in proj.highlights[:2]:
                        lines.append(f"  • {highlight}")
                lines.append("")
        
        if skills:
            lines.append("### SKILLS:")
            skills_by_category = {}
            for skill in skills:
                if skill.category not in skills_by_category:
                    skills_by_category[skill.category] = []
                skills_by_category[skill.category].append(skill.name)
            
            for category, skill_names in skills_by_category.items():
                lines.append(f"- {category}: {', '.join(skill_names)}")
            lines.append("")
        
        if educations:
            lines.append("### EDUCATION:")
            for edu in educations:
                lines.append(f"- {edu.degree} in {edu.field}")
                lines.append(f"  {edu.institution}, {edu.start_date.year} - {edu.end_date.year if edu.end_date else 'Present'}")
                if edu.gpa:
                    lines.append(f"  GPA: {edu.gpa:.2f}")
                if edu.honors:
                    lines.append(f"  Honors: {', '.join(edu.honors)}")
                lines.append("")
        
        formatted = "\n".join(lines)
        logger.debug("Candidate info formatted", {
            "request_id": request_id,
            "total_length": len(formatted),
            "line_count": len(lines),
        })
        
        return formatted
