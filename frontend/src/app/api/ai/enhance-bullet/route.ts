/**
 * AI Enhance Bullet API Route
 * POST /api/ai/enhance-bullet
 *
 * Server-side proxy that authenticates the user via NextAuth session,
 * mints a short-lived backend JWT (AUTH_SECRET never leaves the server),
 * and forwards the request to the FastAPI AI endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateBackendToken } from '@/lib/jwt';
import { getBackendUrl } from '@/lib/backend-url';
import { createRequestLogger, getOrCreateRequestId, logAuthOperation } from '@/lib/logger';

/** Max characters accepted for a single bullet to limit abuse/cost */
const MAX_BULLET_LENGTH = 2000;
const MAX_JD_LENGTH = 20000;

function resolveEnhanceEndpoint(): string {
    try {
        return getBackendUrl('/ai/enhance-bullet');
    } catch {
        // Local/dev fallback when BACKEND_URL is not configured
        const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(
            /\/$/,
            ''
        );
        return `${base}/ai/enhance-bullet`;
    }
}

/**
 * POST /api/ai/enhance-bullet
 * Body: { bullet: string, job_description?: string }
 */
export async function POST(request: NextRequest) {
    const requestId = getOrCreateRequestId(request.headers);
    const logger = createRequestLogger(requestId);

    logger.startOperation('enhance-bullet:proxy');

    try {
        const session = await auth();

        if (!session?.user?.id) {
            logger.warn('Enhance bullet failed - no session', { requestId });
            logAuthOperation('enhance-bullet:unauthorized', undefined, false);
            return NextResponse.json(
                { error: 'Unauthorized', requestId },
                { status: 401 }
            );
        }

        const userId = session.user.id;
        logAuthOperation('enhance-bullet:authenticated', userId, true);

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: 'Invalid JSON body', requestId },
                { status: 400 }
            );
        }

        if (!body || typeof body !== 'object') {
            return NextResponse.json(
                { error: 'Invalid request body', requestId },
                { status: 400 }
            );
        }

        const { bullet, job_description: jobDescription } = body as {
            bullet?: unknown;
            job_description?: unknown;
        };

        if (typeof bullet !== 'string' || !bullet.trim()) {
            return NextResponse.json(
                { error: 'Bullet text is required', requestId },
                { status: 400 }
            );
        }

        if (bullet.length > MAX_BULLET_LENGTH) {
            return NextResponse.json(
                {
                    error: `Bullet text exceeds maximum length of ${MAX_BULLET_LENGTH} characters`,
                    requestId,
                },
                { status: 400 }
            );
        }

        if (
            jobDescription !== undefined &&
            jobDescription !== null &&
            (typeof jobDescription !== 'string' || jobDescription.length > MAX_JD_LENGTH)
        ) {
            return NextResponse.json(
                {
                    error: `job_description must be a string of at most ${MAX_JD_LENGTH} characters`,
                    requestId,
                },
                { status: 400 }
            );
        }

        const backendToken = await generateBackendToken(
            userId,
            session.user.email || undefined
        );

        const endpoint = resolveEnhanceEndpoint();

        logger.info('Proxying enhance-bullet to backend', {
            requestId,
            userId,
            bulletLength: bullet.length,
            hasJobDescription: typeof jobDescription === 'string' && jobDescription.length > 0,
        });

        let backendResponse: Response;
        try {
            backendResponse = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${backendToken}`,
                    'X-Request-ID': requestId,
                },
                body: JSON.stringify({
                    bullet: bullet.trim(),
                    job_description:
                        typeof jobDescription === 'string' && jobDescription.trim()
                            ? jobDescription.trim()
                            : undefined,
                }),
            });
        } catch (fetchError) {
            logger.error('Backend enhance-bullet unreachable', {
                requestId,
                userId,
                error:
                    fetchError instanceof Error ? fetchError.message : String(fetchError),
            });
            return NextResponse.json(
                { error: 'AI service unavailable. Please try again later.', requestId },
                { status: 502 }
            );
        }

        const responseText = await backendResponse.text();
        let data: unknown = {};
        try {
            data = responseText ? JSON.parse(responseText) : {};
        } catch {
            data = { detail: responseText || 'Invalid backend response' };
        }

        if (!backendResponse.ok) {
            logger.warn('Backend enhance-bullet returned error', {
                requestId,
                userId,
                status: backendResponse.status,
            });

            // Map auth failures so the client can redirect to login
            if (backendResponse.status === 401 || backendResponse.status === 403) {
                return NextResponse.json(
                    { error: 'Session expired. Please sign in again.', requestId },
                    { status: backendResponse.status }
                );
            }

            const detail =
                typeof data === 'object' &&
                data !== null &&
                'detail' in data &&
                typeof (data as { detail: unknown }).detail === 'string'
                    ? (data as { detail: string }).detail
                    : 'Failed to enhance bullet';

            return NextResponse.json(
                { error: detail, requestId },
                { status: backendResponse.status >= 500 ? 502 : backendResponse.status }
            );
        }

        const enhanced =
            typeof data === 'object' &&
            data !== null &&
            'enhanced_bullet' in data &&
            typeof (data as { enhanced_bullet: unknown }).enhanced_bullet === 'string'
                ? (data as { enhanced_bullet: string }).enhanced_bullet
                : null;

        if (!enhanced) {
            logger.error('Backend response missing enhanced_bullet', { requestId, userId });
            return NextResponse.json(
                { error: 'Invalid response from AI service', requestId },
                { status: 502 }
            );
        }

        logger.endOperation('enhance-bullet:proxy');
        return NextResponse.json({
            enhanced_bullet: enhanced,
            requestId,
        });
    } catch (error) {
        logger.failOperation('enhance-bullet:proxy', error);
        logger.error('Enhance bullet proxy error', {
            requestId,
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: 'Internal server error', requestId },
            { status: 500 }
        );
    }
}
