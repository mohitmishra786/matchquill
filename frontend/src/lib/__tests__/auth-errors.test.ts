/**
 * Tests for client auth error helpers
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    AuthenticationError,
    isAuthStatus,
    isAuthenticationError,
    assertAuthenticatedResponse,
    redirectToLogin,
} from '../auth-errors';

describe('isAuthStatus', () => {
    it('detects 401 and 403', () => {
        expect(isAuthStatus(401)).toBe(true);
        expect(isAuthStatus(403)).toBe(true);
        expect(isAuthStatus(200)).toBe(false);
        expect(isAuthStatus(500)).toBe(false);
    });
});

describe('isAuthenticationError', () => {
    it('detects AuthenticationError instances', () => {
        expect(isAuthenticationError(new AuthenticationError())).toBe(true);
    });

    it('detects common auth messages', () => {
        expect(isAuthenticationError(new Error('Unauthorized'))).toBe(true);
        expect(isAuthenticationError(new Error('Not authenticated'))).toBe(true);
        expect(isAuthenticationError(new Error('Session expired'))).toBe(true);
        expect(isAuthenticationError(new Error('Network failed'))).toBe(false);
    });
});

describe('assertAuthenticatedResponse', () => {
    it('does nothing for successful responses', async () => {
        const response = new Response(JSON.stringify({ ok: true }), { status: 200 });
        await expect(assertAuthenticatedResponse(response)).resolves.toBeUndefined();
    });

    it('throws AuthenticationError on 401', async () => {
        const response = new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
        });
        await expect(assertAuthenticatedResponse(response)).rejects.toBeInstanceOf(
            AuthenticationError
        );
    });

    it('throws AuthenticationError on 403 with server message', async () => {
        const response = new Response(
            JSON.stringify({ error: 'Forbidden: admin privileges required' }),
            { status: 403 }
        );
        try {
            await assertAuthenticatedResponse(response);
            expect.fail('should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(AuthenticationError);
            expect((err as AuthenticationError).message).toContain('Forbidden');
            expect((err as AuthenticationError).status).toBe(403);
        }
    });
});

describe('redirectToLogin', () => {
    const originalLocation = window.location;

    beforeEach(() => {
        // jsdom location is not fully writable; stub assign
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {
                ...originalLocation,
                pathname: '/profile',
                search: '',
                assign: vi.fn(),
            },
        });
    });

    afterEach(() => {
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: originalLocation,
        });
    });

    it('navigates to login with callbackUrl', () => {
        redirectToLogin('/profile');
        expect(window.location.assign).toHaveBeenCalledWith(
            '/login?callbackUrl=%2Fprofile'
        );
    });
});
