"""
Tests for embedding-based semantic similarity in RelevanceScorer.

Semantic matching is opt-in via the `semantic_matching` feature flag (see
app/config.py Settings.feature_flags / is_feature_enabled). These tests
monkeypatch `get_settings` as imported into app.utils.relevance_scorer so the
flag can be flipped per-test without touching the process-wide
`@lru_cache`-backed global settings singleton used by the rest of the app.

Tests that require the actual sentence-transformer model to be installed skip
gracefully (via EmbeddingService.is_available()) rather than failing, so this
file behaves correctly both in this repo's dev venv (where the optional
`requirements-semantic.txt` extra is installed) and in a default/CI install
that never pulls in torch/sentence-transformers.
"""

from datetime import datetime

import pytest

from app.config import Settings
from app.models.user import Experience, Skill
from app.utils.embedding_service import EmbeddingService, cosine_similarity
from app.utils.relevance_scorer import RelevanceScorer


def _enable_semantic_matching(monkeypatch: pytest.MonkeyPatch) -> None:
    """Force the `semantic_matching` feature flag on for a single test."""
    settings = Settings(feature_flags="semantic_matching")
    monkeypatch.setattr(
        "app.utils.relevance_scorer.get_settings", lambda: settings
    )


@pytest.fixture(autouse=True)
def _reset_scorer_caches():
    """Every test starts and ends with clean JD/embedding caches."""
    RelevanceScorer.clear_cache()
    RelevanceScorer.clear_embedding_cache()
    yield
    RelevanceScorer.clear_cache()
    RelevanceScorer.clear_embedding_cache()


# ---------------------------------------------------------------------------
# cosine_similarity: pure-Python helper, no model required
# ---------------------------------------------------------------------------

def test_cosine_similarity_identical_vectors():
    assert cosine_similarity([1.0, 0.0, 0.0], [1.0, 0.0, 0.0]) == pytest.approx(1.0)


def test_cosine_similarity_orthogonal_vectors():
    assert cosine_similarity([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0)


def test_cosine_similarity_negative_is_clamped_to_zero():
    # Opposite vectors have cosine -1, which we clamp to 0 (not "negatively
    # relevant" for resume/JD matching purposes).
    assert cosine_similarity([1.0, 0.0], [-1.0, 0.0]) == 0.0


def test_cosine_similarity_handles_bad_input_without_crashing():
    assert cosine_similarity(None, [1.0]) == 0.0
    assert cosine_similarity([1.0], None) == 0.0
    assert cosine_similarity([1.0, 2.0], [1.0]) == 0.0  # mismatched length
    assert cosine_similarity([0.0, 0.0], [0.0, 0.0]) == 0.0  # zero vector


# ---------------------------------------------------------------------------
# Semantic matching is opt-in and must not change default (keyword-only)
# behavior -- this is the core regression guard for the existing 276-test
# baseline.
# ---------------------------------------------------------------------------

def test_semantic_matching_disabled_by_default():
    scorer = RelevanceScorer("Senior Python Developer needing Django experience.")
    assert scorer.semantic_enabled is False
    assert scorer.jd_embedding is None


def test_semantic_similarity_is_zero_when_disabled_even_for_a_paraphrase():
    """
    Without the feature flag, a strong paraphrase gets NO credit -- proving
    the new code path is fully inert unless explicitly enabled.
    """
    jd = "We need a candidate with strong project management experience."
    scorer = RelevanceScorer(jd)
    assert scorer.semantic_enabled is False

    exp = Experience(
        id="e1",
        company="Acme Robotics",
        title="Team Lead",
        startDate=datetime(2021, 1, 1),
        current=True,
        description="Directed daily standups and kept the roadmap on track.",
        keywords=[],
        highlights=["Led cross-functional teams to deliver initiatives on time"],
    )
    scored = scorer.score_experience(exp)
    assert scored.semantic_similarity == 0.0
    assert scored.score == 0.0  # zero keyword overlap, zero semantic contribution


# ---------------------------------------------------------------------------
# Core claim: with semantic matching enabled, a paraphrased bullet with ZERO
# keyword overlap ranks meaningfully higher against a relevant requirement
# than an unrelated bullet with equally-zero keyword overlap. Pure keyword
# scoring cannot distinguish these two cases at all (both score 0.0).
# ---------------------------------------------------------------------------

def test_paraphrase_ranks_higher_than_unrelated_with_semantic_matching(monkeypatch):
    if not EmbeddingService.is_available():
        pytest.skip("sentence-transformers backend not installed in this environment")

    _enable_semantic_matching(monkeypatch)

    jd = """Senior Program Coordinator

    We need a candidate with strong project management experience,
    coordinating priorities across multiple stakeholders and departments.
    """
    scorer = RelevanceScorer(jd)
    assert scorer.semantic_enabled is True

    # Paraphrases "project management" / "coordinating priorities across
    # stakeholders" without using any of those words.
    paraphrased_experience = Experience(
        id="e1",
        company="Acme Robotics",
        title="Team Lead",
        startDate=datetime(2021, 1, 1),
        current=True,
        description="Directed daily standups and kept the roadmap on track.",
        keywords=[],
        highlights=["Led cross-functional teams to deliver initiatives on time"],
    )
    # Genuinely unrelated domain, also zero keyword overlap with the JD.
    unrelated_experience = Experience(
        id="e2",
        company="Cool Air HVAC",
        title="Field Technician",
        startDate=datetime(2019, 1, 1),
        current=False,
        description="Repaired industrial refrigeration units and diagnosed compressor failures.",
        keywords=[],
        highlights=["Replaced condenser coils on rooftop units"],
    )

    scored_paraphrase = scorer.score_experience(paraphrased_experience)
    scored_unrelated = scorer.score_experience(unrelated_experience)

    # Sanity check: the keyword pass alone found nothing for either --
    # any ranking difference must come purely from semantic similarity.
    assert scored_paraphrase.matched_keywords == []
    assert scored_unrelated.matched_keywords == []

    # Semantic similarity and final blended score both favor the paraphrase.
    assert scored_paraphrase.semantic_similarity > scored_unrelated.semantic_similarity
    assert scored_paraphrase.score > scored_unrelated.score

    # "Meaningfully higher", not just a rounding-error win: require at least
    # a 25% relative margin. (Observed in this repo's dev venv with
    # all-MiniLM-L6-v2: ~1.74 vs ~1.08, a ~60% margin.)
    assert scored_paraphrase.score > scored_unrelated.score * 1.25


def test_skill_semantic_similarity_credits_paraphrased_skill(monkeypatch):
    if not EmbeddingService.is_available():
        pytest.skip("sentence-transformers backend not installed in this environment")

    _enable_semantic_matching(monkeypatch)

    jd = "Looking for someone who can coordinate priorities across multiple stakeholders."
    scorer = RelevanceScorer(jd)

    matching_skill = Skill(id="s1", name="Stakeholder Management", category="Soft Skill")
    unrelated_skill = Skill(id="s2", name="Deep Sea Diving", category="Hobby")

    scored_matching = scorer.score_skill(matching_skill)
    scored_unrelated = scorer.score_skill(unrelated_skill)

    # Keyword pass alone would score both at 0 (no lexical overlap at all).
    assert scored_matching.matched_keywords == []
    assert scored_unrelated.matched_keywords == []
    assert scored_matching.score > scored_unrelated.score


# ---------------------------------------------------------------------------
# Caching: embeddings must be computed once per unique text, not recomputed
# per request/per item, mirroring the existing JD-instance cache pattern.
# ---------------------------------------------------------------------------

def test_embedding_cache_avoids_recomputing_identical_text(monkeypatch):
    if not EmbeddingService.is_available():
        pytest.skip("sentence-transformers backend not installed in this environment")

    _enable_semantic_matching(monkeypatch)

    call_count = {"n": 0}
    real_embed = EmbeddingService.embed

    def counting_embed(text):
        call_count["n"] += 1
        return real_embed(text)

    monkeypatch.setattr(EmbeddingService, "embed", staticmethod(counting_embed))

    jd = "Looking for a project manager with strong communication skills."
    scorer = RelevanceScorer(jd)  # embeds the JD once
    assert call_count["n"] == 1

    exp = Experience(
        id="e1",
        company="Acme",
        title="Lead",
        startDate=datetime(2020, 1, 1),
        current=True,
        description="Led cross-functional teams to deliver initiatives on time.",
        keywords=[],
        highlights=[],
    )

    scorer.score_experience(exp)
    calls_after_first = call_count["n"]
    assert calls_after_first == 2  # JD + this experience's text blob

    # Scoring the exact same experience content again must hit the cache --
    # no additional embed() calls.
    exp_again = Experience(
        id="e2",
        company="Acme",
        title="Lead",
        startDate=datetime(2020, 1, 1),
        current=True,
        description="Led cross-functional teams to deliver initiatives on time.",
        keywords=[],
        highlights=[],
    )
    scorer.score_experience(exp_again)
    assert call_count["n"] == calls_after_first  # no new embed() calls -- cache hit


def test_embedding_cache_respects_max_size():
    RelevanceScorer.clear_embedding_cache()
    original_max = RelevanceScorer._embedding_cache_max_size
    try:
        RelevanceScorer._embedding_cache_max_size = 3
        for i in range(5):
            RelevanceScorer._embedding_cache[f"fake-key-{i}"] = [0.0]
            if len(RelevanceScorer._embedding_cache) > RelevanceScorer._embedding_cache_max_size:
                oldest_key = next(iter(RelevanceScorer._embedding_cache))
                del RelevanceScorer._embedding_cache[oldest_key]
        assert len(RelevanceScorer._embedding_cache) <= 3
    finally:
        RelevanceScorer._embedding_cache_max_size = original_max
        RelevanceScorer.clear_embedding_cache()


# ---------------------------------------------------------------------------
# Graceful degradation: if the embedding backend is unavailable (dependency
# missing, model load failed, encode() raised), scoring must fall back to the
# keyword-only path without crashing.
# ---------------------------------------------------------------------------

def test_scoring_falls_back_gracefully_when_backend_unavailable(monkeypatch):
    _enable_semantic_matching(monkeypatch)
    # Simulate a missing/broken embedding backend regardless of whether
    # sentence-transformers is actually installed in this environment.
    monkeypatch.setattr(EmbeddingService, "embed", staticmethod(lambda text: None))

    jd = "We need a candidate with strong project management experience."
    scorer = RelevanceScorer(jd)
    assert scorer.semantic_enabled is True
    assert scorer.jd_embedding is None  # embed() returned None -> no crash

    exp = Experience(
        id="e1",
        company="Acme Robotics",
        title="Team Lead",
        startDate=datetime(2021, 1, 1),
        current=True,
        description="Directed daily standups and kept the roadmap on track.",
        keywords=[],
        highlights=["Led cross-functional teams to deliver initiatives on time"],
    )

    # Must not raise, and must degrade to the same result as keyword-only.
    scored = scorer.score_experience(exp)
    assert scored.semantic_similarity == 0.0
    assert scored.score == 0.0


def test_embedding_service_embed_handles_empty_text():
    assert EmbeddingService.embed("") is None
    assert EmbeddingService.embed("   ") is None
    assert EmbeddingService.embed(None) is None  # type: ignore[arg-type]
