/**
 * Pagination Utilities
 * Provides consistent pagination logic for API endpoints and UI components
 */

/**
 * Pagination Parameters
 */
export interface PaginationParams {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
}

/**
 * Paginated Response
 */
export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
}

/**
 * Default pagination values
 */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

/**
 * Parse pagination parameters from URL search params
 * @param searchParams - URLSearchParams from request
 * @returns Parsed and validated pagination parameters
 */
export function parsePaginationParams(searchParams: URLSearchParams): PaginationParams {
    const parsedPage = parseInt(searchParams.get('page') || String(DEFAULT_PAGE), 10);
    const page = Math.max(1, Number.isNaN(parsedPage) ? DEFAULT_PAGE : parsedPage);

    const parsedLimit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
    const limit = Math.min(
        MAX_LIMIT,
        Math.max(1, Number.isNaN(parsedLimit) ? DEFAULT_LIMIT : parsedLimit)
    );
    const sortBy = searchParams.get('sortBy') || undefined;
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
    const search = searchParams.get('search') || undefined;

    return {
        page,
        limit,
        sortBy,
        sortOrder,
        search,
    };
}

/**
 * Calculate pagination metadata
 * @param total - Total number of items
 * @param page - Current page number
 * @param limit - Items per page
 * @returns Pagination metadata
 */
export function calculatePagination(total: number, page: number, limit: number) {
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
        hasPrevPage,
    };
}

/**
 * Calculate skip value for Prisma queries
 * @param page - Current page number
 * @param limit - Items per page
 * @returns Skip value for Prisma skip parameter
 */
export function calculateSkip(page: number, limit: number): number {
    return (page - 1) * limit;
}

/**
 * Create paginated response
 * @param data - Array of items
 * @param total - Total count of items
 * @param params - Pagination parameters
 * @returns Paginated response object
 */
export function createPaginatedResponse<T>(
    data: T[],
    total: number,
    params: PaginationParams
): PaginatedResponse<T> {
    return {
        data,
        pagination: calculatePagination(total, params.page, params.limit),
    };
}

/**
 * Build pagination links for API responses
 * @param baseUrl - Base URL for the endpoint
 * @param params - Current pagination parameters
 * @param total - Total number of items
 * @returns Object with first, prev, next, and last page links
 */
export function buildPaginationLinks(
    baseUrl: string,
    params: PaginationParams,
    total: number
): { first: string; prev: string | null; next: string | null; last: string } {
    const { page, limit, sortBy, sortOrder, search } = params;
    const totalPages = Math.ceil(total / limit);

    const buildUrl = (p: number) => {
        const url = new URL(baseUrl, 'http://localhost');
        url.searchParams.set('page', String(p));
        url.searchParams.set('limit', String(limit));
        if (sortBy) url.searchParams.set('sortBy', sortBy);
        if (sortOrder) url.searchParams.set('sortOrder', sortOrder);
        if (search) url.searchParams.set('search', search);
        return url.pathname + url.search;
    };

    return {
        first: buildUrl(1),
        prev: page > 1 ? buildUrl(page - 1) : null,
        next: page < totalPages ? buildUrl(page + 1) : null,
        last: buildUrl(totalPages),
    };
}

/**
 * Pagination hook return type
 */
export interface UsePaginationReturn {
    page: number;
    limit: number;
    setPage: (page: number) => void;
    setLimit: (limit: number) => void;
    nextPage: () => void;
    prevPage: () => void;
    canGoNext: boolean;
    canGoPrev: boolean;
    reset: () => void;
}

/**
 * Generate page numbers for pagination UI
 * @param currentPage - Current active page
 * @param totalPages - Total number of pages
 * @param maxVisible - Maximum number of visible page buttons
 * @returns Array of page numbers and ellipsis indicators
 */
export function generatePageNumbers(
    currentPage: number,
    totalPages: number,
    maxVisible: number = 5
): (number | string)[] {
    if (totalPages <= maxVisible) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];
    const halfVisible = Math.floor(maxVisible / 2);

    let startPage = Math.max(1, currentPage - halfVisible);
    let endPage = Math.min(totalPages, currentPage + halfVisible);

    // Adjust if we're near the start
    if (currentPage <= halfVisible) {
        endPage = maxVisible;
    }

    // Adjust if we're near the end
    if (currentPage > totalPages - halfVisible) {
        startPage = totalPages - maxVisible + 1;
    }

    // Always show first page
    if (startPage > 1) {
        pages.push(1);
        if (startPage > 2) {
            pages.push('...');
        }
    }

    // Add visible pages
    for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
    }

    // Always show last page
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            pages.push('...');
        }
        pages.push(totalPages);
    }

    return pages;
}
