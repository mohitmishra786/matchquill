"""
Tests for Thread Pool Executor Usage
Verify that CPU-intensive tasks are offloaded from the event loop.
"""

import asyncio
import threading
from unittest.mock import patch, MagicMock
from concurrent.futures import ThreadPoolExecutor

from app.utils.pdf_generator import PDFGenerator, get_pdf_executor
from app.models.resume import CompiledResume


class TestThreadPoolOffloading:
    """Tests for verifying CPU-intensive task offloading."""
    
    def test_thread_pool_executor_exists(self):
        """Test that the thread pool executor is properly configured."""
        executor = get_pdf_executor()
        
        assert isinstance(executor, ThreadPoolExecutor)
        assert executor._max_workers == 4
        assert executor._thread_name_prefix == "pdf_generator"
    
    def test_thread_pool_singleton(self):
        """Test that the executor is a singleton."""
        executor1 = get_pdf_executor()
        executor2 = get_pdf_executor()
        
        # Should be the same instance
        assert executor1 is executor2
    
    def test_pdf_generation_runs_in_thread_pool(self):
        """Test that PDF generation actually runs in a separate thread."""
        from app.utils import pdf_generator
        
        # Track which thread the PDF generation runs in
        main_thread_id = threading.current_thread().ident
        pdf_thread_id = None
        
        def mock_generate_sync(self, html_content, max_pages=1):
            nonlocal pdf_thread_id
            pdf_thread_id = threading.current_thread().ident
            # Return minimal PDF bytes
            return b"%PDF-1.4 mock pdf"
        
        with patch.object(pdf_generator.PDFGenerator, '_generate_pdf_sync', mock_generate_sync):
            with patch.object(pdf_generator, 'HTML') as mock_html:
                # Set up mocks to avoid actual WeasyPrint calls
                mock_doc = MagicMock()
                mock_doc.pages = [MagicMock()]
                mock_html.return_value.render.return_value = mock_doc
                
                async def test_generation():
                    generator = pdf_generator.PDFGenerator()
                    resume = CompiledResume(
                        name="Test",
                        email="test@test.com",
                        template="experience-skills-projects",
                        experiences=[],
                        projects=[],
                        educations=[],
                        skills=[],
                        publications=[]
                    )
                    
                    result = await generator.generate_pdf(resume)
                    return result
                
                asyncio.run(test_generation())
        
        # Verify PDF was generated in a different thread
        assert pdf_thread_id is not None
        assert pdf_thread_id != main_thread_id
        print(f"Main thread: {main_thread_id}, PDF thread: {pdf_thread_id}")
        print("✓ PDF generation runs in separate thread (not blocking event loop)")
    
    def test_concurrent_pdf_generations_use_thread_pool(self):
        """Test that multiple concurrent PDF generations use the thread pool."""
        from app.utils import pdf_generator
        import time
        
        # Track concurrent operations
        concurrent_count = 0
        max_concurrent = 0
        lock = threading.Lock()
        
        def mock_generate_sync(self, html_content, max_pages=1):
            nonlocal concurrent_count, max_concurrent
            
            with lock:
                concurrent_count += 1
                if concurrent_count > max_concurrent:
                    max_concurrent = concurrent_count
            
            # Simulate CPU-intensive work
            time.sleep(0.1)
            
            with lock:
                concurrent_count -= 1
            
            return b"%PDF-1.4 mock pdf"
        
        with patch.object(pdf_generator.PDFGenerator, '_generate_pdf_sync', mock_generate_sync):
            with patch.object(pdf_generator, 'HTML') as mock_html:
                mock_doc = MagicMock()
                mock_doc.pages = [MagicMock()]
                mock_html.return_value.render.return_value = mock_doc
    
                async def test_concurrent():
                    generator = pdf_generator.PDFGenerator()
                    
                    # Create 5 concurrent PDF generation tasks
                    tasks = []
                    for i in range(5):
                        resume = CompiledResume(
                            name=f"Test{i}",
                            email=f"test{i}@test.com",
                            template="experience-skills-projects",
                            experiences=[],
                            projects=[],
                            educations=[],
                            skills=[],
                            publications=[]
                        )
                        tasks.append(generator.generate_pdf(resume))
                    
                    # Run all concurrently
                    results = await asyncio.gather(*tasks)
                    return len(results)
                
                result_count = asyncio.run(test_concurrent())
        
        # Verify all tasks completed
        assert result_count == 5
        # With thread pool of 4 workers, we should see concurrency
        assert max_concurrent >= 2
        assert max_concurrent <= 4  # Can't exceed thread pool size
        print(f"Max concurrent PDF generations: {max_concurrent}")
        print("✓ Thread pool properly handles concurrent operations")
    
    def test_executor_survives_pdf_generator_recreation(self):
        """Test that the executor persists across PDFGenerator instances."""
        executor1 = get_pdf_executor()
        
        # Create a new PDFGenerator
        PDFGenerator()
        
        # Get executor again
        executor2 = get_pdf_executor()
        
        # Should be the same executor
        assert executor1 is executor2
        print("✓ Thread pool executor is properly singleton")


class TestAsyncGroqUsage:
    """Tests for AsyncGroq client usage (non-blocking LLM calls)."""
    
    def test_groq_client_uses_async_groq(self):
        """Test that GroqClient uses AsyncGroq for non-blocking LLM calls."""
        from app.services.groq_client import GroqClient
        from groq import AsyncGroq
        
        client = GroqClient()
        
        # Verify it's using AsyncGroq (not synchronous Groq)
        assert isinstance(client.client, AsyncGroq)
        assert hasattr(client.client, 'chat')
        print("✓ GroqClient uses AsyncGroq for non-blocking LLM calls")
