/**
 * JWT Token Utilities
 * Helper functions for working with JWT tokens between frontend and backend
 */

import { SignJWT } from 'jose';

/**
 * Generate a JWT token for backend authentication
 * Uses the same secret as NextAuth to ensure compatibility
 */
export async function generateBackendToken(
    userId: string,
    email?: string | null
): Promise<string> {
    // Must match backend decode_service_jwt (AUTH_SECRET || NEXTAUTH_SECRET).
    // Trim whitespace — Vercel/Railway UI paste often adds trailing newlines.
    const secret = (
        process.env.AUTH_SECRET?.trim() ||
        process.env.NEXTAUTH_SECRET?.trim() ||
        ''
    );

    if (!secret) {
        throw new Error('AUTH_SECRET or NEXTAUTH_SECRET is not configured');
    }

    // Create JWT signed with the same secret as NextAuth / Railway verifier
    const token = await new SignJWT({
        sub: userId,
        email: email,
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(new TextEncoder().encode(secret));

    return token;
}
