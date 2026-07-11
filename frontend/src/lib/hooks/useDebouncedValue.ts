'use client';

/**
 * useDebouncedValue
 * Returns a value that updates only after `delayMs` of inactivity.
 * Useful for search/filter inputs that drive expensive filtering.
 */

import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs: number = 300): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebounced(value);
        }, delayMs);

        return () => {
            clearTimeout(timer);
        };
    }, [value, delayMs]);

    return debounced;
}

export default useDebouncedValue;
