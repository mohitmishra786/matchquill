/**
 * Pure helpers for resume version history UI.
 * Kept free of server actions / NextAuth so unit tests stay lightweight.
 */

import type { Prisma } from '@prisma/client'

/**
 * Extract lightweight stats from a resume snapshot without deep cloning.
 */
export function getSnapshotStats(snapshot: Prisma.JsonValue | null | undefined): {
  expCount: number
  projCount: number
  skillCount: number
} {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return { expCount: 0, projCount: 0, skillCount: 0 }
  }
  const obj = snapshot as Prisma.JsonObject
  return {
    expCount: Array.isArray(obj.experiences) ? obj.experiences.length : 0,
    projCount: Array.isArray(obj.projects) ? obj.projects.length : 0,
    skillCount: Array.isArray(obj.skills) ? obj.skills.length : 0,
  }
}

/**
 * Build page href with preserved limit query param.
 */
export function buildHistoryPageHref(
  basePath: string,
  page: number,
  limit: number
): string {
  const params = new URLSearchParams()
  params.set('page', String(page))
  if (limit !== 10) {
    params.set('limit', String(limit))
  }
  return `${basePath}?${params.toString()}`
}
