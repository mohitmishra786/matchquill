import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sanitizeFeedbackData } from '@/lib/sanitization';
import { logger } from "@/lib/logger";
import { isRateLimited, getClientIP, rateLimits } from '@/lib/rate-limit';

const VALID_CATEGORIES = ['General', 'Bug', 'Feature', 'Usability', 'Performance', 'Other'];

const MAX_COMMENT_LENGTH = 2000;
const MIN_COMMENT_LENGTH = 10;
const MAX_REQUEST_BODY_SIZE = 1024 * 1024;

function validateFeedbackRequest(body: unknown): { valid: boolean; data: Record<string, unknown> | null; error?: string } {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { valid: false, data: null, error: 'Invalid request body' };
    }

    const data = body as Record<string, unknown>;

    if (typeof data.rating === 'undefined' && typeof data.comment === 'undefined') {
        return { valid: false, data: null, error: 'Rating and comment are required' };
    }

    return { valid: true, data };
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientIP = getClientIP(request);
    const rateLimit = isRateLimited(clientIP, rateLimits.feedback);

    if (rateLimit.limited) {
        logger.warn('[Feedback] Rate limit exceeded', { clientIP, userId: session.user.id });
        return NextResponse.json(
            { error: 'Too many feedback submissions. Please try again later.' },
            { status: 429 }
        );
    }

    try {
        const contentLength = request.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > MAX_REQUEST_BODY_SIZE) {
            return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
        }

        const body = await request.json();

        const validation = validateFeedbackRequest(body);
        if (!validation.valid) {
            return NextResponse.json({ error: validation.error }, { status: 400 });
        }

        // Validate the raw rating before it goes through sanitizeFeedbackData:
        // sanitizeFeedbackData -> sanitizeNumber() defaults a missing rating
        // to 3 and clamps out-of-range values into [1, 5], so validating
        // *after* sanitizing would always see an in-range number and never
        // reject a missing or out-of-range rating.
        const rawRating = (validation.data as Record<string, unknown>).rating;
        if (rawRating === undefined || rawRating === null) {
            return NextResponse.json({ error: 'Rating is required' }, { status: 400 });
        }

        const ratingNum = Number(rawRating);
        if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
            return NextResponse.json({ error: 'Rating must be a number between 1 and 5' }, { status: 400 });
        }

        const sanitizedData = sanitizeFeedbackData(validation.data!);
        const { comment, category } = sanitizedData;

        if (!comment || typeof comment !== 'string') {
            return NextResponse.json({ error: 'Comment is required' }, { status: 400 });
        }

        if (comment.length < MIN_COMMENT_LENGTH) {
            return NextResponse.json({
                error: `Comment must be at least ${MIN_COMMENT_LENGTH} characters`
            }, { status: 400 });
        }

        if (comment.length > MAX_COMMENT_LENGTH) {
            return NextResponse.json({
                error: `Comment must not exceed ${MAX_COMMENT_LENGTH} characters`
            }, { status: 400 });
        }

        const validatedCategory = category && VALID_CATEGORIES.includes(category as string)
            ? category as string
            : 'General';

        await prisma.feedback.create({
            data: {
                userId: session.user.id,
                rating: ratingNum,
                comment: comment,
                category: validatedCategory,
            },
        });

        logger.info('[Feedback] Submitted successfully', {
            userId: session.user.id,
            rating: ratingNum,
            category: validatedCategory
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('[Feedback] Submission failed', { error, userId: session.user?.id });
        return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
    }
}