def test_root(client):
    """Test root health check."""
    response = client.get("/api/py/")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_health(client):
    """Test detailed health check."""
    response = client.get("/api/py/health")
    assert response.status_code == 200
    assert "status" in response.json()
    assert "redis" in response.json()
