/**
 * Client-side list pagination helpers
 */

export interface PageSlice {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    startIndex: number;
    endIndex: number;
}

/**
 * Clamp page into valid range [1, totalPages] (or 1 when empty).
 */
export function clampPage(page: number, totalPages: number): number {
    if (!Number.isFinite(page) || page < 1) return 1;
    if (totalPages < 1) return 1;
    return Math.min(Math.floor(page), totalPages);
}

/**
 * Compute pagination metadata for a list of `total` items.
 */
export function getPageSlice(total: number, page: number, limit: number): PageSlice {
    const safeLimit = Math.max(1, Math.floor(limit) || 10);
    const totalPages = total === 0 ? 0 : Math.ceil(total / safeLimit);
    const safePage = clampPage(page, Math.max(totalPages, 1));
    const startIndex = (safePage - 1) * safeLimit;
    const endIndex = Math.min(startIndex + safeLimit, total);

    return {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
        startIndex,
        endIndex,
    };
}

/**
 * Return the slice of items for the current page.
 */
export function paginateItems<T>(items: T[], page: number, limit: number): {
    items: T[];
    slice: PageSlice;
} {
    const slice = getPageSlice(items.length, page, limit);
    return {
        items: items.slice(slice.startIndex, slice.endIndex),
        slice,
    };
}
