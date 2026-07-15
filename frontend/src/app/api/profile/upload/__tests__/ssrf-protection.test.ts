import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('SSRF Protection', () => {
    describe('getBackendUrl', () => {
        const originalEnv = process.env;

        beforeEach(() => {
            vi.resetModules();
            process.env = { ...originalEnv };
        });

        afterEach(() => {
            process.env = originalEnv;
            vi.restoreAllMocks();
        });

        it('should return valid backend URL when BACKEND_URL is configured', async () => {
            process.env.BACKEND_URL = 'http://backend:8000/api/py';

            const { getBackendUrl } = await import('@/lib/backend-url');
            const result = getBackendUrl('/upload/resume');

            expect(result).toBe('http://backend:8000/api/py/upload/resume');
        });

        it('should strip trailing slash from BACKEND_URL', async () => {
            process.env.BACKEND_URL = 'http://backend:8000/api/py/';

            const { getBackendUrl } = await import('@/lib/backend-url');
            const result = getBackendUrl('/upload/resume');

            expect(result).toBe('http://backend:8000/api/py/upload/resume');
        });

        it('should throw error when BACKEND_URL is not configured', async () => {
            delete process.env.BACKEND_URL;
            delete process.env.NEXT_PUBLIC_API_URL;
            delete process.env.VERCEL_URL;
            delete process.env.VERCEL;
            delete process.env.VERCEL_ENV;

            const { getBackendUrl } = await import('@/lib/backend-url');

            expect(() => getBackendUrl('/upload/resume')).toThrow(
                'BACKEND_URL is not configured'
            );
        });

        it('should derive backend URL from VERCEL_URL when BACKEND_URL is unset', async () => {
            delete process.env.BACKEND_URL;
            delete process.env.NEXT_PUBLIC_API_URL;
            process.env.VERCEL_URL = 'matchquill.vercel.app';
            process.env.VERCEL_ENV = 'production';

            const { getBackendUrl } = await import('@/lib/backend-url');
            const result = getBackendUrl('/upload/resume');

            expect(result).toBe('https://matchquill.vercel.app/api/py/upload/resume');
        });

        it('should use NEXT_PUBLIC_API_URL when BACKEND_URL is unset and URL is public', async () => {
            delete process.env.BACKEND_URL;
            process.env.NEXT_PUBLIC_API_URL = 'https://matchquill-backend.up.railway.app/api/py';
            process.env.VERCEL = '1';

            const { getBackendUrl } = await import('@/lib/backend-url');
            const result = getBackendUrl('/upload/resume');

            expect(result).toBe('https://matchquill-backend.up.railway.app/api/py/upload/resume');
        });

        it('should reject localhost BACKEND_URL on Vercel', async () => {
            process.env.BACKEND_URL = 'http://localhost:8000/api/py';
            process.env.VERCEL = '1';

            const { getBackendUrl } = await import('@/lib/backend-url');

            expect(() => getBackendUrl('/upload/resume')).toThrow(/localhost on Vercel/);
        });

        it('should throw error when BACKEND_URL has invalid format', async () => {
            process.env.BACKEND_URL = 'not-a-valid-url';

            const { getBackendUrl } = await import('@/lib/backend-url');

            expect(() => getBackendUrl('/upload/resume')).toThrow('Invalid BACKEND_URL configuration');
        });

        it('should accept hosts in ALLOWED_BACKEND_HOSTS', async () => {
            process.env.BACKEND_URL = 'http://backend:8000';
            process.env.ALLOWED_BACKEND_HOSTS = 'backend:8000,localhost:3000,api.example.com';

            const { getBackendUrl } = await import('@/lib/backend-url');
            const result = getBackendUrl('/upload/resume');

            expect(result).toBe('http://backend:8000/upload/resume');
        });

        it('should reject hosts not in ALLOWED_BACKEND_HOSTS', async () => {
            process.env.BACKEND_URL = 'http://malicious:8000';
            process.env.ALLOWED_BACKEND_HOSTS = 'backend:8000,localhost:3000';

            const { getBackendUrl } = await import('@/lib/backend-url');

            expect(() => getBackendUrl('/upload/resume')).toThrow("Backend host 'malicious:8000' is not in allowed list");
        });

        it('should allow all hosts when ALLOWED_BACKEND_HOSTS is empty', async () => {
            process.env.BACKEND_URL = 'http://any-host:8000';
            delete process.env.ALLOWED_BACKEND_HOSTS;

            const { getBackendUrl } = await import('@/lib/backend-url');
            const result = getBackendUrl('/upload/resume');

            expect(result).toBe('http://any-host:8000/upload/resume');
        });

        it('should reject internal IP addresses when ALLOWED_BACKEND_HOSTS is set', async () => {
            process.env.BACKEND_URL = 'http://192.168.1.1:8000';
            process.env.ALLOWED_BACKEND_HOSTS = 'backend:8000';

            const { getBackendUrl } = await import('@/lib/backend-url');

            expect(() => getBackendUrl('/upload/resume')).toThrow("Backend host '192.168.1.1:8000' is not in allowed list");
        });

        it('should handle HTTPS URLs', async () => {
            process.env.BACKEND_URL = 'https://api.example.com';

            const { getBackendUrl } = await import('@/lib/backend-url');
            const result = getBackendUrl('/api/py/upload/resume');

            expect(result).toBe('https://api.example.com/api/py/upload/resume');
        });
    });
});
