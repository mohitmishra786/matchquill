/**
 * Debounce and throttle utilities for input handlers and resize events.
 */

export function debounce<T extends (...args: never[]) => void>(
    fn: T,
    waitMs: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const debounced = (...args: Parameters<T>) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            fn(...args);
        }, waitMs);
    };

    debounced.cancel = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    };

    return debounced;
}

export function throttle<T extends (...args: never[]) => void>(
    fn: T,
    waitMs: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
    let last = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const throttled = (...args: Parameters<T>) => {
        const now = Date.now();
        const remaining = waitMs - (now - last);
        if (remaining <= 0) {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            last = now;
            fn(...args);
        } else if (!timer) {
            timer = setTimeout(() => {
                last = Date.now();
                timer = null;
                fn(...args);
            }, remaining);
        }
    };

    throttled.cancel = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    };

    return throttled;
}
