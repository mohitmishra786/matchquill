/**
 * MatchQuill brand mark + wordmark (matches assets/logo.svg / README).
 * Inline SVG keeps the logo crisp at any size and avoids shipping large PNGs.
 */

import React, { useId } from 'react';
import Link from 'next/link';

interface BrandMarkProps {
    size?: number;
    className?: string;
    title?: string;
}

/** Icon-only mark (gradient badge + quill + check). */
export function BrandMark({ size = 32, className = '', title }: BrandMarkProps) {
    const reactId = useId();
    const gradId = `mqBrandGrad-${reactId.replace(/:/g, '')}`;
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="10 10 100 100"
            className={className}
            role={title ? 'img' : 'presentation'}
            aria-hidden={title ? undefined : true}
            aria-label={title}
        >
            <defs>
                <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#9333ea" />
                </linearGradient>
            </defs>
            <rect x="10" y="10" width="100" height="100" rx="26" fill={`url(#${gradId})`} />
            <path
                d="M60 26 C 78 34, 85 58, 70 77 C 62 87, 52 92, 44 99 C 46 85, 50 71, 46 57 C 42 43, 45 32, 60 26 Z"
                fill="#ffffff"
                fillOpacity="0.96"
            />
            <path
                d="M60 29 C 54 49, 48 71, 44 97"
                stroke="#6366f1"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
            />
            <path d="M53 45 L44 41" stroke="#6366f1" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M50 59 L40 57" stroke="#6366f1" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M47 73 L37 73" stroke="#6366f1" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="98" cy="97" r="15" fill="#ffffff" />
            <circle cx="98" cy="97" r="15" fill="none" stroke="#9333ea" strokeWidth="2" />
            <path
                d="M91 97 L96 102 L106 89"
                fill="none"
                stroke="#9333ea"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

interface BrandLogoProps {
    href?: string;
    size?: number;
    showWordmark?: boolean;
    className?: string;
    wordmarkClassName?: string;
}

/** Navbar / footer brand link. */
export function BrandLogo({
    href = '/',
    size = 32,
    showWordmark = true,
    className = '',
    wordmarkClassName = '',
}: BrandLogoProps) {
    const content = (
        <>
            <BrandMark size={size} />
            {showWordmark && (
                <span
                    className={`font-bold tracking-tight ${wordmarkClassName}`}
                    style={{ fontFamily: 'var(--font-display)' }}
                >
                    MatchQuill
                </span>
            )}
        </>
    );

    if (!href) {
        return (
            <span className={`inline-flex items-center gap-2 ${className}`} style={{ color: 'var(--foreground)' }}>
                {content}
            </span>
        );
    }

    return (
        <Link
            href={href}
            className={`inline-flex items-center gap-2 transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/40 rounded-lg ${className}`}
            style={{ color: 'var(--foreground)' }}
            aria-label="MatchQuill home"
        >
            {content}
        </Link>
    );
}

export default BrandLogo;
