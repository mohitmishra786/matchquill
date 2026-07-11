/**
 * Input Sanitization Utilities
 * XSS protection for user-generated content.
 *
 * Uses the `sanitize-html` package (no jsdom) so Next.js page-data collection
 * and CodeQL incomplete-sanitization checks both succeed.
 */

import sanitizeHtml from 'sanitize-html';

// ============================================================================
// Configuration
// ============================================================================

const PLAIN_TEXT_OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
};

const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: [
        'b',
        'i',
        'em',
        'strong',
        'u',
        'p',
        'br',
        'ul',
        'ol',
        'li',
        'a',
        'span',
        'h1',
        'h2',
        'h3',
        'h4',
        'blockquote',
        'code',
        'pre',
    ],
    allowedAttributes: {
        a: ['href', 'name', 'target', 'rel'],
        // no event handlers / style
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
    transformTags: {
        a: sanitizeHtml.simpleTransform('a', {
            rel: 'noopener noreferrer',
        }),
    },
    disallowedTagsMode: 'discard',
};

// ============================================================================
// Sanitization Functions
// ============================================================================

/**
 * Sanitize plain text input - removes all HTML tags
 * Use for: names, titles, company names, simple text fields
 */
export function sanitizeText(input: unknown): string {
    if (typeof input !== 'string' || !input) return '';
    const cleaned = sanitizeHtml(input, PLAIN_TEXT_OPTIONS);
    return cleaned.trim().replace(/\s+/g, ' ');
}

/**
 * Sanitize rich text input - allows safe formatting tags, strips scripts/events
 * Use for: descriptions, summaries, content that may have formatting
 */
export function sanitizeRichText(input: unknown): string {
    if (typeof input !== 'string' || !input) return '';
    return sanitizeHtml(input, RICH_TEXT_OPTIONS).trim();
}

/**
 * Sanitize URL input
 * Validates and sanitizes URLs to prevent javascript: and data: protocols
 */
export function sanitizeUrl(input: unknown): string | null {
    if (typeof input !== 'string' || !input) return null;

    const sanitized = input.trim();

    // Check for dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
    const lowerUrl = sanitized.toLowerCase();

    for (const protocol of dangerousProtocols) {
        if (lowerUrl.startsWith(protocol)) {
            return null;
        }
    }

    // Validate URL format if it looks like a URL
    if (sanitized && !sanitized.match(/^(https?:\/\/|mailto:|tel:)/i)) {
        // If no protocol, assume https://
        if (sanitized.includes('.') && !sanitized.includes(' ')) {
            return `https://${sanitized}`;
        }
    }

    return sanitized || null;
}

/**
 * Sanitize email input
 */
export function sanitizeEmail(input: unknown): string {
    if (typeof input !== 'string' || !input) return '';

    // Strip any HTML then trim/lowercase
    const sanitized = sanitizeText(input).toLowerCase();

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(sanitized)) {
        return '';
    }

    return sanitized;
}

/**
 * Sanitize array of strings
 */
export function sanitizeStringArray(
    inputs: (string | null | undefined)[] | null | undefined
): string[] {
    if (!inputs || !Array.isArray(inputs)) return [];

    return inputs
        .map((item) => sanitizeText(item))
        .filter((item) => item.length > 0);
}

/**
 * Sanitize a number within a range
 */
export function sanitizeNumber(
    input: unknown,
    min: number = Number.MIN_SAFE_INTEGER,
    max: number = Number.MAX_SAFE_INTEGER,
    defaultValue: number = 0
): number {
    if (input === null || input === undefined) return defaultValue;
    if (typeof input === 'number') {
        if (isNaN(input) || !isFinite(input)) return defaultValue;
        return Math.max(min, Math.min(max, input));
    }

    const num = typeof input === 'string' ? parseFloat(input) : NaN;

    if (isNaN(num) || !isFinite(num)) return defaultValue;

    return Math.max(min, Math.min(max, num));
}

/**
 * Sanitize boolean input
 */
export function sanitizeBoolean(input: unknown, defaultValue: boolean = false): boolean {
    if (input === null || input === undefined) return defaultValue;
    if (typeof input === 'boolean') return input;
    if (typeof input === 'number') return input !== 0;
    if (typeof input === 'string') {
        const lower = input.toLowerCase().trim();
        return lower === 'true' || lower === '1' || lower === 'yes';
    }
    return defaultValue;
}

// ============================================================================
// Object Sanitization
// ============================================================================

export interface SanitizedExperienceData {
    company: string;
    title: string;
    location: string;
    description: string;
    highlights: string[];
    keywords: string[];
    startDate: unknown;
    endDate: unknown;
    current: boolean;
}

export function sanitizeExperienceData(
    data: Record<string, unknown>
): SanitizedExperienceData {
    return {
        company: sanitizeText(data.company as string),
        title: sanitizeText(data.title as string),
        location: sanitizeText(data.location as string),
        description: sanitizeRichText(data.description as string),
        highlights: sanitizeStringArray(data.highlights as string[]),
        keywords: sanitizeStringArray(data.keywords as string[]),
        startDate: data.startDate,
        endDate: data.endDate,
        current: sanitizeBoolean(data.current, false),
    };
}

export interface SanitizedProjectData {
    name: string;
    description: string;
    url: string | null;
    technologies: string[];
    highlights: string[];
    startDate: unknown;
    endDate: unknown;
}

export function sanitizeProjectData(
    data: Record<string, unknown>
): SanitizedProjectData {
    return {
        name: sanitizeText(data.name as string),
        description: sanitizeRichText(data.description as string),
        url: sanitizeUrl(data.url as string),
        technologies: sanitizeStringArray(data.technologies as string[]),
        highlights: sanitizeStringArray(data.highlights as string[]),
        startDate: data.startDate,
        endDate: data.endDate,
    };
}

export interface SanitizedEducationData {
    institution: string;
    degree: string;
    field: string;
    gpa: number;
    honors: string[];
    startDate: unknown;
    endDate: unknown;
}

export function sanitizeEducationData(
    data: Record<string, unknown>
): SanitizedEducationData {
    return {
        institution: sanitizeText(data.institution as string),
        degree: sanitizeText(data.degree as string),
        field: sanitizeText(data.field as string),
        gpa: sanitizeNumber(data.gpa, 0, 4, 0),
        honors: sanitizeStringArray(data.honors as string[]),
        startDate: data.startDate,
        endDate: data.endDate,
    };
}

export interface SanitizedSkillData {
    name: string;
    category: string;
    proficiency: string;
    yearsExp: number;
}

export function sanitizeSkillData(data: Record<string, unknown>): SanitizedSkillData {
    return {
        name: sanitizeText(data.name as string),
        category: sanitizeText(data.category as string),
        proficiency: sanitizeText(data.proficiency as string),
        yearsExp: sanitizeNumber(data.yearsExp, 0, 100, 0),
    };
}

export interface SanitizedCoverLetterData {
    content: string;
    jobTitle: string;
    companyName: string;
}

export function sanitizeCoverLetterData(
    data: Record<string, unknown>
): SanitizedCoverLetterData {
    return {
        content: sanitizeRichText(data.content as string),
        jobTitle: sanitizeText(data.jobTitle as string),
        companyName: sanitizeText(data.companyName as string),
    };
}

export interface SanitizedProfileData {
    name: string;
    image: string | null;
}

export function sanitizeProfileData(
    data: Record<string, unknown>
): SanitizedProfileData {
    return {
        name: sanitizeText(data.name as string),
        image: sanitizeUrl(data.image as string),
    };
}

export interface SanitizedFeedbackData {
    rating: number;
    comment: string;
    category: string;
}

export function sanitizeFeedbackData(
    data: Record<string, unknown>
): SanitizedFeedbackData {
    return {
        rating: sanitizeNumber(data.rating, 1, 5, 3),
        comment: sanitizeRichText(data.comment as string),
        category: sanitizeText(data.category as string),
    };
}

/**
 * Create a sanitized version of request body
 */
export function sanitizeRequestBody<T extends Record<string, unknown>>(body: T): T {
    const sanitized = { ...body };

    for (const key of Object.keys(sanitized)) {
        const value = sanitized[key];

        if (typeof value === 'string') {
            (sanitized as Record<string, unknown>)[key] = sanitizeText(value);
        } else if (Array.isArray(value)) {
            (sanitized as Record<string, unknown>)[key] = value.map((item) =>
                typeof item === 'string' ? sanitizeText(item) : item
            );
        } else if (typeof value === 'object' && value !== null) {
            (sanitized as Record<string, unknown>)[key] = sanitizeRequestBody(
                value as Record<string, unknown>
            );
        }
    }

    return sanitized;
}

/**
 * Get Content Security Policy headers
 */
export function getSecurityHeaders(): Record<string, string> {
    return {
        'Content-Security-Policy': [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self'",
            "connect-src 'self'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ].join('; '),
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
    };
}
