/**
 * Profile Service Layer
 * Centralizes profile-related API calls so components stay free of fetch boilerplate.
 */

import type { Experience, Project, Education, Skill } from '@/types';

export class ProfileServiceError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'ProfileServiceError';
        this.status = status;
    }
}

async function parseJson(res: Response): Promise<unknown> {
    try {
        return await res.json();
    } catch {
        return {};
    }
}

export async function fetchProfile(): Promise<unknown> {
    const res = await fetch('/api/profile', { credentials: 'include' });
    if (!res.ok) {
        throw new ProfileServiceError('Failed to load profile', res.status);
    }
    return parseJson(res);
}

export async function createExperience(
    data: Partial<Experience>
): Promise<unknown> {
    const res = await fetch('/api/profile/experiences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const body = (await parseJson(res)) as { error?: string };
        throw new ProfileServiceError(body.error || 'Failed to create experience', res.status);
    }
    return parseJson(res);
}

export async function createProject(data: Partial<Project>): Promise<unknown> {
    const res = await fetch('/api/profile/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const body = (await parseJson(res)) as { error?: string };
        throw new ProfileServiceError(body.error || 'Failed to create project', res.status);
    }
    return parseJson(res);
}

export async function createEducation(
    data: Partial<Education>
): Promise<unknown> {
    const res = await fetch('/api/profile/educations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const body = (await parseJson(res)) as { error?: string };
        throw new ProfileServiceError(body.error || 'Failed to create education', res.status);
    }
    return parseJson(res);
}

export async function createSkill(data: Partial<Skill>): Promise<unknown> {
    const res = await fetch('/api/profile/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const body = (await parseJson(res)) as { error?: string };
        throw new ProfileServiceError(body.error || 'Failed to create skill', res.status);
    }
    return parseJson(res);
}
