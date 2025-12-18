import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOrCreateAppUserId, requireSessionUser } from '@/lib/auth-helpers'
import * as XLSX from 'xlsx'

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)

    // Parse the multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Read the file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })

    // Assume the first sheet contains the data
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

    if (jsonData.length === 0) {
      return NextResponse.json({ error: 'No data found in file' }, { status: 400 })
    }

    // Get user's existing categories to find max sort_order
    const { data: memberRows } = await supabaseAdmin
      .from('category_members')
      .select('category_id')
      .eq('user_id', appUserId)

    const categoryIds = (memberRows || []).map((r: any) => r.category_id)
    let maxSortOrder = -1

    if (categoryIds.length > 0) {
      const { data: cats } = await supabaseAdmin
        .from('categories')
        .select('sort_order')
        .in('id', categoryIds)
      
      if (cats && cats.length > 0) {
        maxSortOrder = Math.max(...cats.map((c: any) => c.sort_order))
      }
    }

    // Process data: Group tasks by category
    const categoryMap = new Map<string, { tasks: any[], archived: boolean }>()
    
    for (const row of jsonData) {
      // Expected columns: Category, Task, Date, Favorite, Status/Completed, Archived (or similar variations)
      const categoryName = row.Category || row.category || row.CATEGORY
      const taskName = row.Task || row.task || row.TASK || row.Name || row.name
      const taskDate = row.Date || row.date || row.DATE
      const favorite = row.Favorite || row.favorite || row.FAVORITE || row.Favorited || row.favorited
      // Check both Status and Completed columns
      const completedValue = row.Status || row.status || row.STATUS || 
                             row.Completed || row.completed || row.COMPLETED || 
                             row.Complete || row.complete
      const archivedValue = row.Archived || row.archived || row.ARCHIVED

      if (!categoryName || !taskName) {
        continue // Skip rows without required data
      }

      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, { tasks: [], archived: parseArchived(archivedValue) })
      }

      categoryMap.get(categoryName)!.tasks.push({
        name: taskName,
        date: taskDate ? formatDate(taskDate) : new Date().toISOString().split('T')[0],
        favorited: parseFavorite(favorite),
        completed: parseCompleted(completedValue),
      })
    }

    // Check for conflicts with existing archived categories
    const conflictingCategories: string[] = []
    if (categoryIds.length > 0) {
      const { data: existingArchivedCats } = await supabaseAdmin
        .from('categories')
        .select('name')
        .in('id', categoryIds)
        .eq('archived', true)

      const existingArchivedNames = new Set(
        (existingArchivedCats || []).map((c: any) => c.name.toLowerCase())
      )

      for (const categoryName of categoryMap.keys()) {
        if (existingArchivedNames.has(categoryName.toLowerCase())) {
          conflictingCategories.push(categoryName)
        }
      }
    }

    if (conflictingCategories.length > 0) {
      return NextResponse.json({
        error: `The following category names conflict with archived categories: ${conflictingCategories.join(', ')}. Please restore or delete the archived categories first.`,
        conflictingCategories,
      }, { status: 409 })
    }

    // Create categories and tasks
    const stats = {
      categoriesCreated: 0,
      tasksCreated: 0,
    }

    let currentSortOrder = maxSortOrder + 1

    for (const [categoryName, categoryData] of categoryMap.entries()) {
      // Create category with archived status from backup
      const { data: category, error: catError } = await supabaseAdmin
        .from('categories')
        .insert({ name: categoryName, sort_order: currentSortOrder, archived: categoryData.archived })
        .select('id')
        .single()

      if (catError) {
        console.error('Error creating category:', catError)
        continue
      }

      stats.categoriesCreated++
      currentSortOrder++

      // Add user as owner of the category
      await supabaseAdmin
        .from('category_members')
        .insert({ category_id: category.id, user_id: appUserId, role: 'owner' })

      // Create tasks
      const tasksToInsert = categoryData.tasks.map(task => ({
        category_id: category.id,
        user_id: appUserId,
        name: task.name,
        date: task.date,
        favorited: task.favorited,
        completed: task.completed,
      }))

      const { error: tasksError } = await supabaseAdmin
        .from('tasks')
        .insert(tasksToInsert)

      if (tasksError) {
        console.error('Error creating tasks:', tasksError)
        continue
      }

      stats.tasksCreated += categoryData.tasks.length
    }

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${stats.categoriesCreated} categories and ${stats.tasksCreated} tasks`,
      stats,
    })

  } catch (e: any) {
    console.error('POST /api/backup/import error:', e)
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}

// Helper function to parse favorite value
function parseFavorite(value: any): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim()
    return lower === 'true' || lower === 'yes' || lower === '1' || lower === 'y'
  }
  if (typeof value === 'number') return value === 1
  return false
}

// Helper function to parse completed value
function parseCompleted(value: any): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim()
    // Check for "completed" status values
    if (lower === 'completed' || lower === 'done' || lower === 'complete' || lower === 'finished') {
      return true
    }
    // Check for "active" status values
    if (lower === 'active' || lower === 'incomplete' || lower === 'pending' || lower === 'in progress') {
      return false
    }
    // Check for boolean-like values
    return lower === 'true' || lower === 'yes' || lower === '1' || lower === 'y'
  }
  if (typeof value === 'number') return value === 1
  return false
}

// Helper function to format date
function formatDate(value: any): string {
  if (!value) return new Date().toISOString().split('T')[0]
  
  // If it's an Excel date number
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
  }
  
  // If it's already a string, try to parse it
  if (typeof value === 'string') {
    try {
      const parsed = new Date(value)
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0]
      }
    } catch {
      // Fall through to default
    }
  }
  
  return new Date().toISOString().split('T')[0]
}

// Helper function to parse archived value
function parseArchived(value: any): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim()
    return lower === 'true' || lower === 'yes' || lower === '1' || lower === 'y'
  }
  if (typeof value === 'number') return value === 1
  return false
}

