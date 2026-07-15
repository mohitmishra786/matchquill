/**
 * Footer Component - Apple-Inspired Design
 * Consistent footer across all pages with:
 * - Glassmorphism effect matching Navbar
 * - Responsive layout
 * - Quick links and branding
 */

import React from 'react';
import Link from 'next/link';
import { BrandLogo } from './BrandLogo';

const Footer: React.FC = () => {
    const current_year = new Date().getFullYear();

    return (
        <footer
            className="w-full mt-auto pt-16 pb-8 px-4"
            style={{
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(var(--glass-blur))',
                WebkitBackdropFilter: 'blur(var(--glass-blur))',
                borderTop: '1px solid var(--border)',
            }}
        >
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
                    {/* Brand */}
                    <div>
                        <BrandLogo size={28} className="mb-3 text-lg" wordmarkClassName="text-lg" />
                        <p
                            className="text-sm leading-relaxed max-w-xs"
                            style={{ color: 'var(--muted-foreground)' }}
                        >
                            The career compiler — local job-description extraction, profile-constrained
                            resume tailoring, and cover letters that only use your real experience.
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4
                            className="text-sm font-semibold mb-3 uppercase tracking-wider"
                            style={{ color: 'var(--foreground-secondary)' }}
                        >
                            Quick Links
                        </h4>
                        <ul className="space-y-2">
                            <li>
                                <Link
                                    href="/dashboard"
                                    className="text-sm transition-colors hover:opacity-80"
                                    style={{ color: 'var(--muted-foreground)' }}
                                >
                                    Dashboard
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/profile"
                                    className="text-sm transition-colors hover:opacity-80"
                                    style={{ color: 'var(--muted-foreground)' }}
                                >
                                    Profile
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/templates"
                                    className="text-sm transition-colors hover:opacity-80"
                                    style={{ color: 'var(--muted-foreground)' }}
                                >
                                    Templates
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/pricing"
                                    className="text-sm transition-colors hover:opacity-80"
                                    style={{ color: 'var(--muted-foreground)' }}
                                >
                                    Pricing
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Resources */}
                    <div>
                        <h4
                            className="text-sm font-semibold mb-3 uppercase tracking-wider"
                            style={{ color: 'var(--foreground-secondary)' }}
                        >
                            Resources
                        </h4>
                        <ul className="space-y-2">
                            <li>
                                <Link
                                    href="/tracker"
                                    className="text-sm transition-colors hover:opacity-80"
                                    style={{ color: 'var(--muted-foreground)' }}
                                >
                                    Job Tracker
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/interview-prep"
                                    className="text-sm transition-colors hover:opacity-80"
                                    style={{ color: 'var(--muted-foreground)' }}
                                >
                                    Interview Prep
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/settings"
                                    className="text-sm transition-colors hover:opacity-80"
                                    style={{ color: 'var(--muted-foreground)' }}
                                >
                                    Settings
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div
                    className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-4"
                    style={{ borderTop: '1px solid var(--border)' }}
                >
                    <p
                        className="text-sm"
                        style={{ color: 'var(--muted-foreground)' }}
                    >
                        © {current_year} MatchQuill. All rights reserved.
                    </p>
                    <div className="flex gap-6">
                        <span
                            className="text-sm opacity-50 cursor-not-allowed"
                            style={{ color: 'var(--muted-foreground)' }}
                            title="Coming soon"
                        >
                            Privacy
                        </span>
                        <span
                            className="text-sm opacity-50 cursor-not-allowed"
                            style={{ color: 'var(--muted-foreground)' }}
                            title="Coming soon"
                        >
                            Terms
                        </span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
