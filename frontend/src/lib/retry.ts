/**
 * Retry utilities with exponential backoff
 */

export interface RetryOptions {
    /** Maximum number of attempts (including the first). Default: 3 */
    maxAttempts?: number;
    /** Initial delay in ms before first retry. Default: 300 */
    initialDelayMs?: number;
    /** Multiplier applied after each failed attempt. Default: 2 */
    backoffFactor?: number;
    /** Cap on delay between attempts in ms. Default: 5000 */
    maxDelayMs?: number;
    /** Optional predicate — return false to stop retrying immediately */
    shouldRetry?: (error: unknown, attempt: number) => boolean;
    /** Called before each retry (not the first attempt) */
    onRetry?: (error: unknown, attempt: number, nextDelayMs: number) => void;
}

/**
 * Compute delay for a given attempt number (1-indexed attempt that just failed).
 * attempt=1 → initialDelayMs, attempt=2 → initialDelayMs * factor, etc.
 */
export function computeBackoffDelay(
    attempt: number,
    initialDelayMs: number = 300,
    backoffFactor: number = 2,
    maxDelayMs: number = 5000
): number {
    if (attempt < 1) return 0;
    const delay = initialDelayMs * Math.pow(backoffFactor, attempt - 1);
    return Math.min(delay, maxDelayMs);
}

/**
 * Sleep helper used by withRetry
 */
export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an async function with exponential backoff retries.
 */
export async function withRetry<T>(
    fn: (attempt: number) => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxAttempts = 3,
        initialDelayMs = 300,
        backoffFactor = 2,
        maxDelayMs = 5000,
        shouldRetry = () => true,
        onRetry,
    } = options;

    if (maxAttempts < 1) {
        throw new Error('withRetry: maxAttempts must be at least 1');
    }

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn(attempt);
        } catch (error) {
            lastError = error;

            if (attempt >= maxAttempts || !shouldRetry(error, attempt)) {
                break;
            }

            const nextDelayMs = computeBackoffDelay(
                attempt,
                initialDelayMs,
                backoffFactor,
                maxDelayMs
            );
            onRetry?.(error, attempt, nextDelayMs);
            await delay(nextDelayMs);
        }
    }

    throw lastError instanceof Error
        ? lastError
        : new Error(String(lastError ?? 'withRetry: unknown failure'));
}
