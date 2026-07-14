/**
 * Tests for the billing checkout session route.
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

vi.mock('@/lib/subscription', () => ({
    priceIdForTier: vi.fn(),
    PURCHASABLE_TIERS: ['PRO'],
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
import { priceIdForTier } from '@/lib/subscription';
import { isRateLimited, getClientIP } from '@/lib/rate-limit';

function makeRequest(body: unknown) {
    return new NextRequest('http://localhost:3000/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

describe('POST /api/billing/checkout', () => {
    let sessionsCreate: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        (getClientIP as ReturnType<typeof vi.fn>).mockReturnValue('127.0.0.1');
        (isRateLimited as ReturnType<typeof vi.fn>).mockReturnValue({ limited: false });
        sessionsCreate = vi.fn();
        (getStripe as ReturnType<typeof vi.fn>).mockReturnValue({
            checkout: { sessions: { create: sessionsCreate } },
        });
        (priceIdForTier as ReturnType<typeof vi.fn>).mockReturnValue('price_pro_monthly');
    });

    it('rejects unauthenticated requests', async () => {
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await POST(makeRequest({ tier: 'PRO' }));
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
        expect(sessionsCreate).not.toHaveBeenCalled();
    });

    it('rejects sessions with no email on the user', async () => {
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'user-1' } });

        const response = await POST(makeRequest({ tier: 'PRO' }));

        expect(response.status).toBe(401);
        expect(sessionsCreate).not.toHaveBeenCalled();
    });

    it('enforces rate limiting', async () => {
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
            user: { id: 'user-1', email: 'a@b.com' },
        });
        (isRateLimited as ReturnType<typeof vi.fn>).mockReturnValue({ limited: true });

        const response = await POST(makeRequest({ tier: 'PRO' }));
        const data = await response.json();

        expect(response.status).toBe(429);
        expect(data.error).toContain('Too many requests');
    });

    it('rejects invalid JSON bodies', async () => {
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
            user: { id: 'user-1', email: 'a@b.com' },
        });

        const request = new NextRequest('http://localhost:3000/api/billing/checkout', {
            method: 'POST',
            body: 'not-json',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid request body');
    });

    it('rejects a tier that is not purchasable', async () => {
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
            user: { id: 'user-1', email: 'a@b.com' },
        });

        const response = await POST(makeRequest({ tier: 'TEAM' }));
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('tier must be one of');
        expect(sessionsCreate).not.toHaveBeenCalled();
    });

    it('creates a checkout session for a new customer using customer_email', async () => {
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
            user: { id: 'user-1', email: 'a@b.com' },
        });
        (prisma.userSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        sessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session/abc' });

        const response = await POST(makeRequest({ tier: 'PRO' }));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.url).toBe('https://checkout.stripe.com/session/abc');
        expect(sessionsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'subscription',
                customer: undefined,
                customer_email: 'a@b.com',
                client_reference_id: 'user-1',
                line_items: [{ price: 'price_pro_monthly', quantity: 1 }],
            })
        );
    });

    it('reuses the existing Stripe customer when one is already on file', async () => {
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
            user: { id: 'user-1', email: 'a@b.com' },
        });
        (prisma.userSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
            stripeCustomerId: 'cus_existing',
        });
        sessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session/xyz' });

        const response = await POST(makeRequest({ tier: 'PRO' }));

        expect(response.status).toBe(200);
        expect(sessionsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                customer: 'cus_existing',
                customer_email: undefined,
            })
        );
    });

    it('returns 500 when Stripe does not return a checkout URL', async () => {
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
            user: { id: 'user-1', email: 'a@b.com' },
        });
        (prisma.userSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        sessionsCreate.mockResolvedValue({ url: null });

        const response = await POST(makeRequest({ tier: 'PRO' }));
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to start checkout');
    });

    it('returns 500 when Stripe throws', async () => {
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
            user: { id: 'user-1', email: 'a@b.com' },
        });
        (prisma.userSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        sessionsCreate.mockRejectedValue(new Error('stripe down'));

        const response = await POST(makeRequest({ tier: 'PRO' }));
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to start checkout');
    });
});
