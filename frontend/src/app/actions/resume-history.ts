'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { logger } from '@/lib/logger'
import {
  HISTORY_MAX_PAGE_SIZE,
  HISTORY_PAGE_SIZE,
  MAX_RESUME_VERSIONS,
  MAX_SNAPSHOT_JSON_CHARS,
} from '@/lib/constants'

/**
 * Strip DB-only fields and oversized text so snapshots stay lean.
 * Not exported — "use server" files may only export async functions.
 */
function compactSnapshotEntity<T extends Record<string, unknown>>(
  entity: T,
  dropKeys: string[] = ['userId', 'createdAt', 'updatedAt']
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(entity)) {
    if (dropKeys.includes(key)) continue
    // Cap long free-text fields
    if (typeof value === 'string' && value.length > 5000) {
      out[key] = value.slice(0, 5000)
    } else if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
      out[key] = (value as string[]).map((s) => (s.length > 1000 ? s.slice(0, 1000) : s))
    } else {
      out[key] = value
    }
  }
  return out
}

export type SnapshotResult =
  | { success: true }
  | { success: false; error: string }

export async function createResumeSnapshot(name?: string): Promise<SnapshotResult> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: "Unauthorized" }

  try {
    // Fetch complete profile
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        experiences: true,
        projects: true,
        educations: true,
        skills: true,
        publications: true,
      },
    })

    if (!user) return { success: false, error: "User not found" }

    // Create compact snapshot payload (omit userId/timestamps to cut storage)
    const snapshot = {
      experiences: user.experiences.map((e) => compactSnapshotEntity(e as unknown as Record<string, unknown>)),
      projects: user.projects.map((p) => compactSnapshotEntity(p as unknown as Record<string, unknown>)),
      educations: user.educations.map((e) => compactSnapshotEntity(e as unknown as Record<string, unknown>)),
      skills: user.skills.map((s) => compactSnapshotEntity(s as unknown as Record<string, unknown>)),
      publications: user.publications.map((p) => compactSnapshotEntity(p as unknown as Record<string, unknown>)),
      capturedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    const serialized = JSON.stringify(snapshot)
    if (serialized.length > MAX_SNAPSHOT_JSON_CHARS) {
      logger.warn('[ResumeHistory] Snapshot exceeds size budget', {
        size: serialized.length,
        max: MAX_SNAPSHOT_JSON_CHARS,
      })
      return { success: false, error: 'Snapshot too large to store. Reduce profile content and try again.' }
    }

    await prisma.resumeVersion.create({
      data: {
        userId: session.user.id,
        name: name || `Version ${new Date().toLocaleDateString()}`,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    })

    // Enforce retention: keep only the newest MAX_RESUME_VERSIONS
    const allVersions = await prisma.resumeVersion.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    if (allVersions.length > MAX_RESUME_VERSIONS) {
      const toDelete = allVersions.slice(MAX_RESUME_VERSIONS).map((v) => v.id)
      await prisma.resumeVersion.deleteMany({
        where: { id: { in: toDelete }, userId: session.user.id },
      })
    }

    revalidatePath("/resumes/history")
    return { success: true };
  } catch (error) {
    logger.error('[ResumeHistory] Snapshot creation failed', { error });
    return { success: false, error: 'Failed to create snapshot' };
  }
}

// Types are erased at compile time — safe in "use server" modules
export type ResumeVersionListItem = {
  id: string
  name: string | null
  snapshot: Prisma.JsonValue
  createdAt: Date
}

export type PaginatedResumeVersions = {
  versions: ResumeVersionListItem[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

/**
 * Fetch a single page of resume versions for the current user.
 * Server-side pagination prevents loading unbounded history into the DOM.
 */
export async function getResumeVersions(
  page: number = 1,
  limit: number = HISTORY_PAGE_SIZE
): Promise<PaginatedResumeVersions> {
  const session = await auth()
  const safeLimit = Math.min(Math.max(1, limit || HISTORY_PAGE_SIZE), HISTORY_MAX_PAGE_SIZE)
  const safePage = Math.max(1, page || 1)

  if (!session?.user?.id) {
    return {
      versions: [],
      total: 0,
      page: safePage,
      limit: safeLimit,
      totalPages: 0,
      hasNextPage: false,
      hasPrevPage: false,
    }
  }

  const userId = session.user.id
  const skip = (safePage - 1) * safeLimit

  const [total, versions] = await Promise.all([
    prisma.resumeVersion.count({ where: { userId } }),
    prisma.resumeVersion.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: safeLimit,
      // Only fields needed for the list UI (still includes snapshot for stats)
      select: {
        id: true,
        name: true,
        snapshot: true,
        createdAt: true,
      },
    }),
  ])

  const totalPages = total === 0 ? 0 : Math.ceil(total / safeLimit)

  return {
    versions,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1,
  }
}

export type RestoreResult =
  | { success: true }
  | { success: false; error: string }

export async function restoreResumeVersion(versionId: string): Promise<RestoreResult> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: "Unauthorized" }

  const version = await prisma.resumeVersion.findUnique({
    where: { id: versionId, userId: session.user.id },
  })

  if (!version || !version.snapshot) return { success: false, error: "Version not found" }

  const snapshot = version.snapshot as any
  const userId = session.user.id

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Clear current profile
      await tx.experience.deleteMany({ where: { userId } })
      await tx.project.deleteMany({ where: { userId } })
      await tx.education.deleteMany({ where: { userId } })
      await tx.skill.deleteMany({ where: { userId } })
      await tx.publication.deleteMany({ where: { userId } })

      // 2. Restore from snapshot
      // We explicitly map fields to avoid issues with IDs or metadata in snapshot
      if (snapshot.experiences?.length) {
        await tx.experience.createMany({

          data: snapshot.experiences.map((e: any) => ({
            userId,
            company: e.company,
            title: e.title,
            location: e.location,
            startDate: e.startDate,
            endDate: e.endDate,
            current: e.current,
            description: e.description,
            highlights: e.highlights,
            keywords: e.keywords,
          })),
        })
      }

      if (snapshot.projects?.length) {
        await tx.project.createMany({

          data: snapshot.projects.map((p: any) => ({
            userId,
            name: p.name,
            description: p.description,
            url: p.url,
            startDate: p.startDate,
            endDate: p.endDate,
            technologies: p.technologies,
            highlights: p.highlights,
          })),
        })
      }

      if (snapshot.educations?.length) {
        await tx.education.createMany({

          data: snapshot.educations.map((e: any) => ({
            userId,
            institution: e.institution,
            degree: e.degree,
            field: e.field,
            startDate: e.startDate,
            endDate: e.endDate,
            gpa: e.gpa,
            honors: e.honors,
          })),
        })
      }

      if (snapshot.skills?.length) {
        await tx.skill.createMany({

          data: snapshot.skills.map((s: any) => ({
            userId,
            name: s.name,
            category: s.category,
            proficiency: s.proficiency,
            yearsExp: s.yearsExp,
          })),
        })
      }

      if (snapshot.publications?.length) {
        await tx.publication.createMany({
          data: snapshot.publications.map((p: any) => ({
            userId,
            title: p.title,
            venue: p.venue,
            authors: p.authors,
            date: p.date,
            url: p.url,
            doi: p.doi,
            abstract: p.abstract,
          })),
        })
      }
    })

    revalidatePath("/profile")
    return { success: true }
  } catch (error) {
    logger.error('[ResumeHistory] Restore failed', { error })
    return { success: false, error: "Failed to restore version" }
  }
}
