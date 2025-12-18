import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOrCreateAppUserId, requireSessionUser } from '@/lib/auth-helpers'
import * as XLSX from 'xlsx'

export async function GET() {
  try {
    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)

    // Get user's categories
    const { data: memberRows, error: membersError } = await supabaseAdmin
      .from('category_members')
      .select('category_id')
      .eq('user_id', appUserId)

    if (membersError) throw membersError
    const categoryIds = (memberRows || []).map((r: any) => r.category_id)

    if (categoryIds.length === 0) {
      return NextResponse.json({ error: 'No categories found to export' }, { status: 404 })
    }

    // Fetch categories (including archived ones for backup)
    const { data: categories, error: catsError } = await supabaseAdmin
      .from('categories')
      .select('id, name, archived')
      .in('id', categoryIds)
      .order('sort_order', { ascending: true })

    if (catsError) throw catsError

    // Fetch all tasks for these categories
    const { data: tasks, error: tasksError } = await supabaseAdmin
      .from('tasks')
      .select('category_id, name, date, completed, favorited')
      .in('category_id', categoryIds)
      .eq('user_id', appUserId)

    if (tasksError) throw tasksError

    // Create maps for category info
    const categoryMap = new Map(categories?.map(c => [c.id, c.name]) || [])
    const categoryArchivedMap = new Map(categories?.map(c => [c.id, c.archived]) || [])

    // Format data for Excel export (including Archived column)
    const excelData = (tasks || []).map(task => ({
      Category: categoryMap.get(task.category_id) || 'Unknown',
      Task: task.name,
      Date: task.date,
      Favorite: task.favorited ? 'Yes' : 'No',
      Status: task.completed ? 'Completed' : 'Active',
      Archived: categoryArchivedMap.get(task.category_id) ? 'Yes' : 'No'
    }))

    // Create workbook
    const worksheet = XLSX.utils.json_to_sheet(excelData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tasks')

    // Generate buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // Generate filename with current date
    const date = new Date().toISOString().split('T')[0]
    const filename = `backup-${user.email?.split('@')[0] || 'user'}-${date}.xlsx`

    // Return the file
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })

  } catch (e: any) {
    console.error('GET /api/backup/export error:', e)
    return NextResponse.json({ 
      error: e.message 
    }, { 
      status: e.message === 'Unauthorized' ? 401 : 500 
    })
  }
}

