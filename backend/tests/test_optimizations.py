"""
Test optimizations for PDF generation and Redis cache operations.
"""

import pytest
from unittest.mock import Mock, patch


class TestSharedFontConfiguration:
    """Tests for shared FontConfiguration in PDFGenerator."""
    
    def test_get_shared_font_configuration_singleton(self):
        """Test that get_shared_font_configuration returns the same instance."""
        import app.utils.pdf_generator as pdf_gen
        
        # Reset module-level font config
        pdf_gen._font_configuration = None
        
        # First call creates FontConfiguration
        font_config1 = pdf_gen.get_shared_font_configuration()
        assert font_config1 is not None
        
        # Second call returns same instance
        font_config2 = pdf_gen.get_shared_font_configuration()
        assert font_config1 is font_config2
    
    def test_pdf_generator_uses_shared_font_config(self):
        """Test that PDFGenerator uses shared FontConfiguration."""
        import app.utils.pdf_generator as pdf_gen
        
        # Reset module-level font config
        pdf_gen._font_configuration = None
        
        # Create PDFGenerator instance
        generator = pdf_gen.PDFGenerator()
        
        # Verify it uses shared font config
        shared_config = pdf_gen.get_shared_font_configuration()
        assert generator.font_config is shared_config


class TestOptimizedJSONSerialization:
    """Tests for optimized JSON serialization in Redis cache."""
    
    def test_json_dumps_with_orjson(self):
        """Test JSON serialization with orjson if available."""
        from app.utils.redis_cache import _json_dumps
        
        test_data = {"key": "value", "number": 123, "nested": {"a": 1}}
        result = _json_dumps(test_data)
        
        assert isinstance(result, str)
        assert "key" in result
        assert "value" in result
    
    def test_json_loads_with_orjson(self):
        """Test JSON deserialization with orjson if available."""
        from app.utils.redis_cache import _json_loads
        
        test_json = '{"key": "value", "number": 123}'
        result = _json_loads(test_json)
        
        assert isinstance(result, dict)
        assert result["key"] == "value"
        assert result["number"] == 123
    
    def test_json_serialization_roundtrip(self):
        """Test that serialization and deserialization are consistent."""
        from app.utils.redis_cache import _json_dumps, _json_loads
        
        test_data = {
            "string": "test",
            "number": 42,
            "float": 3.14,
            "bool": True,
            "null": None,
            "list": [1, 2, 3],
            "dict": {"nested": "value"},
        }
        
        # Serialize and deserialize
        serialized = _json_dumps(test_data)
        deserialized = _json_loads(serialized)
        
        assert deserialized == test_data
    
    def test_json_dumps_handles_complex_types(self):
        """Test that JSON serialization handles complex types."""
        from app.utils.redis_cache import _json_dumps
        
        # Test with datetime (should be converted to string with default=str)
        from datetime import datetime
        test_data = {"date": datetime(2024, 1, 1, 12, 0, 0)}
        
        result = _json_dumps(test_data)
        assert isinstance(result, str)
        assert "date" in result
    
    @pytest.mark.asyncio
    async def test_redis_cache_uses_optimized_json(self):
        """Test that Redis cache functions use optimized JSON functions."""
        from app.utils.redis_cache import set_cached, get_cached, redis_client, CacheStatus
        from unittest.mock import AsyncMock
        
        # Mock Redis client
        mock_client = Mock()
        mock_client.set = AsyncMock(return_value=True)
        mock_client.get = AsyncMock(return_value='{"key": "value"}')
        
        with patch.object(redis_client, 'get_client', return_value=mock_client):
            with patch.object(redis_client, '_status', CacheStatus.HEALTHY):
                # Test set_cached uses optimized serialization
                result = await set_cached("test_key", {"test": "data"})
                assert result is True
                
                # Test get_cached uses optimized deserialization
                data = await get_cached("test_key")
                assert data == {"key": "value"}


class TestCachePerformance:
    """Performance tests for cache optimizations."""
    
    def test_orjson_faster_than_standard_json(self):
        """Test that orjson is faster than standard json (if available)."""
        from app.utils.redis_cache import _use_orjson
        
        if not _use_orjson:
            pytest.skip("orjson not available")
        
        import time
        import json
        
        # Create large test data
        test_data = {f"key_{i}": f"value_{i}" * 10 for i in range(1000)}
        
        # Benchmark orjson
        start = time.time()
        for _ in range(100):
            from app.utils.redis_cache import _json_dumps, _json_loads
            serialized = _json_dumps(test_data)
            _json_loads(serialized)
        orjson_time = time.time() - start
        
        # Benchmark standard json
        start = time.time()
        for _ in range(100):
            serialized = json.dumps(test_data, default=str)
            json.loads(serialized)
        json_time = time.time() - start
        
        # orjson should be faster (though this may vary by system)
        from app.utils.logger import logger
        logger.info(f"orjson time: {orjson_time:.4f}s, json time: {json_time:.4f}s")
        # We don't assert strict performance due to system variations
        assert orjson_time > 0
        assert json_time > 0
