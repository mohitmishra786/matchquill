/**
 * Tests for User Registration API
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
    default: {
        user: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
        userSettings: {
            create: vi.fn(),
        },
    },
}));

vi.mock('@/lib/rate-limit', () => ({
    isRateLimited: vi.fn(),
    getClientIP: vi.fn(),
    rateLimits: {
        registration: { maxRequests: 5, windowMs: 900000 },
    },
}));

vi.mock('bcryptjs', () => ({
    default: {
        hash: vi.fn(),
    },
}));

import prisma from '@/lib/prisma';
import { isRateLimited, getClientIP } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';

describe('POST /api/auth/register', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getClientIP as ReturnType<typeof vi.fn>).mockReturnValue('127.0.0.1');
        (isRateLimited as ReturnType<typeof vi.fn>).mockReturnValue({ limited: false });
    });

    it('should create a new user with valid data', async () => {
        (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        (bcrypt.hash as ReturnType<typeof vi.fn>).mockResolvedValue('hashed_password');
        (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            createdAt: new Date(),
        });
        (prisma.userSettings.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

        const request = new NextRequest('http://localhost:3000/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email: 'test@example.com',
                password: 'SecurePass123!',
                name: 'Test User',
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.message).toBe('User created successfully');
        expect(data.user.email).toBe('test@example.com');
        expect(bcrypt.hash).toHaveBeenCalledWith('SecurePass123!', 12);
    });

    it('should reject registration without email', async () => {
        const request = new NextRequest('http://localhost:3000/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                password: 'SecurePass123!',
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('Email and password are required');
    });

    it('should reject registration without password', async () => {
        const request = new NextRequest('http://localhost:3000/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email: 'test@example.com',
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('Email and password are required');
    });

    it('should reject invalid email format', async () => {
        const request = new NextRequest('http://localhost:3000/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email: 'invalid-email',
                password: 'SecurePass123!',
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('Invalid email format');
    });

    it('should reject password shorter than 10 characters', async () => {
        const request = new NextRequest('http://localhost:3000/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email: 'test@example.com',
                password: 'short',
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('Password must be at least 10 characters');
    });

    it('should reject registration if user already exists', async () => {
        (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: 'existing-user',
            email: 'test@example.com',
        });

        const request = new NextRequest('http://localhost:3000/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email: 'test@example.com',
                password: 'SecurePass123!',
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.error).toContain('User with this email already exists');
    });


    it('should reject password missing special character', async () => {
        const request = new NextRequest('http://localhost:3000/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email: 'test@example.com',
                password: 'SecurePass123',
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('special character');
    });

    it('should enforce rate limiting', async () => {
        (isRateLimited as ReturnType<typeof vi.fn>).mockReturnValue({ limited: true });

        const request = new NextRequest('http://localhost:3000/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email: 'test@example.com',
                password: 'SecurePass123!',
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(429);
        expect(data.error).toContain('Too many registration attempts');
    });

    it('should handle database errors gracefully', async () => {
        (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('Database connection failed')
        );

        const request = new NextRequest('http://localhost:3000/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email: 'test@example.com',
                password: 'SecurePass123!',
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toContain('Internal server error');
    });

    it('should create user without name if not provided', async () => {
        (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        (bcrypt.hash as ReturnType<typeof vi.fn>).mockResolvedValue('hashed_password');
        (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: 'user-123',
            email: 'test@example.com',
            name: null,
            createdAt: new Date(),
        });
        (prisma.userSettings.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

        const request = new NextRequest('http://localhost:3000/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email: 'test@example.com',
                password: 'SecurePass123!',
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.user.name).toBeNull();
    });

    it('should continue registration even if settings creation fails', async () => {
        (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        (bcrypt.hash as ReturnType<typeof vi.fn>).mockResolvedValue('hashed_password');
        (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            createdAt: new Date(),
        });
        (prisma.userSettings.create as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('Settings creation failed')
        );

        const request = new NextRequest('http://localhost:3000/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email: 'test@example.com',
                password: 'SecurePass123!',
                name: 'Test User',
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        // Should still succeed
        expect(response.status).toBe(201);
        expect(data.message).toBe('User created successfully');
    });
});