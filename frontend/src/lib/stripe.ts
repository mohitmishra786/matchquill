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
        apiVersion: '2026-06-24.dahlia',
        appInfo: {
            name: 'MatchQuill',
        },
    });

    return cachedStripe;
}
