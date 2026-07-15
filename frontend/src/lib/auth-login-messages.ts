/**
 * Map Auth.js error codes to user-facing login messages.
 */

export function authErrorMessage(code: string | null | undefined): string {
    if (!code) {
        return 'Sign-in failed. Please try again.';
    }

    switch (code) {
        case 'CredentialsSignin':
            return 'Invalid email or password.';
        case 'Configuration':
            return 'Sign-in is misconfigured on the server. Ensure AUTH_SECRET (or NEXTAUTH_SECRET) is set in Vercel Production, then redeploy.';
        case 'AccessDenied':
            return 'Access denied for this account.';
        case 'OAuthAccountNotLinked':
            return 'This email is already registered with a different sign-in method. Use email/password, or the original provider.';
        case 'OAuthSignin':
        case 'OAuthCallback':
        case 'OAuthCreateAccount':
            return 'Google sign-in failed. Check Google OAuth credentials or use email/password.';
        case 'SessionRequired':
            return 'Please sign in to continue.';
        case 'Callback':
            return 'Sign-in callback failed. Please try again.';
        default:
            // Avoid leaking raw internal codes when possible
            if (code.length > 40 || code.includes(' ')) {
                return code;
            }
            return `Sign-in failed (${code}). Please try again.`;
    }
}
