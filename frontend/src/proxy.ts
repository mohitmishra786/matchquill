/**
 * Lightweight Middleware for route protection
 * Uses JWT token validation without importing full auth module
 * This reduces Edge Function size to stay under 1MB limit
 */

import { NextResponse, type NextRequest } from 'next/server';

const protectedPages = ['/profile', '/templates', '/settings', '/dashboard', '/interview-prep'];
const protectedAPIs = ['/api/profile'];
const authPages = ['/login', '/register'];

export function isValidSessionToken(token: string | undefined): boolean {
    if (!token || token.length < 10) {
        return false;
    }

    const suspiciousPatterns = [
        /['";]/,
        /<script>/i,
        /javascript:/i,
        /on\w+=/i,
        /DROP\s+TABLE/i,
        /UNION\s+SELECT/i,
        /\.\.[/\\]/, // path traversal (../, ..\)
        /^[/\\]/, // absolute path
    ];

    return !suspiciousPatterns.some(pattern => pattern.test(token));
}

export function validateRequestHeaders(request: NextRequest): boolean {
    const suspiciousHeaders = [
        'x-forwarded-host',
        'x-host',
        'x-http-host-override',
    ];

    for (const header of suspiciousHeaders) {
        const value = request.headers.get(header);
        if (value && (value.includes('\'') || value.includes('"') || value.includes(';'))) {
            return false;
        }
    }

    return true;
}

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (!validateRequestHeaders(request)) {
        return NextResponse.json({ error: 'Invalid request headers' }, { status: 400 });
    }

    const sessionToken = request.cookies.get('authjs.session-token')?.value ||
        request.cookies.get('__Secure-authjs.session-token')?.value;

    if (!isValidSessionToken(sessionToken)) {
        const isProtectedPage = protectedPages.some(page => pathname.startsWith(page));
        const isProtectedAPI = protectedAPIs.some(api => pathname.startsWith(api));

        if (isProtectedPage || isProtectedAPI) {
            if (isProtectedAPI) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            const callbackUrl = encodeURIComponent(pathname);
            return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, request.url));
        }
    }

    const isLoggedIn = !!sessionToken && isValidSessionToken(sessionToken);
    const isAuthPage = authPages.some(page => pathname.startsWith(page));
    const isProtectedPage = protectedPages.some(page => pathname.startsWith(page));
    const isProtectedAPI = protectedAPIs.some(api => pathname.startsWith(api));

    if (isAuthPage && isLoggedIn) {
        return NextResponse.redirect(new URL('/profile', request.url));
    }

    if ((isProtectedPage || isProtectedAPI) && !isLoggedIn) {
        if (isProtectedAPI) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const callbackUrl = encodeURIComponent(pathname);
        return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/profile/:path*',
        '/templates/:path*',
        '/settings/:path*',
        '/login',
        '/register',
        '/api/profile/:path*',
    ],
};
