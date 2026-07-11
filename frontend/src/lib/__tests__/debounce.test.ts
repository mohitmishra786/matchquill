import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce, throttle } from '../debounce';

describe('debounce', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('delays invocation until wait elapses', () => {
        const fn = vi.fn();
        const d = debounce(fn, 100);
        d();
        d();
        expect(fn).not.toHaveBeenCalled();
        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('cancel prevents call', () => {
        const fn = vi.fn();
        const d = debounce(fn, 100);
        d();
        d.cancel();
        vi.advanceTimersByTime(100);
        expect(fn).not.toHaveBeenCalled();
    });
});

describe('throttle', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('invokes immediately then throttles', () => {
        const fn = vi.fn();
        const t = throttle(fn, 100);
        t();
        t();
        expect(fn).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(2);
    });
});
