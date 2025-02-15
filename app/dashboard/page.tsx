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
    if (!newTaskName.trim() || !user) return

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

  const filteredTasks = selectedCategory === 'overview' 
    ? tasks 
    : tasks.filter(task => task.category_id === selectedCategory)

  const completedTasks = filteredTasks.filter(task => task.completed)
  const incompleteTasks = filteredTasks.filter(task => !task.completed)

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="categories" direction="horizontal">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="flex space-x-2 mb-6 bg-white p-2 rounded-lg shadow overflow-x-auto"
              >
                <button
                  onClick={() => setSelectedCategory('overview')}
                  className={`px-4 py-2 rounded-md ${
                    selectedCategory === 'overview'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
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
                      <button
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        onClick={() => setSelectedCategory(category.id)}
                        className={`px-4 py-2 rounded-md ${
                          selectedCategory === category.id
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        {category.name}
                      </button>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleAddTask} className="mb-6 flex gap-2">
            <input
              type="text"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              placeholder="Add a new task..."
              className="flex-1 p-2 border rounded-md"
            />
            <input
              type="date"
              value={newTaskDate}
              onChange={(e) => setNewTaskDate(e.target.value)}
              className="p-2 border rounded-md"
            />
            <button
              type="submit"
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
            >
              Add Task
            </button>
          </form>

          <div className="space-y-4">
            <TaskList
              tasks={incompleteTasks}
              onUpdate={fetchTasks}
              title="Active Tasks"
            />
            <TaskList
              tasks={completedTasks}
              onUpdate={fetchTasks}
              title="Completed Tasks"
              defaultCollapsed
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
}: {
  tasks: Task[]
  onUpdate: () => void
  title: string
  defaultCollapsed?: boolean
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)

      if (error) throw error
      onUpdate()
    } catch (error) {
      console.error('Error updating task:', error)
    }
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
              className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md"
            >
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={(e) =>
                    handleTaskUpdate(task.id, { completed: e.target.checked })
                  }
                  className="h-4 w-4"
                />
                <span className={task.completed ? 'line-through text-gray-500' : ''}>
                  {task.name}
                </span>
                <span className="text-sm text-gray-500">{task.date}</span>
              </div>
              <button
                onClick={() =>
                  handleTaskUpdate(task.id, { favorited: !task.favorited })
                }
                className={`text-yellow-500 ${
                  task.favorited ? 'opacity-100' : 'opacity-50'
                }`}
              >
                ★
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 