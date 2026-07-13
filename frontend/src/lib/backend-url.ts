/**
 * Backend URL Utility
 * Provides secure backend URL construction with SSRF protection.
 *
 * On Vercel unified deployments, BACKEND_URL can be omitted — the helper
 * derives https://{VERCEL_URL}/api/py automatically.
 */

const ALLOWED_BACKEND_HOSTS = (
    process.env.ALLOWED_BACKEND_HOSTS?.split(',').map(h => h.trim()) || []
);

function resolveBackendBaseUrl(): string {
    const configured = process.env.BACKEND_URL?.trim();
    if (configured) {
        return configured.endsWith('/') ? configured.slice(0, -1) : configured;
    }

    const vercelUrl = process.env.VERCEL_URL?.trim();
    if (vercelUrl) {
        const protocol = process.env.VERCEL_ENV === 'development' ? 'http' : 'https';
        return `${protocol}://${vercelUrl}/api/py`;
    }

    throw new Error(
        'BACKEND_URL environment variable is not configured and VERCEL_URL is unavailable'
    );
}

export function getBackendUrl(path: string): string {
    const backendUrl = resolveBackendBaseUrl();

    try {
        const url = new URL(backendUrl);

        if (ALLOWED_BACKEND_HOSTS.length > 0 && !ALLOWED_BACKEND_HOSTS.includes(url.host)) {
            throw new Error(`Backend host '${url.host}' is not in allowed list`);
        }

        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        return `${backendUrl}${normalizedPath}`;
    } catch (error) {
        throw new Error(
            `Invalid BACKEND_URL configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

export function isBackendHostAllowed(host: string): boolean {
    if (ALLOWED_BACKEND_HOSTS.length === 0) {
        return true;
    }
    return ALLOWED_BACKEND_HOSTS.includes(host);
}