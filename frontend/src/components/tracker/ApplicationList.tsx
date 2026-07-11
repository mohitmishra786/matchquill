'use client'

import { useMemo, useState, memo } from 'react'
import { deleteApplication, updateApplicationStatus } from "@/app/actions/tracker"
import { sanitizeText, sanitizeUrl } from "@/lib/sanitization"
import { DEFAULT_PAGE_SIZE } from "@/lib/constants"

const statusColors = {
  applied: "bg-blue-100 text-blue-800",
  interviewing: "bg-yellow-100 text-yellow-800",
  offer: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
}

interface Application {
  id: string
  company: string
  position: string
  status: string
  appliedDate: Date
  url?: string | null
  description?: string | null
}

const ApplicationRow = memo(function ApplicationRow({ app }: { app: Application }) {
  const company = sanitizeText(app.company)
  const position = sanitizeText(app.position)
  const description = app.description ? sanitizeText(app.description) : null
  const safeUrl = app.url ? sanitizeUrl(app.url) : null

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="font-medium text-gray-900">{company}</div>
        {description && (
          <div className="text-xs text-gray-500 line-clamp-1">{description}</div>
        )}
        {safeUrl && (
          <a href={safeUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">
            View Job
          </a>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-gray-700">{position}</td>
      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
        {new Date(app.appliedDate).toLocaleDateString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <select
          defaultValue={app.status}
          onChange={(e) => updateApplicationStatus(app.id, e.target.value)}
          aria-label={`Status for ${company}`}
          className={`text-xs font-semibold px-2 py-1 rounded-full border-none cursor-pointer ${
            statusColors[app.status as keyof typeof statusColors] || "bg-gray-100"
          }`}
        >
          <option value="applied">Applied</option>
          <option value="interviewing">Interviewing</option>
          <option value="offer">Offer</option>
          <option value="rejected">Rejected</option>
        </select>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button
          type="button"
          onClick={() => deleteApplication(app.id)}
          className="text-red-600 hover:text-red-900"
          aria-label={`Delete application at ${company}`}
        >
          Delete
        </button>
      </td>
    </tr>
  )
})

export function ApplicationList({ applications }: { applications: Application[] }) {
  const [page, setPage] = useState(1)
  const pageSize = DEFAULT_PAGE_SIZE

  const totalPages = Math.max(1, Math.ceil(applications.length / pageSize))
  // Clamp when list shrinks (e.g. after delete) so we never show an empty page
  const currentPage = Math.min(page, totalPages)
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return applications.slice(start, start + pageSize)
  }, [applications, currentPage, pageSize])

  if (applications.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No applications yet. Start tracking your journey!</p>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {pageItems.map((app) => (
            <ApplicationRow key={app.id} app={app} />
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <nav
          className="flex items-center justify-between px-4 py-3 border-t"
          aria-label="Applications pagination"
        >
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, Math.min(p, totalPages) - 1))}
            className="px-3 py-1.5 text-sm border rounded disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, Math.min(p, totalPages) + 1))}
            className="px-3 py-1.5 text-sm border rounded disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  )
}
