/**
 * Optimistic profile update helpers
 */

import { describe, it, expect } from 'vitest';
import { applyOptimisticItemUpdate } from '../profile-optimistic';

describe('applyOptimisticItemUpdate', () => {
    const existing = [
        { id: 'a', name: 'Alpha' },
        { id: 'b', name: 'Beta' },
    ];

    it('prepends a new item when creating', () => {
        const result = applyOptimisticItemUpdate(existing, { id: 'c', name: 'Gamma' }, undefined);
        expect(result).toEqual([
            { id: 'c', name: 'Gamma' },
            { id: 'a', name: 'Alpha' },
            { id: 'b', name: 'Beta' },
        ]);
    });

    it('replaces matching item when editing', () => {
        const result = applyOptimisticItemUpdate(
            existing,
            { id: 'b', name: 'Beta Updated' },
            'b'
        );
        expect(result).toEqual([
            { id: 'a', name: 'Alpha' },
            { id: 'b', name: 'Beta Updated' },
        ]);
    });

    it('handles undefined list on create', () => {
        const result = applyOptimisticItemUpdate(undefined, { id: 'x', name: 'X' }, undefined);
        expect(result).toEqual([{ id: 'x', name: 'X' }]);
    });

    it('avoids duplicates when create returns an existing id', () => {
        const result = applyOptimisticItemUpdate(
            existing,
            { id: 'a', name: 'Alpha New' },
            undefined
        );
        expect(result).toEqual([
            { id: 'a', name: 'Alpha New' },
            { id: 'b', name: 'Beta' },
        ]);
    });
});
