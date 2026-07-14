"""
Relevance Scoring Algorithm
Matches job descriptions to user profile items.
"""

import re
from collections import Counter
from dataclasses import dataclass
import heapq
from typing import TypeVar, Generic, Optional, Callable, List, Any

from app.config import get_settings
from app.models.user import (
    UserProfile,
    Experience,
    Project,
    Education,
    Skill,
    Publication,
)
# Importing this module is always safe/cheap: the heavy sentence-transformer
# dependency is only imported lazily, inside EmbeddingService, on first use
# (and only if the `semantic_matching` feature flag is enabled).
from app.utils.embedding_service import EmbeddingService, cosine_similarity


T = TypeVar("T", Experience, Project, Education, Skill, Publication)


@dataclass
class ScoredItem(Generic[T]):
    """An item with its computed relevance score."""
    item: T
    score: float
    matched_keywords: list[str]
    # Semantic (embedding) similarity contribution, 0.0 when the semantic
    # backend is disabled/unavailable. Exposed for transparency/debugging;
    # `score` already includes this as an additive term.
    semantic_similarity: float = 0.0


class RelevanceScorer:
    """
    Scores profile items based on relevance to a job description.
    Uses keyword matching with TF-IDF-like weighting.
    Implements caching to avoid re-processing identical job descriptions.
    """
    
    # Common words to ignore in matching
    STOP_WORDS = frozenset({
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
        "be", "have", "has", "had", "do", "does", "did", "will", "would",
        "could", "should", "may", "might", "must", "shall", "can", "need",
        "we", "you", "they", "he", "she", "it", "i", "me", "my", "our",
        "your", "their", "this", "that", "these", "those", "what", "which",
        "who", "whom", "when", "where", "why", "how", "all", "each", "every",
        "both", "few", "more", "most", "other", "some", "such", "no", "not",
        "only", "own", "same", "so", "than", "too", "very", "just", "also",
        "about", "into", "through", "during", "before", "after", "above",
        "below", "between", "under", "again", "further", "then", "once",
    })
    
    # Boost factors for recent items and specific matches
    RECENCY_BOOST = 1.2  # Boost for items in last 2 years
    TITLE_MATCH_BOOST = 2.0  # Boost when job title matches
    SKILL_EXACT_MATCH_BOOST = 1.5  # Boost for exact skill matches

    # Max additive bonus contributed by embedding-based semantic similarity
    # (cosine similarity in [0, 1] times this weight). Additive, applied after
    # keyword-density normalization, so it rewards paraphrased/semantically
    # equivalent content that the keyword pass alone would score near zero --
    # without ever letting semantics override a strong keyword match.
    SEMANTIC_SIMILARITY_WEIGHT = 6.0

    # Class-level cache for processed job descriptions
    _cache: dict = {}
    _cache_max_size: int = 100  # Maximum cached job descriptions

    # Class-level cache for computed text embeddings (JD + profile item text
    # blobs), MD5-keyed and LRU(FIFO)-bounded exactly like `_cache` above.
    # Shared across all RelevanceScorer instances/JDs so a profile item's
    # embedding is computed once no matter how many JDs it gets scored against.
    _embedding_cache: dict = {}
    _embedding_cache_max_size: int = 2000
    
    def __new__(cls, job_description: str):
        """
        Implement caching to return cached instances for identical job descriptions.
        This avoids re-processing the same job description multiple times.
        """
        if not job_description:
            return super().__new__(cls)
        
        # Create a cache key from the job description
        import hashlib
        cache_key = hashlib.md5(job_description.lower().encode(), usedforsecurity=False).hexdigest()
        
        # Return cached instance if available
        if cache_key in cls._cache:
            return cls._cache[cache_key]
        
        # Create new instance
        instance = super().__new__(cls)
        
        # Cache the instance (with simple LRU eviction)
        if len(cls._cache) >= cls._cache_max_size:
            # Remove oldest entry (simple FIFO)
            oldest_key = next(iter(cls._cache))
            del cls._cache[oldest_key]
        
        cls._cache[cache_key] = instance
        instance._cache_key = cache_key
        return instance
    
    def __init__(self, job_description: str):
        """
        Initialize scorer with a job description.
        Uses caching to avoid re-processing identical descriptions.
        
        Args:
            job_description: Full job posting text
        """
        # Skip initialization if already initialized (cached instance)
        if hasattr(self, '_initialized'):
            return
        
        self.job_description = job_description.lower()
        self.jd_tokens = self._tokenize(job_description)
        self.jd_keyword_freq = Counter(self.jd_tokens)

        # Extract potential job title and company (heuristic)
        self.job_title = self._extract_job_title(job_description)
        self.required_skills = self._extract_required_skills(job_description)

        # Semantic matching is opt-in via the FEATURE_FLAGS env var
        # (`semantic_matching`) so that the default keyword-only behavior --
        # and the existing test suite -- are completely unaffected unless an
        # operator explicitly turns it on. When enabled, the JD embedding is
        # computed once (cached) and reused for every item scored against it.
        settings = get_settings()
        self.semantic_enabled = settings.is_feature_enabled("semantic_matching")
        self.jd_embedding = (
            self._get_cached_embedding(job_description) if self.semantic_enabled else None
        )

        self._initialized = True

    @classmethod
    def clear_cache(cls) -> int:
        """Clear the job description cache. Returns number of entries cleared."""
        count = len(cls._cache)
        cls._cache.clear()
        return count

    @classmethod
    def get_cache_stats(cls) -> dict:
        """Get cache statistics."""
        return {
            "cached_entries": len(cls._cache),
            "max_size": cls._cache_max_size,
            "cache_keys": list(cls._cache.keys()),
        }

    @classmethod
    def _get_cached_embedding(cls, text: str) -> Optional[list]:
        """
        Return a cached embedding for `text`, computing and caching it on
        miss. MD5-keyed and FIFO-bounded, mirroring the `_cache` pattern used
        for job description instances above. Returns None (no crash) if the
        embedding backend is unavailable.
        """
        if not text or not text.strip():
            return None

        import hashlib
        cache_key = hashlib.md5(text.strip().lower().encode(), usedforsecurity=False).hexdigest()

        if cache_key in cls._embedding_cache:
            return cls._embedding_cache[cache_key]

        vector = EmbeddingService.embed(text)
        if vector is None:
            return None

        if len(cls._embedding_cache) >= cls._embedding_cache_max_size:
            oldest_key = next(iter(cls._embedding_cache))
            del cls._embedding_cache[oldest_key]

        cls._embedding_cache[cache_key] = vector
        return vector

    @classmethod
    def clear_embedding_cache(cls) -> int:
        """Clear the embedding cache. Returns number of entries cleared."""
        count = len(cls._embedding_cache)
        cls._embedding_cache.clear()
        return count

    def _semantic_similarity(self, text_blob: str) -> float:
        """
        Raw cosine similarity in [0, 1] between `text_blob` and this scorer's
        job description embedding. Returns 0.0 (never raises) when semantic
        matching is disabled, the embedding backend is unavailable, or either
        text fails to embed -- the keyword score is always usable on its own.
        """
        if not self.semantic_enabled or self.jd_embedding is None:
            return 0.0

        item_embedding = self._get_cached_embedding(text_blob)
        if item_embedding is None:
            return 0.0

        return cosine_similarity(self.jd_embedding, item_embedding)

    def _tokenize(self, text: str) -> list[str]:
        """
        Tokenize text into meaningful keywords.
        Removes stop words and normalizes.
        """
        # Remove special characters, keep alphanumeric and spaces
        text = re.sub(r"[^\w\s+#.]", " ", text.lower())
        
        # Filter stop words and short tokens
        tokens = []
        for t in text.split():
            # Handle trailing punctuation that might have been preserved (like dots)
            # but preserve things like .net or node.js
            # Simple heuristic: if it ends with dot and is not a known acronym, strip it
            if t.endswith(".") and t != ".net" and len(t) > 1:
                 t = t.rstrip(".")
            
            if (t not in self.STOP_WORDS
                and len(t) > 1
                and not t.isdigit()):
                tokens.append(t)
        
        return tokens
    
    def _extract_job_title(self, jd: str) -> str:
        """
        Heuristically extract job title from description.
        Usually appears in first line or after specific patterns.
        """
        lines = jd.strip().split("\n")
        if lines:
            # First non-empty line is often the title
            first_line = lines[0].strip()
            if len(first_line) < 100:  # Reasonable title length
                return first_line.lower()
        return ""
    
    def _extract_required_skills(self, jd: str) -> set[str]:
        """
        Extract explicitly required skills from job description.
        Looks for patterns like "Required:", "Must have:", etc.
        """
        skills = set()
        
        # Common skill indicators
        skill_patterns = [
            r"(?:required|must have|essential|mandatory)[:\s]+([^.]+)",
            r"(?:skills?|requirements?|qualifications?)[:\s]+([^.]+)",
            r"(?:experience with|proficiency in|knowledge of)[:\s]+([^.]+)",
        ]
        
        for pattern in skill_patterns:
            matches = re.findall(pattern, jd.lower())
            for match in matches:
                # Tokenize the matched text
                tokens = self._tokenize(match)
                skills.update(tokens)
        
        return skills
    
    def score_experience(self, exp: Experience) -> ScoredItem[Experience]:
        """Score a work experience entry."""
        score = 0.0
        matched = []
        
        # Create text blob from experience
        text_blob = " ".join([
            exp.title,
            exp.company,
            exp.description,
            " ".join(exp.highlights),
            " ".join(exp.keywords),
        ])
        
        exp_tokens = set(self._tokenize(text_blob))
        
        # Calculate keyword overlap
        for token in exp_tokens:
            if token in self.jd_keyword_freq:
                # Weight by frequency in JD
                token_score = self.jd_keyword_freq[token]
                score += token_score
                matched.append(token)
        
        # Boost for title match
        if self.job_title:
            title_tokens = set(self._tokenize(exp.title))
            jd_title_tokens = set(self._tokenize(self.job_title))
            if title_tokens & jd_title_tokens:
                score *= self.TITLE_MATCH_BOOST
        
        # Boost for current/recent positions
        if exp.current:
            score *= self.RECENCY_BOOST
        
        # Normalize by number of keywords to avoid favoring longer descriptions
        if len(exp_tokens) > 0:
            score = score / (len(exp_tokens) ** 0.5)  # Square root normalization

        # Semantic similarity bonus: catches paraphrased/semantically-equivalent
        # experience (e.g. "led cross-functional teams" vs a JD asking for
        # "project management") that shares no keywords with the JD. No-op
        # unless the `semantic_matching` feature flag is enabled.
        semantic_similarity = self._semantic_similarity(text_blob)
        score += semantic_similarity * self.SEMANTIC_SIMILARITY_WEIGHT

        # Store score in the item
        exp.relevance_score = score

        return ScoredItem(
            item=exp, score=score, matched_keywords=matched, semantic_similarity=semantic_similarity
        )
    
    def score_project(self, proj: Project) -> ScoredItem[Project]:
        """Score a project entry."""
        score = 0.0
        matched = []
        
        text_blob = " ".join([
            proj.name,
            proj.description,
            " ".join(proj.technologies),
            " ".join(proj.highlights),
        ])
        
        proj_tokens = set(self._tokenize(text_blob))
        
        for token in proj_tokens:
            if token in self.jd_keyword_freq:
                score += self.jd_keyword_freq[token]
                matched.append(token)
        
        # Technology matches are valuable
        tech_tokens = set(t.lower() for t in proj.technologies)
        tech_matches = tech_tokens & set(self.jd_keyword_freq.keys())
        score += len(tech_matches) * 2  # Extra weight for tech matches
        
        if len(proj_tokens) > 0:
            score = score / (len(proj_tokens) ** 0.5)

        semantic_similarity = self._semantic_similarity(text_blob)
        score += semantic_similarity * self.SEMANTIC_SIMILARITY_WEIGHT

        proj.relevance_score = score
        return ScoredItem(
            item=proj, score=score, matched_keywords=matched, semantic_similarity=semantic_similarity
        )
    
    def score_skill(self, skill: Skill) -> ScoredItem[Skill]:
        """Score a skill entry."""
        score = 0.0
        matched = []
        
        skill_name_lower = skill.name.lower()
        
        # Check for exact or partial match
        if skill_name_lower in self.jd_keyword_freq:
            score = self.jd_keyword_freq[skill_name_lower] * self.SKILL_EXACT_MATCH_BOOST
            matched.append(skill_name_lower)
        elif skill_name_lower in self.job_description:
            # Substring match
            score = 2.0
            matched.append(skill_name_lower)
        
        # Check if skill is in required skills
        if skill_name_lower in self.required_skills:
            score *= 1.5
        
        # Boost by proficiency
        if skill.proficiency and skill.proficiency.lower() == "expert":
            score *= 1.2

        # Semantic bonus catches skills phrased differently than the JD's
        # wording (e.g. skill "Stakeholder Management" vs JD phrase
        # "coordinate priorities across teams").
        semantic_similarity = self._semantic_similarity(skill_name_lower)
        score += semantic_similarity * self.SEMANTIC_SIMILARITY_WEIGHT

        skill.relevance_score = score
        return ScoredItem(
            item=skill, score=score, matched_keywords=matched, semantic_similarity=semantic_similarity
        )
    
    def score_education(self, edu: Education) -> ScoredItem[Education]:
        """Score an education entry."""
        score = 0.0
        matched = []
        
        text_blob = " ".join([
            edu.institution,
            edu.degree,
            edu.field,
            " ".join(edu.honors),
        ])
        
        edu_tokens = set(self._tokenize(text_blob))
        
        for token in edu_tokens:
            if token in self.jd_keyword_freq:
                score += self.jd_keyword_freq[token]
                matched.append(token)
        
        semantic_similarity = self._semantic_similarity(text_blob)
        score += semantic_similarity * self.SEMANTIC_SIMILARITY_WEIGHT

        edu.relevance_score = score
        return ScoredItem(
            item=edu, score=score, matched_keywords=matched, semantic_similarity=semantic_similarity
        )
    
    def score_publication(self, pub: Publication) -> ScoredItem[Publication]:
        """Score a publication entry."""
        score = 0.0
        matched = []
        
        text_blob = " ".join([
            pub.title,
            pub.venue,
            pub.abstract or "",
        ])
        
        pub_tokens = set(self._tokenize(text_blob))
        
        for token in pub_tokens:
            if token in self.jd_keyword_freq:
                score += self.jd_keyword_freq[token]
                matched.append(token)
        
        semantic_similarity = self._semantic_similarity(text_blob)
        score += semantic_similarity * self.SEMANTIC_SIMILARITY_WEIGHT

        pub.relevance_score = score
        return ScoredItem(
            item=pub, score=score, matched_keywords=matched, semantic_similarity=semantic_similarity
        )
    
    def _top_scored(
        self,
        items: list,
        scorer: Callable[[Any], ScoredItem],
        k: Optional[int] = None,
    ) -> List[ScoredItem]:
        """
        Score items and return top-k by score using heapq.nlargest (O(n log k)).
        When k is None, return all items sorted by score descending.
        """
        scored = [scorer(item) for item in items]
        if not scored:
            return []
        if k is None or k >= len(scored):
            return sorted(scored, key=lambda x: x.score, reverse=True)
        return heapq.nlargest(k, scored, key=lambda x: x.score)

    def score_profile(
        self,
        profile: UserProfile,
        *,
        max_experiences: Optional[int] = None,
        max_projects: Optional[int] = None,
        max_skills: Optional[int] = None,
        max_education: Optional[int] = None,
        max_publications: Optional[int] = None,
    ) -> dict[str, list]:
        """
        Score all items in a user profile.

        When max_* limits are provided, uses heapq.nlargest for O(n log k)
        instead of full O(n log n) sorts (only top-k needed).

        Returns:
            Dict with scored items sorted by relevance for each category.
        """
        return {
            "experiences": self._top_scored(
                profile.experiences, self.score_experience, max_experiences
            ),
            "projects": self._top_scored(
                profile.projects, self.score_project, max_projects
            ),
            "skills": self._top_scored(
                profile.skills, self.score_skill, max_skills
            ),
            "educations": self._top_scored(
                profile.educations, self.score_education, max_education
            ),
            "publications": self._top_scored(
                profile.publications, self.score_publication, max_publications
            ),
        }
    
    def select_top_items(
        self,
        profile: UserProfile,
        max_experiences: int = 3,
        max_projects: int = 2,
        max_skills: int = 10,
        max_education: int = 2,
        max_publications: int = 2,
    ) -> dict[str, list]:
        """
        Select top N relevant items from each category.
        
        Args:
            profile: User profile to select from
            max_*: Maximum items per category
        
        Returns:
            Dict with selected items for each category
        """
        # Score only top-k per category (O(n log k) via heapq.nlargest)
        scored = self.score_profile(
            profile,
            max_experiences=max_experiences,
            max_projects=max_projects,
            max_skills=max_skills,
            max_education=max_education,
            max_publications=max_publications,
        )
        
        return {
            "experiences": [s.item for s in scored["experiences"]],
            "projects": [s.item for s in scored["projects"]],
            "skills": [s.item for s in scored["skills"]],
            "educations": [s.item for s in scored["educations"]],
            "publications": [s.item for s in scored["publications"]],
        }
