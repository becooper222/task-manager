'use client'

import { useEffect, useState } from 'react'
import { ChangelogEntry } from '@/lib/types'

export default function ChangelogModal({
  categoryId,
  categoryName,
  onClose,
}: {
  categoryId: string | null
  categoryName?: string
  onClose: () => void
}) {
  const [entries, setEntries] = useState<ChangelogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchChangelog()
  }, [categoryId])

  const fetchChangelog = async () => {
    try {
      let url = '/api/changelog?'
      if (categoryId) {
        url += `category_id=${categoryId}`
      } else {
        url += 'recent=true'
      }

      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch changelog')
      const data = await res.json()
      setEntries(data.entries || [])
    } catch (e) {
      console.error('Error fetching changelog:', e)
      setError('Failed to load changelog')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString()
  }

  const getEventIcon = (eventType: string): string => {
    switch (eventType) {
      case 'task_created':
        return '✨'
      case 'task_updated':
        return '✏️'
      case 'task_completed':
        return '✅'
      case 'task_deleted':
        return '🗑️'
      case 'attachment_added':
        return '📎'
      case 'attachment_deleted':
        return '🔗'
      case 'category_created':
        return '📁'
      case 'category_updated':
        return '📝'
      case 'category_archived':
        return '📦'
      case 'claude_code_triggered':
        return '⚡'
      case 'claude_code_completed':
        return '🎉'
      case 'member_added':
        return '👥'
      case 'member_removed':
        return '👋'
      default:
        return '•'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-primary rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-accent flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Activity Log</h2>
            {categoryName && (
              <p className="text-sm text-text-secondary">{categoryName}</p>
            )}
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-8 text-text-secondary">Loading...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-400">{error}</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              <p>No activity yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="p-4 bg-secondary rounded-lg flex items-start gap-3"
                >
                  <span className="text-2xl">{getEventIcon(entry.event_type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary">{entry.description}</p>
                    <p className="text-xs text-text-secondary mt-1">
                      {formatDate(entry.inserted_at)}
                    </p>
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-text-secondary cursor-pointer hover:text-text-primary">
                          Details
                        </summary>
                        <pre className="text-xs bg-accent p-2 rounded mt-1 overflow-x-auto">
                          {JSON.stringify(entry.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-accent flex gap-2">
          <button
            onClick={fetchChangelog}
            className="px-4 py-2 bg-accent text-text-primary rounded-md hover:bg-secondary"
          >
            Refresh
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-secondary text-text-primary rounded-md hover:bg-accent"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
