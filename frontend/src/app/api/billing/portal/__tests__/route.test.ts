/**
 * Tests for the billing portal session route.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

// Mock dependencies
vi.mock('@/lib/auth', () => ({
    auth: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        userSettings: {
            findUnique: vi.fn(),
        },
    },
}));

vi.mock('@/lib/stripe', () => ({
    getStripe: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
    isRateLimited: vi.fn(),
    getClientIP: vi.fn(),
    rateLimits: {
        billing: { maxRequests: 10, windowMs: 900000 },
    },
}));

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';
import { isRateLimited, getClientIP } from '@/lib/rate-limit';

function makeRequest() {
    return new NextRequest('http://localhost:3000/api/billing/portal', {
        method: 'POST',
    });
}

describe('POST /api/billing/portal', () => {
    let portalCreate: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        (getClientIP as ReturnType<typeof vi.fn>).mockReturnValue('127.0.0.1');
        (isRateLimited as ReturnType<typeof vi.fn>).mockReturnValue({ limited: false });
        portalCreate = vi.fn();
        (getStripe as ReturnType<typeof vi.fn>).mockReturnValue({
            billingPortal: { sessions: { create: portalCreate } },
        });
    });

    it('rejects unauthenticated requests', async () => {
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await POST(makeRequest());
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
        expect(portalCreate).not.toHaveBeenCalled();
    });

    it('enforces rate limiting', async () => {
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'user-1' } });
        (isRateLimited as ReturnType<typeof vi.fn>).mockReturnValue({ limited: true });

        const response = await POST(makeRequest());
        const data = await response.json();

        expect(response.status).toBe(429);
        expect(data.error).toContain('Too many requests');
    });

    it('returns 404 when the user has no billing account on file', async () => {
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'user-1' } });
        (prisma.userSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await POST(makeRequest());
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('No billing account found. Subscribe to a paid plan first.');
        expect(portalCreate).not.toHaveBeenCalled();
    });

    it('creates a billing portal session for the authenticated user', async () => {
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'user-1' } });
        (prisma.userSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
            stripeCustomerId: 'cus_123',
        });
        portalCreate.mockResolvedValue({ url: 'https://billing.stripe.com/session/abc' });

        const response = await POST(makeRequest());
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.url).toBe('https://billing.stripe.com/session/abc');
        expect(portalCreate).toHaveBeenCalledWith({
            customer: 'cus_123',
            return_url: 'http://localhost:3000/settings',
        });
    });

    it('returns 500 when Stripe throws', async () => {
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'user-1' } });
        (prisma.userSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
            stripeCustomerId: 'cus_123',
        });
        portalCreate.mockRejectedValue(new Error('stripe down'));

        const response = await POST(makeRequest());
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to open billing portal');
    });
});
