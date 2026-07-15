/**
 * NextAuth.js v5 Configuration
 * Supports Google OAuth (optional) and Credentials (email/password)
 *
 * IMPORTANT Auth.js behavior:
 * - Throwing from `authorize` becomes CallbackRouteError → client sees
 *   `error=Configuration` (looks like a system failure, session never set).
 * - Invalid credentials must `return null` so Auth.js raises CredentialsSignin.
 * - `secret` must be set or every sign-in redirects to Configuration.
 */

// Ensure NEXTAUTH_SECRET → AUTH_SECRET mapping runs before NextAuth init.
import './prisma-env';

import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import prisma from './prisma';
import { createLogger } from '@/lib/logger';

const logger = createLogger({ component: 'Auth' });

function resolveAuthSecret(): string | undefined {
    const secret =
        process.env.AUTH_SECRET?.trim() ||
        process.env.NEXTAUTH_SECRET?.trim() ||
        undefined;
    return secret || undefined;
}

const authSecret = resolveAuthSecret();

if (!authSecret && process.env.NODE_ENV === 'production') {
    logger.error(
        '[Auth] AUTH_SECRET / NEXTAUTH_SECRET is missing. Credentials login will fail with error=Configuration.'
    );
}

function isPlaceholderOAuthValue(value: string | undefined): boolean {
    if (!value) return true;
    const v = value.trim().toLowerCase();
    return (
        v.length === 0 ||
        v.includes('your_google') ||
        v.includes('your-') ||
        v === 'changeme' ||
        v === 'xxx'
    );
}

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const googleEnabled =
    !isPlaceholderOAuthValue(googleClientId) &&
    !isPlaceholderOAuthValue(googleClientSecret);

const providers: NextAuthConfig['providers'] = [];

if (googleEnabled) {
    providers.push(
        Google({
            clientId: googleClientId!,
            clientSecret: googleClientSecret!,
        })
    );
} else {
    logger.info(
        '[Auth] Google OAuth disabled — set real GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET to enable'
    );
}

providers.push(
    Credentials({
        id: 'credentials',
        name: 'Email',
        credentials: {
            email: { label: 'Email', type: 'email' },
            password: { label: 'Password', type: 'password' },
        },
        async authorize(credentials) {
            // Never throw for expected auth failures — Auth.js maps throws to Configuration.
            const rawEmail =
                typeof credentials?.email === 'string' ? credentials.email.trim() : '';
            const password =
                typeof credentials?.password === 'string' ? credentials.password : '';

            if (!rawEmail || !password) {
                return null;
            }

            try {
                // Match registration storage case first, then lowercase fallback.
                let user = await prisma.user.findUnique({
                    where: { email: rawEmail },
                });
                if (!user && rawEmail !== rawEmail.toLowerCase()) {
                    user = await prisma.user.findUnique({
                        where: { email: rawEmail.toLowerCase() },
                    });
                }

                if (!user?.passwordHash) {
                    // Unknown user or OAuth-only account (no password set)
                    return null;
                }

                const isValid = await bcrypt.compare(password, user.passwordHash);
                if (!isValid) {
                    return null;
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    image: user.image,
                };
            } catch (err) {
                // Log DB/runtime failures server-side; still return null so the client
                // gets CredentialsSignin instead of opaque Configuration.
                logger.error('[Auth] Credentials authorize failed', {
                    error: err instanceof Error ? err.message : String(err),
                    errorType: err instanceof Error ? err.constructor.name : typeof err,
                });
                return null;
            }
        },
    })
);

export const { handlers, signIn, signOut, auth } = NextAuth({
    // Explicit secret — do not rely solely on env inference across serverless isolates.
    secret: authSecret,
    adapter: PrismaAdapter(prisma),
    // Trust the deployment host (required on Vercel / behind proxies for v5).
    trustHost: true,
    session: {
        strategy: 'jwt',
    },
    pages: {
        signIn: '/login',
        error: '/login',
    },
    providers,
    // NOTE: Do NOT set a custom cookie `domain`. On *.vercel.app (a public
    // suffix) browsers reject cookies with an explicit Domain attribute, so the
    // session token was never stored and every protected route bounced back to
    // /login. NextAuth's default host-only cookies work correctly here.
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = (token.id as string) || (token.sub as string);
            }
            return session;
        },
    },
});
