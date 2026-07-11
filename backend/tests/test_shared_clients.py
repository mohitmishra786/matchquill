"""
Test shared HTTP client and AsyncGroq client optimizations.
"""

import pytest
from unittest.mock import Mock, patch

import app.services.profile_service as profile_service
import app.services.resume_parser as resume_parser


class TestSharedGroqClient:
    """Tests for shared AsyncGroq client in resume_parser."""
    
    def test_get_groq_client_creates_singleton(self):
        """Test that get_groq_client returns the same instance."""
        with patch('app.services.resume_parser.get_settings') as mock_settings:
            mock_config = Mock()
            mock_config.groq_api_key = "test_key"
            mock_settings.return_value = mock_config
            
            # Reset module-level client (single import style)
            resume_parser._groq_client = None
            
            # First call creates client
            client1 = resume_parser.get_groq_client()
            assert client1 is not None
            
            # Second call returns same client
            client2 = resume_parser.get_groq_client()
            assert client1 is client2
    
    def test_get_groq_client_no_api_key(self):
        """Test that get_groq_client returns None when no API key."""
        with patch('app.services.resume_parser.get_settings') as mock_settings:
            mock_config = Mock()
            mock_config.groq_api_key = None
            mock_settings.return_value = mock_config
            
            # Reset module-level client
            resume_parser._groq_client = None
            
            client = resume_parser.get_groq_client()
            assert client is None


class TestSharedHTTPClient:
    """Tests for shared HTTP client in profile_service."""
    
    @pytest.mark.asyncio
    async def test_get_shared_http_client_creates_singleton(self):
        """Test that get_shared_http_client returns the same instance."""
        # Reset module-level client
        profile_service._http_client = None
        
        # First call creates client
        client1 = await profile_service.get_shared_http_client()
        assert client1 is not None
        assert hasattr(client1, 'get')
        
        # Second call returns same client
        client2 = await profile_service.get_shared_http_client()
        assert client1 is client2
    
    @pytest.mark.asyncio
    async def test_close_shared_http_client(self):
        """Test that close_shared_http_client properly closes the client."""
        # Reset module-level client
        profile_service._http_client = None
        
        # Create client
        client = await profile_service.get_shared_http_client()
        assert client is not None
        
        # Close client
        await profile_service.close_shared_http_client()
        
        # Verify client is closed and set to None
        assert profile_service._http_client is None
    
    @pytest.mark.asyncio
    async def test_profile_service_uses_shared_client(self):
        """Test that ProfileService uses shared HTTP client."""
        # Create service instance
        service = profile_service.ProfileService()
        assert service is not None
        
        # Verify shared client can be accessed
        shared_client = await profile_service.get_shared_http_client()
        assert shared_client is not None
    
    @pytest.mark.asyncio
    async def test_profile_service_context_manager(self):
        """Test ProfileService async context manager."""
        async with profile_service.ProfileService() as service:
            assert service is not None
        
        # Service should be closed after context exit
        # (but shared client should remain)
        assert profile_service._http_client is not None
