/**
 * Structured API error codes for consistent client/server error handling.
 */

export const ApiErrorCode = {
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    RATE_LIMITED: 'RATE_LIMITED',
    CONFLICT: 'CONFLICT',
    INTERNAL: 'INTERNAL',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export interface ApiErrorBody {
    error: string;
    code: ApiErrorCode;
    requestId?: string;
    details?: unknown;
}

export function apiError(
    code: ApiErrorCode,
    message: string,
    options?: { requestId?: string; details?: unknown; status?: number }
): { body: ApiErrorBody; status: number } {
    const statusByCode: Record<ApiErrorCode, number> = {
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        VALIDATION_ERROR: 400,
        RATE_LIMITED: 429,
        CONFLICT: 409,
        INTERNAL: 500,
        SERVICE_UNAVAILABLE: 503,
    };
    return {
        status: options?.status ?? statusByCode[code],
        body: {
            error: message,
            code,
            requestId: options?.requestId,
            details: options?.details,
        },
    };
}
