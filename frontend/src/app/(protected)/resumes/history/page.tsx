import {
  getResumeVersions,
  createResumeSnapshot,
} from '@/app/actions/resume-history'
import { HISTORY_MAX_PAGE_SIZE, HISTORY_PAGE_SIZE } from '@/lib/constants'
import { HistoryList } from '@/components/resumes/HistoryList'

export const metadata = {
  title: 'Version History | CV-Wiz',
  description: 'Manage resume versions and backups',
}

interface HistoryPageProps {
  searchParams: Promise<{ page?: string; limit?: string }>
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const requestedLimit = parseInt(params.limit || String(HISTORY_PAGE_SIZE), 10) || HISTORY_PAGE_SIZE
  const limit = Math.min(Math.max(1, requestedLimit), HISTORY_MAX_PAGE_SIZE)

  const result = await getResumeVersions(page, limit)

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Version History</h1>
          <p className="text-gray-600">Save snapshots and restore previous versions</p>
        </div>
        <form
          action={async () => {
            'use server'
            await createResumeSnapshot()
          }}
        >
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Save Current Version
          </button>
        </form>
      </div>

      <HistoryList
        versions={result.versions}
        pagination={{
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
          hasNextPage: result.hasNextPage,
          hasPrevPage: result.hasPrevPage,
        }}
      />
    </div>
  )
}
