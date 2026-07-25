/**
 * Stripe Client Singleton
 *
 * Server-only. Never import this from a "use client" component.
 * STRIPE_SECRET_KEY is required at runtime for any route that calls Stripe
 * (checkout, billing portal, webhook signature verification). It is NOT
 * required at build time — routes read it lazily via getStripe() so
 * `next build` succeeds without real keys configured.
 */

import Stripe from 'stripe';

/** Default pinned to the SDK's current API version (item-level current_period_end). */
const DEFAULT_STRIPE_API_VERSION = '2026-06-24.dahlia' as const;

function resolveStripeApiVersion(): Stripe.LatestApiVersion {
    const configured = process.env.STRIPE_API_VERSION?.trim();
    if (!configured) {
        return DEFAULT_STRIPE_API_VERSION;
    }
    // Stripe versions look like YYYY-MM-DD.name (e.g. 2026-06-24.dahlia)
    if (!/^\d{4}-\d{2}-\d{2}\.[a-z0-9_-]+$/i.test(configured)) {
        throw new Error(
            `STRIPE_API_VERSION is invalid (${JSON.stringify(configured)}). Expected format YYYY-MM-DD.name (e.g. ${DEFAULT_STRIPE_API_VERSION}).`
        );
    }
    return configured as Stripe.LatestApiVersion;
}

let cachedStripe: Stripe | null = null;

export function getStripe(): Stripe {
    if (cachedStripe) return cachedStripe;

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
        throw new Error(
            'STRIPE_SECRET_KEY is not set. Configure it in your environment before using billing routes.'
        );
    }

    cachedStripe = new Stripe(secretKey, {
        apiVersion: resolveStripeApiVersion(),
        appInfo: {
            name: 'MatchQuill',
        },
    });

    return cachedStripe;
}
