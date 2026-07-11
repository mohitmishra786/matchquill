/**
 * Tests for AI enhance-bullet proxy (server-side auth)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ai/enhance-bullet/route';

vi.mock('@/lib/auth', () => ({
    auth: vi.fn(),
}));

vi.mock('@/lib/jwt', () => ({
    generateBackendToken: vi.fn().mockResolvedValue('mock-backend-jwt'),
}));

vi.mock('@/lib/backend-url', () => ({
    getBackendUrl: vi.fn().mockReturnValue('http://localhost:8000/ai/enhance-bullet'),
}));

vi.mock('@/lib/logger', () => ({
    createRequestLogger: () => ({
        startOperation: vi.fn(),
        endOperation: vi.fn(),
        failOperation: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
    getOrCreateRequestId: () => 'test-request-id',
    logAuthOperation: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { generateBackendToken } from '@/lib/jwt';

describe('POST /api/ai/enhance-bullet', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('rejects unauthenticated requests', async () => {
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const request = new NextRequest('http://localhost:3000/api/ai/enhance-bullet', {
            method: 'POST',
            body: JSON.stringify({ bullet: 'Led a team' }),
        });
        const response = await POST(request);

        expect(response.status).toBe(401);
        expect(generateBackendToken).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects missing bullet text', async () => {
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
            user: { id: 'user-1', email: 'u@example.com' },
        });

        const request = new NextRequest('http://localhost:3000/api/ai/enhance-bullet', {
            method: 'POST',
            body: JSON.stringify({ bullet: '   ' }),
        });
        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('required');
    });

    it('proxies with Authorization header when authenticated', async () => {
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
            user: { id: 'user-1', email: 'u@example.com' },
        });
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
            new Response(JSON.stringify({ enhanced_bullet: 'Led a cross-functional team' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const request = new NextRequest('http://localhost:3000/api/ai/enhance-bullet', {
            method: 'POST',
            body: JSON.stringify({
                bullet: 'Led a team',
                job_description: 'Looking for leaders',
            }),
        });
        const response = await POST(request);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.enhanced_bullet).toBe('Led a cross-functional team');

        expect(generateBackendToken).toHaveBeenCalledWith('user-1', 'u@example.com');
        expect(global.fetch).toHaveBeenCalledWith(
            'http://localhost:8000/ai/enhance-bullet',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    Authorization: 'Bearer mock-backend-jwt',
                }),
            })
        );
    });

    it('maps backend 401 to client-facing session expired response', async () => {
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
            user: { id: 'user-1', email: 'u@example.com' },
        });
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
            new Response(JSON.stringify({ detail: 'Invalid token' }), { status: 401 })
        );

        const request = new NextRequest('http://localhost:3000/api/ai/enhance-bullet', {
            method: 'POST',
            body: JSON.stringify({ bullet: 'Led a team' }),
        });
        const response = await POST(request);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toContain('Session expired');
    });

    it('returns 502 when backend is unreachable', async () => {
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
            user: { id: 'user-1', email: 'u@example.com' },
        });
        (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ECONNREFUSED'));

        const request = new NextRequest('http://localhost:3000/api/ai/enhance-bullet', {
            method: 'POST',
            body: JSON.stringify({ bullet: 'Led a team' }),
        });
        const response = await POST(request);

        expect(response.status).toBe(502);
    });
});
