import { describe, it, expect } from 'vitest';
import { authErrorMessage } from '../auth-login-messages';

describe('authErrorMessage', () => {
    it('maps CredentialsSignin to a clear password error', () => {
        expect(authErrorMessage('CredentialsSignin')).toMatch(/invalid email or password/i);
    });

    it('maps Configuration to a secret/env guidance message', () => {
        expect(authErrorMessage('Configuration')).toMatch(/AUTH_SECRET|NEXTAUTH_SECRET/i);
    });

    it('handles empty codes', () => {
        expect(authErrorMessage(null)).toMatch(/try again/i);
    });
});
