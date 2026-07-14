/**
 * Audit Logging Utility Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    createAuditLog,
    auditFromRequest,
    sanitizeForAudit,
    calculateDiff,
    auditCreate,
    auditUpdate,
    auditDelete,
    auditAuth,
    auditExport,
    auditImport,
    getEntityAuditLogs,
    getUserAuditLogs,
    getRecentAuditLogs,
    getAuditStats,
    cleanupOldAuditLogs,
    archiveOldAuditLogs,
} from '../audit';
import prisma from '../prisma';
import { logger } from '../logger';
import type { NextRequest } from 'next/server';

// Mock prisma
// audit.ts imports the named `prisma` export (not default), so the mock
// must provide both to match the real module shape.
vi.mock('../prisma', () => {
    const mockPrisma = {
        auditLog: {
            create: vi.fn(),
            findMany: vi.fn(),
            count: vi.fn(),
            deleteMany: vi.fn(),
            groupBy: vi.fn(),
        },
    };
    return {
        prisma: mockPrisma,
        default: mockPrisma,
    };
});

describe('createAuditLog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should create audit log with all fields', async () => {
        (prisma.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'log-1' });

        await createAuditLog({
            userId: 'user-1',
            action: 'CREATE',
            entityType: 'Experience',
            entityId: 'exp-1',
            oldValues: { name: 'old' },
            newValues: { name: 'new' },
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
            requestId: 'req-1',
            metadata: { source: 'api' },
        });

        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'user-1',
                action: 'CREATE',
                entityType: 'Experience',
                entityId: 'exp-1',
                oldValues: { name: 'old' },
                newValues: { name: 'new' },
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0',
                requestId: 'req-1',
                metadata: { source: 'api' },
            }),
        });
    });

    it('should handle missing optional fields', async () => {
        (prisma.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'log-1' });

        await createAuditLog({
            action: 'VIEW',
            entityType: 'Profile',
        });

        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: 'VIEW',
                entityType: 'Profile',
                userId: undefined,
                entityId: undefined,
                oldValues: null,
                newValues: null,
                ipAddress: undefined,
                userAgent: undefined,
                requestId: undefined,
                metadata: null,
            }),
        });
    });

    it('should not throw on database error', async () => {
        (prisma.auditLog.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));
        // createAuditLog now reports failures through the structured `logger`
        // (see src/lib/logger.ts) rather than raw console.error.
        const loggerSpy = vi.spyOn(logger, 'warn').mockImplementation(() => { });

        await expect(
            createAuditLog({
                action: 'CREATE',
                entityType: 'User',
            })
        ).resolves.not.toThrow();

        expect(loggerSpy).toHaveBeenCalledWith(
            '[Audit] Failed to create audit log',
            expect.objectContaining({ error: expect.any(Error) })
        );
        loggerSpy.mockRestore();
    });
});

describe('auditFromRequest', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should extract IP and user agent from request', async () => {
        (prisma.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'log-1' });

        const request = {
            headers: new Headers({
                'x-forwarded-for': '192.168.1.1, 10.0.0.1',
                'user-agent': 'Mozilla/5.0',
                'x-request-id': 'req-1',
            }),
        } as unknown as NextRequest;

        await auditFromRequest(request, {
            userId: 'user-1',
            action: 'CREATE',
            entityType: 'Experience',
        });

        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'user-1',
                action: 'CREATE',
                entityType: 'Experience',
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0',
                requestId: 'req-1',
            }),
        });
    });

    it('should use x-real-ip when x-forwarded-for is not present', async () => {
        (prisma.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'log-1' });

        const request = {
            headers: new Headers({
                'x-real-ip': '10.0.0.1',
            }),
        } as unknown as NextRequest;

        await auditFromRequest(request, {
            action: 'VIEW',
            entityType: 'Profile',
        });

        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                ipAddress: '10.0.0.1',
            }),
        });
    });
});

describe('sanitizeForAudit', () => {
    it('should redact sensitive fields', () => {
        const data = {
            name: 'John',
            password: 'secret123',
            passwordHash: 'hash123',
            token: 'abc123',
            accessToken: 'access123',
            refreshToken: 'refresh123',
            apiKey: 'key123',
            normalField: 'value',
        };

        const sanitized = sanitizeForAudit(data);

        expect(sanitized.name).toBe('John');
        expect(sanitized.password).toBe('[REDACTED]');
        expect(sanitized.passwordHash).toBe('[REDACTED]');
        expect(sanitized.token).toBe('[REDACTED]');
        expect(sanitized.accessToken).toBe('[REDACTED]');
        expect(sanitized.refreshToken).toBe('[REDACTED]');
        expect(sanitized.apiKey).toBe('[REDACTED]');
        expect(sanitized.normalField).toBe('value');
    });

    it('should recursively sanitize nested objects', () => {
        const data = {
            user: {
                name: 'John',
                password: 'secret',
            },
            settings: {
                apiKey: 'key123',
            },
        };

        const sanitized = sanitizeForAudit(data);

        expect((sanitized.user as Record<string, unknown>).name).toBe('John');
        expect((sanitized.user as Record<string, unknown>).password).toBe('[REDACTED]');
        expect((sanitized.settings as Record<string, unknown>).apiKey).toBe('[REDACTED]');
    });
});

describe('calculateDiff', () => {
    it('should return only changed fields', () => {
        const oldValues = { name: 'John', age: 30, city: 'NYC' };
        const newValues = { name: 'Jane', age: 30, city: 'LA' };

        const diff = calculateDiff(oldValues, newValues);

        expect(diff.oldValues).toEqual({ name: 'John', city: 'NYC' });
        expect(diff.newValues).toEqual({ name: 'Jane', city: 'LA' });
    });

    it('should detect added fields', () => {
        const oldValues = { name: 'John' };
        const newValues = { name: 'John', age: 30 };

        const diff = calculateDiff(oldValues, newValues);

        expect(diff.oldValues).toEqual({ age: undefined });
        expect(diff.newValues).toEqual({ age: 30 });
    });

    it('should detect removed fields', () => {
        const oldValues = { name: 'John', age: 30 };
        const newValues = { name: 'John' };

        const diff = calculateDiff(oldValues, newValues);

        expect(diff.oldValues).toEqual({ age: 30 });
        expect(diff.newValues).toEqual({ age: undefined });
    });
});

describe('auditCreate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should log create action', async () => {
        (prisma.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'log-1' });

        const request = {
            headers: new Headers(),
        } as unknown as NextRequest;

        await auditCreate(request, 'user-1', 'Experience', 'exp-1', { name: 'New Exp' }, { source: 'api' });

        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'user-1',
                action: 'CREATE',
                entityType: 'Experience',
                entityId: 'exp-1',
                newValues: { name: 'New Exp' },
                metadata: { source: 'api' },
            }),
        });
    });
});

describe('auditUpdate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should log update with diff', async () => {
        (prisma.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'log-1' });

        const request = {
            headers: new Headers(),
        } as unknown as NextRequest;

        await auditUpdate(
            request,
            'user-1',
            'Experience',
            'exp-1',
            { name: 'Old Name', age: 30 },
            { name: 'New Name', age: 30 }
        );

        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'user-1',
                action: 'UPDATE',
                entityType: 'Experience',
                entityId: 'exp-1',
                oldValues: { name: 'Old Name' },
                newValues: { name: 'New Name' },
            }),
        });
    });
});

describe('auditDelete', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should log delete action', async () => {
        (prisma.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'log-1' });

        const request = {
            headers: new Headers(),
        } as unknown as NextRequest;

        await auditDelete(request, 'user-1', 'Experience', 'exp-1', { name: 'Exp to Delete' });

        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'user-1',
                action: 'DELETE',
                entityType: 'Experience',
                entityId: 'exp-1',
                oldValues: { name: 'Exp to Delete' },
            }),
        });
    });
});

describe('auditAuth', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should log login success', async () => {
        (prisma.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'log-1' });

        const request = {
            headers: new Headers(),
        } as unknown as NextRequest;

        await auditAuth(request, 'LOGIN', 'user-1', true);

        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'user-1',
                action: 'LOGIN',
                entityType: 'User',
                entityId: 'user-1',
                metadata: { success: true },
            }),
        });
    });

    it('should log login failure', async () => {
        (prisma.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'log-1' });

        const request = {
            headers: new Headers(),
        } as unknown as NextRequest;

        await auditAuth(request, 'LOGIN', undefined, false, { reason: 'invalid_credentials' });

        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: 'LOGIN',
                metadata: { success: false, reason: 'invalid_credentials' },
            }),
        });
    });
});

describe('auditExport', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should log export action', async () => {
        (prisma.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'log-1' });

        const request = {
            headers: new Headers(),
        } as unknown as NextRequest;

        await auditExport(request, 'user-1', 'Profile', 'PDF');

        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'user-1',
                action: 'EXPORT',
                entityType: 'Profile',
                metadata: { format: 'PDF' },
            }),
        });
    });
});

describe('auditImport', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should log import action', async () => {
        (prisma.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'log-1' });

        const request = {
            headers: new Headers(),
        } as unknown as NextRequest;

        await auditImport(request, 'user-1', 'Experience', 'LinkedIn', 5);

        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'user-1',
                action: 'IMPORT',
                entityType: 'Experience',
                metadata: { source: 'LinkedIn', recordCount: 5 },
            }),
        });
    });
});

describe('getEntityAuditLogs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch logs for entity', async () => {
        const mockLogs = [{ id: 'log-1' }, { id: 'log-2' }];
        (prisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockLogs);
        (prisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

        const result = await getEntityAuditLogs('Experience', 'exp-1');

        expect(result.logs).toEqual(mockLogs);
        expect(result.total).toBe(2);
        expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
            where: { entityType: 'Experience', entityId: 'exp-1' },
            orderBy: { createdAt: 'desc' },
            take: 50,
            skip: 0,
            include: { user: { select: { id: true, name: true, email: true } } },
        });
    });

    it('should filter by actions', async () => {
        (prisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (prisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

        await getEntityAuditLogs('Experience', 'exp-1', { actions: ['CREATE', 'UPDATE'] });

        expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
            where: { entityType: 'Experience', entityId: 'exp-1', action: { in: ['CREATE', 'UPDATE'] } },
            orderBy: { createdAt: 'desc' },
            take: 50,
            skip: 0,
            include: { user: { select: { id: true, name: true, email: true } } },
        });
    });
});

describe('getUserAuditLogs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch logs for user', async () => {
        const mockLogs = [{ id: 'log-1' }];
        (prisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockLogs);
        (prisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

        const result = await getUserAuditLogs('user-1');

        expect(result.logs).toEqual(mockLogs);
        expect(result.total).toBe(1);
    });

    it('should filter by date range', async () => {
        (prisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (prisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-12-31');

        await getUserAuditLogs('user-1', { startDate, endDate });

        expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
            where: {
                userId: 'user-1',
                createdAt: { gte: startDate, lte: endDate },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
            skip: 0,
        });
    });
});

describe('getRecentAuditLogs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch recent logs', async () => {
        const mockLogs = [{ id: 'log-1' }, { id: 'log-2' }];
        (prisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockLogs);

        const result = await getRecentAuditLogs({ limit: 10 });

        expect(result).toEqual(mockLogs);
        expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
            where: {},
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { user: { select: { id: true, name: true, email: true } } },
        });
    });
});

describe('getAuditStats', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return audit statistics', async () => {
        (prisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(100);
        (prisma.auditLog.groupBy as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce([
                { action: 'CREATE', _count: { action: 50 } },
                { action: 'UPDATE', _count: { action: 30 } },
            ])
            .mockResolvedValueOnce([
                { entityType: 'Experience', _count: { entityType: 40 } },
                { entityType: 'Skill', _count: { entityType: 40 } },
            ]);

        const result = await getAuditStats();

        expect(result.totalCount).toBe(100);
        expect(result.actionCounts).toEqual([
            { action: 'CREATE', count: 50 },
            { action: 'UPDATE', count: 30 },
        ]);
        expect(result.entityTypeCounts).toEqual([
            { entityType: 'Experience', count: 40 },
            { entityType: 'Skill', count: 40 },
        ]);
    });
});

describe('cleanupOldAuditLogs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should delete old logs', async () => {
        (prisma.auditLog.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 50 });

        const result = await cleanupOldAuditLogs(365);

        expect(result).toBe(50);
        expect(prisma.auditLog.deleteMany).toHaveBeenCalledWith({
            where: {
                createdAt: {
                    lt: expect.any(Date),
                },
            },
        });
    });
});

describe('archiveOldAuditLogs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should archive and delete old logs', async () => {
        const mockLogs = [{ id: 'log-1' }, { id: 'log-2' }];
        (prisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockLogs);
        (prisma.auditLog.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });

        const result = await archiveOldAuditLogs(365);

        expect(result).toEqual(mockLogs);
        expect(prisma.auditLog.findMany).toHaveBeenCalled();
        expect(prisma.auditLog.deleteMany).toHaveBeenCalled();
    });
});
