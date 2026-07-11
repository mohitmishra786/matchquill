import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { buildPublicProfile } from './publicProfile';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                name: true,
                image: true,
                email: true,
                experiences: {
                    orderBy: [{ current: 'desc' }, { startDate: 'desc' }],
                    select: {
                        company: true,
                        title: true,
                        location: true,
                        startDate: true,
                        endDate: true,
                        current: true,
                        description: true,
                        highlights: true,
                    },
                },
                projects: {
                    orderBy: { order: 'asc' },
                    select: {
                        name: true,
                        description: true,
                        url: true,
                        startDate: true,
                        endDate: true,
                        technologies: true,
                        highlights: true,
                    },
                },
                educations: {
                    orderBy: { startDate: 'desc' },
                    select: {
                        institution: true,
                        degree: true,
                        field: true,
                        startDate: true,
                        endDate: true,
                        gpa: true,
                        honors: true,
                    },
                },
                skills: {
                    orderBy: [{ category: 'asc' }, { order: 'asc' }],
                    select: {
                        name: true,
                        category: true,
                    },
                },
                publications: {
                    orderBy: { date: 'desc' },
                    select: {
                        title: true,
                        venue: true,
                        authors: true,
                        date: true,
                        url: true,
                    },
                },
                settings: {
                    select: {
                        resumePreferences: true,
                    },
                },
            },
        });

        if (!user) {
            return NextResponse.json(
                { error: 'Profile not found or not public' },
                { status: 404 }
            );
        }

        const publicProfile = buildPublicProfile(user);

        if (!publicProfile) {
            return NextResponse.json(
                { error: 'Profile not found or not public' },
                { status: 404 }
            );
        }

        return NextResponse.json(publicProfile);
    } catch (error) {
        logger.error('[PublicProfile] Fetch failed', { error, id });
        return NextResponse.json(
            { error: 'Failed to fetch profile' },
            { status: 500 }
        );
    }
}
