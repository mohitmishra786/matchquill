/**
 * Atomic update helpers to reduce TOCTOU races on profile mutations.
 * Prefer conditional updates (where version/id matches) over read-modify-write.
 */

export type Versioned<T> = T & { updatedAt?: string | Date; id: string };

/**
 * Build a Prisma-style where clause that only updates if the row still matches
 * the expected updatedAt (optimistic concurrency).
 */
export function concurrencyWhere(
  id: string,
  expectedUpdatedAt?: string | Date | null
): { id: string; updatedAt?: Date } {
  if (!expectedUpdatedAt) {
    return { id };
  }
  const updatedAt =
    expectedUpdatedAt instanceof Date
      ? expectedUpdatedAt
      : new Date(expectedUpdatedAt);
  return { id, updatedAt };
}

/**
 * Returns true if the server entity is still the version the client edited.
 */
export function isSameVersion(
  clientUpdatedAt: string | Date | undefined,
  serverUpdatedAt: string | Date | undefined
): boolean {
  if (!clientUpdatedAt || !serverUpdatedAt) {
    return true; // no version info — caller must use other guards
  }
  const a = new Date(clientUpdatedAt).getTime();
  const b = new Date(serverUpdatedAt).getTime();
  return a === b;
}
