'use client'

import { useEffect, useState, useRef } from 'react'
import { TaskAttachment } from '@/lib/types'

export default function TaskAttachmentsModal({
  taskId,
  taskName,
  onClose,
}: {
  taskId: string
  taskName: string
  onClose: () => void
}) {
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchAttachments()
  }, [taskId])

  const fetchAttachments = async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/attachments`)
      if (!res.ok) throw new Error('Failed to fetch attachments')
      const data = await res.json()
      setAttachments(data.attachments || [])
    } catch (e) {
      console.error('Error fetching attachments:', e)
      setError('Failed to load attachments')
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to upload file')
      }

      await fetchAttachments()
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to upload')
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleUpload(file)
    }
  }

  const handleDelete = async (attachmentId: string) => {
    if (!confirm('Are you sure you want to delete this attachment?')) return

    try {
      const res = await fetch(`/api/attachments/${attachmentId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete attachment')
      }

      await fetchAttachments()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  const handleDownload = async (attachment: TaskAttachment) => {
    try {
      const res = await fetch(`/api/attachments/${attachment.id}`)
      if (!res.ok) throw new Error('Failed to get download URL')

      const data = await res.json()
      window.open(data.url, '_blank')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to download')
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getFileIcon = (mimeType: string | null): string => {
    if (!mimeType) return '📄'
    if (mimeType.startsWith('image/')) return '🖼️'
    if (mimeType.includes('pdf')) return '📕'
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
    if (mimeType.includes('zip') || mimeType.includes('gzip') || mimeType.includes('tar'))
      return '📦'
    if (mimeType.includes('markdown') || mimeType.includes('text')) return '📄'
    return '📎'
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-primary rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-accent flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Task Attachments</h2>
            <p className="text-sm text-text-secondary truncate max-w-md">{taskName}</p>
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

        <div className="p-4 border-b border-accent">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
            id="file-upload"
            accept=".jpg,.jpeg,.png,.heic,.heif,.pdf,.docx,.doc,.md,.txt,.html,.zip,.gz,.tar,.js,.py,.json,.css"
          />
          <label
            htmlFor="file-upload"
            className={`w-full px-4 py-3 bg-accent text-text-primary rounded-md hover:bg-secondary flex items-center justify-center gap-2 cursor-pointer ${
              uploading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {uploading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
                  <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                </svg>
                Upload File
              </>
            )}
          </label>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          <p className="text-xs text-text-secondary mt-2">
            Supported: Images (JPG, PNG, HEIC), Documents (PDF, DOCX, MD, HTML), Archives (ZIP,
            GZIP), Code files. Max 50MB.
          </p>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-8 text-text-secondary">Loading...</div>
          ) : attachments.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              <p>No attachments yet. Upload files to provide context for Claude Code runs.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="p-3 bg-secondary rounded-lg flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-2xl">{getFileIcon(attachment.mime_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">{attachment.file_name}</p>
                      <p className="text-xs text-text-secondary">
                        {formatFileSize(attachment.file_size)} •{' '}
                        {new Date(attachment.inserted_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDownload(attachment)}
                      className="p-2 text-text-secondary hover:text-blue-400 rounded-md hover:bg-accent"
                      title="Download"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4"
                      >
                        <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                        <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(attachment.id)}
                      className="p-2 text-text-secondary hover:text-red-400 rounded-md hover:bg-accent"
                      title="Delete"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-accent">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-secondary text-text-primary rounded-md hover:bg-accent"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
