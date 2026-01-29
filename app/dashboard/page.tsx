'use client'

import { useEffect, useRef, useState } from 'react'
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useUser } from '@auth0/nextjs-auth0/client'
import { Category, Task, CategoryGitHubRepo } from '@/lib/types'
import ShareCategoryModal from './ShareCategoryModal'
import GitHubSettingsModal from './GitHubSettingsModal'
import ClaudeCodeRunsModal from './ClaudeCodeRunsModal'

// Type for archived categories with task count
type ArchivedCategory = Category & { task_count: number }

// Type for GitHub connection status
type GitHubStatus = {
  connected: boolean
  username: string | null
}

export default function Dashboard() {
  const { user } = useUser()
  const [categories, setCategories] = useState<Category[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [newTaskName, setNewTaskName] = useState('')
  const [newTaskDate, setNewTaskDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showCategoryInput, setShowCategoryInput] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [fixingOrder, setFixingOrder] = useState(false)
  const [fixOrderStatus, setFixOrderStatus] = useState<string | null>(null)
  const [showBackupMenu, setShowBackupMenu] = useState(false)
  const backupMenuRef = useRef<HTMLDivElement>(null)
  const [sharingCategoryId, setSharingCategoryId] = useState<string | null>(null)
  const [optionsCategoryId, setOptionsCategoryId] = useState<string | null>(null)
  const [archivedCategories, setArchivedCategories] = useState<ArchivedCategory[]>([])
  const [showArchivedModal, setShowArchivedModal] = useState(false)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [githubStatus, setGithubStatus] = useState<GitHubStatus>({ connected: false, username: null })
  const [categoryRepos, setCategoryRepos] = useState<Record<string, CategoryGitHubRepo>>({})
  const [githubSettingsCategoryId, setGithubSettingsCategoryId] = useState<string | null>(null)
  const [claudeCodeTaskId, setClaudeCodeTaskId] = useState<string | null>(null)
  const [claudeMode, setClaudeMode] = useState(false)

  useEffect(() => {
    if (user) {
      fetchCategories()
      fetchTasks()
      fetchArchivedCategories()
      fetchGitHubStatus()
    }
  }, [user])

  // Close backup menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (backupMenuRef.current && !backupMenuRef.current.contains(event.target as Node)) {
        setShowBackupMenu(false)
      }
    }
    if (showBackupMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showBackupMenu])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch categories')
      const data: Category[] = await res.json()
      setCategories(data)
      if (data.length > 0 && !selectedCategory) {
        setSelectedCategory(data[0].id)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch tasks')
      const data: Task[] = await res.json()
      setTasks(data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching tasks:', error)
      setLoading(false)
    }
  }

  const fetchArchivedCategories = async () => {
    try {
      const res = await fetch('/api/categories/archived', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch archived categories')
      const data: ArchivedCategory[] = await res.json()
      setArchivedCategories(data)
    } catch (error) {
      console.error('Error fetching archived categories:', error)
    }
  }

  const fetchGitHubStatus = async () => {
    try {
      const res = await fetch('/api/auth/github/status')
      if (!res.ok) throw new Error('Failed to fetch GitHub status')
      const data = await res.json()
      setGithubStatus(data)
    } catch (error) {
      console.error('Error fetching GitHub status:', error)
    }
  }

  const fetchCategoryRepo = async (categoryId: string) => {
    try {
      const res = await fetch(`/api/categories/${categoryId}/github`)
      if (!res.ok) return
      const data = await res.json()
      if (data.repo) {
        setCategoryRepos((prev) => ({ ...prev, [categoryId]: data.repo }))
      }
    } catch (error) {
      console.error('Error fetching category repo:', error)
    }
  }

  // Fetch repos for all categories when categories change
  useEffect(() => {
    categories.forEach((cat) => {
      if (!categoryRepos[cat.id]) {
        fetchCategoryRepo(cat.id)
      }
    })
  }, [categories])

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskName.trim() || !user || !selectedCategory || selectedCategory === 'overview') return

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: selectedCategory,
          name: newTaskName,
          date: newTaskDate,
        })
      })
      if (!res.ok) throw new Error('Failed to add task')
      setNewTaskName('')
      fetchTasks()
    } catch (error) {
      console.error('Error adding task:', error)
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const oldIndex = categories.findIndex((cat) => cat.id === active.id)
    const newIndex = categories.findIndex((cat) => cat.id === over.id)

    const items = arrayMove(categories, oldIndex, newIndex)
    setCategories(items)

    // Update sort_order for all affected categories
    try {
      const updates = items.map((category, index) => ({ id: category.id, sort_order: index }))
      const res = await fetch('/api/categories/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updates })
      })
      if (!res.ok) throw new Error('Failed to reorder categories')
    } catch (error) {
      console.error('Error updating category order:', error)
      fetchCategories() // Revert to server state if error
    }
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !user) return
    setCategoryError(null)

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName })
      })
      
      if (!res.ok) {
        const data = await res.json()
        if (res.status === 409) {
          setCategoryError(data.error || 'A category with this name already exists in your archived categories.')
          return
        }
        throw new Error('Failed to add category')
      }
      
      setNewCategoryName('')
      setShowCategoryInput(false)
      setCategoryError(null)
      fetchCategories()
    } catch (error) {
      console.error('Error adding category:', error)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!user) return
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete task')
      fetchTasks()
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    if (!user) return
    
    try {
      // First check if there are any tasks in this category
      const resTasks = await fetch('/api/tasks', { cache: 'no-store' })
      if (!resTasks.ok) throw new Error('Failed to load tasks')
      const allTasks: Task[] = await resTasks.json()
      const tasksInCategory = allTasks.filter(t => t.category_id === categoryId)

      // If there are tasks, ask for confirmation
      if (tasksInCategory.length > 0) {
        const confirmed = window.confirm(
          `This category contains ${tasksInCategory.length} task${
            tasksInCategory.length === 1 ? '' : 's'
          }. Are you sure you want to delete it? All tasks in this category will also be deleted.`
        )
        
        if (!confirmed) return
      }

      // Proceed with deletion - tasks will be automatically deleted due to CASCADE
      const res = await fetch(`/api/categories/${categoryId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete category')
      
      // Refresh categories and tasks after deletion
      fetchCategories()
      fetchTasks()
      
      // If the deleted category was selected, switch to overview
      if (selectedCategory === categoryId) {
        setSelectedCategory('overview')
      }
    } catch (error) {
      console.error('Error deleting category:', error)
    }
  }

  const handleArchiveCategory = async (categoryId: string) => {
    if (!user) return
    
    try {
      const res = await fetch(`/api/categories/${categoryId}/archive`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true })
      })
      if (!res.ok) throw new Error('Failed to archive category')
      
      // Refresh categories
      fetchCategories()
      fetchArchivedCategories()
      
      // If the archived category was selected, switch to overview
      if (selectedCategory === categoryId) {
        setSelectedCategory('overview')
      }
    } catch (error) {
      console.error('Error archiving category:', error)
    }
  }

  const handleRestoreCategory = async (categoryId: string) => {
    if (!user) return
    
    try {
      const res = await fetch(`/api/categories/${categoryId}/archive`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false })
      })
      if (!res.ok) throw new Error('Failed to restore category')
      
      // Refresh categories
      fetchCategories()
      fetchArchivedCategories()
    } catch (error) {
      console.error('Error restoring category:', error)
    }
  }

  const handleDeleteArchivedCategory = async (categoryId: string) => {
    if (!user) return
    
    const category = archivedCategories.find(c => c.id === categoryId)
    const taskCount = category?.task_count || 0
    
    const confirmed = window.confirm(
      taskCount > 0
        ? `This archived category contains ${taskCount} task${taskCount === 1 ? '' : 's'}. Are you sure you want to permanently delete it? This action cannot be undone.`
        : 'Are you sure you want to permanently delete this archived category? This action cannot be undone.'
    )
    
    if (!confirmed) return
    
    try {
      const res = await fetch(`/api/categories/${categoryId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete category')
      
      fetchArchivedCategories()
      fetchTasks()
    } catch (error) {
      console.error('Error deleting archived category:', error)
    }
  }

  // Separate categories into Claude-enabled and standard
  const claudeCategories = categories.filter(cat => categoryRepos[cat.id])
  const standardCategories = categories.filter(cat => !categoryRepos[cat.id])
  const displayedCategories = claudeMode ? claudeCategories : standardCategories
  const previewCategories = claudeMode ? standardCategories : claudeCategories
  const displayedCategoryIds = new Set(displayedCategories.map(c => c.id))

  // Reset to overview when switching modes if current selection isn't in the new mode
  useEffect(() => {
    if (selectedCategory && selectedCategory !== 'overview') {
      const isInDisplayedCategories = displayedCategories.some(c => c.id === selectedCategory)
      if (!isInDisplayedCategories) {
        setSelectedCategory('overview')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claudeMode])

  const filteredTasks = selectedCategory === 'overview'
    ? tasks.filter(task => displayedCategoryIds.has(task.category_id))
    : tasks.filter(task => task.category_id === selectedCategory)

  const completedTasks = filteredTasks.filter(task => task.completed)
  const incompleteTasks = filteredTasks.filter(task => !task.completed)

  const handleLogout = () => {
    window.location.href = '/api/auth/logout'
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadStatus(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/backup/import', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to import backup')
      }

      setUploadStatus(`✓ ${data.message}`)
      fetchCategories()
      fetchTasks()

      // Clear the file input
      e.target.value = ''
    } catch (error: any) {
      console.error('Error uploading backup:', error)
      setUploadStatus(`✗ Error: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleDownloadTemplate = () => {
    window.location.href = '/api/backup/template'
  }

  const handleDownloadBackup = () => {
    window.location.href = '/api/backup/export'
  }

  const handleFixCategoryOrder = async () => {
    setFixingOrder(true)
    setFixOrderStatus(null)

    try {
      const res = await fetch('/api/categories/fix-order')
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fix category order')
      }

      setFixOrderStatus(`✓ ${data.message}`)
      fetchCategories() // Refresh categories to show new order
    } catch (error: any) {
      console.error('Error fixing category order:', error)
      setFixOrderStatus(`✗ Error: ${error.message}`)
    } finally {
      setFixingOrder(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="flex flex-wrap gap-2">
            <a
              href="https://www.benjamincooper.info/"
              className="px-4 py-2 text-sm font-medium text-text-primary bg-accent rounded-md hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-accent"
            >
              Home
            </a>
            <a
              href="https://www.benjamincooper.info/portfolio.html"
              className="px-4 py-2 text-sm font-medium text-text-primary bg-accent rounded-md hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-accent"
            >
              Portfolio
            </a>
          </div>
          <div className="flex gap-2">
            {/* GitHub Connection Status */}
            {githubStatus.connected ? (
              <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-text-primary bg-accent rounded-md">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                <span className="hidden sm:inline">{githubStatus.username}</span>
              </div>
            ) : (
              <a
                href="/api/auth/github"
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-primary bg-accent rounded-md hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-accent"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                <span className="hidden sm:inline">Connect GitHub</span>
              </a>
            )}
            {/* Archived Categories Button - only show if there are archived categories */}
            {archivedCategories.length > 0 && (
              <button
                onClick={() => setShowArchivedModal(true)}
                className="px-4 py-2 text-sm font-medium text-text-primary bg-accent rounded-md hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-accent"
              >
                Archived ({archivedCategories.length})
              </button>
            )}
            {/* Backup & Import Dropdown */}
            <div className="relative" ref={backupMenuRef}>
              <button
                onClick={() => setShowBackupMenu(!showBackupMenu)}
                className="px-4 py-2 text-sm font-medium text-text-primary bg-accent rounded-md hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-accent"
              >
                Backup & Import
              </button>
              {showBackupMenu && (
                <div className="absolute right-0 mt-2 w-72 bg-primary rounded-lg shadow-lg border border-accent z-50">
                  <div className="p-4">
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={handleDownloadBackup}
                        className="px-4 py-2 text-sm font-medium text-text-primary bg-accent rounded-md hover:bg-secondary"
                      >
                        💾 Download Backup
                      </button>
                      <div>
                        <label
                          htmlFor="backup-upload"
                          className={`flex items-center justify-center px-4 py-2 text-sm font-medium text-text-primary bg-accent rounded-md hover:bg-secondary cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {uploading ? 'Uploading...' : '📤 Upload Backup'}
                        </label>
                        <input
                          id="backup-upload"
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handleFileUpload}
                          disabled={uploading}
                          className="hidden"
                        />
                      </div>
                      <button
                        onClick={handleDownloadTemplate}
                        className="px-4 py-2 text-sm font-medium text-text-primary bg-accent rounded-md hover:bg-secondary"
                      >
                        📥 Download Template
                      </button>
                      <button
                        onClick={handleFixCategoryOrder}
                        disabled={fixingOrder}
                        className="px-4 py-2 text-sm font-medium text-text-primary bg-accent rounded-md hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {fixingOrder ? 'Fixing...' : '🔧 Fix Category Order'}
                      </button>
                    </div>
                    {uploadStatus && (
                      <div
                        className={`mt-3 p-3 rounded-md text-sm ${uploadStatus.startsWith('✓') ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}
                      >
                        {uploadStatus}
                      </div>
                    )}
                    {fixOrderStatus && (
                      <div
                        className={`mt-3 p-3 rounded-md text-sm ${fixOrderStatus.startsWith('✓') ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}
                      >
                        {fixOrderStatus}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-text-primary bg-accent rounded-md hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-accent"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setClaudeMode(false)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                !claudeMode
                  ? 'bg-accent text-text-primary'
                  : 'bg-secondary text-text-secondary hover:text-text-primary'
              }`}
            >
              Tasks ({standardCategories.length})
            </button>
            <button
              onClick={() => setClaudeMode(true)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                claudeMode
                  ? 'bg-purple-600 text-white'
                  : 'bg-secondary text-text-secondary hover:text-text-primary'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M15.98 1.804a1 1 0 00-1.96 0l-.24 1.192a1 1 0 01-.784.785l-1.192.238a1 1 0 000 1.962l1.192.238a1 1 0 01.785.785l.238 1.192a1 1 0 001.962 0l.238-1.192a1 1 0 01.785-.785l1.192-.238a1 1 0 000-1.962l-1.192-.238a1 1 0 01-.785-.785l-.238-1.192zM6.949 5.684a1 1 0 00-1.898 0l-.683 2.051a1 1 0 01-.633.633l-2.051.683a1 1 0 000 1.898l2.051.684a1 1 0 01.633.632l.683 2.051a1 1 0 001.898 0l.683-2.051a1 1 0 01.633-.633l2.051-.683a1 1 0 000-1.898l-2.051-.683a1 1 0 01-.633-.633L6.95 5.684zM13.949 13.684a1 1 0 00-1.898 0l-.184.551a1 1 0 01-.632.633l-.551.183a1 1 0 000 1.898l.551.183a1 1 0 01.633.633l.183.551a1 1 0 001.898 0l.184-.551a1 1 0 01.632-.633l.551-.183a1 1 0 000-1.898l-.551-.184a1 1 0 01-.633-.632l-.183-.551z" />
              </svg>
              Claude ({claudeCategories.length})
            </button>
          </div>

          {/* Preview of other mode's categories */}
          {previewCategories.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <span className="hidden sm:inline">
                {claudeMode ? 'Tasks:' : 'Claude:'}
              </span>
              <div className="flex gap-1 flex-wrap max-w-xs sm:max-w-md">
                {previewCategories.slice(0, 4).map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setClaudeMode(!claudeMode)
                      setSelectedCategory(cat.id)
                    }}
                    className="px-2 py-0.5 text-xs bg-secondary/50 rounded hover:bg-secondary truncate max-w-[80px] sm:max-w-[120px]"
                    title={cat.name}
                  >
                    {cat.name}
                  </button>
                ))}
                {previewCategories.length > 4 && (
                  <span className="px-2 py-0.5 text-xs text-text-secondary">
                    +{previewCategories.length - 4}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="flex space-x-2 mb-6 bg-primary p-2 rounded-lg shadow overflow-x-auto">
            <button
              onClick={() => setSelectedCategory('overview')}
              className={`px-4 py-2 rounded-md whitespace-nowrap ${
                selectedCategory === 'overview'
                  ? 'bg-accent text-text-primary'
                  : 'bg-secondary hover:bg-accent text-text-primary'
              }`}
            >
              Overview
            </button>
            <SortableContext
              items={displayedCategories.map((cat) => cat.id)}
              strategy={horizontalListSortingStrategy}
            >
              {displayedCategories.map((category) => (
                <SortableCategory
                  key={category.id}
                  category={category}
                  isSelected={selectedCategory === category.id}
                  onSelect={() => setSelectedCategory(category.id)}
                  onShowOptions={() => setOptionsCategoryId(category.id)}
                  onShare={() => setSharingCategoryId(category.id)}
                  hasGitHubRepo={!!categoryRepos[category.id]}
                />
              ))}
            </SortableContext>

            {showCategoryInput ? (
              <div className="flex flex-col gap-2">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => {
                      setNewCategoryName(e.target.value)
                      setCategoryError(null)
                    }}
                    placeholder="Category name"
                    className={`px-3 py-2 bg-secondary border rounded-md text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent ${categoryError ? 'border-red-500' : 'border-accent'}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddCategory()
                      if (e.key === 'Escape') {
                        setShowCategoryInput(false)
                        setNewCategoryName('')
                        setCategoryError(null)
                      }
                    }}
                    autoFocus
                  />
                  <button
                    onClick={handleAddCategory}
                    className="px-3 py-2 bg-accent text-text-primary rounded-md hover:bg-secondary"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowCategoryInput(false)
                      setNewCategoryName('')
                      setCategoryError(null)
                    }}
                    className="px-3 py-2 bg-secondary text-text-primary rounded-md hover:bg-accent"
                  >
                    Cancel
                  </button>
                </div>
                {categoryError && (
                  <div className="text-red-400 text-sm max-w-md">
                    {categoryError}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowCategoryInput(true)}
                className="px-4 py-2 rounded-md bg-secondary text-text-primary hover:bg-accent whitespace-nowrap"
              >
                + Add Category
              </button>
            )}
          </div>
        </DndContext>

        <div className="bg-primary rounded-lg shadow p-6">
          <form onSubmit={handleAddTask} className="mb-6 flex flex-col md:flex-row gap-2">
            <input
              type="text"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              placeholder="Add a new task..."
              className="w-full md:flex-1 p-2 bg-secondary border border-accent rounded-md text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <select
              value={selectedCategory === 'overview' ? '' : selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full md:w-auto p-2 border border-accent rounded-md bg-secondary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              required
            >
              <option value="" disabled>Select category</option>
              {displayedCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={newTaskDate}
              onChange={(e) => setNewTaskDate(e.target.value)}
              className="w-full md:w-auto p-2 border border-accent rounded-md bg-secondary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              type="submit"
              disabled={!selectedCategory || selectedCategory === 'overview'}
              className="w-full md:w-auto bg-accent text-text-primary px-4 py-2 rounded-md hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Task
            </button>
          </form>

          <div className="space-y-4">
            <TaskList
              tasks={incompleteTasks}
              onUpdate={fetchTasks}
              title="Active Tasks"
              onDeleteTask={handleDeleteTask}
              categories={categories}
              categoryRepos={categoryRepos}
              onTriggerClaudeCode={(taskId) => setClaudeCodeTaskId(taskId)}
            />
            <TaskList
              tasks={completedTasks}
              onUpdate={fetchTasks}
              title="Completed Tasks"
              defaultCollapsed
              onDeleteTask={handleDeleteTask}
              categories={categories}
              categoryRepos={categoryRepos}
              onTriggerClaudeCode={(taskId) => setClaudeCodeTaskId(taskId)}
            />
          </div>
        </div>
      </div>

      {sharingCategoryId && (
        <ShareCategoryModal
          categoryId={sharingCategoryId}
          categoryName={categories.find((c) => c.id === sharingCategoryId)?.name || ''}
          onClose={() => setSharingCategoryId(null)}
          onMembersChanged={fetchCategories}
        />
      )}

      {showArchivedModal && (
        <ArchivedCategoriesModal
          archivedCategories={archivedCategories}
          onClose={() => setShowArchivedModal(false)}
          onRestore={handleRestoreCategory}
          onDelete={handleDeleteArchivedCategory}
        />
      )}

      {optionsCategoryId && (
        <CategoryOptionsModal
          categoryName={categories.find((c) => c.id === optionsCategoryId)?.name || ''}
          onClose={() => setOptionsCategoryId(null)}
          onArchive={() => {
            handleArchiveCategory(optionsCategoryId)
            setOptionsCategoryId(null)
          }}
          onDelete={() => {
            handleDeleteCategory(optionsCategoryId)
            setOptionsCategoryId(null)
          }}
          onGitHubSettings={() => {
            setGithubSettingsCategoryId(optionsCategoryId)
            setOptionsCategoryId(null)
          }}
          hasGitHubRepo={!!categoryRepos[optionsCategoryId]}
        />
      )}

      {githubSettingsCategoryId && (
        <GitHubSettingsModal
          categoryId={githubSettingsCategoryId}
          categoryName={categories.find((c) => c.id === githubSettingsCategoryId)?.name || ''}
          onClose={() => setGithubSettingsCategoryId(null)}
          onRepoLinked={() => fetchCategoryRepo(githubSettingsCategoryId)}
        />
      )}

      {claudeCodeTaskId && (
        <ClaudeCodeRunsModal
          taskId={claudeCodeTaskId}
          taskName={tasks.find((t) => t.id === claudeCodeTaskId)?.name || ''}
          onClose={() => setClaudeCodeTaskId(null)}
        />
      )}
    </div>
  )
}

function SortableCategory({
  category,
  isSelected,
  onSelect,
  onShowOptions,
  onShare,
  hasGitHubRepo,
}: {
  category: Category
  isSelected: boolean
  onSelect: () => void
  onShowOptions: () => void
  onShare: () => void
  hasGitHubRepo: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isShared = (category.member_count ?? 1) > 1

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative group"
    >
      <button
        onClick={onSelect}
        className={`px-4 py-2 rounded-md flex items-center gap-2 ${
          isSelected
            ? 'bg-accent text-text-primary'
            : 'bg-secondary hover:bg-accent text-text-primary'
        }`}
      >
        <span>{category.name}</span>
        {hasGitHubRepo && (
          <svg className="w-4 h-4 text-text-secondary" fill="currentColor" viewBox="0 0 24 24" aria-label="GitHub linked">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
        )}
        {isShared && (
          <span className="inline-flex items-center justify-center w-5 h-5 text-xs bg-accent rounded-full" title={`${category.member_count} members`}>
            {category.member_count}
          </span>
        )}
      </button>
      <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onShare()
          }}
          className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-secondary rounded-full bg-primary border border-accent shadow-sm"
          title="Share category"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-3.5 h-3.5"
          >
            <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.475l6.733-3.366A2.52 2.52 0 0113 4.5z" />
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onShowOptions()
          }}
          className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-secondary rounded-full bg-primary border border-accent shadow-sm"
          title="Category options"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-3.5 h-3.5"
          >
            <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// Category Options Modal Component
function CategoryOptionsModal({
  categoryName,
  onClose,
  onArchive,
  onDelete,
  onGitHubSettings,
  hasGitHubRepo,
}: {
  categoryName: string
  onClose: () => void
  onArchive: () => void
  onDelete: () => void
  onGitHubSettings: () => void
  hasGitHubRepo: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-primary rounded-lg shadow-xl w-full max-w-sm mx-4">
        <div className="p-4 border-b border-accent flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">{categoryName}</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary"
          >
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
        <div className="p-4 space-y-3">
          <button
            onClick={onGitHubSettings}
            className="w-full px-4 py-3 text-left text-text-primary bg-secondary hover:bg-accent rounded-lg flex items-center gap-3 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="font-medium">GitHub Settings</div>
              <div className="text-sm text-text-secondary">
                {hasGitHubRepo ? 'Manage linked repository' : 'Link a GitHub repository'}
              </div>
            </div>
          </button>
          <button
            onClick={onArchive}
            className="w-full px-4 py-3 text-left text-text-primary bg-secondary hover:bg-accent rounded-lg flex items-center gap-3 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5 text-amber-500"
            >
              <path d="M2 3a1 1 0 00-1 1v1a1 1 0 001 1h16a1 1 0 001-1V4a1 1 0 00-1-1H2z" />
              <path fillRule="evenodd" d="M2 7.5h16l-.811 7.71a2 2 0 01-1.99 1.79H4.802a2 2 0 01-1.99-1.79L2 7.5zM7 11a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="font-medium">Archive</div>
              <div className="text-sm text-text-secondary">Hide this category from view</div>
            </div>
          </button>
          <button
            onClick={onDelete}
            className="w-full px-4 py-3 text-left text-red-400 bg-secondary hover:bg-red-900/20 rounded-lg flex items-center gap-3 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="font-medium">Delete</div>
              <div className="text-sm text-text-secondary">Permanently remove this category</div>
            </div>
          </button>
        </div>
        <div className="p-4 border-t border-accent">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-accent text-text-primary rounded-md hover:bg-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function TaskList({
  tasks,
  onUpdate,
  title,
  defaultCollapsed = false,
  onDeleteTask,
  categories,
  categoryRepos,
  onTriggerClaudeCode,
}: {
  tasks: Task[]
  onUpdate: () => void
  title: string
  defaultCollapsed?: boolean
  onDeleteTask: (taskId: string) => void
  categories: Category[]
  categoryRepos: Record<string, CategoryGitHubRepo>
  onTriggerClaudeCode: (taskId: string) => void
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [editingTask, setEditingTask] = useState<string | null>(null)
  const [editedTaskName, setEditedTaskName] = useState('')
  const [editedTaskDate, setEditedTaskDate] = useState('')
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  // Collapse expanded task name when clicking outside the task list
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!listRef.current) return
      if (expandedTaskId && !listRef.current.contains(event.target as Node)) {
        setExpandedTaskId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [expandedTaskId])

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      if (!res.ok) throw new Error('Failed to update task')
      onUpdate()
      setEditingTask(null)
    } catch (error) {
      console.error('Error updating task:', error)
    }
  }

  const startEditing = (task: Task) => {
    setEditingTask(task.id)
    setEditedTaskName(task.name)
    setEditedTaskDate(task.date)
  }

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId)
    return category ? category.name : ''
  }

  return (
    <div className="border rounded-md p-4" ref={listRef}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full mb-2"
      >
        <h3 className="text-lg font-semibold">{title} ({tasks.length})</h3>
        <span>{collapsed ? '▼' : '▲'}</span>
      </button>
      
      {!collapsed && (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-2 hover:bg-secondary rounded-md"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={(e) =>
                    handleTaskUpdate(task.id, { completed: e.target.checked })
                  }
                  className="h-4 w-4 bg-secondary border-accent"
                />
                {editingTask === task.id ? (
                  <div className="flex flex-col sm:flex-row gap-2 flex-1">
                    <input
                      type="text"
                      value={editedTaskName}
                      onChange={(e) => setEditedTaskName(e.target.value)}
                      className="flex-grow p-1 bg-secondary border border-accent rounded-md text-text-primary"
                      autoFocus
                    />
                    <input
                      type="date"
                      value={editedTaskDate}
                      onChange={(e) => setEditedTaskDate(e.target.value)}
                      className="p-1 bg-secondary border border-accent rounded-md text-text-primary"
                    />
                    <button
                      onClick={() => handleTaskUpdate(task.id, { 
                        name: editedTaskName,
                        date: editedTaskDate
                      })}
                      className="px-2 py-1 bg-accent text-text-primary rounded-md hover:bg-secondary"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingTask(null)}
                      className="px-2 py-1 bg-secondary text-text-primary rounded-md hover:bg-accent"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`text-left w-full cursor-pointer transition-all ${
                        task.completed ? 'line-through text-text-secondary' : 'text-text-primary'
                      } ${expandedTaskId === task.id ? 'whitespace-normal' : 'truncate'}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpandedTaskId(prev => prev === task.id ? null : task.id)
                      }}
                      title={expandedTaskId === task.id ? 'Click to collapse' : 'Click to expand'}
                    >
                      {task.name}
                    </button>
                    <span className="text-sm text-text-secondary">{task.date}</span>
                    <span className="text-xs px-2 py-1 bg-secondary rounded-full text-text-secondary">
                      {getCategoryName(task.category_id)}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                {!editingTask && categoryRepos[task.category_id] && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onTriggerClaudeCode(task.id) }}
                    className="p-1 text-purple-400 hover:text-purple-300 focus:outline-none"
                    aria-label="Run Claude Code"
                    title="Run Claude Code"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path d="M15.98 1.804a1 1 0 00-1.96 0l-.24 1.192a1 1 0 01-.784.785l-1.192.238a1 1 0 000 1.962l1.192.238a1 1 0 01.785.785l.238 1.192a1 1 0 001.962 0l.238-1.192a1 1 0 01.785-.785l1.192-.238a1 1 0 000-1.962l-1.192-.238a1 1 0 01-.785-.785l-.238-1.192zM6.949 5.684a1 1 0 00-1.898 0l-.683 2.051a1 1 0 01-.633.633l-2.051.683a1 1 0 000 1.898l2.051.684a1 1 0 01.633.632l.683 2.051a1 1 0 001.898 0l.683-2.051a1 1 0 01.633-.633l2.051-.683a1 1 0 000-1.898l-2.051-.683a1 1 0 01-.633-.633L6.95 5.684zM13.949 13.684a1 1 0 00-1.898 0l-.184.551a1 1 0 01-.632.633l-.551.183a1 1 0 000 1.898l.551.183a1 1 0 01.633.633l.183.551a1 1 0 001.898 0l.184-.551a1 1 0 01.632-.633l.551-.183a1 1 0 000-1.898l-.551-.184a1 1 0 01-.633-.632l-.183-.551z" />
                    </svg>
                  </button>
                )}
                {!editingTask && (
                  <button
                    onClick={(e) => { e.stopPropagation(); startEditing(task) }}
                    className="p-1 text-text-secondary hover:text-text-primary focus:outline-none"
                    aria-label="Edit task"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-4 h-4"
                    >
                      <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                      <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTaskUpdate(task.id, { favorited: !task.favorited })
                  }}
                  className="p-1 text-yellow-500 hover:text-yellow-400 focus:outline-none"
                  aria-label={task.favorited ? "Unfavorite task" : "Favorite task"}
                >
                  {task.favorited ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-4 h-4"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-4 h-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                      />
                    </svg>
                  )}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id) }}
                  className="p-1 text-text-secondary hover:text-text-primary focus:outline-none"
                  aria-label="Delete task"
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
  )
}

// Archived Categories Modal Component
function ArchivedCategoriesModal({
  archivedCategories,
  onClose,
  onRestore,
  onDelete,
}: {
  archivedCategories: ArchivedCategory[]
  onClose: () => void
  onRestore: (categoryId: string) => void
  onDelete: (categoryId: string) => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-primary rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-accent flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Archived Categories</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary"
          >
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
          {archivedCategories.length === 0 ? (
            <p className="text-text-secondary text-center py-8">No archived categories</p>
          ) : (
            <div className="space-y-3">
              {archivedCategories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-3 bg-secondary rounded-lg"
                >
                  <div>
                    <h3 className="font-medium text-text-primary">{category.name}</h3>
                    <p className="text-sm text-text-secondary">
                      {category.task_count} task{category.task_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onRestore(category.id)}
                      className="px-3 py-1.5 text-sm bg-accent text-text-primary rounded-md hover:bg-primary flex items-center gap-1.5"
                      title="Restore category"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4"
                      >
                        <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
                      </svg>
                      Restore
                    </button>
                    <button
                      onClick={() => onDelete(category.id)}
                      className="px-3 py-1.5 text-sm bg-red-900/30 text-red-400 rounded-md hover:bg-red-900/50 flex items-center gap-1.5"
                      title="Delete permanently"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4"
                      >
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                      </svg>
                      Delete
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
            className="w-full px-4 py-2 bg-accent text-text-primary rounded-md hover:bg-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}