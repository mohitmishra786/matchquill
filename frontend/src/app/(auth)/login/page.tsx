'use client';

/**
 * Login Page
 * Supports Google OAuth and email/password login
 */

import { useState, Suspense, useMemo } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { BrandMark } from '@/components/ui/BrandLogo';
import { authErrorMessage } from '@/lib/auth-login-messages';

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Matches the reveal pattern used on the homepage: opacity never gates
 * visibility (stays 1 in both states), only translateY animates. That way
 * the card is still fully visible if the animation never runs.
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
        visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE, delay } },
    };
}

function LoginForm() {
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl') || '/profile';
    // Auth.js redirects land on /login?error=Configuration (etc.) — derive, don't sync via effect.
    const urlErrorCode = searchParams.get('error');
    const urlError = useMemo(
        () => (urlErrorCode ? authErrorMessage(urlErrorCode) : ''),
        [urlErrorCode]
    );
    const reduceMotion = Boolean(useReducedMotion());

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    /** Errors from the current submit attempt; takes precedence over ?error= from the URL. */
    const [submitError, setSubmitError] = useState('');
    const [loading, setLoading] = useState(false);

    const error = submitError || urlError;

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError('');
        setLoading(true);

        try {
            const result = await signIn('credentials', {
                email: email.trim(),
                password,
                redirect: false,
                callbackUrl,
            });

            // Auth.js returns HTTP 200 even when url contains ?error=…
            // Prefer explicit error; also reject ok:false / missing url.
            if (result?.error) {
                setSubmitError(authErrorMessage(result.error));
                setLoading(false);
                return;
            }

            if (!result?.ok || !result.url) {
                setSubmitError('Sign-in failed. Please check your email and password.');
                setLoading(false);
                return;
            }

            // Hard navigation so the session cookie is always sent to middleware
            // (client soft navigations can race the cookie / RSC cache).
            const dest =
                result.url.startsWith('http') && !result.url.includes('/api/auth')
                    ? result.url
                    : callbackUrl.startsWith('/')
                      ? callbackUrl
                      : '/profile';
            window.location.assign(dest);
        } catch {
            setSubmitError('An error occurred. Please try again.');
            setLoading(false);
        }
        // Keep loading=true on success until full page navigation completes.
    };

    const handleGoogleLogin = () => {
        signIn('google', { callbackUrl });
    };

    return (
        <div className="relative flex items-center justify-center px-4 pt-20 pb-28 sm:py-28">
            <motion.div
                initial="hidden"
                animate="visible"
                variants={revealVariants(0, reduceMotion)}
                className="w-full max-w-md"
            >
                {/* Logo & Title */}
                <div className="text-center mb-8">
                    <Link
                        href="/"
                        aria-label="MatchQuill home"
                        className="inline-flex items-center justify-center mb-5 transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40 focus:ring-offset-2 focus:ring-offset-[var(--background)] rounded-2xl"
                    >
                        <BrandMark size={56} title="MatchQuill" />
                    </Link>
                    <h1
                        className="text-3xl font-bold tracking-[-0.02em]"
                        style={{ color: 'var(--foreground)', fontFamily: 'var(--font-display)' }}
                    >
                        Welcome back
                    </h1>
                    <p className="mt-2" style={{ color: 'var(--muted-foreground)' }}>
                        Sign in to your MatchQuill account
                    </p>
                </div>

                {/* Login Card */}
                <div
                    className="rounded-[2rem] p-8"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
                >
                    {/* Google Login */}
                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3.5 min-h-[44px] rounded-full font-semibold transition-all active:scale-[0.98] hover:bg-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40 focus:ring-offset-2 focus:ring-offset-[var(--card)]"
                        style={{ border: '1px solid var(--border)', color: 'var(--foreground)', background: 'var(--card)' }}
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        Continue with Google
                    </button>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <div className="w-full" style={{ borderTop: '1px solid var(--border)' }} />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4" style={{ background: 'var(--card)', color: 'var(--muted-foreground)' }}>
                                or continue with email
                            </span>
                        </div>
                    </div>

                    {/* Email Login Form */}
                    <form onSubmit={handleEmailLogin} className="space-y-4" noValidate>
                        {error && (
                            <div
                                className="p-3 rounded-xl text-sm bg-[var(--destructive)]/10 text-[var(--destructive)] border border-[var(--destructive)]/20"
                                role="alert"
                                aria-live="assertive"
                            >
                                {error}
                            </div>
                        )}

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground-secondary)' }}>
                                Email address
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                                aria-invalid={error ? true : undefined}
                                className="w-full px-4 py-3 min-h-[44px] rounded-2xl outline-none transition-shadow focus:ring-2 focus:ring-[var(--ring)]/30"
                                style={{ background: 'var(--background)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                                placeholder="you@example.com"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground-secondary)' }}>
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                aria-invalid={error ? true : undefined}
                                className="w-full px-4 py-3 min-h-[44px] rounded-2xl outline-none transition-shadow focus:ring-2 focus:ring-[var(--ring)]/30"
                                style={{ background: 'var(--background)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            aria-busy={loading}
                            className="w-full py-3.5 px-4 min-h-[44px] rounded-full font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40 focus:ring-offset-2 focus:ring-offset-[var(--card)]"
                            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                        >
                            {loading ? 'Signing in…' : 'Sign in'}
                        </button>
                    </form>
                </div>

                {/* Register Link */}
                <p className="text-center mt-6" style={{ color: 'var(--muted-foreground)' }}>
                    Don&apos;t have an account?{' '}
                    <Link
                        href="/register"
                        className="font-semibold transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40 rounded"
                        style={{ color: 'var(--primary)' }}
                    >
                        Sign up
                    </Link>
                </p>
            </motion.div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center py-32">
                    <div
                        className="animate-spin rounded-full h-8 w-8"
                        style={{ borderTop: '2px solid var(--primary)', borderBottom: '2px solid var(--primary)', borderLeft: '2px solid transparent', borderRight: '2px solid transparent' }}
                        role="status"
                        aria-label="Loading"
                    />
                </div>
            }
        >
            <LoginForm />
        </Suspense>
    );
}
