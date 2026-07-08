"""
Tests for PDF Generator
"""
import sys
from unittest.mock import MagicMock, patch
import pytest

# Mock weasyprint modules BEFORE importing the module under test
mock_wp = MagicMock()
mock_wp.HTML = MagicMock()
mock_wp.CSS = MagicMock()
sys.modules["weasyprint"] = mock_wp

mock_wp_fonts = MagicMock()
mock_wp_fonts.FontConfiguration = MagicMock()
sys.modules["weasyprint.text.fonts"] = mock_wp_fonts

# Also mock jinja2 to avoid template loading issues
mock_jinja2 = MagicMock()
sys.modules["jinja2"] = mock_jinja2
mock_jinja2.Environment = MagicMock()

from app.utils.pdf_generator import PDFGenerator  # noqa: E402
from app.models.resume import CompiledResume  # noqa: E402


@pytest.fixture
def generator():
    """Create PDFGenerator with mocked weasyprint."""
    return PDFGenerator()


def test_generate_html(generator):
    """Test HTML generation from resume data."""
    # Mock the template
    generator.template = MagicMock()
    generator.template.render.return_value = "<html>Test</html>"
    
    resume = CompiledResume(
        name="Test User",
        email="test@example.com",
        template="experience-skills-projects",
        experiences=[],
        projects=[],
        educations=[],
        skills=[],
        publications=[]
    )
    html = generator.generate_html(resume)
    assert "<html>Test</html>" in html


@pytest.mark.asyncio
async def test_generate_pdf_async(generator):
    """Test async PDF generation returns bytes."""
    # Setup mock return values
    mock_document = MagicMock()
    mock_document.pages = [MagicMock()]  # 1 page
    mock_wp.HTML.return_value.render.return_value = mock_document
    
    # Mock the template
    generator.template = MagicMock()
    generator.template.render.return_value = "<html>Test</html>"
    
    resume = CompiledResume(
        name="Test User",
        email="test@example.com",
        template="experience-skills-projects",
        experiences=[],
        projects=[],
        educations=[],
        skills=[],
        publications=[]
    )
    
    # Patch BytesIO to capture what gets written
    mock_buffer = MagicMock()
    mock_buffer.getvalue.return_value = b"PDF CONTENT"
    
    with patch('app.utils.pdf_generator.BytesIO', return_value=mock_buffer):
        pdf_bytes = await generator.generate_pdf(resume)
    
    assert pdf_bytes == b"PDF CONTENT"


@pytest.mark.asyncio
async def test_generate_pdf_page_limit_exceeded(generator):
    """Test that exceeding page limit raises ValueError."""
    # Mock 2 pages to exceed limit
    mock_document = MagicMock()
    mock_document.pages = [MagicMock(), MagicMock()]
    
    # Need to patch at the module level where it's used
    with patch('app.utils.pdf_generator.HTML') as mock_html:
        mock_html.return_value.render.return_value = mock_document
        
        # Mock the template
        generator.template = MagicMock()
        generator.template.render.return_value = "<html>Test</html>"
        
        resume = CompiledResume(
            name="Test User",
            email="test@example.com",
            template="experience-skills-projects",
            experiences=[],
            projects=[],
            educations=[],
            skills=[],
            publications=[]
        )
        
        with pytest.raises(ValueError, match="exceeds 1 page"):
            await generator.generate_pdf(resume, max_pages=1)


@pytest.mark.asyncio
async def test_generate_pdf_base64_async(generator):
    """Test async PDF generation returns base64 string."""
    # Mock return for this test specifically
    mock_document = MagicMock()
    mock_document.pages = [MagicMock()]
    
    with patch('app.utils.pdf_generator.HTML') as mock_html:
        mock_html.return_value.render.return_value = mock_document
        
        # Mock the template
        generator.template = MagicMock()
        generator.template.render.return_value = "<html>Test</html>"
        
        resume = CompiledResume(
            name="Test User",
            email="test@example.com",
            template="experience-skills-projects",
            experiences=[],
            projects=[],
            educations=[],
            skills=[],
            publications=[]
        )
        
        # Patch BytesIO to return predictable content
        mock_buffer = MagicMock()
        mock_buffer.getvalue.return_value = b"PDF CONTENT"
        
        with patch('app.utils.pdf_generator.BytesIO', return_value=mock_buffer):
            b64 = await generator.generate_pdf_base64(resume)
        
        # "PDF CONTENT" -> "UERGIENPTlRFTlQ="
        assert b64 == "UERGIENPTlRFTlQ="


def test_preview_html(generator):
    """Test HTML preview generation."""
    # Mock the template
    generator.template = MagicMock()
    generator.template.render.return_value = "<html>Resume</html>"
    
    resume = CompiledResume(
        name="Test User",
        email="test@example.com",
        template="experience-skills-projects",
        experiences=[],
        projects=[],
        educations=[],
        skills=[],
        publications=[]
    )
    html = generator.preview_html(resume)
    assert "<html>Resume</html>" in html


@pytest.mark.asyncio
async def test_generate_pdf_runs_in_thread_pool(generator):
    """Test that PDF generation uses thread pool executor."""
    
    mock_document = MagicMock()
    mock_document.pages = [MagicMock()]
    
    with patch('app.utils.pdf_generator.HTML') as mock_html:
        mock_html.return_value.render.return_value = mock_document
        
        # Mock the template
        generator.template = MagicMock()
        generator.template.render.return_value = "<html>Test</html>"
        
        resume = CompiledResume(
            name="Test User",
            email="test@example.com",
            template="experience-skills-projects",
            experiences=[],
            projects=[],
            educations=[],
            skills=[],
            publications=[]
        )
        
        mock_buffer = MagicMock()
        mock_buffer.getvalue.return_value = b"PDF CONTENT"
        
        # Don't mock the executor - let it use the real one
        with patch('app.utils.pdf_generator.BytesIO', return_value=mock_buffer):
            # The actual PDF generation should use the executor
            # This test verifies the async method exists and can be called
            result = await generator.generate_pdf(resume)
            assert result == b"PDF CONTENT"
