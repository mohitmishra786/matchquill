"use client";

/**
 * Unified Navbar Component — Liquid Glass Design
 * Features:
 * - Transparent, full-width at the top of the page
 * - Shrinks into a centered, floating glass pill on scroll
 * - Theme-aware colors using CSS variables
 * - Smooth spring-like transitions and micro-interactions
 * - 44px touch targets for mobile accessibility
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import { BrandLogo } from './BrandLogo';
import { User, LogOut, LogIn, Menu, X } from 'lucide-react';
import { logger } from '@/lib/logger';

const EASE = 'cubic-bezier(0.32,0.72,0,1)';

const Navbar: React.FC = () => {
    const { data: session, status } = useSession();
    const pathname = usePathname();
    const isLoading = status === 'loading';
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Auto-close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

    // Track scroll for the pill morph
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 24);
        };
        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleSignOut = async () => {
        logger.info('[Navbar] User signing out');
        await signOut({ callbackUrl: '/' });
    };

    const navLinkClass = (path: string) => {
        const isActive = pathname === path;
        return `
            px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-300 min-h-[44px] flex items-center
            ${isActive
                ? 'text-[var(--primary)] bg-[var(--primary)]/10'
                : 'text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]'
            }
        `.trim();
    };

    return (
        <>
            {/* Floating shell — always centered, width and chrome animate on scroll */}
            <div
                className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 sm:px-4"
                style={{ transition: `padding-top 500ms ${EASE}`, paddingTop: isScrolled ? '0.75rem' : '0' }}
            >
                <nav
                    className="w-full pointer-events-auto"
                    style={{
                        maxWidth: isScrolled ? '880px' : '100%',
                        borderRadius: isScrolled ? '9999px' : '0px',
                        background: isScrolled ? 'var(--glass-bg)' : 'transparent',
                        backdropFilter: isScrolled ? 'blur(var(--glass-blur))' : 'none',
                        WebkitBackdropFilter: isScrolled ? 'blur(var(--glass-blur))' : 'none',
                        border: `1px solid ${isScrolled ? 'var(--glass-border)' : 'transparent'}`,
                        boxShadow: isScrolled ? 'var(--shadow-lg)' : 'none',
                        transition: `all 500ms ${EASE}`,
                    }}
                >
                    <div className="w-full px-4 sm:px-6">
                        <div className="flex items-center justify-between h-16">
                            {/* Left: Logo and Home */}
                            <div className="flex items-center gap-6">
                                <BrandLogo
                                    size={32}
                                    className="text-xl"
                                    wordmarkClassName="hidden sm:inline text-xl"
                                />

                                {/* Desktop Navigation Links (only if logged in) */}
                                {session && (
                                    <div className="hidden lg:flex items-center gap-1">
                                        <Link href="/dashboard" className={navLinkClass('/dashboard')} prefetch>
                                            Dashboard
                                        </Link>
                                        <Link href="/profile" className={navLinkClass('/profile')} prefetch>
                                            Profile
                                        </Link>
                                        <Link href="/templates" className={navLinkClass('/templates')} prefetch>
                                            Templates
                                        </Link>
                                        <Link href="/pricing" className={navLinkClass('/pricing')} prefetch>
                                            Pricing
                                        </Link>
                                    </div>
                                )}
                            </div>

                            {/* Right: Theme Toggle and Auth */}
                            <div className="flex items-center gap-2">
                                {/* Theme Toggle */}
                                <ThemeToggle />

                                {/* Loading State */}
                                {isLoading && (
                                    <div
                                        className="w-24 h-9 animate-pulse rounded-full skeleton"
                                    />
                                )}

                                {/* Not Logged In */}
                                {!isLoading && !session && (
                                    <div className="hidden lg:flex items-center gap-2">
                                        <Link href="/pricing" className={navLinkClass('/pricing')}>
                                            Pricing
                                        </Link>
                                        <Link
                                            href="/login"
                                            className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-medium rounded-full transition-all duration-200 hover:opacity-80"
                                            style={{ color: 'var(--foreground-secondary)' }}
                                        >
                                            <LogIn size={18} strokeWidth={1.75} />
                                            <span>Sign In</span>
                                        </Link>
                                        <Link
                                            href="/register"
                                            className="group flex items-center gap-2 pl-5 pr-2 py-2 min-h-[44px] text-sm font-semibold rounded-full transition-all duration-300 active:scale-[0.98]"
                                            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                                        >
                                            Get Started
                                            <span
                                                className="flex items-center justify-center w-7 h-7 rounded-full transition-transform duration-300 group-hover:translate-x-0.5"
                                                style={{ background: 'rgba(255,255,255,0.2)' }}
                                            >
                                                &rarr;
                                            </span>
                                        </Link>
                                    </div>
                                )}

                                {/* Logged In */}
                                {!isLoading && session && (
                                    <div className="hidden lg:flex items-center gap-2">
                                        {/* User Info */}
                                        <Link
                                            href="/profile"
                                            className="flex items-center gap-2 px-3 py-2 rounded-full transition-all duration-200 min-h-[44px]"
                                            style={{
                                                background: pathname === '/profile' ? 'var(--muted)' : 'transparent',
                                            }}
                                        >
                                            <div
                                                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
                                                style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                                            >
                                                {session.user?.name?.charAt(0)?.toUpperCase() || <User size={16} />}
                                            </div>
                                            <span
                                                className="text-sm font-medium"
                                                style={{ color: 'var(--foreground)' }}
                                            >
                                                {session.user?.name || 'User'}
                                            </span>
                                        </Link>

                                        {/* Sign Out */}
                                        <button
                                            onClick={handleSignOut}
                                            className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-medium rounded-full transition-all duration-200 hover:bg-[var(--muted)]"
                                            style={{ color: 'var(--foreground-secondary)' }}
                                            aria-label="Sign out"
                                        >
                                            <LogOut size={18} strokeWidth={1.75} />
                                            <span className="hidden lg:inline">Sign Out</span>
                                        </button>
                                    </div>
                                )}

                                {/* Mobile Menu Button */}
                                <button
                                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                    className="lg:hidden flex items-center justify-center w-11 h-11 rounded-full transition-all duration-200"
                                    style={{
                                        background: isMobileMenuOpen ? 'var(--muted)' : 'transparent',
                                        color: 'var(--foreground)',
                                    }}
                                    aria-label="Toggle menu"
                                    aria-expanded={isMobileMenuOpen}
                                    aria-controls="navbar-mobile-menu"
                                >
                                    {isMobileMenuOpen ? <X size={22} strokeWidth={1.75} /> : <Menu size={22} strokeWidth={1.75} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </nav>
            </div>

            {/* Spacer for fixed navbar */}
            <div className="h-16" />

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div
                    id="navbar-mobile-menu"
                    className="fixed inset-x-3 top-[4.5rem] z-40 lg:hidden animate-fade-in rounded-3xl overflow-hidden"
                    style={{
                        background: 'var(--glass-bg)',
                        backdropFilter: 'blur(var(--glass-blur))',
                        WebkitBackdropFilter: 'blur(var(--glass-blur))',
                        border: '1px solid var(--glass-border)',
                        boxShadow: 'var(--shadow-lg)',
                    }}
                >
                    <div className="px-4 py-4 space-y-2">
                        {session && (
                            <>
                                <Link
                                    href="/dashboard"
                                    className={navLinkClass('/dashboard')}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    Dashboard
                                </Link>
                                <Link
                                    href="/profile"
                                    className={navLinkClass('/profile')}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    Profile
                                </Link>
                                <Link
                                    href="/templates"
                                    className={navLinkClass('/templates')}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    Templates
                                </Link>
                                <Link
                                    href="/pricing"
                                    className={navLinkClass('/pricing')}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    Pricing
                                </Link>
                                <hr style={{ borderColor: 'var(--border)' }} />
                                <button
                                    onClick={() => {
                                        setIsMobileMenuOpen(false);
                                        handleSignOut();
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-3 min-h-[44px] text-sm font-medium rounded-xl transition-all"
                                    style={{ color: 'var(--destructive)' }}
                                >
                                    <LogOut size={18} strokeWidth={1.75} />
                                    Sign Out
                                </button>
                            </>
                        )}
                        {!session && !isLoading && (
                            <>
                                <Link
                                    href="/pricing"
                                    className="flex items-center gap-2 px-4 py-3 min-h-[44px] text-sm font-medium rounded-xl"
                                    style={{ color: 'var(--foreground)' }}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    Pricing
                                </Link>
                                <Link
                                    href="/login"
                                    className="flex items-center gap-2 px-4 py-3 min-h-[44px] text-sm font-medium rounded-xl"
                                    style={{ color: 'var(--foreground)' }}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <LogIn size={18} strokeWidth={1.75} />
                                    Sign In
                                </Link>
                                <Link
                                    href="/register"
                                    className="flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] text-sm font-semibold rounded-xl"
                                    style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    Get Started
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default Navbar;
