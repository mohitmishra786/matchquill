import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { isValidGitHubUsername, sanitizeGitHubUsername, isValidGitHubUrl } from '@/lib/github-validation';
import { isRateLimited, getClientIP, rateLimits } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Rate limiting
        const clientIP = getClientIP(request);
        const rateLimit = isRateLimited(clientIP, {
            ...rateLimits.api,
            maxRequests: 30, // 30 GitHub API calls per 15 minutes
        });

        if (rateLimit.limited) {
            logger.warn('[GitHub] Rate limit exceeded', { clientIP });
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                { status: 429 }
            );
        }

        const { username } = await request.json();

        if (!username) {
            return NextResponse.json({ error: 'Username required' }, { status: 400 });
        }

        // Validate username format
        if (!isValidGitHubUsername(username)) {
            logger.warn('[GitHub] Invalid username format', { username: sanitizeGitHubUsername(username) });
            return NextResponse.json(
                { error: 'Invalid GitHub username format' },
                { status: 400 }
            );
        }

        // Sanitize username before using in URL
        const sanitizedUsername = sanitizeGitHubUsername(username);

        const githubUrl = new URL(`https://api.github.com/users/${encodeURIComponent(sanitizedUsername)}/repos?sort=updated&per_page=10`);
        if (githubUrl.origin !== 'https://api.github.com') {
            return NextResponse.json({ error: 'Invalid GitHub URL' }, { status: 400 });
        }
        const res = await fetch(githubUrl.toString(), {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'CV-Wiz-App'
            }
        });

        if (res.status === 404) {
            return NextResponse.json({ error: 'GitHub user not found' }, { status: 404 });
        }

        if (!res.ok) {
            return NextResponse.json({ error: 'Failed to fetch from GitHub' }, { status: res.status });
        }

        const repos = await res.json();
        const projects = repos
            .filter((repo: { html_url: string }) => isValidGitHubUrl(repo.html_url))
            .map((repo: { name: string; description: string | null; html_url: string; language: string | null; stargazers_count: number; forks_count: number; updated_at: string; created_at: string }) => ({
                name: repo.name,
                description: repo.description || '',
                url: repo.html_url,
                startDate: repo.created_at,
                technologies: [repo.language].filter(Boolean),
                highlights: [
                    `${repo.stargazers_count} Stars`,
                    `${repo.forks_count} Forks`
                ].filter(s => !s.startsWith('0 ')), // Only show if > 0
            }));

        return NextResponse.json({ projects });
    } catch (error) {
        logger.error('[GitHub] API request failed', { error });
        return NextResponse.json({ error: 'Failed to fetch GitHub projects' }, { status: 500 });
    }
}