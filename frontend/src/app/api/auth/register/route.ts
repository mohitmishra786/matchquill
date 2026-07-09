/**
 * User Registration API
 * POST /api/auth/register
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { isValidEmail } from '@/lib/utils';
import { createRequestLogger, getOrCreateRequestId, logDbOperation, logAuthOperation } from '@/lib/logger';
import { isRateLimited, getClientIP, rateLimits, validateBotProtection } from '@/lib/rate-limit';

function sanitizeError(error: unknown): { message: string; code: string } {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as { code?: string }).code || 'UNKNOWN_ERROR';

    const sensitivePatterns = [
        /password/i,
        /secret/i,
        /token/i,
        /api[_-]?key/i,
        /credential/i,
        /connection string/i,
        /database/i,
        /prisma/i,
        /at\s+.*\.ts:?\d*/,
        /\/[a-zA-Z0-9_/-]+\.(ts|js):\d+:\d+/,
    ];

    if (sensitivePatterns.some(pattern => pattern.test(errorMessage))) {
        return { message: 'An internal error occurred', code: errorCode };
    }

    return { message: 'An internal error occurred', code: errorCode };
}

export async function POST(request: NextRequest) {
    const requestId = getOrCreateRequestId(request.headers);
    const logger = createRequestLogger(requestId);

    logger.startOperation('user:register');

    try {
        // Rate limiting check
        const clientIP = getClientIP(request);
        const rateLimit = isRateLimited(clientIP, rateLimits.registration);
        
        if (rateLimit.limited) {
            logger.warn('Registration rate limit exceeded', { clientIP });
            return NextResponse.json(
                { error: 'Too many registration attempts. Please try again later.', requestId },
                { status: 429 }
            );
        }

        const body = await request.json();
        const { email, password, name, honeypot } = body;

        if (!validateBotProtection(honeypot)) {
            logger.warn('Registration blocked - bot detected via honeypot', { clientIP });
            return NextResponse.json(
                { error: 'Registration is temporarily unavailable', requestId },
                { status: 403 }
            );
        }

        logger.info('Registration attempt', {
            email: email ? `${email.substring(0, 3)}***` : undefined,
            hasPassword: !!password,
            hasName: !!name
        });

        if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
            logger.warn('Registration failed: missing required fields', { hasEmail: typeof email === 'string', hasPassword: typeof password === 'string' });
            return NextResponse.json(
                { error: 'Email and password are required', requestId },
                { status: 400 }
            );
        }

        // Validate email format
        if (!isValidEmail(email)) {
            logger.warn('Registration failed: invalid email format');
            return NextResponse.json(
                { error: 'Invalid email format', requestId },
                { status: 400 }
            );
        }

        // Validate password strength
        if (typeof password !== 'string' || password.length < 8) {
            logger.warn('Registration failed: password too short');
            return NextResponse.json(
                { error: 'Password must be at least 8 characters', requestId },
                { status: 400 }
            );
        }

        // Check database connection
        logger.info('Checking database connection...');
        logDbOperation('findUnique', 'User', { email: `${email.substring(0, 3)}***` });

        // Check if user already exists
        let existingUser;
        try {
            existingUser = await prisma.user.findUnique({
                where: { email },
            });
        } catch (dbError) {
            logger.error('Database error during user lookup', {
                error: dbError instanceof Error ? dbError.message : dbError,
                databaseUrl: process.env.DATABASE_URL ? 'set' : 'NOT SET',
                cvDatabaseUrl: process.env.CV_DATABASE_DATABASE_URL ? 'set' : 'NOT SET',
            });
            throw dbError;
        }

        if (existingUser) {
            logger.warn('Registration failed: user already exists');
            logAuthOperation('register:duplicate', existingUser.id, false);
            return NextResponse.json(
                { error: 'User with this email already exists', requestId },
                { status: 409 }
            );
        }

        // Hash password
        logger.info('Hashing password...');
        const passwordHash = await bcrypt.hash(password, 12);

        // Create user
        logger.info('Creating user in database...');
        logDbOperation('create', 'User', { email: `${email.substring(0, 3)}***` });

        let user;
        try {
            user = await prisma.user.create({
                data: {
                    email,
                    passwordHash,
                    name: name || null,
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    createdAt: true,
                },
            });
        } catch (dbError) {
            logger.error('Database error during user creation', {
                error: dbError instanceof Error ? dbError.message : dbError,
                code: (dbError as { code?: string }).code,
            });
            throw dbError;
        }

        logger.info('User created successfully', { userId: user.id });
        logAuthOperation('register:success', user.id, true);

        // Create default settings
        logger.info('Creating default user settings...');
        logDbOperation('create', 'UserSettings', { userId: user.id });

        try {
            await prisma.userSettings.create({
                data: {
                    userId: user.id,
                    selectedTemplate: 'experience-skills-projects',
                },
            });
        } catch (settingsError) {
            logger.warn('Failed to create default settings (non-critical)', {
                error: settingsError instanceof Error ? settingsError.message : settingsError,
            });
            // Don't fail registration if settings creation fails
        }

        logger.endOperation('user:register');

        return NextResponse.json(
            {
                message: 'User created successfully',
                user,
                requestId,
            },
            { status: 201 }
        );
    } catch (error) {
        logger.failOperation('user:register', error);

        const sanitized = sanitizeError(error);

        return NextResponse.json(
            {
                error: sanitized.message,
                code: sanitized.code,
                requestId,
            },
            { status: 500 }
        );
    }
}
