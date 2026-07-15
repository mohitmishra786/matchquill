import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { isValidSessionToken, getSessionTokenFromCookies } from '@/proxy';

describe('Cookie Security', () => {
    describe('getSessionTokenFromCookies', () => {
        it('reads standard secure session cookie', () => {
            const req = new NextRequest('https://matchquill.vercel.app/profile', {
                headers: {
                    cookie: '__Secure-authjs.session-token=abc123def456ghi789',
                },
            });
            expect(getSessionTokenFromCookies(req)).toBe('abc123def456ghi789');
        });

        it('reassembles chunked session cookies', () => {
            const req = new NextRequest('https://matchquill.vercel.app/profile', {
                headers: {
                    cookie:
                        '__Secure-authjs.session-token.0=chunkA; __Secure-authjs.session-token.1=chunkB',
                },
            });
            expect(getSessionTokenFromCookies(req)).toBe('chunkAchunkB');
        });
    });

    describe('isValidSessionToken', () => {
        it('should accept valid session tokens', () => {
            const validTokens = [
                'abc123def456ghi789',
                'session-12345-abcde-67890',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature',
            ];

            validTokens.forEach((token: string) => {
                expect(isValidSessionToken(token)).toBe(true);
            });
        });

        it('should reject empty or undefined tokens', () => {
            expect(isValidSessionToken('')).toBe(false);
            expect(isValidSessionToken(undefined)).toBe(false);
        });

        it('should reject tokens shorter than minimum length', () => {
            expect(isValidSessionToken('abc')).toBe(false);
            expect(isValidSessionToken('short')).toBe(false);
        });

        it('should reject tokens with SQL injection patterns', () => {
            const maliciousTokens = [
                "token' OR '1'='1",
                'token"; DROP TABLE users;--',
                "token' UNION SELECT",
                'token; DELETE FROM sessions',
            ];

            maliciousTokens.forEach((token: string) => {
                expect(isValidSessionToken(token)).toBe(false);
            });
        });

        it('should reject tokens with XSS patterns', () => {
            const maliciousTokens = [
                '<script>alert(1)</script>',
                'token" onload="alert(1)"',
                'tokenjavascript:evil()',
                'token onmouseover="alert(1)"',
            ];

            maliciousTokens.forEach((token: string) => {
                expect(isValidSessionToken(token)).toBe(false);
            });
        });

        it('should reject tokens with path traversal', () => {
            const maliciousTokens = [
                '../../../etc/passwd',
                '..\\..\\windows\\system32',
                '/etc/passwd',
            ];

            maliciousTokens.forEach((token: string) => {
                expect(isValidSessionToken(token)).toBe(false);
            });
        });
    });
});
