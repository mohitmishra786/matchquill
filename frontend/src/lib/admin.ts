/**
 * Admin Authorization Utilities
 *
 * Centralizes role checks for admin-only API routes (e.g. audit logs).
 * Never trust client-supplied role claims — always verify against the database.
 */

import prisma from './prisma';
import { createLogger } from './logger';

const logger = createLogger({ component: 'admin' });

export type UserRole = 'USER' | 'ADMIN';

/**
 * Parse ADMIN_EMAILS env into a normalized set of emails.
 * Comma-separated list used to bootstrap admins without a manual DB update.
 */
export function getAdminEmailsFromEnv(): Set<string> {
    const raw = process.env.ADMIN_EMAILS || '';
    if (!raw.trim()) {
        return new Set();
    }
    return new Set(
        raw
            .split(',')
            .map((email) => email.trim().toLowerCase())
            .filter(Boolean)
    );
}

/**
 * Determine whether a user has administrative privileges.
 *
 * Checks (in order):
 * 1. Database `role` column is ADMIN
 * 2. User email is listed in ADMIN_EMAILS (bootstrap path)
 *
 * @param userId - Authenticated user id from the session
 * @returns true if the user is an admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
    if (!userId || typeof userId !== 'string') {
        return false;
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, email: true },
        });

        if (!user) {
            logger.warn('Admin check failed - user not found', { userId });
            return false;
        }

        if (user.role === 'ADMIN') {
            return true;
        }

        // Bootstrap: allow configured admin emails (case-insensitive)
        if (user.email) {
            const adminEmails = getAdminEmailsFromEnv();
            if (adminEmails.has(user.email.toLowerCase())) {
                logger.info('Admin access granted via ADMIN_EMAILS', {
                    userId,
                    // Do not log full email in production logs if sensitive;
                    // domain-only is enough for diagnostics.
                    emailDomain: user.email.split('@')[1] || 'unknown',
                });
                return true;
            }
        }

        return false;
    } catch (error) {
        logger.error('Admin check failed with error', {
            userId,
            error: error instanceof Error ? error.message : String(error),
        });
        // Fail closed: deny admin on error
        return false;
    }
}

/**
 * Require admin privileges or throw a structured result for API handlers.
 */
export async function requireAdmin(userId: string): Promise<
    | { ok: true }
    | { ok: false; status: 403; error: string }
> {
    const admin = await isAdmin(userId);
    if (!admin) {
        return {
            ok: false,
            status: 403,
            error: 'Forbidden: admin privileges required',
        };
    }
    return { ok: true };
}
