"""
Embedding Service

Optional, gracefully-degrading semantic (sentence-embedding) similarity
backend used by RelevanceScorer to complement keyword/TF-IDF matching.

Why this design:
- Groq (this project's LLM provider, see groq_client.py) exposes chat/completion
  models only -- there is no embeddings endpoint to piggyback on.
- A local sentence-transformer model (default: all-MiniLM-L6-v2, ~90MB) gives a
  good quality/latency tradeoff for short resume/JD phrases and runs fully
  offline once downloaded, no per-request API cost. Its cost is a heavy
  dependency chain (torch + transformers, several hundred MB) which is why it
  is kept OUT of the default `requirements.txt` (see requirements-semantic.txt)
  and is loaded lazily -- most processes that never enable the
  `semantic_matching` feature flag never pay the import cost at all.
- Every public entry point in this module is guarded: a missing dependency, a
  missing/uncached model, or an encoding error all result in `None`/`False`
  being returned rather than an exception. Callers (RelevanceScorer) must
  treat "unavailable" as "fall back to keyword-only scoring".
"""

import os
import threading
from typing import List, Optional

from app.utils.logger import logger

# Overridable via env for testing or swapping in a different sentence-transformer.
_MODEL_NAME = os.getenv("SEMANTIC_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")


class EmbeddingService:
    """
    Lazy-loaded, process-wide singleton wrapper around an optional
    sentence-transformer model. The model is loaded at most once per process,
    on first use, and the load is attempted at most once -- if it fails, the
    service stays permanently unavailable for the lifetime of the process
    (no repeated expensive retry attempts per request).
    """

    _model = None
    _load_attempted: bool = False
    _lock = threading.Lock()

    @classmethod
    def is_available(cls) -> bool:
        """Whether embeddings can currently be computed."""
        cls._ensure_loaded()
        return cls._model is not None

    @classmethod
    def _ensure_loaded(cls) -> None:
        if cls._load_attempted:
            return
        with cls._lock:
            if cls._load_attempted:  # re-check inside the lock
                return
            cls._load_attempted = True
            try:
                # Imported lazily so importing this module never pulls in
                # torch/transformers unless embeddings are actually used.
                from sentence_transformers import SentenceTransformer

                cls._model = SentenceTransformer(_MODEL_NAME)
                logger.info(f"Semantic embedding model loaded: {_MODEL_NAME}")
            except Exception as e:  # ImportError, OSError, network errors, etc.
                cls._model = None
                logger.warning(
                    "Semantic embedding backend unavailable "
                    f"({e.__class__.__name__}: {e}); "
                    "relevance scoring will fall back to keyword-only matching."
                )

    @classmethod
    def embed(cls, text: str) -> Optional[List[float]]:
        """
        Compute a normalized sentence embedding for `text`.

        Returns None (never raises) if the backend is unavailable or encoding
        fails for any reason -- callers must fall back gracefully.
        """
        if not text or not text.strip():
            return None
        cls._ensure_loaded()
        if cls._model is None:
            return None
        try:
            vector = cls._model.encode(text, normalize_embeddings=True)
            return vector.tolist()
        except Exception as e:
            logger.warning(f"Embedding encode failed, degrading to keyword-only: {e}")
            return None

    @classmethod
    def reset_for_testing(cls) -> None:
        """Reset lazy-load state. Test-only helper."""
        cls._model = None
        cls._load_attempted = False


def cosine_similarity(a: Optional[List[float]], b: Optional[List[float]]) -> float:
    """
    Cosine similarity between two equal-length vectors, clamped to [0, 1].

    Pure Python (no numpy dependency) so this stays usable even in processes
    where the embedding backend itself is unavailable. Negative similarity is
    clamped to 0 -- for resume/JD relevance a negative cosine carries the same
    "not relevant" meaning as zero, and clamping keeps additive blending with
    the keyword score non-negative.
    """
    if not a or not b or len(a) != len(b):
        return 0.0

    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(y * y for y in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0

    similarity = dot / (norm_a * norm_b)
    return max(0.0, min(1.0, similarity))
