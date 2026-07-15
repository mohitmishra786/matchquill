/**
 * MatchQuill Pricing Page
 *
 * Public page (no auth required) so visitors can see pricing before signing
 * up. Uses Stripe Checkout (redirect) to start a subscription — no Stripe.js
 * on this page, so no CSP changes were needed.
 *
 * Disclosure (no dark patterns):
 * - Plan price, billing interval, and "auto-renews" language are stated
 *   directly on the card, not hidden in fine print.
 * - Cancellation is one click away in Settings -> Billing (Stripe billing
 *   portal), no "contact support to cancel" flow.
 *
 * Enterprise/Team is not purchasable yet (see src/lib/subscription.ts,
 * PURCHASABLE_TIERS) so that card routes to a "contact us" email instead of
 * checkout — no fabricated self-serve flow for a tier that doesn't exist.
 */

'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { CheckCircle2, Sparkles, XCircle } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1] as const;

// Support/contact address for the Enterprise "contact us" CTA. Configurable per
// deployment via NEXT_PUBLIC_SUPPORT_EMAIL; falls back to the default domain.
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'admin@mohitmishra7.com';

/**
 * Content opacity is never the gate for visibility — it stays at 1 in both
 * the "hidden" and "visible" states, only translateY animates. Matches the
 * homepage pattern so headless renderers / reduced-motion users still see
 * fully legible content instead of a blank section.
 */
function revealVariants(delay = 0, reduceMotion = false): Variants {
    if (reduceMotion) {
        return {
            hidden: { opacity: 1, y: 0 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
        };
    }
    return {
        hidden: { opacity: 1, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.6, ease: EASE, delay },
        },
    };
}

const FREE_FEATURES = [
    '5 tailored resumes per month',
    'Core resume templates',
    'Cover letter generation',
    'Job application tracker',
];

const PRO_FEATURES = [
    'Unlimited tailored resumes',
    'Semantic job-match scoring (new)',
    'Full template library',
    'Priority AI processing',
    'Cancel anytime, no lock-in',
];

const ENTERPRISE_FEATURES = [
    'Everything in Pro',
    'Multiple seats for your team',
    'Centralized billing',
    'Priority support',
];

function CheckoutBanner() {
    const searchParams = useSearchParams();
    const checkout = searchParams.get('checkout');

    if (checkout !== 'success' && checkout !== 'cancelled') return null;

    const isSuccess = checkout === 'success';

    return (
        <div
            className="max-w-3xl mx-auto mb-8 px-4"
        >
            <div
                className="flex items-center gap-3 rounded-2xl px-5 py-4 text-sm font-medium"
                style={{
                    background: isSuccess ? 'color-mix(in srgb, var(--accent-green) 12%, var(--card))' : 'var(--card)',
                    border: `1px solid ${isSuccess ? 'var(--accent-green)' : 'var(--border)'}`,
                    color: 'var(--foreground)',
                }}
            >
                {isSuccess ? (
                    <CheckCircle2 size={20} strokeWidth={1.75} style={{ color: 'var(--accent-green)' }} />
                ) : (
                    <XCircle size={20} strokeWidth={1.75} style={{ color: 'var(--muted-foreground)' }} />
                )}
                {isSuccess
                    ? "You're on Pro. Welcome aboard — head to your dashboard to keep going."
                    : 'Checkout was cancelled. No charge was made — upgrade whenever you’re ready.'}
            </div>
        </div>
    );
}

export default function PricingPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const reduceMotion = Boolean(useReducedMotion());

    const isAuthenticated = status === 'authenticated' && !!session?.user;

    const handleUpgrade = async () => {
        if (!isAuthenticated) {
            router.push('/register?redirect=/pricing');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/billing/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tier: 'PRO' }),
            });
            const data = await res.json();
            if (!res.ok || !data.url) {
                throw new Error(data.error || 'Failed to start checkout');
            }
            window.location.href = data.url;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen" style={{ background: 'var(--background)' }}>
            {/* Hero */}
            <section className="pt-28 pb-16 px-4 sm:pt-36 sm:pb-20">
                <div className="max-w-3xl mx-auto text-center px-4">
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={revealVariants(0, reduceMotion)}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium mb-6"
                        style={{
                            background: 'var(--glass-bg)',
                            border: '1px solid var(--glass-border)',
                            color: 'var(--foreground-secondary)',
                            backdropFilter: 'blur(var(--glass-blur))',
                            WebkitBackdropFilter: 'blur(var(--glass-blur))',
                        }}
                    >
                        <Sparkles size={14} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
                        No hidden fees &middot; Cancel in one click
                    </motion.div>

                    <motion.h1
                        initial="hidden"
                        animate="visible"
                        variants={revealVariants(0.08, reduceMotion)}
                        className="font-bold leading-[1.05] text-[clamp(2.25rem,6vw,3.5rem)] tracking-[-0.03em]"
                        style={{ color: 'var(--foreground)', fontFamily: 'var(--font-display)', textWrap: 'balance' }}
                    >
                        Simple, honest{' '}
                        <span style={{ color: 'var(--primary)' }}>pricing</span>
                    </motion.h1>

                    <motion.p
                        initial="hidden"
                        animate="visible"
                        variants={revealVariants(0.16, reduceMotion)}
                        className="mt-6 text-lg sm:text-xl max-w-xl mx-auto"
                        style={{ color: 'var(--foreground-secondary)', textWrap: 'pretty' }}
                    >
                        Start free. Upgrade when you need unlimited tailoring. Cancel anytime, in one click.
                    </motion.p>
                </div>
            </section>

            <Suspense fallback={null}>
                <CheckoutBanner />
            </Suspense>

            {/* Plans */}
            <section className="px-4 pb-16">
                <div className="max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 px-4 items-stretch">
                    {/* Free tier */}
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: '-60px' }}
                        variants={revealVariants(0, reduceMotion)}
                        className="p-1.5 rounded-[2rem]"
                        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                    >
                        <div className="rounded-[calc(2rem-0.375rem)] p-8 h-full flex flex-col">
                            <h2 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
                                Free
                            </h2>
                            <p className="mt-3 text-4xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
                                $0
                                <span className="text-base font-normal ml-1" style={{ color: 'var(--muted-foreground)' }}>
                                    / month
                                </span>
                            </p>
                            <p className="mt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                For occasional job applications.
                            </p>

                            <ul className="mt-6 space-y-3 flex-1">
                                {FREE_FEATURES.map((feature) => (
                                    <li key={feature} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--foreground)' }}>
                                        <CheckCircle2 size={18} strokeWidth={1.75} className="shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            <Link
                                href={isAuthenticated ? '/dashboard' : '/register'}
                                className="mt-8 w-full text-center px-6 py-3 min-h-[44px] flex items-center justify-center font-semibold rounded-full transition-all hover:opacity-80 border"
                                style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--card)' }}
                            >
                                {isAuthenticated ? 'Your current plan' : 'Start Free'}
                            </Link>
                        </div>
                    </motion.div>

                    {/* Pro tier — highlighted */}
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: '-60px' }}
                        variants={revealVariants(0.08, reduceMotion)}
                        className="relative p-1.5 rounded-[2rem] lg:-translate-y-3"
                        style={{ background: 'var(--primary)' }}
                    >
                        <span
                            className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
                            style={{ background: 'var(--foreground)', color: 'var(--background)' }}
                        >
                            Most popular
                        </span>

                        <div className="rounded-[calc(2rem-0.375rem)] p-8 h-full flex flex-col" style={{ background: 'var(--card)' }}>
                            <h2 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
                                Pro
                            </h2>
                            <p className="mt-3 text-4xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
                                $9.99
                                <span className="text-base font-normal ml-1" style={{ color: 'var(--muted-foreground)' }}>
                                    / month
                                </span>
                            </p>
                            <p className="mt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                Billed monthly. Auto-renews until cancelled — cancel anytime from Settings, no
                                questions asked.
                            </p>

                            <ul className="mt-6 space-y-3 flex-1">
                                {PRO_FEATURES.map((feature) => (
                                    <li key={feature} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--foreground)' }}>
                                        <CheckCircle2 size={18} strokeWidth={1.75} className="shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={handleUpgrade}
                                disabled={loading}
                                className="mt-8 w-full px-6 py-3 min-h-[44px] font-semibold rounded-full transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                            >
                                {loading ? 'Redirecting to Stripe…' : 'Upgrade to Pro'}
                            </button>

                            {error && (
                                <p className="mt-3 text-sm text-center" style={{ color: 'var(--destructive)' }}>
                                    {error}
                                </p>
                            )}
                        </div>
                    </motion.div>

                    {/* Enterprise tier — not purchasable via self-serve yet, routes to sales email */}
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: '-60px' }}
                        variants={revealVariants(0.16, reduceMotion)}
                        className="p-1.5 rounded-[2rem]"
                        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                    >
                        <div className="rounded-[calc(2rem-0.375rem)] p-8 h-full flex flex-col">
                            <h2 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
                                Enterprise
                            </h2>
                            <p className="mt-3 text-4xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
                                Custom
                            </p>
                            <p className="mt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                For teams and organizations tailoring resumes at scale. Talk to us about your needs.
                            </p>

                            <ul className="mt-6 space-y-3 flex-1">
                                {ENTERPRISE_FEATURES.map((feature) => (
                                    <li key={feature} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--foreground)' }}>
                                        <CheckCircle2 size={18} strokeWidth={1.75} className="shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            <a
                                href={`mailto:${SUPPORT_EMAIL}?subject=Enterprise%20plan%20inquiry`}
                                className="mt-8 w-full text-center px-6 py-3 min-h-[44px] flex items-center justify-center font-semibold rounded-full transition-all hover:opacity-80 border"
                                style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--card)' }}
                            >
                                Contact us
                            </a>
                        </div>
                    </motion.div>
                </div>

                <motion.p
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-40px' }}
                    variants={revealVariants(0, reduceMotion)}
                    className="max-w-4xl mx-auto mt-10 px-4 text-center text-sm"
                    style={{ color: 'var(--muted-foreground)' }}
                >
                    Payments are processed securely by Stripe. We never see or store your card details.
                    Manage or cancel your subscription anytime from{' '}
                    <Link href="/settings" className="underline hover:opacity-80" style={{ color: 'var(--foreground-secondary)' }}>
                        Settings
                    </Link>
                    .
                </motion.p>
            </section>
        </div>
    );
}
