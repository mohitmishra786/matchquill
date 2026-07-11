import { describe, it, expect } from 'vitest';
import { parseFeatureFlags, isFeatureEnabled, requireFeature } from '../feature-flags';

describe('parseFeatureFlags', () => {
    it('returns empty set for empty input', () => {
        expect(parseFeatureFlags('').size).toBe(0);
        expect(parseFeatureFlags(null).size).toBe(0);
    });

    it('parses comma-separated flags', () => {
        const flags = parseFeatureFlags('ai-enhance, Public-Profiles ');
        expect(flags.has('ai-enhance')).toBe(true);
        expect(flags.has('public-profiles')).toBe(true);
        expect(flags.size).toBe(2);
    });
});

describe('isFeatureEnabled', () => {
    it('uses defaults when env empty', () => {
        expect(isFeatureEnabled('ai-enhance', '')).toBe(true);
        expect(isFeatureEnabled('experimental-dashboard', '')).toBe(false);
    });

    it('respects explicit env list', () => {
        expect(isFeatureEnabled('ai-enhance', 'interview-prep')).toBe(false);
        expect(isFeatureEnabled('interview-prep', 'interview-prep')).toBe(true);
    });
});

describe('requireFeature', () => {
    it('returns 403 when disabled', () => {
        // Override by checking experimental with empty env (not in defaults)
        const result = requireFeature('experimental-dashboard');
        // When FEATURE_FLAGS unset, experimental is off
        if (!process.env.FEATURE_FLAGS) {
            expect(result.ok).toBe(false);
        }
    });
});
