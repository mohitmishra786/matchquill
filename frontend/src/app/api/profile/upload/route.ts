/**
 * Resume/CV Upload API Route
 * Forwards uploads to backend for parsing - NO MOCK DATA FALLBACK
 *
 * This route acts as a proxy to the backend parsing service.
 * All parsing is done server-side for reliability.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createRequestLogger, getOrCreateRequestId, logAuthOperation } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { generateBackendToken } from '@/lib/jwt';
import { getBackendUrl } from '@/lib/backend-url';
import { MAX_UPLOAD_BYTES } from '@/lib/constants';
import { Prisma } from '@prisma/client';

/**
 * Multi-chunk LLM resume parse can exceed 2 minutes on long PDFs (Railway logs
 * showed ~117s for a 5-chunk parse). Vercel Pro allows up to 300s; keep headroom
 * for cold start + DB save after parse.
 */
export const maxDuration = 300;

/** Backend fetch timeout (ms) — must stay under maxDuration. */
const BACKEND_FETCH_TIMEOUT_MS = 280_000;

function looksLikeHtml(body: string): boolean {
    const sample = body.slice(0, 200).trim().toLowerCase();
    return sample.startsWith('<!doctype') || sample.startsWith('<html') || sample.includes('<head');
}

async function fetchBackendWithRetry(
    endpoint: string,
    init: RequestInit,
    logger: ReturnType<typeof createRequestLogger>,
    requestId: string,
): Promise<Response> {
    let lastError: unknown;
    // One retry helps Railway cold-starts that drop the first connection.
    for (let attempt = 1; attempt <= 2; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), BACKEND_FETCH_TIMEOUT_MS);
        try {
            const response = await fetch(endpoint, {
                ...init,
                signal: controller.signal,
            });
            clearTimeout(timer);
            return response;
        } catch (err) {
            clearTimeout(timer);
            lastError = err;
            const message = err instanceof Error ? err.message : String(err);
            const aborted = err instanceof Error && err.name === 'AbortError';
            logger.warn('[Upload] Backend fetch attempt failed', {
                requestId,
                attempt,
                aborted,
                error: message,
            });
            if (attempt < 2 && !aborted) {
                await new Promise((r) => setTimeout(r, 800));
                continue;
            }
            throw err;
        }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function POST(request: NextRequest) {
    const requestId = getOrCreateRequestId(request.headers);
    const logger = createRequestLogger(requestId);

    logger.startOperation('upload:resume');

    try {
        // Check authentication
        logger.info('[Upload] Authenticating user');
        const session = await auth();

        if (!session?.user?.id) {
            logger.warn('[Upload] Authentication failed - no session');
            logAuthOperation('upload:unauthorized', undefined, false);
            return NextResponse.json(
                {
                    success: false,
                    error: 'Unauthorized. Please sign in to upload files.',
                    requestId
                },
                { status: 401 }
            );
        }

        const userId = session.user.id;
        logger.info('[Upload] User authenticated', { requestId, userId });
        logAuthOperation('upload:authenticated', userId, true);

        // Generate JWT token for backend authentication
        let backendToken: string;
        try {
            backendToken = await generateBackendToken(userId, session.user.email);
        } catch (tokenError) {
            logger.error('[Upload] Failed to generate backend token', { 
                requestId, 
                userId,
                error: tokenError instanceof Error ? tokenError.message : String(tokenError)
            });
            return NextResponse.json(
                {
                    success: false,
                    error: 'Authentication error. Please try again.',
                    requestId
                },
                { status: 500 }
            );
        }

        // Parse the multipart form data
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const fileType = formData.get('type') as string || 'resume';

        if (!file) {
            logger.warn('[Upload] No file provided', { requestId, userId });
            return NextResponse.json(
                {
                    success: false,
                    error: 'No file provided. Please select a file to upload.',
                    requestId
                },
                { status: 400 }
            );
        }

        if (file.size > MAX_UPLOAD_BYTES) {
            const maxMb = Math.round(MAX_UPLOAD_BYTES / 1024 / 1024);
            logger.warn('[Upload] File exceeds size limit', {
                requestId,
                userId,
                filesize: file.size,
                maxBytes: MAX_UPLOAD_BYTES,
            });
            return NextResponse.json(
                {
                    success: false,
                    error: `File too large. Maximum size is ${maxMb}MB.`,
                    requestId,
                },
                { status: 400 }
            );
        }

        logger.info('[Upload] Processing file', {
            requestId,
            userId,
            filename: file.name,
            filetype: file.type,
            filesize: file.size,
            uploadType: fileType,
        });

        // Prepare form data for backend
        const backendFormData = new FormData();
        backendFormData.append('file', file);
        backendFormData.append('file_type', fileType);

        let uploadEndpoint: string;
        try {
            uploadEndpoint = getBackendUrl('/upload/resume');
        } catch (urlError) {
            const message = urlError instanceof Error ? urlError.message : String(urlError);
            logger.error('[Upload] Invalid BACKEND_URL configuration', {
                requestId,
                userId,
                error: message,
            });
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Parsing service is not configured. Set BACKEND_URL on Vercel to your Railway public URL (https://<service>.up.railway.app/api/py).',
                    details: {
                        errorType: 'CONFIG_ERROR',
                        message,
                    },
                    requestId,
                },
                { status: 503 }
            );
        }

        // Forward to backend for parsing
        logger.info('[Upload] Forwarding to backend', {
            requestId,
            userId,
            // Host only — avoid leaking full internal paths/tokens in logs
            backendHost: (() => {
                try {
                    return new URL(uploadEndpoint).host;
                } catch {
                    return 'invalid';
                }
            })(),
        });

        let backendResponse: Response;

        try {
            backendResponse = await fetchBackendWithRetry(
                uploadEndpoint,
                {
                    method: 'POST',
                    body: backendFormData,
                    headers: {
                        'X-Request-ID': requestId,
                        Authorization: `Bearer ${backendToken}`,
                    },
                },
                logger,
                requestId,
            );
        } catch (fetchError) {
            const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
            const timedOut = fetchError instanceof Error && fetchError.name === 'AbortError';

            logger.error('[Upload] Backend connection failed', {
                requestId,
                userId,
                timedOut,
                error: errorMessage,
            });

            return NextResponse.json(
                {
                    success: false,
                    error: timedOut
                        ? 'Parsing service timed out. Long resumes can take over a minute to parse with AI — wait for Railway to finish and try again, or upload a shorter PDF.'
                        : 'Failed to connect to parsing service. Check that BACKEND_URL points at your live Railway API and that the service is running.',
                    details: {
                        errorType: timedOut ? 'TIMEOUT' : 'CONNECTION_ERROR',
                        message: errorMessage,
                    },
                    requestId,
                },
                { status: 503 }
            );
        }

        // Read body once as text, then JSON.parse — never double-read the stream
        const responseText = await backendResponse.text();
        let backendData: Record<string, unknown>;

        if (!responseText.trim()) {
            logger.error('[Upload] Empty backend response body', {
                requestId,
                userId,
                status: backendResponse.status,
            });
            return NextResponse.json(
                {
                    success: false,
                    error: 'Parsing service returned an empty response.',
                    details: {
                        errorType: 'EMPTY_RESPONSE',
                        status: backendResponse.status,
                    },
                    requestId,
                },
                { status: 502 }
            );
        }

        if (looksLikeHtml(responseText)) {
            logger.error('[Upload] Backend returned HTML instead of JSON', {
                requestId,
                userId,
                status: backendResponse.status,
                responsePreview: responseText.slice(0, 200),
            });
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Parsing service misconfigured: received HTML instead of JSON. On Vercel, set BACKEND_URL to your Railway public URL (https://<service>.up.railway.app/api/py), not localhost and not the Vercel frontend domain.',
                    details: {
                        errorType: 'HTML_RESPONSE',
                        status: backendResponse.status,
                        responsePreview: responseText.slice(0, 200),
                    },
                    requestId,
                },
                { status: 502 }
            );
        }

        try {
            backendData = JSON.parse(responseText) as Record<string, unknown>;
        } catch (parseError) {
            logger.error('[Upload] Failed to parse backend response', {
                requestId,
                userId,
                status: backendResponse.status,
                responsePreview: responseText.slice(0, 500),
                parseError: parseError instanceof Error ? parseError.message : String(parseError),
            });

            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid response from parsing service.',
                    details: {
                        errorType: 'PARSE_ERROR',
                        status: backendResponse.status,
                        responsePreview: responseText.slice(0, 200),
                    },
                    requestId,
                },
                { status: 502 }
            );
        }

        // Handle non-OK response from backend
        if (!backendResponse.ok) {
            logger.error('[Upload] Backend returned error', {
                requestId,
                userId,
                status: backendResponse.status,
                error: backendData,
            });

            // Extract error message from backend response
            const errorMessage = typeof backendData.detail === 'string'
                ? backendData.detail
                : (backendData.detail as Record<string, unknown>)?.message ||
                backendData.error ||
                'Failed to parse file';

            return NextResponse.json(
                {
                    success: false,
                    error: String(errorMessage),
                    details: backendData,
                    requestId,
                },
                { status: backendResponse.status }
            );
        }

        // Success - return parsed data
        logger.info('[Upload] Parsing successful', {
            requestId,
            userId,
            hasName: !!(backendData.data as Record<string, unknown>)?.name,
            hasExperiences: !!((backendData.data as Record<string, unknown>)?.experiences as unknown[])?.length,
            hasSkills: !!((backendData.data as Record<string, unknown>)?.skills as unknown[])?.length,
            hasEducation: !!((backendData.data as Record<string, unknown>)?.education as unknown[])?.length,
            extractionMethod: (backendData.data as Record<string, unknown>)?.extraction_method,
        });

        // === NEW: Automatically save parsed data to database ===
        try {
            logger.info('[Upload] Saving parsed data to database', { requestId, userId });

            const parsedData = backendData.data as Record<string, unknown>;

            // Wrap all database operations in a transaction with extended timeout
            await prisma.$transaction(async (tx) => {
                // Update user profile name if provided
                if (parsedData.name) {
                    await tx.user.update({
                        where: { id: userId },
                        data: { name: String(parsedData.name) },
                    });
                    logger.debug('[Upload] Updated user name', { userId });
                }

                // Save experiences with deduplication
                const experiences = parsedData.experiences as unknown[] || [];
                let experiencesCreated = 0;
                for (const exp of experiences) {
                    const e = exp as Record<string, unknown>;
                    if (!e.company || !e.title) continue;

                    // Check for existing experience
                    const existing = await tx.experience.findFirst({
                        where: {
                            userId,
                            company: String(e.company),
                            title: String(e.title),
                            startDate: e.start_date ? new Date(String(e.start_date)) : undefined,
                        },
                    });

                    if (!existing) {
                        await tx.experience.create({
                            data: {
                                userId,
                                company: String(e.company),
                                title: String(e.title),
                                description: e.description ? String(e.description) : '',
                                startDate: e.start_date ? new Date(String(e.start_date)) : new Date(),
                                endDate: e.end_date && !e.current ? new Date(String(e.end_date)) : null,
                                current: Boolean(e.current),
                                location: e.location ? String(e.location) : null,
                                highlights: e.highlights ? (e.highlights as string[]) : [],
                            },
                        });
                        experiencesCreated++;
                    }
                }
                logger.debug('[Upload] Saved experiences', { total: experiences.length, created: experiencesCreated });

                // Save education
                const education = parsedData.education as unknown[] || [];
                for (const edu of education) {
                    const e = edu as Record<string, unknown>;
                    if (!e.institution && !e.school) continue;
                    if (!e.degree || !e.field) continue;

                    await tx.education.create({
                        data: {
                            userId,
                            institution: String(e.institution || e.school),
                            degree: String(e.degree),
                            field: String(e.field || e.major || ''),
                            startDate: e.start_date ? new Date(String(e.start_date)) : new Date(),
                            endDate: e.end_date ? new Date(String(e.end_date)) : null,
                            gpa: e.gpa ? parseFloat(String(e.gpa)) : null,
                        },
                    });
                }
                logger.debug('[Upload] Saved education', { count: education.length });

                // Save skills with batch deduplication (optimized for large skill lists)
                const skills = parsedData.skills as unknown[] || [];
                const skillNames = skills
                    .map(skill => typeof skill === 'string' ? skill : String((skill as Record<string, unknown>).name || skill))
                    .filter(name => name && name.trim());

                if (skillNames.length > 0) {
                    // Batch fetch existing skills
                    const existingSkills = await tx.skill.findMany({
                        where: {
                            userId,
                            name: { in: skillNames },
                        },
                        select: { name: true },
                    });

                    const existingSkillNames = new Set(existingSkills.map(s => s.name));
                    const newSkills = skillNames.filter(name => !existingSkillNames.has(name));

                    // Batch create new skills
                    if (newSkills.length > 0) {
                        await tx.skill.createMany({
                            data: newSkills.map(name => ({
                                userId,
                                name,
                                category: 'technical',
                                proficiency: 'intermediate',
                            })),
                            skipDuplicates: true,
                        });
                    }

                    logger.debug('[Upload] Saved skills', { total: skillNames.length, created: newSkills.length });
                }

                // Save projects with deduplication
                const projects = parsedData.projects as unknown[] || [];
                let projectsCreated = 0;
                for (const project of projects) {
                    const p = project as Record<string, unknown>;
                    if (!p.name) continue;

                    // Check for existing project
                    const existing = await tx.project.findFirst({
                        where: {
                            userId,
                            name: String(p.name),
                        },
                    });

                    if (!existing) {
                        await tx.project.create({
                            data: {
                                userId,
                                name: String(p.name),
                                description: p.description ? String(p.description) : '',
                                technologies: p.technologies ? (p.technologies as string[]) : [],
                                url: p.url ? String(p.url) : null,
                            },
                        });
                        projectsCreated++;
                    }
                }
                logger.debug('[Upload] Saved projects', { total: projects.length, created: projectsCreated });

                // Save publications
                const publications = parsedData.publications as unknown[] || [];
                let publicationsCreated = 0;
                for (const pub of publications) {
                    const p = pub as Record<string, unknown>;
                    if (!p.title) continue;

                    // Check for existing publication
                    const existing = await tx.publication.findFirst({
                        where: {
                            userId,
                            title: String(p.title),
                        },
                    });

                    if (!existing) {
                        await tx.publication.create({
                            data: {
                                userId,
                                title: String(p.title),
                                venue: p.venue ? String(p.venue) : '',
                                authors: p.authors ? (p.authors as string[]) : [],
                                date: p.year ? new Date(`${p.year}-01-01`) : new Date(),
                                url: p.url ? String(p.url) : null,
                                doi: p.doi ? String(p.doi) : null,
                                abstract: p.abstract ? String(p.abstract) : null,
                            },
                        });
                        publicationsCreated++;
                    }
                }
                logger.debug('[Upload] Saved publications', { total: publications.length, created: publicationsCreated });

                logger.info('[Upload] Successfully saved parsed data to database', {
                    requestId,
                    userId,
                    experiencesCreated,
                    projectsCreated,
                    educationCount: education.length,
                });

                // Create a new resume version with complete snapshot
                const snapshot = await tx.user.findUnique({
                    where: { id: userId },
                    include: {
                        experiences: true,
                        projects: true,
                        educations: true,
                        skills: true,
                        publications: true,
                    },
                });

                if (snapshot) {
                    await tx.resumeVersion.create({
                        data: {
                            userId,
                            name: file.name || 'Resume Upload',
                            snapshot: snapshot as unknown as Prisma.InputJsonValue,
                        },
                    });

                    // Keep only the last 3 versions
                    const allVersions = await tx.resumeVersion.findMany({
                        where: { userId },
                        orderBy: { createdAt: 'desc' },
                        select: { id: true },
                    });

                    if (allVersions.length > 3) {
                        const versionsToDelete = allVersions.slice(3);
                        await tx.resumeVersion.deleteMany({
                            where: {
                                id: { in: versionsToDelete.map(v => v.id) },
                            },
                        });
                        logger.debug('[Upload] Cleaned up old versions', {
                            deleted: versionsToDelete.length,
                            remaining: 3,
                        });
                    }

                    logger.info('[Upload] Created resume version', {
                        requestId,
                        userId,
                        versionName: file.name,
                    });
                }
            }, {
                timeout: 30000, // 30 seconds for large skill lists
            });
        } catch (saveError) {
            logger.error('[Upload] Error saving to database', {
                requestId,
                userId,
                error: saveError instanceof Error ? saveError.message : String(saveError),
            });
            // Don't fail the upload - data is still returned to frontend
        }

        logger.endOperation('upload:resume');

        return NextResponse.json({
            success: true,
            data: backendData.data,
            requestId,
        });

    } catch (error) {
        // Unexpected error in the route handler
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        logger.error('[Upload] Unexpected error in upload handler', {
            requestId,
            errorType: error instanceof Error ? error.constructor.name : typeof error,
            errorMessage,
            stack: errorStack,
        });
        logger.failOperation('upload:resume', error);

        return NextResponse.json(
            {
                success: false,
                error: 'An unexpected error occurred while processing your file.',
                details: process.env.NODE_ENV !== 'production' ? {
                    errorType: error instanceof Error ? error.constructor.name : typeof error,
                    message: errorMessage,
                } : undefined,
                requestId,
            },
            { status: 500 }
        );
    }
}
