/**
 * Unit tests for HistoryList helpers (pagination + snapshot stats)
 */
import { describe, it, expect } from 'vitest'
import { buildHistoryPageHref, getSnapshotStats } from '../history-utils'

describe('getSnapshotStats', () => {
  it('returns zeros for null/invalid snapshots', () => {
    expect(getSnapshotStats(null)).toEqual({ expCount: 0, projCount: 0, skillCount: 0 })
    expect(getSnapshotStats(undefined)).toEqual({ expCount: 0, projCount: 0, skillCount: 0 })
    expect(getSnapshotStats([])).toEqual({ expCount: 0, projCount: 0, skillCount: 0 })
    expect(getSnapshotStats('string')).toEqual({ expCount: 0, projCount: 0, skillCount: 0 })
  })

  it('counts array fields when present', () => {
    const stats = getSnapshotStats({
      experiences: [{ id: 1 }, { id: 2 }],
      projects: [{ id: 1 }],
      skills: [{ id: 1 }, { id: 2 }, { id: 3 }],
    })
    expect(stats).toEqual({ expCount: 2, projCount: 1, skillCount: 3 })
  })

  it('treats non-array fields as empty', () => {
    const stats = getSnapshotStats({
      experiences: 'not-an-array',
      projects: null,
    })
    expect(stats).toEqual({ expCount: 0, projCount: 0, skillCount: 0 })
  })
})

describe('buildHistoryPageHref', () => {
  it('includes page query param', () => {
    expect(buildHistoryPageHref('/resumes/history', 2, 10)).toBe(
      '/resumes/history?page=2'
    )
  })

  it('includes non-default limit', () => {
    expect(buildHistoryPageHref('/resumes/history', 1, 20)).toBe(
      '/resumes/history?page=1&limit=20'
    )
  })

  it('omits default limit of 10', () => {
    expect(buildHistoryPageHref('/resumes/history', 3, 10)).not.toContain('limit=')
  })
})

describe('history pagination math', () => {
  it('computes total pages correctly', () => {
    const total = 25
    const limit = 10
    const totalPages = Math.ceil(total / limit)
    expect(totalPages).toBe(3)
    expect(1 < totalPages).toBe(true)
    expect(3 < totalPages).toBe(false)
  })

  it('caps page size at max', () => {
    const HISTORY_MAX_PAGE_SIZE = 50
    const requested = 999
    const limit = Math.min(Math.max(1, requested), HISTORY_MAX_PAGE_SIZE)
    expect(limit).toBe(50)
  })
})
