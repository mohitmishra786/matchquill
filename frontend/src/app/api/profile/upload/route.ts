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

        const uploadEndpoint = getBackendUrl('/upload/resume');

        // Forward to backend for parsing
        logger.info('[Upload] Forwarding to backend', {
            requestId,
            userId,
            backendUrl: uploadEndpoint,
        });

        let backendResponse: Response;

        try {
            backendResponse = await fetch(uploadEndpoint, {
                method: 'POST',
                body: backendFormData,
                headers: {
                    'X-Request-ID': requestId,
                    'Authorization': `Bearer ${backendToken}`,
                },
            });
        } catch (fetchError) {
            const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);

            logger.error('[Upload] Backend connection failed', {
                requestId,
                userId,
                error: errorMessage,
            });

            return NextResponse.json(
                {
                    success: false,
                    error: 'Failed to connect to parsing service.',
                    requestId,
                },
                { status: 503 }
            );
        }

        // Parse backend response
        let backendData: Record<string, unknown>;

        try {
            backendData = await backendResponse.json();
        } catch (parseError) {
            const responseText = await backendResponse.text().catch(() => 'Unable to read response');

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
