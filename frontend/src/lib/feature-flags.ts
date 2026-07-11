/**
 * Feature Flags
 *
 * Server and client can check named flags enabled via FEATURE_FLAGS env
 * (comma-separated). Prefer server-side checks for security-sensitive features.
 *
 * Example: FEATURE_FLAGS=ai-enhance,public-profiles,interview-prep
 */

export type FeatureFlag =
    | 'ai-enhance'
    | 'public-profiles'
    | 'interview-prep'
    | 'cover-letter-ai'
    | 'audit-admin'
    | 'experimental-dashboard';

/**
 * Parse FEATURE_FLAGS env into a normalized set.
 */
export function parseFeatureFlags(raw: string | undefined | null): Set<string> {
    if (!raw || !raw.trim()) {
        return new Set();
    }
    return new Set(
        raw
            .split(',')
            .map((f) => f.trim().toLowerCase())
            .filter(Boolean)
    );
}

/**
 * Check if a feature is enabled.
 * When FEATURE_FLAGS is unset/empty, defaults to enabled for stable features
 * listed in DEFAULT_ENABLED so production works without configuration.
 */
const DEFAULT_ENABLED: ReadonlySet<string> = new Set([
    'ai-enhance',
    'public-profiles',
    'interview-prep',
    'cover-letter-ai',
]);

export function isFeatureEnabled(
    flag: FeatureFlag | string,
    envValue: string | undefined = process.env.FEATURE_FLAGS ??
        process.env.NEXT_PUBLIC_FEATURE_FLAGS
): boolean {
    const key = flag.trim().toLowerCase();
    if (!key) {
        return false;
    }
    const configured = parseFeatureFlags(envValue);
    if (configured.size === 0) {
        return DEFAULT_ENABLED.has(key);
    }
    return configured.has(key);
}

/**
 * Require a feature or return a structured denial for API routes.
 */
export function requireFeature(flag: FeatureFlag | string):
    | { ok: true }
    | { ok: false; status: 403; error: string } {
    if (!isFeatureEnabled(flag)) {
        return {
            ok: false,
            status: 403,
            error: `Feature disabled: ${flag}`,
        };
    }
    return { ok: true };
}
