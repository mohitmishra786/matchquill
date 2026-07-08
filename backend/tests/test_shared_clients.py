"""
Test shared HTTP client and AsyncGroq client optimizations.
"""

import pytest
from unittest.mock import Mock, patch


class TestSharedGroqClient:
    """Tests for shared AsyncGroq client in resume_parser."""
    
    def test_get_groq_client_creates_singleton(self):
        """Test that get_groq_client returns the same instance."""
        with patch('app.services.resume_parser.get_settings') as mock_settings:
            mock_config = Mock()
            mock_config.groq_api_key = "test_key"
            mock_settings.return_value = mock_config
            
            from app.services.resume_parser import get_groq_client
            
            # Reset module-level client
            import app.services.resume_parser
            app.services.resume_parser._groq_client = None
            
            # First call creates client
            client1 = get_groq_client()
            assert client1 is not None
            
            # Second call returns same client
            client2 = get_groq_client()
            assert client1 is client2
    
    def test_get_groq_client_no_api_key(self):
        """Test that get_groq_client returns None when no API key."""
        with patch('app.services.resume_parser.get_settings') as mock_settings:
            mock_config = Mock()
            mock_config.groq_api_key = None
            mock_settings.return_value = mock_config
            
            from app.services.resume_parser import get_groq_client
            
            # Reset module-level client
            import app.services.resume_parser
            app.services.resume_parser._groq_client = None
            
            client = get_groq_client()
            assert client is None


class TestSharedHTTPClient:
    """Tests for shared HTTP client in profile_service."""
    
    def test_get_shared_http_client_creates_singleton(self):
        """Test that get_shared_http_client returns the same instance."""
        from app.services.profile_service import get_shared_http_client
        
        # Reset module-level client
        import app.services.profile_service
        app.services.profile_service._http_client = None
        
        # First call creates client
        client1 = get_shared_http_client()
        assert client1 is not None
        assert hasattr(client1, 'get')
        
        # Second call returns same client
        client2 = get_shared_http_client()
        assert client1 is client2
    
    @pytest.mark.asyncio
    async def test_close_shared_http_client(self):
        """Test that close_shared_http_client properly closes the client."""
        from app.services.profile_service import get_shared_http_client, close_shared_http_client
        
        # Reset module-level client
        import app.services.profile_service
        app.services.profile_service._http_client = None
        
        # Create client
        client = get_shared_http_client()
        assert client is not None
        
        # Close client
        await close_shared_http_client()
        
        # Verify client is closed and set to None
        assert app.services.profile_service._http_client is None
    
    @pytest.mark.asyncio
    async def test_profile_service_uses_shared_client(self):
        """Test that ProfileService uses shared HTTP client."""
        from app.services.profile_service import ProfileService, get_shared_http_client
        
        # Create service instance
        service = ProfileService()
        assert service.use_shared_client is True
        
        # Verify shared client can be accessed
        shared_client = get_shared_http_client()
        assert shared_client is not None
    
    @pytest.mark.asyncio
    async def test_profile_service_context_manager(self):
        """Test ProfileService async context manager."""
        from app.services.profile_service import ProfileService
        
        async with ProfileService() as service:
            assert service is not None
            assert service.use_shared_client is True
        
        # Service should be closed after context exit
        # (but shared client should remain)
        from app.services.profile_service import _http_client
        assert _http_client is not None
