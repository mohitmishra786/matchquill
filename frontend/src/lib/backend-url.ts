/**
 * Backend URL Utility
 * Provides secure backend URL construction with SSRF protection.
 *
 * Resolution order (production split deploy: Vercel frontend + Railway backend):
 * 1. BACKEND_URL (preferred server-side secret)
 * 2. NEXT_PUBLIC_API_URL when it is a non-localhost public URL
 * 3. VERCEL_URL → https://{VERCEL_URL}/api/py (unified Vercel Services only)
 *
 * Localhost values are never used on Vercel — they would target the serverless
 * container itself and cause silent parse failures.
 */

const ALLOWED_BACKEND_HOSTS = (
    process.env.ALLOWED_BACKEND_HOSTS?.split(',').map(h => h.trim()).filter(Boolean) || []
);

function stripTrailingSlash(url: string): string {
    return url.endsWith('/') ? url.slice(0, -1) : url;
}

function isLocalhostUrl(value: string): boolean {
    try {
        const host = new URL(value).hostname.toLowerCase();
        return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0';
    } catch {
        return /localhost|127\.0\.0\.1/i.test(value);
    }
}

function isRunningOnVercel(): boolean {
    return Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_URL);
}

function resolveBackendBaseUrl(): string {
    const configured = process.env.BACKEND_URL?.trim();
    if (configured) {
        if (isRunningOnVercel() && isLocalhostUrl(configured)) {
            throw new Error(
                'BACKEND_URL is set to localhost on Vercel. Set BACKEND_URL to your Railway public URL, e.g. https://<service>.up.railway.app/api/py'
            );
        }
        return stripTrailingSlash(configured);
    }

    // Prefer a correctly configured public API URL over the self-referential Vercel fallback.
    const publicApi = process.env.NEXT_PUBLIC_API_URL?.trim();
    if (publicApi && !isLocalhostUrl(publicApi)) {
        return stripTrailingSlash(publicApi);
    }

    // On Vercel, localhost NEXT_PUBLIC_API_URL is a common misconfiguration — do not use it.
    if (publicApi && isRunningOnVercel() && isLocalhostUrl(publicApi)) {
        // Fall through to VERCEL_URL only so unified deploys still work; split deploys
        // will get HTML from /api/py and the upload route will surface a clear error.
    }

    const vercelUrl = process.env.VERCEL_URL?.trim();
    if (vercelUrl) {
        // Unified deploy fallback only — split Railway deploys MUST set BACKEND_URL.
        const protocol = process.env.VERCEL_ENV === 'development' ? 'http' : 'https';
        return `${protocol}://${vercelUrl}/api/py`;
    }

    if (publicApi) {
        // Last resort in local dev (localhost allowed off Vercel)
        return stripTrailingSlash(publicApi);
    }

    throw new Error(
        'BACKEND_URL is not configured. For production set BACKEND_URL to your Railway URL (https://<service>.up.railway.app/api/py).'
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
