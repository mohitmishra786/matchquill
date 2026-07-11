"""Tests for score_profile top-k heap optimization and STOP_WORDS immutability."""

from app.utils.relevance_scorer import RelevanceScorer
from app.models.user import UserProfile, Skill


def test_stop_words_is_frozenset() -> None:
    assert isinstance(RelevanceScorer.STOP_WORDS, frozenset)


def test_score_profile_respects_max_skills() -> None:
    skills = [
        Skill(id=str(i), name=name, category="tech")
        for i, name in enumerate(
            ["python", "java", "rust", "go", "sql", "react", "node", "docker", "k8s", "aws"]
        )
    ]
    profile = UserProfile(
        id="u1",
        email="u@example.com",
        name="Test",
        experiences=[],
        projects=[],
        educations=[],
        skills=skills,
        publications=[],
    )
    scorer = RelevanceScorer(
        "We need a senior python and aws engineer with docker experience"
    )
    scored = scorer.score_profile(profile, max_skills=3)
    assert len(scored["skills"]) <= 3
    # Scores should be non-increasing
    scores = [s.score for s in scored["skills"]]
    assert scores == sorted(scores, reverse=True)


def test_select_top_items_limits() -> None:
    skills = [
        Skill(id=str(i), name=n, category="tech")
        for i, n in enumerate(["python", "java", "cobol"])
    ]
    profile = UserProfile(
        id="u1",
        email="u@example.com",
        name="Test",
        experiences=[],
        projects=[],
        educations=[],
        skills=skills,
        publications=[],
    )
    scorer = RelevanceScorer("python developer")
    selected = scorer.select_top_items(profile, max_skills=1)
    assert len(selected["skills"]) == 1
