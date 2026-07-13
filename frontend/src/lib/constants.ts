/**
 * Shared magic-number constants for the frontend.
 * Prefer importing from here over hardcoding values in components.
 */

/**
 * Resume / cover letter upload.
 * Vercel Functions cap request bodies at 4.5 MB — keep a safe margin.
 * Override via NEXT_PUBLIC_MAX_UPLOAD_BYTES (e.g. 10485760 for Docker backend).
 */
export const MAX_UPLOAD_BYTES = Number(
    process.env.NEXT_PUBLIC_MAX_UPLOAD_BYTES ?? 4 * 1024 * 1024
);
export const ALLOWED_RESUME_EXTENSIONS = [
    '.pdf',
    '.docx',
    '.doc',
    '.txt',
    '.md',
    '.markdown',
] as const;

/** Pagination defaults */
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;

/** Auth / passwords */
export const MIN_PASSWORD_LENGTH = 10;
export const BCRYPT_COST_FACTOR = 12;

/** Debounce / throttle (ms) */
export const DEBOUNCE_INPUT_MS = 300;
export const DEBOUNCE_SEARCH_MS = 250;
export const DEBOUNCE_FILE_SELECT_MS = 150;
export const THROTTLE_RESIZE_MS = 100;

/** AI */
export const MAX_BULLET_LENGTH = 2000;
export const MAX_JOB_DESCRIPTION_LENGTH = 50_000;

/** Resume history (must live outside "use server" modules) */
export const MAX_RESUME_VERSIONS = 20;
export const MAX_SNAPSHOT_JSON_CHARS = 500_000;
export const HISTORY_PAGE_SIZE = 10;
export const HISTORY_MAX_PAGE_SIZE = 50;

/** Toasts */
export const TOAST_DEFAULT_DURATION_MS = 3000;
