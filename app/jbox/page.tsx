'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type JBoxMessage = {
  id: string
  body: string
  occasion: string | null
  created_at: string
  delivered_at: string | null
  read_at: string | null
  hearted_at: string | null
}

const OCCASIONS = [
  { value: '', label: 'Everyday note' },
  { value: 'anniversary', label: 'Anniversary' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'special', label: 'Just extra special' },
]

function statusFor(m: JBoxMessage) {
  if (m.hearted_at) return { text: "Julia ♥'d this", cls: 'text-rose-500 font-semibold' }
  if (m.read_at) return { text: 'Read', cls: 'text-emerald-600' }
  if (m.delivered_at) return { text: 'Waiting in the box', cls: 'text-amber-600' }
  return { text: 'Sent', cls: 'text-gray-400' }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export default function JBoxPage() {
  const [messages, setMessages] = useState<JBoxMessage[]>([])
  const [draft, setDraft] = useState('')
  const [occasion, setOccasion] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justSent, setJustSent] = useState(false)
  // deleting a love note by mistake is unrecoverable, so the button arms first
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/jbox/messages')
      if (!res.ok) throw new Error('Failed to load messages')
      setMessages(await res.json())
      setError(null)
    } catch (e: any) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    load()
    pollRef.current = setInterval(load, 30000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [load])

  const send = async () => {
    if (!draft.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/jbox/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: draft.trim(), occasion: occasion || null }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to send')
      }
      setDraft('')
      setOccasion('')
      setJustSent(true)
      setTimeout(() => setJustSent(false), 2500)
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  const remove = async (id: string) => {
    setDeletingId(id)
    setError(null)
    try {
      const res = await fetch(`/api/jbox/messages/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete')
      }
      setMessages((prev) => prev.filter((m) => m.id !== id))
      setConfirmingId(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-amber-50">
      <div className="mx-auto max-w-lg px-4 py-8">
        <header className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-rose-600">J-Box</h1>
          <p className="mt-1 text-sm text-gray-500">A note for Julia, delivered to her box</p>
        </header>

        <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write something she'll open the lid for..."
            rows={4}
            maxLength={2000}
            className="w-full resize-none rounded-xl border border-gray-200 p-3 text-gray-800 placeholder-gray-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
          />
          <div className="mt-3 flex items-center gap-2">
            <select
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              className="rounded-lg border border-gray-200 px-2 py-2 text-sm text-gray-600 focus:outline-none"
            >
              {OCCASIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <span className="ml-auto text-xs text-gray-400">{draft.length}/2000</span>
            <button
              onClick={send}
              disabled={sending || !draft.trim()}
              className="rounded-xl bg-rose-500 px-5 py-2 font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:opacity-40"
            >
              {sending ? 'Sending…' : justSent ? 'Sent ♥' : 'Send ♥'}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </div>

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Sent notes
          </h2>
          <ul className="space-y-3">
            {messages.map((m) => {
              const status = statusFor(m)
              return (
                <li key={m.id} className="group rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <p className="whitespace-pre-wrap text-gray-800">{m.body}</p>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                    <span className="text-gray-400">
                      {formatDate(m.created_at)}
                      {m.occasion ? ` · ${m.occasion}` : ''}
                    </span>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className={status.cls}>{status.text}</span>
                      {confirmingId === m.id ? (
                        <span className="flex items-center gap-2">
                          <button
                            onClick={() => remove(m.id)}
                            disabled={deletingId === m.id}
                            className="rounded-md bg-red-500 px-2 py-1 font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
                          >
                            {deletingId === m.id ? 'Deleting…' : 'Delete'}
                          </button>
                          <button
                            onClick={() => setConfirmingId(null)}
                            className="text-gray-500 underline-offset-2 hover:underline"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmingId(m.id)}
                          aria-label="Delete this note"
                          title="Delete this note"
                          className="rounded-md px-1.5 py-0.5 text-base leading-none text-gray-300 transition hover:bg-red-50 hover:text-red-500 focus:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
            {messages.length === 0 && (
              <li className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                No notes yet — send the first one.
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  )
}
