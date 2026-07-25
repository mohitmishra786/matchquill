/**
 * POST /api/webhooks/stripe
 *
 * Stripe webhook receiver. Registering this endpoint in the Stripe Dashboard
 * (or via `stripe listen` in dev) is a HUMAN ACTION — see
 * docs/monetization-decision.md and the PR description.
 *
 * Handles the three events needed to keep UserSettings.subscriptionTier in
 * sync with Stripe:
 *   - checkout.session.completed   -> user just subscribed, set tier + ids
 *   - customer.subscription.updated -> plan/status changed (upgrade, downgrade,
 *                                       past_due, cancel_at_period_end toggled)
 *   - customer.subscription.deleted -> subscription fully ended, revert to FREE
 *
 * This route MUST run on the Node.js runtime (not edge) because the Stripe
 * SDK's signature verification uses Node's crypto module, and it must read
 * the raw request body (no JSON parsing) for signature verification to work.
 */

import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import {
    findUserByStripeCustomerId,
    tierForPriceId,
    upsertSubscriptionState,
} from '@/lib/subscription';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

function mapStripeStatus(status: Stripe.Subscription.Status): 'ACTIVE' | 'PAST_DUE' | 'CANCELED' {
    switch (status) {
        case 'active':
        case 'trialing':
            return 'ACTIVE';
        case 'past_due':
        case 'unpaid':
        case 'incomplete':
            return 'PAST_DUE';
        default:
            // canceled, incomplete_expired, paused, etc.
            return 'CANCELED';
    }
}

async function syncSubscription(subscription: Stripe.Subscription) {
    const customerId =
        typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

    const owner = await findUserByStripeCustomerId(customerId);
    if (!owner) {
        logger.warn('[StripeWebhook] No UserSettings found for Stripe customer', { customerId });
        return;
    }

    // Stripe API 2026-06-24+: current_period_end lives on subscription items,
    // not the top-level Subscription object.
    const primaryItem = subscription.items.data[0];
    const priceId = primaryItem?.price?.id ?? null;
    const periodEnd = primaryItem?.current_period_end ?? null;
    const status = mapStripeStatus(subscription.status);
    const tier = status === 'ACTIVE' ? tierForPriceId(priceId) ?? 'PRO' : 'FREE';

    await upsertSubscriptionState(owner.userId, {
        subscriptionTier: status === 'CANCELED' ? 'FREE' : tier,
        subscriptionStatus: status,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });

    logger.info('[StripeWebhook] Synced subscription', {
        userId: owner.userId,
        tier,
        status,
        subscriptionId: subscription.id,
    });
}

export async function POST(request: NextRequest) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        logger.error('[StripeWebhook] STRIPE_WEBHOOK_SECRET is not configured');
        return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    const signature = request.headers.get('stripe-signature');
    if (!signature) {
        return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    const rawBody = await request.text();

    let event: Stripe.Event;
    try {
        const stripe = getStripe();
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
        logger.warn('[StripeWebhook] Signature verification failed', { error });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const checkoutSession = event.data.object as Stripe.Checkout.Session;
                const userId = checkoutSession.client_reference_id;
                const customerId =
                    typeof checkoutSession.customer === 'string'
                        ? checkoutSession.customer
                        : checkoutSession.customer?.id;
                const subscriptionId =
                    typeof checkoutSession.subscription === 'string'
                        ? checkoutSession.subscription
                        : checkoutSession.subscription?.id;

                if (!userId || !customerId) {
                    logger.warn('[StripeWebhook] checkout.session.completed missing userId/customerId', {
                        userId,
                        customerId,
                    });
                    break;
                }

                // Persist the Stripe customer id immediately; full plan/status
                // details arrive (and get synced) via customer.subscription.updated,
                // which Stripe fires right after checkout completes.
                await upsertSubscriptionState(userId, {
                    stripeCustomerId: customerId,
                    stripeSubscriptionId: subscriptionId ?? null,
                    subscriptionStatus: 'ACTIVE',
                    subscriptionTier: 'PRO',
                });

                logger.info('[StripeWebhook] Checkout completed', { userId, customerId, subscriptionId });
                break;
            }

            case 'customer.subscription.updated': {
                await syncSubscription(event.data.object as Stripe.Subscription);
                break;
            }

            case 'customer.subscription.deleted': {
                await syncSubscription(event.data.object as Stripe.Subscription);
                break;
            }

            default:
                // Unhandled event types are expected — we only listen for the
                // three above in the Stripe Dashboard webhook config.
                break;
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        logger.error('[StripeWebhook] Handler failed', { error, eventType: event.type });
        // Return 500 so Stripe retries delivery.
        return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
    }
}
