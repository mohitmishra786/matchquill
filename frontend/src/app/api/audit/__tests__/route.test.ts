/**
 * Tests for Audit Log API Security (IDOR / admin bypass)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, DELETE } from '@/app/api/audit/route';

vi.mock('@/lib/auth', () => ({
    auth: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        user: {
            findUnique: vi.fn(),
        },
        auditLog: {
            findMany: vi.fn(),
            count: vi.fn(),
        },
    },
}));

vi.mock('@/lib/admin', () => ({
    requireAdmin: vi.fn(),
    isAdmin: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
    getUserAuditLogs: vi.fn(),
    getRecentAuditLogs: vi.fn(),
    getAuditStats: vi.fn(),
    cleanupOldAuditLogs: vi.fn(),
    getEntityAuditLogs: vi.fn(),
    auditFromRequest: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
    createRequestLogger: () => ({
        startOperation: vi.fn(),
        endOperation: vi.fn(),
        failOperation: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
    getOrCreateRequestId: () => 'test-request-id',
}));

import { auth } from '@/lib/auth';
import { requireAdmin } from '@/lib/admin';
import {
    getRecentAuditLogs,
    getUserAuditLogs,
    cleanupOldAuditLogs,
} from '@/lib/audit';

describe('Audit API Security', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /api/audit', () => {
        it('should reject unauthenticated requests', async () => {
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

            const request = new NextRequest('http://localhost:3000/api/audit');
            const response = await GET(request);

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.error).toBe('Unauthorized');
        });

        it('should reject non-admin users (IDOR prevention)', async () => {
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
                user: { id: 'user-123' },
            });
            (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
                ok: false,
                status: 403,
                error: 'Forbidden: admin privileges required',
            });

            // Even with a target userId in query, non-admins must not access logs
            const request = new NextRequest(
                'http://localhost:3000/api/audit?userId=victim-user-456'
            );
            const response = await GET(request);

            expect(response.status).toBe(403);
            const data = await response.json();
            expect(data.error).toContain('Forbidden');
            expect(getUserAuditLogs).not.toHaveBeenCalled();
            expect(getRecentAuditLogs).not.toHaveBeenCalled();
        });

        it('should allow admin users', async () => {
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
                user: { id: 'admin-123' },
            });
            (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
            (getRecentAuditLogs as ReturnType<typeof vi.fn>).mockResolvedValue([]);

            const request = new NextRequest('http://localhost:3000/api/audit');
            const response = await GET(request);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.logs).toEqual([]);
            expect(getRecentAuditLogs).toHaveBeenCalled();
        });

        it('should allow admin to filter by any userId', async () => {
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
                user: { id: 'admin-123' },
            });
            (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
            (getUserAuditLogs as ReturnType<typeof vi.fn>).mockResolvedValue({
                logs: [{ id: 'log-1' }],
                total: 1,
            });

            const request = new NextRequest(
                'http://localhost:3000/api/audit?userId=other-user'
            );
            const response = await GET(request);

            expect(response.status).toBe(200);
            expect(getUserAuditLogs).toHaveBeenCalledWith(
                'other-user',
                expect.objectContaining({ limit: 50, offset: 0 })
            );
        });
    });

    describe('DELETE /api/audit', () => {
        it('should reject unauthenticated requests', async () => {
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

            const request = new NextRequest('http://localhost:3000/api/audit', {
                method: 'DELETE',
            });
            const response = await DELETE(request);

            expect(response.status).toBe(401);
        });

        it('should reject non-admin users', async () => {
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
                user: { id: 'user-123' },
            });
            (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
                ok: false,
                status: 403,
                error: 'Forbidden: admin privileges required',
            });

            const request = new NextRequest('http://localhost:3000/api/audit', {
                method: 'DELETE',
            });
            const response = await DELETE(request);

            expect(response.status).toBe(403);
            expect(cleanupOldAuditLogs).not.toHaveBeenCalled();
        });

        it('should allow admin cleanup', async () => {
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
                user: { id: 'admin-123' },
            });
            (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
            (cleanupOldAuditLogs as ReturnType<typeof vi.fn>).mockResolvedValue(5);

            const request = new NextRequest(
                'http://localhost:3000/api/audit?retentionDays=90',
                { method: 'DELETE' }
            );
            const response = await DELETE(request);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.deleted).toBe(5);
            expect(cleanupOldAuditLogs).toHaveBeenCalledWith(90);
        });
    });
});
