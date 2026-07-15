'use client';

/**
 * Registration Page
 * Email/password signup with validation
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { BrandMark } from '@/components/ui/BrandLogo';
import { isStrongPassword, MIN_PASSWORD_LENGTH } from '@/lib/validation';

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

export default function RegisterPage() {
    const router = useRouter();
    const reduceMotion = Boolean(useReducedMotion());

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validation
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        const strength = isStrongPassword(password);
        if (!strength.isValid) {
            setError(strength.errors[0] || 'Password does not meet strength requirements');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            // Redirect to login
            router.push('/login?registered=true');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed');
        } finally {
            setLoading(false);
        }
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
                        Create your account
                    </h1>
                    <p className="mt-2" style={{ color: 'var(--muted-foreground)' }}>
                        Start building your career profile
                    </p>
                </div>

                {/* Register Card */}
                <div
                    className="rounded-[2rem] p-8"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
                >
                    <form onSubmit={handleRegister} className="space-y-4" noValidate>
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
                            <label htmlFor="name" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground-secondary)' }}>
                                Full name
                            </label>
                            <input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoComplete="name"
                                className="w-full px-4 py-3 min-h-[44px] rounded-2xl outline-none transition-shadow focus:ring-2 focus:ring-[var(--ring)]/30"
                                style={{ background: 'var(--background)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                                placeholder="John Doe"
                            />
                        </div>

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
                                minLength={MIN_PASSWORD_LENGTH}
                                autoComplete="new-password"
                                aria-invalid={error ? true : undefined}
                                aria-describedby="password-helper"
                                className="w-full px-4 py-3 min-h-[44px] rounded-2xl outline-none transition-shadow focus:ring-2 focus:ring-[var(--ring)]/30"
                                style={{ background: 'var(--background)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                                placeholder="••••••••"
                            />
                            <p id="password-helper" className="mt-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                At least {MIN_PASSWORD_LENGTH} characters with upper, lower, number, and special character
                            </p>
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground-secondary)' }}>
                                Confirm password
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                autoComplete="new-password"
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
                            className="w-full py-3.5 px-4 min-h-[44px] rounded-full font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40 focus:ring-offset-2 focus:ring-offset-[var(--card)] mt-2"
                            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                        >
                            {loading ? 'Creating account…' : 'Create account'}
                        </button>
                    </form>
                </div>

                {/* Login Link */}
                <p className="text-center mt-6" style={{ color: 'var(--muted-foreground)' }}>
                    Already have an account?{' '}
                    <Link
                        href="/login"
                        className="font-semibold transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40 rounded"
                        style={{ color: 'var(--primary)' }}
                    >
                        Sign in
                    </Link>
                </p>
            </motion.div>
        </div>
    );
}
