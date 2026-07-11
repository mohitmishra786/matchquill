"""Tests for namespaced cache keys and set-index helpers."""

from app.utils.redis_cache import (
    generate_cache_key,
    parse_cache_key_parts,
    CACHE_NAMESPACE,
    _index_set_key,
)


def test_generate_cache_key_namespace() -> None:
    key = generate_cache_key("user-1", "some job description", "resume")
    assert key.startswith(f"{CACHE_NAMESPACE}:resume:")
    assert "user-1" in key or "user-1".replace(":", "_") in key


def test_parse_cache_key_parts() -> None:
    key = generate_cache_key("abc", "jd text here long enough", "cover")
    parts = parse_cache_key_parts(key)
    assert parts is not None
    ns, prefix, user, _hash = parts
    assert ns == CACHE_NAMESPACE
    assert prefix == "cover"
    assert user == "abc"


def test_index_set_key_format() -> None:
    idx = _index_set_key("user-1", "resume")
    assert idx.startswith(f"{CACHE_NAMESPACE}:idx:")
    assert "resume" in idx
    assert "user-1" in idx


def test_reject_non_namespaced_keys() -> None:
    assert parse_cache_key_parts("other:app:key:x") is None
