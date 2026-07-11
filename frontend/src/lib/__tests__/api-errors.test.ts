import { describe, it, expect } from 'vitest';
import { apiError, ApiErrorCode } from '../api-errors';

describe('apiError', () => {
    it('maps codes to HTTP status', () => {
        expect(apiError(ApiErrorCode.UNAUTHORIZED, 'nope').status).toBe(401);
        expect(apiError(ApiErrorCode.RATE_LIMITED, 'slow down').status).toBe(429);
        expect(apiError(ApiErrorCode.VALIDATION_ERROR, 'bad').body.code).toBe(
            ApiErrorCode.VALIDATION_ERROR
        );
    });
});
