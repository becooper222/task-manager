'use client'

import { useEffect, useState } from 'react'
import { ClaudeCodeRun } from '@/lib/types'

export default function ClaudeCodeRunsModal({
  taskId,
  taskName,
  onClose,
}: {
  taskId: string
  taskName: string
  onClose: () => void
}) {
  const [runs, setRuns] = useState<ClaudeCodeRun[]>([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRuns()
  }, [taskId])

  const fetchRuns = async () => {
    try {
      const res = await fetch(`/api/claude-code/runs?task_id=${taskId}`)
      if (!res.ok) throw new Error('Failed to fetch runs')
      const data = await res.json()
      setRuns(data.runs || [])
    } catch (e) {
      console.error('Error fetching runs:', e)
      setError('Failed to load runs')
    } finally {
      setLoading(false)
    }
  }

  const handleTrigger = async () => {
    setTriggering(true)
    setError(null)

    try {
      const res = await fetch('/api/claude-code/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to trigger Claude Code')
      }

      await fetchRuns()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to trigger')
    } finally {
      setTriggering(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-500/20 text-gray-400',
      queued: 'bg-blue-500/20 text-blue-400',
      running: 'bg-yellow-500/20 text-yellow-400',
      completed: 'bg-green-500/20 text-green-400',
      failed: 'bg-red-500/20 text-red-400',
    }
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[status] || styles.pending}`}>
        {status}
      </span>
    )
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-primary rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-accent flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Claude Code Runs</h2>
            <p className="text-sm text-text-secondary truncate max-w-md">{taskName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="p-4 border-b border-accent">
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="w-full px-4 py-3 bg-accent text-text-primary rounded-md hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {triggering ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Triggering...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path d="M15.98 1.804a1 1 0 00-1.96 0l-.24 1.192a1 1 0 01-.784.785l-1.192.238a1 1 0 000 1.962l1.192.238a1 1 0 01.785.785l.238 1.192a1 1 0 001.962 0l.238-1.192a1 1 0 01.785-.785l1.192-.238a1 1 0 000-1.962l-1.192-.238a1 1 0 01-.785-.785l-.238-1.192zM6.949 5.684a1 1 0 00-1.898 0l-.683 2.051a1 1 0 01-.633.633l-2.051.683a1 1 0 000 1.898l2.051.684a1 1 0 01.633.632l.683 2.051a1 1 0 001.898 0l.683-2.051a1 1 0 01.633-.633l2.051-.683a1 1 0 000-1.898l-2.051-.683a1 1 0 01-.633-.633L6.95 5.684zM13.949 13.684a1 1 0 00-1.898 0l-.184.551a1 1 0 01-.632.633l-.551.183a1 1 0 000 1.898l.551.183a1 1 0 01.633.633l.183.551a1 1 0 001.898 0l.184-.551a1 1 0 01.632-.633l.551-.183a1 1 0 000-1.898l-.551-.184a1 1 0 01-.633-.632l-.183-.551z" />
                </svg>
                Run Claude Code
              </>
            )}
          </button>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-8 text-text-secondary">Loading...</div>
          ) : runs.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              <p>No runs yet. Click "Run Claude Code" to start.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <div key={run.id} className="p-4 bg-secondary rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(run.status)}
                      <span className="text-sm text-text-secondary">
                        {formatDate(run.inserted_at)}
                      </span>
                    </div>
                    {run.workflow_run_url && (
                      <a
                        href={run.workflow_run_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:underline"
                      >
                        View Workflow →
                      </a>
                    )}
                  </div>

                  {run.github_pr_url && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-text-secondary">PR:</span>
                      <a
                        href={run.github_pr_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        #{run.github_pr_number}
                      </a>
                    </div>
                  )}

                  {run.summary && (
                    <div className="text-sm text-text-primary mt-2">
                      <p className="font-medium">Summary:</p>
                      <p className="text-text-secondary">{run.summary}</p>
                    </div>
                  )}

                  {run.error_message && (
                    <div className="text-sm text-red-400 mt-2">
                      <p className="font-medium">Error:</p>
                      <p>{run.error_message}</p>
                    </div>
                  )}

                  {run.branch_name && (
                    <div className="text-xs text-text-secondary">
                      Branch: <code className="bg-accent px-1 rounded">{run.branch_name}</code>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-accent flex gap-2">
          <button
            onClick={fetchRuns}
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
