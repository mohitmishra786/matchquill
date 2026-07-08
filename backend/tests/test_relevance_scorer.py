
import pytest
from datetime import datetime
from app.utils.relevance_scorer import RelevanceScorer
from app.models.user import UserProfile, Experience, Project, Education, Skill, Publication

@pytest.fixture
def sample_job_description():
    return """
    Senior Python Developer
    
    We are looking for a software engineer with strong Python skills.
    Required: Django, FastAPI, PostgreSQL.
    Experience with AWS is a plus.
    """

@pytest.fixture
def scorer(sample_job_description):
    return RelevanceScorer(sample_job_description)

@pytest.fixture
def sample_profile():
    return UserProfile(
        id="u1",
        email="test@example.com",
        experiences=[
            Experience(
                id="e1",
                company="Tech Corp",
                title="Senior Python Developer",
                startDate=datetime(2022, 1, 1),
                current=True,
                description="Built APIs using FastAPI and Django.",
                keywords=["Python", "FastAPI", "Django"],
                highlights=["Reduced latency by 50%"]
            ),
            Experience(
                id="e2",
                company="Food Inc",
                title="Chef",
                startDate=datetime(2018, 1, 1),
                endDate=datetime(2020, 1, 1),
                description="Cooked meals.",
                keywords=["Cooking", "Management"]
            )
        ],
        projects=[
            Project(
                id="p1",
                name="E-commerce Site",
                description="A site built with Django and React.",
                technologies=["Django", "React", "PostgreSQL"],
                highlights=["Handled 1k users"]
            )
        ],
        skills=[
            Skill(id="s1", name="Python", category="Language", proficiency="Expert"),
            Skill(id="s2", name="Java", category="Language", proficiency="Intermediate"),
            Skill(id="s3", name="Django", category="Framework")
        ],
        educations=[
            Education(
                id="edu1",
                institution="University of Tech",
                degree="BS",
                field="Computer Science",
                startDate=datetime(2016, 1, 1),
                endDate=datetime(2020, 1, 1)
            )
        ],
        publications=[
            Publication(
                id="pub1",
                title="Modern Python Practices",
                venue="PyCon",
                date=datetime(2023, 1, 1),
                abstract="Best practices for Python development."
            )
        ]
    )

def test_initialization(scorer):
    assert "python" in scorer.jd_tokens
    assert "developer" in scorer.jd_tokens
    # Check stop words are removed
    assert "the" not in scorer.jd_tokens
    assert "are" not in scorer.jd_tokens

def test_extract_job_title(scorer):
    # The heuristic takes the first line
    assert "senior python developer" in scorer.job_title

def test_extract_required_skills(scorer):
    # Should extract from "Required: Django, FastAPI, PostgreSQL"
    assert "django" in scorer.required_skills
    assert "fastapi" in scorer.required_skills
    assert "postgresql" in scorer.required_skills

def test_score_experience(scorer, sample_profile):
    # e1: Senior Python Developer (Match)
    e1 = sample_profile.experiences[0]
    scored_e1 = scorer.score_experience(e1)
    
    # e2: Chef (No Match)
    e2 = sample_profile.experiences[1]
    scored_e2 = scorer.score_experience(e2)
    
    assert scored_e1.score > scored_e2.score
    assert scored_e1.score > 0
    assert "python" in scored_e1.matched_keywords
    assert "django" in scored_e1.matched_keywords

def test_score_project(scorer, sample_profile):
    p1 = sample_profile.projects[0]
    scored_p1 = scorer.score_project(p1)
    
    assert scored_p1.score > 0
    # Should match technologies
    assert "django" in scored_p1.matched_keywords
    assert "postgresql" in scored_p1.matched_keywords

def test_score_skill(scorer, sample_profile):
    # Python (Expert match)
    s1 = sample_profile.skills[0]
    scored_s1 = scorer.score_skill(s1)
    
    # Java (No match in JD text "strong Python skills", but check if it appears?)
    # "Java" is not in sample JD.
    s2 = sample_profile.skills[1]
    scored_s2 = scorer.score_skill(s2)
    
    # Django (Required skill match)
    s3 = sample_profile.skills[2]
    scored_s3 = scorer.score_skill(s3)
    
    assert scored_s1.score > 0
    assert scored_s3.score > 0
    # Java might be 0 if not present
    assert scored_s1.score > scored_s2.score

def test_score_profile(scorer, sample_profile):
    scored_profile = scorer.score_profile(sample_profile)
    
    assert "experiences" in scored_profile
    assert len(scored_profile["experiences"]) == 2
    
    # Check sorting: e1 (Python Dev) should be before e2 (Chef)
    assert scored_profile["experiences"][0].item.id == "e1"
    
    assert "skills" in scored_profile
    # Python and Django should be top skills
    top_skill_ids = [s.item.id for s in scored_profile["skills"]]
    assert "s1" in top_skill_ids[:2] # Python
    assert "s3" in top_skill_ids[:2] # Django

def test_select_top_items(scorer, sample_profile):
    top_items = scorer.select_top_items(sample_profile, max_experiences=1, max_skills=1)
    
    assert len(top_items["experiences"]) == 1
    assert top_items["experiences"][0].id == "e1"
    
    assert len(top_items["skills"]) == 1
    # Either Python or Django depending on exact weights
    assert top_items["skills"][0].name in ["Python", "Django"]

def test_empty_job_description():
    scorer = RelevanceScorer("")
    assert len(scorer.jd_tokens) == 0
    assert scorer.job_title == ""
    assert len(scorer.required_skills) == 0

def test_no_matches(scorer):
    # Profile with totally irrelevant data
    profile = UserProfile(
        id="u2",
        email="irrelevant@example.com",
        experiences=[
            Experience(
                id="e3",
                company="Space Corp",
                title="Astronaut",
                startDate=datetime(2020, 1, 1),
                description="Went to space.",
                keywords=["Space", "Mars"]
            )
        ]
    )

    scored_exp = scorer.score_experience(profile.experiences[0])
    # Might match stop words if not filtered correctly, but with unique words "Space", "Mars" against "Python", "Django"
    # The score should be 0 unless "Space" or "Mars" is in JD.
    assert scored_exp.score == 0.0 or scored_exp.score < 0.1


def test_scorer_caching_same_job_description():
    """Test that identical job descriptions return cached scorer instances."""
    jd1 = "Looking for a Python Developer with Django experience."
    jd2 = "Looking for a Python Developer with Django experience."

    scorer1 = RelevanceScorer(jd1)
    scorer2 = RelevanceScorer(jd2)

    # Should return the same instance due to caching
    assert scorer1 is scorer2

    # Both should have the same cache key
    assert hasattr(scorer1, '_cache_key')
    assert scorer1._cache_key == scorer2._cache_key


def test_scorer_caching_different_job_descriptions():
    """Test that different job descriptions get separate scorer instances."""
    jd1 = "Looking for a Python Developer."
    jd2 = "Looking for a Java Developer."

    scorer1 = RelevanceScorer(jd1)
    scorer2 = RelevanceScorer(jd2)

    # Should be different instances
    assert scorer1 is not scorer2

    # Should have different cache keys
    assert scorer1._cache_key != scorer2._cache_key


def test_scorer_cache_stats():
    """Test cache statistics reporting."""
    # Clear cache first
    RelevanceScorer.clear_cache()

    initial_stats = RelevanceScorer.get_cache_stats()
    assert initial_stats["cached_entries"] == 0
    assert initial_stats["max_size"] == 100

    # Create some scorers
    scorer1 = RelevanceScorer("Python Developer")
    scorer2 = RelevanceScorer("Java Developer")  # noqa: F841
    scorer3 = RelevanceScorer("Python Developer")  # Same as scorer1

    # Check stats
    stats = RelevanceScorer.get_cache_stats()
    assert stats["cached_entries"] == 2  # Only 2 unique job descriptions
    assert len(stats["cache_keys"]) == 2

    # scorer1 and scorer3 should be the same instance
    assert scorer1 is scorer3


def test_scorer_clear_cache():
    """Test clearing the scorer cache."""
    # Create some scorers
    RelevanceScorer("Python Developer")
    RelevanceScorer("Java Developer")
    RelevanceScorer("DevOps Engineer")

    # Cache should have entries
    stats_before = RelevanceScorer.get_cache_stats()
    assert stats_before["cached_entries"] > 0

    # Clear cache
    cleared_count = RelevanceScorer.clear_cache()
    assert cleared_count == stats_before["cached_entries"]

    # Cache should be empty
    stats_after = RelevanceScorer.get_cache_stats()
    assert stats_after["cached_entries"] == 0


def test_scorer_cache_max_size():
    """Test that cache respects maximum size limit."""
    # Clear cache first
    RelevanceScorer.clear_cache()

    # Create scorers up to max size
    for i in range(105):  # Max is 100
        RelevanceScorer(f"Job description number {i}")

    # Cache should not exceed max size
    stats = RelevanceScorer.get_cache_stats()
    assert stats["cached_entries"] <= 100


def test_scorer_cache_case_insensitive():
    """Test that job description caching is case-insensitive."""
    jd1 = "Python Developer"
    jd2 = "python developer"
    jd3 = "PYTHON DEVELOPER"

    scorer1 = RelevanceScorer(jd1)
    scorer2 = RelevanceScorer(jd2)
    scorer3 = RelevanceScorer(jd3)

    # All should return the same cached instance
    assert scorer1 is scorer2
    assert scorer2 is scorer3


def test_scorer_cache_preserves_processing():
    """Test that cached scorers don't re-process job descriptions."""
    jd = "Senior Python Developer with Django and FastAPI experience. Required: PostgreSQL, AWS."

    # First scorer processes the JD
    scorer1 = RelevanceScorer(jd)
    original_tokens = scorer1.jd_tokens.copy()
    original_freq = scorer1.jd_keyword_freq.copy()
    original_skills = scorer1.required_skills.copy()

    # Second scorer should use cached instance
    scorer2 = RelevanceScorer(jd)

    # Verify it's the same instance
    assert scorer1 is scorer2

    # Verify processing results are preserved
    assert scorer2.jd_tokens == original_tokens
    assert scorer2.jd_keyword_freq == original_freq
    assert scorer2.required_skills == original_skills


def test_scorer_empty_jd_not_cached():
    """Test that empty job descriptions are handled correctly (no caching issues)."""
    scorer1 = RelevanceScorer("")
    scorer2 = RelevanceScorer("")

    # Empty JD should still work (may or may not be cached, but shouldn't crash)
    assert scorer1.jd_tokens == []
    assert scorer2.jd_tokens == []