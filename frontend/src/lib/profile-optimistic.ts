/**
 * Pure helpers for optimistic profile collection updates
 */

/**
 * Merge a saved entity into a collection optimistically.
 * - On update (editingId provided): replace matching item
 * - On create: prepend if id is new; replace if already present
 */
export function applyOptimisticItemUpdate<T extends { id: string }>(
    items: T[] | undefined,
    saved: T,
    editingId: string | undefined
): T[] {
    const list = items ?? [];
    if (editingId) {
        return list.map((item) => (item.id === editingId ? { ...item, ...saved } : item));
    }
    if (list.some((item) => item.id === saved.id)) {
        return list.map((item) => (item.id === saved.id ? { ...item, ...saved } : item));
    }
    return [saved, ...list];
}
