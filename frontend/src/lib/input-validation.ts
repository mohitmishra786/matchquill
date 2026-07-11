/**
 * Server-side input validation helpers for auth routes.
 * Kept free of React so API routes can import safely.
 */

/** Minimum password length for registration and password changes */
export const MIN_PASSWORD_LENGTH = 10;

function isValidEmail(email: string): boolean {
    const atIndex = email.indexOf('@');
    if (atIndex < 1) return false;
    const lastDotIndex = email.lastIndexOf('.');
    if (lastDotIndex < atIndex + 2) return false;
    if (lastDotIndex >= email.length - 2) return false;
    if (email.indexOf(' ') !== -1) return false;
    return true;
}

/**
 * Validate strong password (production policy).
 * Requires length >= 10, upper, lower, digit, and special character.
 */
export function isStrongPassword(password: string): {
    isValid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (password.length < MIN_PASSWORD_LENGTH) {
        errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export function parseRegistrationInput(body: unknown): { email: string; password: string; name: string | undefined } {
    if (typeof body !== 'object' || body === null) {
        throw new ValidationError('Invalid request body');
    }
    const data = body as Record<string, unknown>;

    const email = typeof data.email === 'string' ? data.email.trim() : '';
    const password = typeof data.password === 'string' ? data.password : '';
    const name = typeof data.name === 'string' ? data.name.trim() : undefined;

    if (!email) {
        throw new ValidationError('Email and password are required');
    }
    if (!password) {
        throw new ValidationError('Email and password are required');
    }
    if (!isValidEmail(email)) {
        throw new ValidationError('Invalid email format');
    }

    const strength = isStrongPassword(password);
    if (!strength.isValid) {
        throw new ValidationError(
            strength.errors[0] || 'Password does not meet strength requirements'
        );
    }

    return { email, password, name };
}

export function parseHoneypot(body: unknown): string | undefined {
    if (typeof body !== 'object' || body === null) return undefined;
    const data = body as Record<string, unknown>;
    return typeof data.honeypot === 'string' ? data.honeypot : undefined;
}
