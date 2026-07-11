/**
 * Tests for admin authorization utilities
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isAdmin, requireAdmin, getAdminEmailsFromEnv } from '../admin';

vi.mock('../prisma', () => ({
    default: {
        user: {
            findUnique: vi.fn(),
        },
    },
}));

vi.mock('../logger', () => ({
    createLogger: () => ({
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

import prisma from '../prisma';

describe('getAdminEmailsFromEnv', () => {
    const original = process.env.ADMIN_EMAILS;

    afterEach(() => {
        if (original === undefined) {
            delete process.env.ADMIN_EMAILS;
        } else {
            process.env.ADMIN_EMAILS = original;
        }
    });

    it('returns empty set when env is unset', () => {
        delete process.env.ADMIN_EMAILS;
        expect(getAdminEmailsFromEnv().size).toBe(0);
    });

    it('parses comma-separated emails and normalizes case', () => {
        process.env.ADMIN_EMAILS = 'Admin@Example.com, other@test.com , ';
        const emails = getAdminEmailsFromEnv();
        expect(emails.has('admin@example.com')).toBe(true);
        expect(emails.has('other@test.com')).toBe(true);
        expect(emails.size).toBe(2);
    });
});

describe('isAdmin', () => {
    const original = process.env.ADMIN_EMAILS;

    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.ADMIN_EMAILS;
    });

    afterEach(() => {
        if (original === undefined) {
            delete process.env.ADMIN_EMAILS;
        } else {
            process.env.ADMIN_EMAILS = original;
        }
    });

    it('returns false for empty userId', async () => {
        expect(await isAdmin('')).toBe(false);
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('returns false when user does not exist', async () => {
        (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        expect(await isAdmin('missing')).toBe(false);
    });

    it('returns true when role is ADMIN', async () => {
        (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
            role: 'ADMIN',
            email: 'admin@example.com',
        });
        expect(await isAdmin('admin-1')).toBe(true);
    });

    it('returns false when role is USER', async () => {
        (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
            role: 'USER',
            email: 'user@example.com',
        });
        expect(await isAdmin('user-1')).toBe(false);
    });

    it('returns true for USER listed in ADMIN_EMAILS', async () => {
        process.env.ADMIN_EMAILS = 'bootstrap@example.com';
        (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
            role: 'USER',
            email: 'Bootstrap@Example.com',
        });
        expect(await isAdmin('user-1')).toBe(true);
    });

    it('fails closed when database throws', async () => {
        (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('db down')
        );
        expect(await isAdmin('user-1')).toBe(false);
    });
});

describe('requireAdmin', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.ADMIN_EMAILS;
    });

    it('returns ok for admins', async () => {
        (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
            role: 'ADMIN',
            email: 'admin@example.com',
        });
        const result = await requireAdmin('admin-1');
        expect(result).toEqual({ ok: true });
    });

    it('returns 403 for non-admins', async () => {
        (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
            role: 'USER',
            email: 'user@example.com',
        });
        const result = await requireAdmin('user-1');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.status).toBe(403);
            expect(result.error).toContain('Forbidden');
        }
    });
});
