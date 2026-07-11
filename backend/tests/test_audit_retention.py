"""
Test audit log retention service.
"""

import pytest
from datetime import datetime, timedelta, timezone

import app.services.audit_retention as audit_retention


class TestAuditLogRetentionService:
    """Tests for audit log retention service."""
    
    def test_initialization_default_retention(self):
        """Test service initialization with default retention period."""
        service = audit_retention.AuditLogRetentionService()
        assert service.retention_days == service.DEFAULT_RETENTION_DAYS
    
    def test_initialization_custom_retention(self):
        """Test service initialization with custom retention period."""
        service = audit_retention.AuditLogRetentionService(retention_days=60)
        assert service.retention_days == 60
    
    def test_retention_validation(self):
        """Test that retention period is clamped to valid range."""
        # Too low
        service = audit_retention.AuditLogRetentionService(retention_days=10)
        assert service.retention_days == service.MIN_RETENTION_DAYS
        
        # Too high
        service = audit_retention.AuditLogRetentionService(retention_days=500)
        assert service.retention_days == service.MAX_RETENTION_DAYS
        
        # Just right
        service = audit_retention.AuditLogRetentionService(retention_days=180)
        assert service.retention_days == 180
    
    def test_get_cutoff_date(self):
        """Test calculation of cutoff date for log retention."""
        retention_days = 90
        service = audit_retention.AuditLogRetentionService(retention_days=retention_days)
        
        cutoff = service.get_cutoff_date()
        expected_cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
        
        # Should be within 1 second of expected
        assert abs((cutoff - expected_cutoff).total_seconds()) < 1
    
    @pytest.mark.asyncio
    async def test_cleanup_old_logs_returns_stats(self):
        """Test that cleanup returns statistics dictionary."""
        service = audit_retention.AuditLogRetentionService(retention_days=90)
        
        result = await service.cleanup_old_logs()
        
        assert isinstance(result, dict)
        assert "success" in result
        assert "cutoff_date" in result
        assert "retention_days" in result
    
    @pytest.mark.asyncio
    async def test_get_log_statistics(self):
        """Test getting log statistics."""
        service = audit_retention.AuditLogRetentionService(retention_days=90)
        
        stats = await service.get_log_statistics()
        
        assert isinstance(stats, dict)
        assert "retention_days" in stats
        assert "cutoff_date" in stats
    
    def test_should_cleanup_run_no_previous_cleanup(self):
        """Test cleanup decision when no previous cleanup exists."""
        service = audit_retention.AuditLogRetentionService()
        
        should_run = service.should_cleanup_run(None)
        assert should_run is True
    
    def test_should_cleanup_run_recent_cleanup(self):
        """Test cleanup decision when cleanup ran recently."""
        service = audit_retention.AuditLogRetentionService()
        
        recent_cleanup = datetime.now(timezone.utc) - timedelta(hours=12)
        should_run = service.should_cleanup_run(recent_cleanup)
        assert should_run is False
    
    def test_should_cleanup_run_old_cleanup(self):
        """Test cleanup decision when cleanup ran over a day ago."""
        service = audit_retention.AuditLogRetentionService()
        
        old_cleanup = datetime.now(timezone.utc) - timedelta(days=2)
        should_run = service.should_cleanup_run(old_cleanup)
        assert should_run is True


class TestAuditRetentionSingleton:
    """Tests for audit retention service singleton."""
    
    def test_get_singleton_returns_same_instance(self):
        """Test that get_audit_retention_service returns singleton."""
        # Single import style (no dual import/from) — CodeQL py/import-and-import-from
        audit_retention._retention_service = None
        
        service1 = audit_retention.get_audit_retention_service()
        service2 = audit_retention.get_audit_retention_service()
        
        assert service1 is service2
    
    def test_singleton_custom_retention_on_first_call(self):
        """Test that custom retention is only used on first call."""
        audit_retention._retention_service = None
        
        service1 = audit_retention.get_audit_retention_service(retention_days=45)
        service2 = audit_retention.get_audit_retention_service(retention_days=90)
        
        # Second call should return same instance with first call's retention
        assert service1 is service2
        assert service1.retention_days == 45
        assert service2.retention_days == 45
