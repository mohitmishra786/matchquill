/**
 * Input Sanitization Utilities
 * Provides XSS protection and input sanitization for user-generated content.
 *
 * Pure JavaScript implementation — no jsdom / isomorphic-dompurify.
 * (jsdom breaks Next.js page-data collection with missing default-stylesheet.css)
 */

// ============================================================================
// Configuration
// ============================================================================

/** Tags allowed in rich-text fields (descriptions, cover letters, etc.) */
const RICH_TEXT_ALLOWED_TAGS = new Set([
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
]);

const VOID_TAGS = new Set(['br']);

// ============================================================================
// Pure HTML helpers (no DOM)
// ============================================================================

function decodeBasicEntities(input: string): string {
    return input
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#0*39;/g, "'")
        .replace(/&#x27;/gi, "'");
}

/**
 * Strip all HTML tags and dangerous content. Pure string processing.
 */
function stripAllTags(html: string): string {
    let s = html;
    // Remove comments, scripts, styles entirely (including content)
    s = s.replace(/<!--[\s\S]*?-->/g, '');
    s = s.replace(/<script\b[\s\S]*?<\/script>/gi, '');
    s = s.replace(/<style\b[\s\S]*?<\/style>/gi, '');
    s = s.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '');
    s = s.replace(/<object\b[\s\S]*?<\/object>/gi, '');
    s = s.replace(/<embed\b[^>]*>/gi, '');
    s = s.replace(/<svg\b[\s\S]*?<\/svg>/gi, '');
    // Remove remaining tags
    s = s.replace(/<\/?[^>]+>/g, '');
    return decodeBasicEntities(s);
}

function isSafeHref(href: string): boolean {
    const trimmed = href.trim();
    const lower = trimmed.toLowerCase();
    if (
        lower.startsWith('javascript:') ||
        lower.startsWith('data:') ||
        lower.startsWith('vbscript:') ||
        lower.startsWith('file:')
    ) {
        return false;
    }
    return /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(trimmed) || trimmed.startsWith('/');
}

/**
 * Allow only safe tags; strip event handlers and dangerous attributes.
 */
function sanitizeRichHtml(html: string): string {
    let s = html;
    s = s.replace(/<!--[\s\S]*?-->/g, '');
    s = s.replace(/<script\b[\s\S]*?<\/script>/gi, '');
    s = s.replace(/<style\b[\s\S]*?<\/style>/gi, '');
    s = s.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '');
    s = s.replace(/<object\b[\s\S]*?<\/object>/gi, '');
    s = s.replace(/<embed\b[^>]*>/gi, '');
    s = s.replace(/<svg\b[\s\S]*?<\/svg>/gi, '');

    // Process tags
    s = s.replace(/<\/?([a-zA-Z0-9]+)(\s[^>]*)?>/g, (match, rawTag: string, attrs?: string) => {
        const isClosing = match.startsWith('</');
        const tag = rawTag.toLowerCase();

        if (!RICH_TEXT_ALLOWED_TAGS.has(tag)) {
            return '';
        }

        if (isClosing) {
            if (VOID_TAGS.has(tag)) return '';
            return `</${tag}>`;
        }

        if (VOID_TAGS.has(tag)) {
            return `<${tag}>`;
        }

        // Only anchors may keep attributes (safe href only)
        if (tag === 'a' && attrs) {
            const hrefMatch = attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
            const href = hrefMatch
                ? (hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3] ?? '').trim()
                : '';
            if (href && isSafeHref(href)) {
                // Force safe rel/target
                return `<a href="${href.replace(/"/g, '&quot;')}" rel="noopener noreferrer">`;
            }
            return '<a>';
        }

        // All other allowed tags: no attributes (drops onclick, style, etc.)
        return `<${tag}>`;
    });

    return s.trim();
}

// ============================================================================
// Sanitization Functions
// ============================================================================

/**
 * Sanitize plain text input - removes all HTML tags
 * Use for: names, titles, company names, simple text fields
 */
export function sanitizeText(input: unknown): string {
    if (typeof input !== 'string' || !input) return '';
    const cleaned = stripAllTags(input);
    return cleaned.trim().replace(/\s+/g, ' ');
}

/**
 * Sanitize rich text input - allows safe formatting tags, strips scripts/events
 * Use for: descriptions, summaries, content that may have formatting
 */
export function sanitizeRichText(input: unknown): string {
    if (typeof input !== 'string' || !input) return '';
    return sanitizeRichHtml(input).trim();
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

/**
 * Sanitized experience data interface
 */
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

/**
 * Sanitize experience data object
 */
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

/**
 * Sanitized project data interface
 */
export interface SanitizedProjectData {
    name: string;
    description: string;
    url: string | null;
    technologies: string[];
    highlights: string[];
    startDate: unknown;
    endDate: unknown;
}

/**
 * Sanitize project data object
 */
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

/**
 * Sanitized education data interface
 */
export interface SanitizedEducationData {
    institution: string;
    degree: string;
    field: string;
    gpa: number;
    honors: string[];
    startDate: unknown;
    endDate: unknown;
}

/**
 * Sanitize education data object
 */
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

/**
 * Sanitized skill data interface
 */
export interface SanitizedSkillData {
    name: string;
    category: string;
    proficiency: string;
    yearsExp: number;
}

/**
 * Sanitize skill data object
 */
export function sanitizeSkillData(data: Record<string, unknown>): SanitizedSkillData {
    return {
        name: sanitizeText(data.name as string),
        category: sanitizeText(data.category as string),
        proficiency: sanitizeText(data.proficiency as string),
        yearsExp: sanitizeNumber(data.yearsExp, 0, 100, 0),
    };
}

/**
 * Cover letter data interface
 */
export interface SanitizedCoverLetterData {
    content: string;
    jobTitle: string;
    companyName: string;
}

/**
 * Sanitize cover letter data object
 */
export function sanitizeCoverLetterData(
    data: Record<string, unknown>
): SanitizedCoverLetterData {
    return {
        content: sanitizeRichText(data.content as string),
        jobTitle: sanitizeText(data.jobTitle as string),
        companyName: sanitizeText(data.companyName as string),
    };
}

/**
 * Sanitized user profile data interface
 */
export interface SanitizedProfileData {
    name: string;
    image: string | null;
}

/**
 * Sanitize user profile data
 */
export function sanitizeProfileData(
    data: Record<string, unknown>
): SanitizedProfileData {
    return {
        name: sanitizeText(data.name as string),
        image: sanitizeUrl(data.image as string),
    };
}

/**
 * Sanitized feedback data interface
 */
export interface SanitizedFeedbackData {
    rating: number;
    comment: string;
    category: string;
}

/**
 * Sanitize feedback data
 */
export function sanitizeFeedbackData(
    data: Record<string, unknown>
): SanitizedFeedbackData {
    return {
        rating: sanitizeNumber(data.rating, 1, 5, 3),
        comment: sanitizeRichText(data.comment as string),
        category: sanitizeText(data.category as string),
    };
}

// ============================================================================
// Middleware Helper
// ============================================================================

/**
 * Create a sanitized version of request body
 * This is a generic sanitizer that strips HTML from all string fields
 */
export function sanitizeRequestBody<T extends Record<string, unknown>>(body: T): T {
    const sanitized = { ...body };

    for (const key of Object.keys(sanitized)) {
        const value = sanitized[key];

        if (typeof value === 'string') {
            // For most fields, use plain text sanitization
            (sanitized as Record<string, unknown>)[key] = sanitizeText(value);
        } else if (Array.isArray(value)) {
            // Sanitize arrays of strings
            (sanitized as Record<string, unknown>)[key] = value.map((item) =>
                typeof item === 'string' ? sanitizeText(item) : item
            );
        } else if (typeof value === 'object' && value !== null) {
            // Recursively sanitize nested objects
            (sanitized as Record<string, unknown>)[key] = sanitizeRequestBody(
                value as Record<string, unknown>
            );
        }
    }

    return sanitized;
}

// ============================================================================
// Security Headers Helper
// ============================================================================

/**
 * Get Content Security Policy headers
 * These headers help prevent XSS attacks
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
