/**
 * Client-side list pagination unit tests
 */

import { describe, it, expect } from 'vitest';
import { clampPage, getPageSlice, paginateItems } from '../list-pagination';

describe('clampPage', () => {
    it('clamps below 1 to 1', () => {
        expect(clampPage(0, 5)).toBe(1);
        expect(clampPage(-3, 5)).toBe(1);
    });

    it('clamps above totalPages', () => {
        expect(clampPage(10, 3)).toBe(3);
    });

    it('returns 1 when totalPages is 0', () => {
        expect(clampPage(2, 0)).toBe(1);
    });
});

describe('getPageSlice', () => {
    it('computes indexes for middle page', () => {
        const slice = getPageSlice(25, 2, 10);
        expect(slice).toMatchObject({
            page: 2,
            limit: 10,
            total: 25,
            totalPages: 3,
            startIndex: 10,
            endIndex: 20,
        });
    });

    it('handles last partial page', () => {
        const slice = getPageSlice(25, 3, 10);
        expect(slice.startIndex).toBe(20);
        expect(slice.endIndex).toBe(25);
    });

    it('handles empty list', () => {
        const slice = getPageSlice(0, 1, 10);
        expect(slice.totalPages).toBe(0);
        expect(slice.startIndex).toBe(0);
        expect(slice.endIndex).toBe(0);
    });
});

describe('paginateItems', () => {
    const items = Array.from({ length: 12 }, (_, i) => i + 1);

    it('returns correct page items', () => {
        const { items: pageItems, slice } = paginateItems(items, 2, 5);
        expect(pageItems).toEqual([6, 7, 8, 9, 10]);
        expect(slice.totalPages).toBe(3);
    });

    it('returns empty items for empty input', () => {
        const { items: pageItems } = paginateItems([], 1, 10);
        expect(pageItems).toEqual([]);
    });
});
