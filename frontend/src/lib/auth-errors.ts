/**
 * Client-side helpers for handling authentication failures.
 * Keeps redirect logic consistent across forms and AI actions.
 */

export class AuthenticationError extends Error {
    readonly status: number;

    constructor(message = 'Session expired. Please sign in again.', status = 401) {
        super(message);
        this.name = 'AuthenticationError';
        this.status = status;
    }
}

/**
 * Returns true if the HTTP status indicates auth failure.
 */
export function isAuthStatus(status: number): boolean {
    return status === 401 || status === 403;
}

/**
 * Redirect the browser to the login page, preserving return URL.
 * No-op on the server (SSR).
 */
export function redirectToLogin(returnPath?: string): void {
    if (typeof window === 'undefined') {
        return;
    }

    const path =
        returnPath ||
        `${window.location.pathname}${window.location.search}` ||
        '/profile';
    const loginUrl = `/login?callbackUrl=${encodeURIComponent(path)}`;
    window.location.assign(loginUrl);
}

/**
 * Inspect a fetch Response and throw AuthenticationError on 401/403.
 * Callers should catch AuthenticationError and call redirectToLogin().
 */
export async function assertAuthenticatedResponse(response: Response): Promise<void> {
    if (isAuthStatus(response.status)) {
        let message = 'Session expired. Please sign in again.';
        try {
            const data = (await response.clone().json()) as { error?: string };
            if (data?.error) {
                message = data.error;
            }
        } catch {
            // ignore parse errors; use default message
        }
        throw new AuthenticationError(message, response.status);
    }
}

/**
 * Detect auth-related errors from thrown values (including nested messages).
 */
export function isAuthenticationError(error: unknown): boolean {
    if (error instanceof AuthenticationError) {
        return true;
    }
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        return (
            msg.includes('unauthorized') ||
            msg.includes('not authenticated') ||
            msg.includes('session expired') ||
            msg.includes('forbidden')
        );
    }
    return false;
}
