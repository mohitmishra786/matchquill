/**
 * Prisma Environment Setup
 * Maps Vercel environment variables to Prisma expected names
 * MUST be imported BEFORE any Prisma client usage
 *
 * Uses createLogger (not raw console.*) so env bootstrap diagnostics go through
 * the same structured logging path as the rest of the app.
 */

import { createLogger } from '@/lib/logger';

const logger = createLogger({ component: 'PrismaEnv' });

// Map CV_DATABASE_DATABASE_URL to DATABASE_URL for Prisma
if (process.env.CV_DATABASE_DATABASE_URL && !process.env.DATABASE_URL) {
    process.env.DATABASE_URL = process.env.CV_DATABASE_DATABASE_URL;
    logger.info('[PRISMA_ENV] Mapped CV_DATABASE_DATABASE_URL to DATABASE_URL');
}

// Map alternative Upstash Redis URLs
if (process.env.UPSTASH_REDIS_RES_REDIS_URL && !process.env.REDIS_URL) {
    process.env.REDIS_URL = process.env.UPSTASH_REDIS_RES_REDIS_URL;
    logger.info('[PRISMA_ENV] Mapped UPSTASH_REDIS_RES_REDIS_URL to REDIS_URL');
}

// Map NextAuth v5 secret
if (process.env.NEXTAUTH_SECRET && !process.env.AUTH_SECRET) {
    process.env.AUTH_SECRET = process.env.NEXTAUTH_SECRET;
    logger.info('[PRISMA_ENV] Mapped NEXTAUTH_SECRET to AUTH_SECRET');
}

// Log database URL status (without exposing the actual value)
if (process.env.DATABASE_URL) {
    const url = process.env.DATABASE_URL;
    const maskedUrl = url.split('@')[1] || 'unknown';
    logger.info(`[PRISMA_ENV] DATABASE_URL configured: ***@${maskedUrl.split('/')[0]}`);
} else {
    logger.error('[PRISMA_ENV] WARNING: DATABASE_URL not set!');
}

export { }; // Make this a module
