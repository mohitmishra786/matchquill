'use client'

import Link from 'next/link'
import { restoreResumeVersion } from '@/app/actions/resume-history'
import { useState } from 'react'
import { Prisma } from '@prisma/client'
import { buildHistoryPageHref, getSnapshotStats } from './history-utils'

// Re-export pure helpers for consumers that imported from this module
export { buildHistoryPageHref, getSnapshotStats } from './history-utils'

interface ResumeVersion {
  id: string
  name: string | null
  snapshot: Prisma.JsonValue
  createdAt: Date | string
}

export interface HistoryListPagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

interface HistoryListProps {
  versions: ResumeVersion[]
  pagination: HistoryListPagination
  /** Base path for page links (default: /resumes/history) */
  basePath?: string
}

export function HistoryList({
  versions,
  pagination,
  basePath = '/resumes/history',
}: HistoryListProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRestore = async (id: string) => {
    if (!confirm('Are you sure? This will overwrite your current profile data.')) return

    setLoadingId(id)
    setError(null)
    try {
      const res = await restoreResumeVersion(id)
      if (res.success) {
        // Soft success feedback without blocking multi-step restore UX
        alert('Profile restored successfully!')
      } else {
        setError(res.error || 'Failed to restore.')
      }
    } catch {
      setError('Failed to restore. Please try again.')
    } finally {
      setLoadingId(null)
    }
  }

  if (pagination.total === 0 || versions.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No versions saved yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <p>
          Showing {(pagination.page - 1) * pagination.limit + 1}–
          {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
          {pagination.total} versions
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <ul className="space-y-4" aria-label="Resume version history">
        {versions.map((v) => {
          const { expCount, projCount, skillCount } = getSnapshotStats(v.snapshot)
          const createdLabel =
            typeof v.createdAt === 'string'
              ? new Date(v.createdAt).toLocaleString()
              : v.createdAt.toLocaleString()

          return (
            <li
              key={v.id}
              className="bg-white p-6 rounded-lg shadow border flex justify-between items-center"
            >
              <div>
                <h3 className="font-semibold text-lg">{v.name || 'Untitled Version'}</h3>
                <p className="text-sm text-gray-500">Saved on {createdLabel}</p>
                <div className="text-xs text-gray-400 mt-1">
                  Stats: {expCount} Exp, {projCount} Proj, {skillCount} Skills
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRestore(v.id)}
                disabled={loadingId === v.id}
                className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded disabled:opacity-50"
              >
                {loadingId === v.id ? 'Restoring...' : 'Restore'}
              </button>
            </li>
          )
        })}
      </ul>

      {pagination.totalPages > 1 && (
        <nav
          className="flex items-center justify-between pt-4 border-t"
          aria-label="History pagination"
        >
          {pagination.hasPrevPage ? (
            <Link
              href={buildHistoryPageHref(basePath, pagination.page - 1, pagination.limit)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              rel="prev"
            >
              Previous
            </Link>
          ) : (
            <span className="px-4 py-2 text-sm text-gray-300 border rounded-lg cursor-not-allowed">
              Previous
            </span>
          )}

          <span className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>

          {pagination.hasNextPage ? (
            <Link
              href={buildHistoryPageHref(basePath, pagination.page + 1, pagination.limit)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              rel="next"
            >
              Next
            </Link>
          ) : (
            <span className="px-4 py-2 text-sm text-gray-300 border rounded-lg cursor-not-allowed">
              Next
            </span>
          )}
        </nav>
      )}
    </div>
  )
}
