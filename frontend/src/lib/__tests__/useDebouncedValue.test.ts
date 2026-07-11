/**
 * useDebouncedValue unit tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

describe('useDebouncedValue', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns initial value immediately', () => {
        const { result } = renderHook(() => useDebouncedValue('hello', 300));
        expect(result.current).toBe('hello');
    });

    it('updates only after delay', () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebouncedValue(value, 200),
            { initialProps: { value: 'a' } }
        );

        rerender({ value: 'b' });
        expect(result.current).toBe('a');

        act(() => {
            vi.advanceTimersByTime(199);
        });
        expect(result.current).toBe('a');

        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(result.current).toBe('b');
    });

    it('resets timer on rapid changes', () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebouncedValue(value, 100),
            { initialProps: { value: '1' } }
        );

        rerender({ value: '2' });
        act(() => {
            vi.advanceTimersByTime(50);
        });
        rerender({ value: '3' });
        act(() => {
            vi.advanceTimersByTime(100);
        });
        expect(result.current).toBe('3');
    });
});
