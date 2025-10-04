'use client'

import { useEffect, useState } from 'react'
import { CategoryMember, CategoryRole } from '@/lib/types'

type ShareCategoryModalProps = {
  categoryId: string
  categoryName: string
  onClose: () => void
  onMembersChanged?: () => void
}

export default function ShareCategoryModal({ categoryId, categoryName, onClose, onMembersChanged }: ShareCategoryModalProps) {
  const [members, setMembers] = useState<CategoryMember[]>([])
  const [yourRole, setYourRole] = useState<CategoryRole>('viewer')
  const [loading, setLoading] = useState(true)
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [newMemberRole, setNewMemberRole] = useState<CategoryRole>('editor')
  const [addingMember, setAddingMember] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetchMembers()
  }, [categoryId])

  const fetchMembers = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/categories/${categoryId}/members`)
      if (!res.ok) throw new Error('Failed to fetch members')
      const data = await res.json()
      setMembers(data.members || [])
      setYourRole(data.your_role || 'viewer')
    } catch (error) {
      console.error('Error fetching members:', error)
      setMessage({ text: 'Failed to load members', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMemberEmail.trim()) return

    setAddingMember(true)
    setMessage(null)

    try {
      const res = await fetch(`/api/categories/${categoryId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newMemberEmail, role: newMemberRole })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add member')
      }

      setMessage({ text: `Successfully added ${newMemberEmail}`, type: 'success' })
      setNewMemberEmail('')
      setNewMemberRole('editor')
      fetchMembers()
      onMembersChanged?.()  // Refresh categories to update member count
    } catch (error: any) {
      console.error('Error adding member:', error)
      setMessage({ text: error.message, type: 'error' })
    } finally {
      setAddingMember(false)
    }
  }

  const handleRemoveMember = async (email: string) => {
    if (!confirm(`Remove ${email} from this category?`)) return

    setMessage(null)

    try {
      const res = await fetch(`/api/categories/${categoryId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to remove member')
      }

      setMessage({ text: `Successfully removed ${email}`, type: 'success' })
      fetchMembers()
      onMembersChanged?.()  // Refresh categories to update member count
    } catch (error: any) {
      console.error('Error removing member:', error)
      setMessage({ text: error.message, type: 'error' })
    }
  }

  const canManageMembers = yourRole === 'owner'

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-primary rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-text-primary">
              Share: {categoryName}
            </h2>
            <button
              onClick={onClose}
              className="text-text-secondary hover:text-text-primary text-3xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="mb-4 p-3 bg-secondary rounded-md">
            <p className="text-sm text-text-secondary">
              Your role: <span className="font-semibold text-text-primary capitalize">{yourRole}</span>
            </p>
          </div>

          {message && (
            <div
              className={`mb-4 p-3 rounded-md text-sm ${
                message.type === 'success'
                  ? 'bg-green-900/30 text-green-300'
                  : 'bg-red-900/30 text-red-300'
              }`}
            >
              {message.text}
            </div>
          )}

          {canManageMembers && (
            <form onSubmit={handleAddMember} className="mb-6">
              <h3 className="text-lg font-semibold text-text-primary mb-3">Add Member</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="flex-1 px-3 py-2 bg-secondary border border-accent rounded-md text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                  disabled={addingMember}
                  required
                />
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as CategoryRole)}
                  className="px-3 py-2 bg-secondary border border-accent rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  disabled={addingMember}
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="owner">Owner</option>
                </select>
                <button
                  type="submit"
                  disabled={addingMember}
                  className="px-4 py-2 bg-accent text-text-primary rounded-md hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingMember ? 'Adding...' : 'Add'}
                </button>
              </div>
              <div className="mt-2 text-xs text-text-secondary">
                <p>• <strong>Owner</strong>: Full access including managing members</p>
                <p>• <strong>Editor</strong>: Can create, edit, and delete tasks</p>
                <p>• <strong>Viewer</strong>: Can only view tasks (read-only)</p>
              </div>
            </form>
          )}

          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-3">
              Members ({members.length})
            </h3>
            {loading ? (
              <div className="text-center py-4 text-text-secondary">Loading...</div>
            ) : members.length === 0 ? (
              <div className="text-center py-4 text-text-secondary">No members found</div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between p-3 bg-secondary rounded-md"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-text-primary font-medium truncate">
                        {member.email}
                        {member.is_you && (
                          <span className="ml-2 text-xs text-accent">(You)</span>
                        )}
                      </p>
                      <p className="text-sm text-text-secondary capitalize">{member.role}</p>
                    </div>
                    {canManageMembers && !member.is_you && (
                      <button
                        onClick={() => handleRemoveMember(member.email)}
                        className="ml-3 px-3 py-1 text-sm bg-accent text-text-primary rounded-md hover:bg-red-600 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-accent text-text-primary rounded-md hover:bg-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

