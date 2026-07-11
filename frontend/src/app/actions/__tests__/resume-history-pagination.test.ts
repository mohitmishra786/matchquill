/**
 * Contract tests for resume history pagination (server action module)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    resumeVersion: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getResumeVersions } from '../resume-history'
import { HISTORY_PAGE_SIZE, HISTORY_MAX_PAGE_SIZE } from '@/lib/constants'

describe('getResumeVersions pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty page when unauthenticated', async () => {
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const result = await getResumeVersions(1, 10)
    expect(result.versions).toEqual([])
    expect(result.total).toBe(0)
    expect(result.hasNextPage).toBe(false)
    expect(prisma.resumeVersion.findMany).not.toHaveBeenCalled()
  })

  it('applies skip/take for the requested page', async () => {
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: 'user-1' },
    })
    ;(prisma.resumeVersion.count as ReturnType<typeof vi.fn>).mockResolvedValue(25)
    ;(prisma.resumeVersion.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'v1', name: 'A', snapshot: {}, createdAt: new Date() },
    ])

    const result = await getResumeVersions(2, 10)

    expect(prisma.resumeVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        skip: 10,
        take: 10,
      })
    )
    expect(result.page).toBe(2)
    expect(result.total).toBe(25)
    expect(result.totalPages).toBe(3)
    expect(result.hasNextPage).toBe(true)
    expect(result.hasPrevPage).toBe(true)
  })

  it('clamps page size to HISTORY_MAX_PAGE_SIZE', async () => {
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: 'user-1' },
    })
    ;(prisma.resumeVersion.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)
    ;(prisma.resumeVersion.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    await getResumeVersions(1, 9999)

    expect(prisma.resumeVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: HISTORY_MAX_PAGE_SIZE,
      })
    )
  })

  it('defaults to HISTORY_PAGE_SIZE', async () => {
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: 'user-1' },
    })
    ;(prisma.resumeVersion.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)
    ;(prisma.resumeVersion.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    await getResumeVersions()

    expect(prisma.resumeVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: HISTORY_PAGE_SIZE,
        skip: 0,
      })
    )
  })
})
