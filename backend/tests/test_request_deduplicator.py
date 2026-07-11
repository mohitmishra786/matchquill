"""
Tests for Request Deduplicator
"""
import pytest
import asyncio
from datetime import datetime, timedelta
from app.utils.request_deduplicator import RequestDeduplicator, get_deduplicator, InFlightRequest


@pytest.fixture
def deduplicator():
    """Create a fresh deduplicator for each test."""
    return RequestDeduplicator(ttl_seconds=2.0)


@pytest.mark.asyncio
async def test_deduplicator_prevents_duplicate_requests(deduplicator):
    """Test that duplicate requests are deduplicated."""
    call_count = 0

    async def expensive_operation(value: int) -> int:
        nonlocal call_count
        call_count += 1
        await asyncio.sleep(0.1)  # Simulate slow operation
        return value * 2

    # Launch 3 identical requests simultaneously
    results = await asyncio.gather(
        deduplicator.execute("test", expensive_operation, 5),
        deduplicator.execute("test", expensive_operation, 5),
        deduplicator.execute("test", expensive_operation, 5),
    )

    # All should get the same result
    assert results == [10, 10, 10]

    # But the function should only be called once
    assert call_count == 1


@pytest.mark.asyncio
async def test_deduplicator_different_keys_not_deduplicated(deduplicator):
    """Test that requests with different keys are not deduplicated."""
    call_count = 0

    async def operation(value: int) -> int:
        nonlocal call_count
        call_count += 1
        return value * 2

    results = await asyncio.gather(
        deduplicator.execute("key1", operation, 5),
        deduplicator.execute("key2", operation, 10),
    )

    assert results == [10, 20]
    assert call_count == 2


@pytest.mark.asyncio
async def test_deduplicator_different_args_not_deduplicated(deduplicator):
    """Test that requests with different arguments are not deduplicated."""
    call_count = 0

    async def operation(value: int) -> int:
        nonlocal call_count
        call_count += 1
        return value * 2

    results = await asyncio.gather(
        deduplicator.execute("test", operation, 5),
        deduplicator.execute("test", operation, 10),
    )

    assert results == [10, 20]
    assert call_count == 2


@pytest.mark.asyncio
async def test_deduplicator_exception_handling(deduplicator):
    """Test that exceptions are propagated correctly."""

    async def failing_operation():
        await asyncio.sleep(0.05)
        raise ValueError("Operation failed")

    # Launch multiple requests
    results = await asyncio.gather(
        deduplicator.execute("test", failing_operation),
        deduplicator.execute("test", failing_operation),
        return_exceptions=True
    )

    # Both should have raised ValueError
    assert all(isinstance(r, ValueError) for r in results)
    assert all(str(r) == "Operation failed" for r in results)


@pytest.mark.asyncio
async def test_deduplicator_cleanup_after_completion(deduplicator):
    """Test that completed requests are cleaned up."""

    async def operation(value: int) -> int:
        return value * 2

    # Execute first request
    result1 = await deduplicator.execute("test", operation, 5)
    assert result1 == 10

    # The in-flight request should be cleaned up
    assert len(deduplicator._in_flight) == 0

    # Second request should execute again (not use cached result)
    call_count = 0

    async def counted_operation(value: int) -> int:
        nonlocal call_count
        call_count += 1
        return value * 2

    result2 = await deduplicator.execute("test", counted_operation, 5)
    assert result2 == 10
    assert call_count == 1


@pytest.mark.asyncio
async def test_deduplicator_ttl_expiration(deduplicator):
    """Test that expired requests are removed."""

    async def slow_operation(value: int) -> int:
        await asyncio.sleep(3.0)  # Longer than TTL
        return value * 2

    # Start a request but don't await it
    task = asyncio.create_task(deduplicator.execute("test", slow_operation, 5))

    # Wait a bit for it to start
    await asyncio.sleep(0.1)

    # Should be in flight
    assert len(deduplicator._in_flight) == 1

    # Wait for TTL to expire
    await asyncio.sleep(2.5)

    # Try another request - should not wait for expired one
    call_count = 0

    async def quick_operation(value: int) -> int:
        nonlocal call_count
        call_count += 1
        return value * 3

    result = await deduplicator.execute("test", quick_operation, 5)
    assert result == 15
    assert call_count == 1

    # Clean up the slow task
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        # Expected when cancelling an in-flight deduplicated coroutine
        pass


@pytest.mark.asyncio
async def test_cleanup_expired_method(deduplicator):
    """Test the cleanup_expired method."""

    # Manually insert an expired request
    expired_event = asyncio.Event()
    expired_request = InFlightRequest(
        event=expired_event,
        timestamp=datetime.utcnow() - timedelta(seconds=10),
        request_hash="expired_hash"
    )
    deduplicator._in_flight["expired_key"] = expired_request

    # Insert a non-expired request
    valid_event = asyncio.Event()
    valid_request = InFlightRequest(
        event=valid_event,
        timestamp=datetime.utcnow(),
        request_hash="valid_hash"
    )
    deduplicator._in_flight["valid_key"] = valid_request

    # Run cleanup
    removed_count = await deduplicator.cleanup_expired()

    assert removed_count == 1
    assert "expired_key" not in deduplicator._in_flight
    assert "valid_key" in deduplicator._in_flight


@pytest.mark.asyncio
async def test_get_stats(deduplicator):
    """Test the get_stats method."""

    async def operation(value: int) -> int:
        await asyncio.sleep(0.5)
        return value * 2

    # Start a request but don't await it
    task = asyncio.create_task(deduplicator.execute("test", operation, 5))

    # Wait a bit for it to start
    await asyncio.sleep(0.1)

    stats = deduplicator.get_stats()

    assert stats["in_flight_count"] == 1
    assert stats["ttl_seconds"] == 2.0
    assert len(stats["requests"]) == 1
    # Key format is "prefix:hash" where hash is first 16 chars of SHA256
    assert stats["requests"][0]["key"].startswith("test:")
    assert len(stats["requests"][0]["key"]) == len("test:") + 16  # prefix + 16-char hash

    # Wait for the request to complete and assert its result
    result = await task
    assert result == 10

    # Stats should show no in-flight requests
    stats = deduplicator.get_stats()
    assert stats["in_flight_count"] == 0


def test_generate_request_hash(deduplicator):
    """Test that request hash generation is consistent."""

    hash1 = deduplicator._generate_request_hash(1, 2, 3, key="value")
    hash2 = deduplicator._generate_request_hash(1, 2, 3, key="value")
    hash3 = deduplicator._generate_request_hash(1, 2, 4, key="value")

    # Same arguments should produce same hash
    assert hash1 == hash2

    # Different arguments should produce different hash
    assert hash1 != hash3


@pytest.mark.asyncio
async def test_global_deduplicator_instance():
    """Test that get_deduplicator returns a singleton."""

    dedup1 = get_deduplicator()
    dedup2 = get_deduplicator()

    assert dedup1 is dedup2


@pytest.mark.asyncio
async def test_concurrent_different_operations(deduplicator):
    """Test multiple different operations can run concurrently."""

    async def operation_a(value: int) -> int:
        await asyncio.sleep(0.1)
        return value * 2

    async def operation_b(value: int) -> int:
        await asyncio.sleep(0.1)
        return value * 3

    results = await asyncio.gather(
        deduplicator.execute("op_a", operation_a, 5),
        deduplicator.execute("op_b", operation_b, 5),
    )

    assert results == [10, 15]


@pytest.mark.asyncio
async def test_sequential_requests_not_deduplicated(deduplicator):
    """Test that sequential requests (not concurrent) are not deduplicated."""
    call_count = 0

    async def operation(value: int) -> int:
        nonlocal call_count
        call_count += 1
        return value * 2

    # Execute sequentially
    result1 = await deduplicator.execute("test", operation, 5)
    result2 = await deduplicator.execute("test", operation, 5)

    assert result1 == 10
    assert result2 == 10
    assert call_count == 2  # Called twice because they're sequential