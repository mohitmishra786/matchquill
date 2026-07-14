/**
 * Tests for subscription/billing helpers: tier definitions, price-ID
 * mapping, and the thin Prisma read/write wrappers around UserSettings.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../prisma', () => ({
    default: {
        userSettings: {
            findUnique: vi.fn(),
            upsert: vi.fn(),
        },
    },
}));

import prisma from '../prisma';
import {
    TIERS,
    PURCHASABLE_TIERS,
    tierForPriceId,
    priceIdForTier,
    getUserTier,
    upsertSubscriptionState,
    findUserByStripeCustomerId,
} from '../subscription';

describe('TIERS / PURCHASABLE_TIERS', () => {
    it('defines the expected tier set', () => {
        expect(TIERS).toEqual(['FREE', 'PRO', 'TEAM']);
    });

    it('only exposes PRO as purchasable today', () => {
        expect(PURCHASABLE_TIERS).toEqual(['PRO']);
    });
});

describe('tierForPriceId', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('returns null for a null or undefined price ID', () => {
        expect(tierForPriceId(null)).toBeNull();
        expect(tierForPriceId(undefined)).toBeNull();
    });

    it('maps a configured price ID to its tier', () => {
        vi.stubEnv('STRIPE_PRICE_ID_PRO_MONTHLY', 'price_pro_monthly');
        expect(tierForPriceId('price_pro_monthly')).toBe('PRO');
    });

    it('returns null for a price ID that matches no configured tier', () => {
        vi.stubEnv('STRIPE_PRICE_ID_PRO_MONTHLY', 'price_pro_monthly');
        expect(tierForPriceId('price_unknown')).toBeNull();
    });
});

describe('priceIdForTier', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('returns the configured Stripe price ID for PRO', () => {
        vi.stubEnv('STRIPE_PRICE_ID_PRO_MONTHLY', 'price_pro_monthly');
        expect(priceIdForTier('PRO')).toBe('price_pro_monthly');
    });

    it('throws a descriptive error when the price ID env var is unset', () => {
        vi.stubEnv('STRIPE_PRICE_ID_PRO_MONTHLY', '');
        expect(() => priceIdForTier('PRO')).toThrow(
            /No Stripe price ID configured for tier PRO.*STRIPE_PRICE_ID_PRO_MONTHLY/
        );
    });
});

describe('getUserTier', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the tier stored on UserSettings', async () => {
        (prisma.userSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
            subscriptionTier: 'PRO',
        });

        const tier = await getUserTier('user-1');

        expect(tier).toBe('PRO');
        expect(prisma.userSettings.findUnique).toHaveBeenCalledWith({
            where: { userId: 'user-1' },
            select: { subscriptionTier: true },
        });
    });

    it('defaults to FREE when there is no UserSettings row', async () => {
        (prisma.userSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const tier = await getUserTier('user-1');

        expect(tier).toBe('FREE');
    });
});

describe('upsertSubscriptionState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('upserts billing fields keyed by userId, creating the row if needed', async () => {
        (prisma.userSettings.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

        await upsertSubscriptionState('user-1', {
            subscriptionTier: 'PRO',
            subscriptionStatus: 'ACTIVE',
            stripeCustomerId: 'cus_123',
        });

        expect(prisma.userSettings.upsert).toHaveBeenCalledWith({
            where: { userId: 'user-1' },
            create: {
                userId: 'user-1',
                subscriptionTier: 'PRO',
                subscriptionStatus: 'ACTIVE',
                stripeCustomerId: 'cus_123',
            },
            update: {
                subscriptionTier: 'PRO',
                subscriptionStatus: 'ACTIVE',
                stripeCustomerId: 'cus_123',
            },
        });
    });
});

describe('findUserByStripeCustomerId', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('looks up the owning UserSettings row, including the user relation', async () => {
        (prisma.userSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
            userId: 'user-1',
            user: { id: 'user-1', email: 'a@b.com' },
        });

        const owner = await findUserByStripeCustomerId('cus_123');

        expect(owner?.userId).toBe('user-1');
        expect(prisma.userSettings.findUnique).toHaveBeenCalledWith({
            where: { stripeCustomerId: 'cus_123' },
            include: { user: { select: { id: true, email: true } } },
        });
    });

    it('returns null when no row owns the given Stripe customer ID', async () => {
        (prisma.userSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const owner = await findUserByStripeCustomerId('cus_unknown');

        expect(owner).toBeNull();
    });
});
