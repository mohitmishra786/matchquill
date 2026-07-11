/**
 * ExperienceForm AI auth flow contract tests
 * Ensures the client never imports server-only JWT utilities.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const formSource = readFileSync(
    join(process.cwd(), 'src/components/forms/ExperienceForm.tsx'),
    'utf-8'
);

describe('ExperienceForm AI auth flow', () => {
    it('does not import client-side JWT generation', () => {
        expect(formSource).not.toMatch(/from ['"]@\/lib\/jwt['"]/);
        expect(formSource).not.toMatch(/generateBackendToken/);
    });

    it('does not call NextAuth auth() on the client', () => {
        expect(formSource).not.toMatch(/from ['"]@\/lib\/auth['"]/);
        // Avoid matching "assertAuthenticatedResponse" etc.
        expect(formSource).not.toMatch(/\bauth\s*\(/);
    });

    it('calls the server-authenticated enhance-bullet proxy', () => {
        expect(formSource).toContain("/api/ai/enhance-bullet");
        expect(formSource).not.toContain('/api/py/ai/enhance-bullet');
    });

    it('handles 401/403 via auth error helpers', () => {
        expect(formSource).toContain('assertAuthenticatedResponse');
        expect(formSource).toContain('redirectToLogin');
        expect(formSource).toContain('isAuthenticationError');
    });
});
