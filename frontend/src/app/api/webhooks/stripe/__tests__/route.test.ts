/**
 * Tests for the Stripe webhook receiver.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

// Mock dependencies
vi.mock('@/lib/stripe', () => ({
    getStripe: vi.fn(),
}));

vi.mock('@/lib/subscription', () => ({
    findUserByStripeCustomerId: vi.fn(),
    tierForPriceId: vi.fn(),
    upsertSubscriptionState: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

import { getStripe } from '@/lib/stripe';
import {
    findUserByStripeCustomerId,
    tierForPriceId,
    upsertSubscriptionState,
} from '@/lib/subscription';

function makeRequest(body: unknown, signature: string | null = 'test-signature') {
    const headers: Record<string, string> = {};
    if (signature !== null) headers['stripe-signature'] = signature;
    return new NextRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
}

describe('POST /api/webhooks/stripe', () => {
    let constructEvent: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test_secret');
        constructEvent = vi.fn();
        (getStripe as ReturnType<typeof vi.fn>).mockReturnValue({
            webhooks: { constructEvent },
        });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('rejects when STRIPE_WEBHOOK_SECRET is not configured', async () => {
        vi.stubEnv('STRIPE_WEBHOOK_SECRET', '');

        const response = await POST(makeRequest({ type: 'checkout.session.completed' }));
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Webhook not configured');
        expect(constructEvent).not.toHaveBeenCalled();
    });

    it('rejects when the stripe-signature header is missing', async () => {
        const response = await POST(makeRequest({ type: 'checkout.session.completed' }, null));
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Missing stripe-signature header');
    });

    it('rejects when signature verification fails', async () => {
        constructEvent.mockImplementation(() => {
            throw new Error('signature mismatch');
        });

        const response = await POST(makeRequest({ type: 'checkout.session.completed' }));
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid signature');
        expect(upsertSubscriptionState).not.toHaveBeenCalled();
    });

    it('handles checkout.session.completed by setting PRO tier and ACTIVE status', async () => {
        constructEvent.mockReturnValue({
            type: 'checkout.session.completed',
            data: {
                object: {
                    client_reference_id: 'user-1',
                    customer: 'cus_123',
                    subscription: 'sub_123',
                },
            },
        });
        (upsertSubscriptionState as ReturnType<typeof vi.fn>).mockResolvedValue({});

        const response = await POST(makeRequest({}));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.received).toBe(true);
        expect(upsertSubscriptionState).toHaveBeenCalledWith('user-1', {
            stripeCustomerId: 'cus_123',
            stripeSubscriptionId: 'sub_123',
            subscriptionStatus: 'ACTIVE',
            subscriptionTier: 'PRO',
        });
    });

    it('skips checkout.session.completed when userId or customerId is missing', async () => {
        constructEvent.mockReturnValue({
            type: 'checkout.session.completed',
            data: {
                object: {
                    client_reference_id: null,
                    customer: 'cus_123',
                    subscription: 'sub_123',
                },
            },
        });

        const response = await POST(makeRequest({}));

        expect(response.status).toBe(200);
        expect(upsertSubscriptionState).not.toHaveBeenCalled();
    });

    it('handles customer.subscription.updated by syncing tier from the price ID', async () => {
        constructEvent.mockReturnValue({
            type: 'customer.subscription.updated',
            data: {
                object: {
                    id: 'sub_123',
                    customer: 'cus_123',
                    status: 'active',
                    cancel_at_period_end: false,
                    current_period_end: 1893456000,
                    items: { data: [{ price: { id: 'price_pro_monthly' } }] },
                },
            },
        });
        (findUserByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue({
            userId: 'user-1',
        });
        (tierForPriceId as ReturnType<typeof vi.fn>).mockReturnValue('PRO');
        (upsertSubscriptionState as ReturnType<typeof vi.fn>).mockResolvedValue({});

        const response = await POST(makeRequest({}));

        expect(response.status).toBe(200);
        expect(tierForPriceId).toHaveBeenCalledWith('price_pro_monthly');
        expect(upsertSubscriptionState).toHaveBeenCalledWith('user-1', {
            subscriptionTier: 'PRO',
            subscriptionStatus: 'ACTIVE',
            stripeSubscriptionId: 'sub_123',
            stripePriceId: 'price_pro_monthly',
            currentPeriodEnd: new Date(1893456000 * 1000),
            cancelAtPeriodEnd: false,
        });
    });

    it('reverts tier to FREE when a subscription moves to past_due', async () => {
        constructEvent.mockReturnValue({
            type: 'customer.subscription.updated',
            data: {
                object: {
                    id: 'sub_123',
                    customer: 'cus_123',
                    status: 'past_due',
                    cancel_at_period_end: false,
                    current_period_end: 1893456000,
                    items: { data: [{ price: { id: 'price_pro_monthly' } }] },
                },
            },
        });
        (findUserByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue({
            userId: 'user-1',
        });
        (upsertSubscriptionState as ReturnType<typeof vi.fn>).mockResolvedValue({});

        await POST(makeRequest({}));

        expect(upsertSubscriptionState).toHaveBeenCalledWith(
            'user-1',
            expect.objectContaining({
                subscriptionTier: 'FREE',
                subscriptionStatus: 'PAST_DUE',
            })
        );
    });

    it('handles customer.subscription.deleted by reverting to FREE/CANCELED', async () => {
        constructEvent.mockReturnValue({
            type: 'customer.subscription.deleted',
            data: {
                object: {
                    id: 'sub_123',
                    customer: 'cus_123',
                    status: 'canceled',
                    cancel_at_period_end: false,
                    current_period_end: null,
                    items: { data: [] },
                },
            },
        });
        (findUserByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue({
            userId: 'user-1',
        });
        (upsertSubscriptionState as ReturnType<typeof vi.fn>).mockResolvedValue({});

        const response = await POST(makeRequest({}));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.received).toBe(true);
        expect(upsertSubscriptionState).toHaveBeenCalledWith('user-1', {
            subscriptionTier: 'FREE',
            subscriptionStatus: 'CANCELED',
            stripeSubscriptionId: 'sub_123',
            stripePriceId: null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
        });
    });

    it('does not upsert when no UserSettings row owns the Stripe customer', async () => {
        constructEvent.mockReturnValue({
            type: 'customer.subscription.updated',
            data: {
                object: {
                    id: 'sub_123',
                    customer: 'cus_unknown',
                    status: 'active',
                    cancel_at_period_end: false,
                    current_period_end: null,
                    items: { data: [] },
                },
            },
        });
        (findUserByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await POST(makeRequest({}));

        expect(response.status).toBe(200);
        expect(upsertSubscriptionState).not.toHaveBeenCalled();
    });

    it('returns 500 (so Stripe retries) when the handler throws', async () => {
        constructEvent.mockReturnValue({
            type: 'checkout.session.completed',
            data: {
                object: {
                    client_reference_id: 'user-1',
                    customer: 'cus_123',
                    subscription: 'sub_123',
                },
            },
        });
        (upsertSubscriptionState as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));

        const response = await POST(makeRequest({}));
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Webhook handler failed');
    });

    it('ignores unhandled event types', async () => {
        constructEvent.mockReturnValue({
            type: 'invoice.paid',
            data: { object: {} },
        });

        const response = await POST(makeRequest({}));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.received).toBe(true);
        expect(upsertSubscriptionState).not.toHaveBeenCalled();
    });
});
