"""Utilities package initialization."""

from app.utils.redis_cache import redis_client, get_cached, set_cached, generate_cache_key
from app.utils.relevance_scorer import RelevanceScorer
from app.utils.embedding_service import EmbeddingService

# PDFGenerator requires system dependencies (gobject, pango)
# Import is optional for development without these deps
try:
    from app.utils.pdf_generator import PDFGenerator
    PDF_AVAILABLE = True
except (ImportError, OSError) as e:
    import warnings
    warnings.warn(f"PDFGenerator unavailable: {e}. PDF generation will be disabled.")
    PDFGenerator = None  # type: ignore
    PDF_AVAILABLE = False

__all__ = [
    "redis_client",
    "get_cached",
    "set_cached",
    "generate_cache_key",
    "RelevanceScorer",
    "EmbeddingService",
    "PDFGenerator",
    "PDF_AVAILABLE",
]

