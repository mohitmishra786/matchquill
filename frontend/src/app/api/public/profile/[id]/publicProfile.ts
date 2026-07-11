/**
 * Public profile privacy helpers
 * Builds a sanitized, preference-filtered public profile payload.
 */

import {
    sanitizeText,
    sanitizeRichText,
    sanitizeUrl,
    sanitizeStringArray,
} from '@/lib/sanitization';

export interface PublicPreferences {
    isPublic: boolean;
    showExperiences: boolean;
    showProjects: boolean;
    showEducations: boolean;
    showSkills: boolean;
    showPublications: boolean;
    showContact: boolean;
    /** When true, include experience description/highlights (still sanitized). Default false. */
    showExperienceDetails: boolean;
}

export const DEFAULT_PUBLIC_PREFERENCES: PublicPreferences = {
    isPublic: false,
    showExperiences: true,
    showProjects: false,
    showEducations: false,
    showSkills: true,
    showPublications: false,
    showContact: false,
    showExperienceDetails: false,
};

type JsonRecord = Record<string, unknown>;

function asBoolean(value: unknown, defaultValue: boolean): boolean {
    if (typeof value === 'boolean') return value;
    return defaultValue;
}

/**
 * Extract public preferences from resumePreferences JSON.
 * Supports both nested `publicPreferences` and top-level flags (e.g. isPublic).
 */
export function parsePublicPreferences(
    resumePreferences: unknown
): PublicPreferences {
    if (!resumePreferences || typeof resumePreferences !== 'object') {
        return { ...DEFAULT_PUBLIC_PREFERENCES };
    }

    const root = resumePreferences as JsonRecord;
    const nested =
        root.publicPreferences && typeof root.publicPreferences === 'object'
            ? (root.publicPreferences as JsonRecord)
            : {};

    // Prefer nested publicPreferences; fall back to top-level keys for backwards compatibility
    const source: JsonRecord = { ...root, ...nested };

    return {
        isPublic: asBoolean(source.isPublic, DEFAULT_PUBLIC_PREFERENCES.isPublic),
        showExperiences: asBoolean(
            source.showExperiences,
            DEFAULT_PUBLIC_PREFERENCES.showExperiences
        ),
        showProjects: asBoolean(
            source.showProjects,
            DEFAULT_PUBLIC_PREFERENCES.showProjects
        ),
        showEducations: asBoolean(
            source.showEducations,
            DEFAULT_PUBLIC_PREFERENCES.showEducations
        ),
        showSkills: asBoolean(source.showSkills, DEFAULT_PUBLIC_PREFERENCES.showSkills),
        showPublications: asBoolean(
            source.showPublications,
            DEFAULT_PUBLIC_PREFERENCES.showPublications
        ),
        showContact: asBoolean(
            source.showContact,
            DEFAULT_PUBLIC_PREFERENCES.showContact
        ),
        showExperienceDetails: asBoolean(
            source.showExperienceDetails,
            DEFAULT_PUBLIC_PREFERENCES.showExperienceDetails
        ),
    };
}

export interface PublicProfileInput {
    name: string | null;
    image: string | null;
    email?: string | null;
    experiences?: Array<Record<string, unknown>>;
    projects?: Array<Record<string, unknown>>;
    educations?: Array<Record<string, unknown>>;
    skills?: Array<Record<string, unknown>>;
    publications?: Array<Record<string, unknown>>;
    settings?: {
        resumePreferences?: unknown;
    } | null;
}

export interface PublicProfilePayload {
    name: string;
    image: string | null;
    experiences?: Array<Record<string, unknown>>;
    projects?: Array<Record<string, unknown>>;
    educations?: Array<Record<string, unknown>>;
    skills?: Array<Record<string, unknown>>;
    publications?: Array<Record<string, unknown>>;
    contact?: { email?: string };
    publicPreferences: Omit<PublicPreferences, 'isPublic'>;
}

function sanitizeExperience(
    exp: Record<string, unknown>,
    includeDetails: boolean
): Record<string, unknown> {
    const base: Record<string, unknown> = {
        company: sanitizeText(exp.company),
        title: sanitizeText(exp.title),
        location: exp.location != null ? sanitizeText(exp.location) : null,
        startDate: exp.startDate ?? null,
        endDate: exp.endDate ?? null,
        current: Boolean(exp.current),
    };

    if (includeDetails) {
        base.description = sanitizeRichText(exp.description);
        base.highlights = sanitizeStringArray(
            Array.isArray(exp.highlights) ? (exp.highlights as string[]) : []
        );
        // keywords are internal targeting data — never expose publicly
    }

    return base;
}

function sanitizeProject(proj: Record<string, unknown>): Record<string, unknown> {
    return {
        name: sanitizeText(proj.name),
        description: sanitizeRichText(proj.description),
        url: proj.url != null ? sanitizeUrl(proj.url) : null,
        startDate: proj.startDate ?? null,
        endDate: proj.endDate ?? null,
        technologies: sanitizeStringArray(
            Array.isArray(proj.technologies) ? (proj.technologies as string[]) : []
        ),
        highlights: sanitizeStringArray(
            Array.isArray(proj.highlights) ? (proj.highlights as string[]) : []
        ),
    };
}

function sanitizeEducation(edu: Record<string, unknown>): Record<string, unknown> {
    return {
        institution: sanitizeText(edu.institution),
        degree: sanitizeText(edu.degree),
        field: sanitizeText(edu.field),
        startDate: edu.startDate ?? null,
        endDate: edu.endDate ?? null,
        gpa: typeof edu.gpa === 'number' ? edu.gpa : null,
        honors: sanitizeStringArray(
            Array.isArray(edu.honors) ? (edu.honors as string[]) : []
        ),
    };
}

function sanitizeSkill(skill: Record<string, unknown>): Record<string, unknown> {
    // Public skills: name + category only (no proficiency / yearsExp)
    return {
        name: sanitizeText(skill.name),
        category: sanitizeText(skill.category),
    };
}

function sanitizePublication(pub: Record<string, unknown>): Record<string, unknown> {
    return {
        title: sanitizeText(pub.title),
        venue: sanitizeText(pub.venue),
        authors: sanitizeStringArray(
            Array.isArray(pub.authors) ? (pub.authors as string[]) : []
        ),
        date: pub.date ?? null,
        url: pub.url != null ? sanitizeUrl(pub.url) : null,
        // abstract can be long / sensitive — omit from public by default
    };
}

/**
 * Build a privacy-safe public profile from a full user record.
 * Returns null if the profile is not public.
 */
export function buildPublicProfile(
    user: PublicProfileInput
): PublicProfilePayload | null {
    const prefs = parsePublicPreferences(user.settings?.resumePreferences);

    if (!prefs.isPublic) {
        return null;
    }

    const {
        isPublic: _isPublic,
        ...visiblePrefs
    } = prefs;

    const payload: PublicProfilePayload = {
        name: sanitizeText(user.name) || 'Anonymous',
        image: user.image ? sanitizeUrl(user.image) : null,
        publicPreferences: visiblePrefs,
    };

    if (prefs.showSkills) {
        payload.skills = (user.skills ?? []).map((s) => sanitizeSkill(s));
    }

    if (prefs.showExperiences) {
        payload.experiences = (user.experiences ?? []).map((e) =>
            sanitizeExperience(e, prefs.showExperienceDetails)
        );
    }

    if (prefs.showProjects) {
        payload.projects = (user.projects ?? []).map((p) => sanitizeProject(p));
    }

    if (prefs.showEducations) {
        payload.educations = (user.educations ?? []).map((e) => sanitizeEducation(e));
    }

    if (prefs.showPublications) {
        payload.publications = (user.publications ?? []).map((p) =>
            sanitizePublication(p)
        );
    }

    // Contact is opt-in; even then only expose email when explicitly enabled
    if (prefs.showContact && user.email) {
        // Never dump full contact — only sanitized email when opted in
        const email = sanitizeText(user.email).toLowerCase();
        if (email) {
            payload.contact = { email };
        }
    }

    return payload;
}
