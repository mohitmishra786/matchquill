/**
 * Retry / exponential backoff unit tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeBackoffDelay, withRetry, delay } from '../retry';

describe('computeBackoffDelay', () => {
    it('returns 0 for attempt < 1', () => {
        expect(computeBackoffDelay(0)).toBe(0);
        expect(computeBackoffDelay(-1)).toBe(0);
    });

    it('returns initial delay for first failed attempt', () => {
        expect(computeBackoffDelay(1, 300, 2, 5000)).toBe(300);
    });

    it('applies exponential factor', () => {
        expect(computeBackoffDelay(2, 300, 2, 5000)).toBe(600);
        expect(computeBackoffDelay(3, 300, 2, 5000)).toBe(1200);
        expect(computeBackoffDelay(4, 300, 2, 5000)).toBe(2400);
    });

    it('caps at maxDelayMs', () => {
        expect(computeBackoffDelay(10, 300, 2, 1000)).toBe(1000);
    });
});

describe('delay', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('resolves after the given ms', async () => {
        const promise = delay(500);
        vi.advanceTimersByTime(500);
        await expect(promise).resolves.toBeUndefined();
    });
});

describe('withRetry', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns result on first success', async () => {
        const fn = vi.fn().mockResolvedValue('ok');
        const result = await withRetry(fn, { maxAttempts: 3 });
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries with exponential backoff and eventually succeeds', async () => {
        const fn = vi
            .fn()
            .mockRejectedValueOnce(new Error('fail-1'))
            .mockRejectedValueOnce(new Error('fail-2'))
            .mockResolvedValue('ok');

        const onRetry = vi.fn();
        const promise = withRetry(fn, {
            maxAttempts: 3,
            initialDelayMs: 100,
            backoffFactor: 2,
            onRetry,
        });

        // First failure → wait 100ms
        await vi.advanceTimersByTimeAsync(100);
        // Second failure → wait 200ms
        await vi.advanceTimersByTimeAsync(200);

        await expect(promise).resolves.toBe('ok');
        expect(fn).toHaveBeenCalledTimes(3);
        expect(onRetry).toHaveBeenCalledTimes(2);
        expect(onRetry.mock.calls[0][2]).toBe(100);
        expect(onRetry.mock.calls[1][2]).toBe(200);
    });

    it('throws after exhausting attempts', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('always-fail'));

        const promise = withRetry(fn, {
            maxAttempts: 2,
            initialDelayMs: 50,
            backoffFactor: 2,
        });

        // Attach rejection handler before advancing timers
        const assertion = expect(promise).rejects.toThrow('always-fail');
        await vi.advanceTimersByTimeAsync(50);
        await assertion;
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('stops early when shouldRetry returns false', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('no-retry'));

        await expect(
            withRetry(fn, {
                maxAttempts: 5,
                shouldRetry: () => false,
            })
        ).rejects.toThrow('no-retry');

        expect(fn).toHaveBeenCalledTimes(1);
    });
});
