'use client'

import { useEffect, useState } from 'react'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { useAuth } from '@/lib/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Category, Task } from '@/lib/types'

export default function Dashboard() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [newTaskName, setNewTaskName] = useState('')
  const [newTaskDate, setNewTaskDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showCategoryInput, setShowCategoryInput] = useState(false)

  useEffect(() => {
    if (user) {
      fetchCategories()
      fetchTasks()
    }
  }, [user])

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order')

      if (error) throw error
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
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('favorited', { ascending: false })
        .order('date', { ascending: true })

      if (error) throw error
      setTasks(data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching tasks:', error)
      setLoading(false)
    }
  }

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskName.trim() || !user || !selectedCategory || selectedCategory === 'overview') return

    try {
      const { error } = await supabase.from('tasks').insert([
        {
          user_id: user.id,
          category_id: selectedCategory,
          name: newTaskName,
          date: newTaskDate,
          completed: false,
          favorited: false,
        },
      ])

      if (error) throw error
      setNewTaskName('')
      fetchTasks()
    } catch (error) {
      console.error('Error adding task:', error)
    }
  }

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return

    const items = Array.from(categories)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    setCategories(items)

    // Update sort_order for all affected categories
    try {
      const updates = items.map((category, index) => ({
        id: category.id,
        sort_order: index,
      }))

      const { error } = await supabase
        .from('categories')
        .upsert(updates, { onConflict: 'id' })

      if (error) throw error
    } catch (error) {
      console.error('Error updating category order:', error)
      fetchCategories() // Revert to server state if error
    }
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !user) return

    try {
      // Get the highest sort_order
      const maxSortOrder = categories.reduce((max, cat) => 
        Math.max(max, cat.sort_order), -1)

      const { error } = await supabase.from('categories').insert([
        {
          user_id: user.id,
          name: newCategoryName,
          sort_order: maxSortOrder + 1
        }
      ])

      if (error) throw error
      
      setNewCategoryName('')
      setShowCategoryInput(false)
      fetchCategories()
    } catch (error) {
      console.error('Error adding category:', error)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)

      if (error) throw error
      
      // Refresh tasks after deletion
      fetchTasks()
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    if (!user) return
    
    try {
      // First check if there are any tasks in this category
      const { data: tasksInCategory, error: tasksError } = await supabase
        .from('tasks')
        .select('id')
        .eq('category_id', categoryId)

      if (tasksError) throw tasksError

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
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId)

      if (error) throw error
      
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

  const filteredTasks = selectedCategory === 'overview' 
    ? tasks 
    : tasks.filter(task => task.category_id === selectedCategory)

  const completedTasks = filteredTasks.filter(task => task.completed)
  const incompleteTasks = filteredTasks.filter(task => !task.completed)

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      // Refresh the page to let middleware handle the redirect
      window.location.reload()
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between mb-4">
          <div className="flex space-x-4">
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
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-medium text-text-primary bg-accent rounded-md hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-accent"
          >
            Logout
          </button>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="categories" direction="horizontal">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="flex space-x-2 mb-6 bg-primary p-2 rounded-lg shadow overflow-x-auto"
              >
                <button
                  onClick={() => setSelectedCategory('overview')}
                  className={`px-4 py-2 rounded-md ${
                    selectedCategory === 'overview'
                      ? 'bg-accent text-text-primary'
                      : 'bg-secondary hover:bg-accent text-text-primary'
                  }`}
                >
                  Overview
                </button>
                {categories.map((category, index) => (
                  <Draggable
                    key={category.id}
                    draggableId={category.id}
                    index={index}
                  >
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className="relative group"
                      >
                        <button
                          onClick={() => setSelectedCategory(category.id)}
                          className={`px-4 py-2 rounded-md ${
                            selectedCategory === category.id
                              ? 'bg-accent text-text-primary'
                              : 'bg-secondary hover:bg-accent text-text-primary'
                          }`}
                        >
                          {category.name}
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category.id)}
                          className="absolute -top-2 -right-2 p-1.5 text-text-secondary 
                                     hover:text-text-primary hover:bg-accent rounded-full 
                                     opacity-0 group-hover:opacity-100 transition-opacity 
                                     bg-primary"
                          title="Delete category"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
                
                {showCategoryInput ? (
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Category name"
                      className="px-3 py-2 bg-secondary border border-accent rounded-md text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddCategory()
                        if (e.key === 'Escape') {
                          setShowCategoryInput(false)
                          setNewCategoryName('')
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
                      }}
                      className="px-3 py-2 bg-secondary text-text-primary rounded-md hover:bg-accent"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCategoryInput(true)}
                    className="px-4 py-2 rounded-md bg-secondary text-text-primary hover:bg-accent"
                  >
                    + Add Category
                  </button>
                )}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <div className="bg-primary rounded-lg shadow p-6">
          <form onSubmit={handleAddTask} className="mb-6 flex gap-2">
            <input
              type="text"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              placeholder="Add a new task..."
              className="flex-1 p-2 bg-secondary border border-accent rounded-md text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <select
              value={selectedCategory === 'overview' ? '' : selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="p-2 border border-accent rounded-md bg-secondary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              required
            >
              <option value="" disabled>Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={newTaskDate}
              onChange={(e) => setNewTaskDate(e.target.value)}
              className="p-2 border border-accent rounded-md bg-secondary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              type="submit"
              disabled={!selectedCategory || selectedCategory === 'overview'}
              className="bg-accent text-text-primary px-4 py-2 rounded-md hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
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
            />
            <TaskList
              tasks={completedTasks}
              onUpdate={fetchTasks}
              title="Completed Tasks"
              defaultCollapsed
              onDeleteTask={handleDeleteTask}
              categories={categories}
            />
          </div>
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
}: {
  tasks: Task[]
  onUpdate: () => void
  title: string
  defaultCollapsed?: boolean
  onDeleteTask: (taskId: string) => void
  categories: Category[]
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [editingTask, setEditingTask] = useState<string | null>(null)
  const [editedTaskName, setEditedTaskName] = useState('')
  const [editedTaskDate, setEditedTaskDate] = useState('')

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)

      if (error) throw error
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
    <div className="border rounded-md p-4">
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
              className="flex items-center justify-between p-2 hover:bg-secondary rounded-md"
            >
              <div className="flex items-center space-x-2 flex-grow">
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={(e) =>
                    handleTaskUpdate(task.id, { completed: e.target.checked })
                  }
                  className="h-4 w-4 bg-secondary border-accent"
                />
                {editingTask === task.id ? (
                  <div className="flex space-x-2 flex-grow">
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
                    <span className={task.completed ? 'line-through text-text-secondary' : 'text-text-primary'}>
                      {task.name}
                    </span>
                    <span className="text-sm text-text-secondary">{task.date}</span>
                    <span className="text-xs px-2 py-1 bg-secondary rounded-full text-text-secondary">
                      {getCategoryName(task.category_id)}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {!editingTask && (
                  <button
                    onClick={() => startEditing(task)}
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
                  onClick={() =>
                    handleTaskUpdate(task.id, { favorited: !task.favorited })
                  }
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
                  onClick={() => onDeleteTask(task.id)}
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