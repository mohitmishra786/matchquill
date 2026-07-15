/**
 * Prisma Client Singleton
 * Prevents multiple instances in development
 */

// CRITICAL: Import environment setup FIRST to map CV_DATABASE_DATABASE_URL to DATABASE_URL
import './prisma-env';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

// Neon requires TLS. Prefer explicit ssl so Node pg does not rely on
// ambiguous sslmode aliases (require/prefer/verify-ca → verify-full warning).
const databaseUrl = process.env.DATABASE_URL ?? '';
const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('sslmode=') || databaseUrl.includes('neon.tech')
        ? { rejectUnauthorized: true }
        : undefined,
});
const adapter = new PrismaPg(pool);

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
