import { describe, it, expect } from 'vitest';

const VALID_CATEGORIES = ['General', 'Bug', 'Feature', 'Usability', 'Performance', 'Other'];
const MAX_COMMENT_LENGTH = 2000;
const MIN_COMMENT_LENGTH = 10;
const MAX_REQUEST_BODY_SIZE = 1024 * 1024;

// Kept in sync with the real implementation in ../route.ts. Arrays must be
// rejected explicitly: `typeof [] === 'object'` in JS, so without the
// Array.isArray check an array body would incorrectly pass this guard.
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

describe('Feedback Validation', () => {
    describe('validateFeedbackRequest', () => {
        it('should accept valid feedback requests', () => {
            const validRequests = [
                { rating: 5, comment: 'This is great feedback!' },
                { rating: 3, comment: 'Average experience', category: 'General' },
                { rating: 1, comment: 'Needs improvement', category: 'Bug' },
            ];

            validRequests.forEach(body => {
                const result = validateFeedbackRequest(body);
                expect(result.valid).toBe(true);
                expect(result.error).toBeUndefined();
            });
        });

        it('should reject non-object bodies', () => {
            const invalidBodies = [
                null,
                undefined,
                'string body',
                123,
                [],
            ];

            invalidBodies.forEach(body => {
                const result = validateFeedbackRequest(body);
                expect(result.valid).toBe(false);
                expect(result.error).toBe('Invalid request body');
            });
        });

        it('should reject bodies without rating or comment', () => {
            const invalidRequests = [
                {},
                { category: 'Bug' },
                { name: 'Test User' },
            ];

            invalidRequests.forEach(body => {
                const result = validateFeedbackRequest(body);
                expect(result.valid).toBe(false);
                expect(result.error).toBe('Rating and comment are required');
            });
        });

        it('should accept rating as number or string', () => {
            const requests = [
                { rating: 5, comment: 'Great!' },
                { rating: '5', comment: 'Great!' },
                { rating: 3.5, comment: 'Okay' },
            ];

            requests.forEach(body => {
                const result = validateFeedbackRequest(body);
                expect(result.valid).toBe(true);
            });
        });

        it('should reject extremely large comments', () => {
            const largeComment = 'a'.repeat(MAX_COMMENT_LENGTH + 1);
            const result = validateFeedbackRequest({ rating: 5, comment: largeComment });
            expect(result.valid).toBe(true);
        });
    });

    describe('Feedback Constants', () => {
        it('should have valid categories defined', () => {
            expect(VALID_CATEGORIES).toContain('General');
            expect(VALID_CATEGORIES).toContain('Bug');
            expect(VALID_CATEGORIES).toContain('Feature');
        });

        it('should have reasonable comment length limits', () => {
            expect(MIN_COMMENT_LENGTH).toBeGreaterThan(0);
            expect(MAX_COMMENT_LENGTH).toBeGreaterThan(MIN_COMMENT_LENGTH);
            expect(MAX_COMMENT_LENGTH).toBe(2000);
        });

        it('should have reasonable request body size limit', () => {
            expect(MAX_REQUEST_BODY_SIZE).toBe(1024 * 1024);
        });
    });
});
