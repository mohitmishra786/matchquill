/**
 * Audit Log API Routes
 * GET /api/audit - Get audit logs (admin only)
 * DELETE /api/audit - Clean up old audit logs (admin only)
 *
 * Security: All handlers require authenticated admin privileges.
 * Non-admin users receive 403 regardless of query parameters (prevents IDOR).
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
    getUserAuditLogs,
    getRecentAuditLogs,
    getAuditStats,
    cleanupOldAuditLogs,
    type AuditAction,
    type EntityType,
} from '@/lib/audit';
import { requireAdmin } from '@/lib/admin';
import { createRequestLogger, getOrCreateRequestId } from '@/lib/logger';

/**
 * GET /api/audit
 * Query params:
 * - userId: Filter by user (optional, admin only)
 * - entityType: Filter by entity type (optional)
 * - entityId: Filter by entity ID (optional)
 * - actions: Comma-separated list of actions (optional)
 * - limit: Number of records to return (default: 50, max: 100)
 * - offset: Pagination offset (default: 0)
 * - startDate: Start date filter (ISO format)
 * - endDate: End date filter (ISO format)
 * - stats: If 'true', return statistics instead of logs
 */
export async function GET(request: NextRequest) {
    const requestId = getOrCreateRequestId(request.headers);
    const logger = createRequestLogger(requestId);

    logger.startOperation('audit:get');

    try {
        const session = await auth();

        if (!session?.user?.id) {
            logger.warn('Audit fetch failed - no session', { requestId });
            return NextResponse.json(
                { error: 'Unauthorized', requestId },
                { status: 401 }
            );
        }

        // SECURITY: Admin-only — prevents IDOR via arbitrary userId filters
        const adminCheck = await requireAdmin(session.user.id);
        if (!adminCheck.ok) {
            logger.warn('Audit fetch forbidden - non-admin', {
                requestId,
                userId: session.user.id,
            });
            return NextResponse.json(
                { error: adminCheck.error, requestId },
                { status: adminCheck.status }
            );
        }

        const { searchParams } = new URL(request.url);

        // Parse shared query parameters
        const userId = searchParams.get('userId') || undefined;
        const entityType = searchParams.get('entityType') as EntityType | undefined;
        const entityId = searchParams.get('entityId') || undefined;
        const actionsParam = searchParams.get('actions');
        const actions = actionsParam ? (actionsParam.split(',') as AuditAction[]) : undefined;
        // Clamp limit to [1, 100] — negative values must not bypass the default
        const limit = Math.min(
            Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1),
            100
        );
        const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // Validate dates if provided (shared by stats and list paths)
        if (startDate && Number.isNaN(Date.parse(startDate))) {
            return NextResponse.json(
                { error: 'Invalid startDate', requestId },
                { status: 400 }
            );
        }
        if (endDate && Number.isNaN(Date.parse(endDate))) {
            return NextResponse.json(
                { error: 'Invalid endDate', requestId },
                { status: 400 }
            );
        }

        // Check if stats requested
        if (searchParams.get('stats') === 'true') {
            logger.info('Fetching audit statistics', {
                requestId,
                adminId: session.user.id,
            });

            const stats = await getAuditStats(
                startDate ? new Date(startDate) : undefined,
                endDate ? new Date(endDate) : undefined
            );

            logger.endOperation('audit:get');
            return NextResponse.json({ stats, requestId });
        }

        logger.info('Fetching audit logs', {
            requestId,
            adminId: session.user.id,
            filterUserId: userId,
            entityType,
            entityId,
            actions,
            limit,
            offset,
        });

        let logs;
        let total;

        if (userId) {
            const result = await getUserAuditLogs(userId, {
                limit,
                offset,
                actions,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
            });
            logs = result.logs;
            total = result.total;
        } else if (entityType && entityId) {
            const { getEntityAuditLogs } = await import('@/lib/audit');
            const result = await getEntityAuditLogs(entityType, entityId, {
                limit,
                offset,
                actions,
            });
            logs = result.logs;
            total = result.total;
        } else {
            logs = await getRecentAuditLogs({
                limit,
                actions,
                entityTypes: entityType ? [entityType] : undefined,
            });
            total = logs.length;
        }

        logger.info('Audit logs fetched successfully', {
            requestId,
            count: logs.length,
            total,
        });

        logger.endOperation('audit:get');

        return NextResponse.json({
            logs,
            pagination: {
                limit,
                offset,
                total,
                hasMore: offset + logs.length < total,
            },
            requestId,
        });
    } catch (error) {
        logger.failOperation('audit:get', error);
        logger.error('Audit GET error details', {
            requestId,
            error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
            { error: 'Internal server error', requestId },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/audit
 * Clean up old audit logs (admin only)
 * Query params:
 * - retentionDays: Number of days to retain (default: 365)
 * - dryRun: If 'true', return count without deleting
 */
export async function DELETE(request: NextRequest) {
    const requestId = getOrCreateRequestId(request.headers);
    const logger = createRequestLogger(requestId);

    logger.startOperation('audit:cleanup');

    try {
        const session = await auth();

        if (!session?.user?.id) {
            logger.warn('Audit cleanup failed - no session', { requestId });
            return NextResponse.json(
                { error: 'Unauthorized', requestId },
                { status: 401 }
            );
        }

        // SECURITY: Admin-only cleanup
        const adminCheck = await requireAdmin(session.user.id);
        if (!adminCheck.ok) {
            logger.warn('Audit cleanup forbidden - non-admin', {
                requestId,
                userId: session.user.id,
            });
            return NextResponse.json(
                { error: adminCheck.error, requestId },
                { status: adminCheck.status }
            );
        }

        const { searchParams } = new URL(request.url);
        const retentionDaysRaw = parseInt(searchParams.get('retentionDays') || '365', 10);
        // Bound retention days to prevent accidental mass deletion or invalid values
        const retentionDays = Math.min(Math.max(retentionDaysRaw || 365, 30), 3650);
        const dryRun = searchParams.get('dryRun') === 'true';

        logger.info('Cleaning up old audit logs', {
            requestId,
            adminId: session.user.id,
            retentionDays,
            dryRun,
        });

        if (dryRun) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

            const { default: prisma } = await import('@/lib/prisma');
            const count = await prisma.auditLog.count({
                where: {
                    createdAt: {
                        lt: cutoffDate,
                    },
                },
            });

            logger.info('Audit cleanup dry run completed', { requestId, wouldDelete: count });

            return NextResponse.json({
                dryRun: true,
                wouldDelete: count,
                retentionDays,
                cutoffDate: cutoffDate.toISOString(),
                requestId,
            });
        }

        const deletedCount = await cleanupOldAuditLogs(retentionDays);

        logger.info('Audit cleanup completed', { requestId, deletedCount });

        const { auditFromRequest } = await import('@/lib/audit');
        const userId = session.user.id;
        await auditFromRequest(request, {
            userId,
            action: 'AUDIT_CLEANUP',
            entityType: 'User',
            entityId: userId,
            metadata: { action: 'audit_cleanup', deletedCount, retentionDays, success: true },
        });

        logger.endOperation('audit:cleanup');

        return NextResponse.json({
            deleted: deletedCount,
            retentionDays,
            requestId,
        });
    } catch (error) {
        logger.failOperation('audit:cleanup', error);
        logger.error('Audit DELETE error details', {
            requestId,
            error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
            { error: 'Internal server error', requestId },
            { status: 500 }
        );
    }
}
