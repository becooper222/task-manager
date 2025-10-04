import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOrCreateAppUserId, requireSessionUser } from '@/lib/auth-helpers'
import { getUserRoleForCategory, canEdit } from '@/lib/permissions'

export async function GET() {
  try {
    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)

    const { data: memberRows, error: membersError } = await supabaseAdmin
      .from('category_members')
      .select('category_id')
      .eq('user_id', appUserId)

    if (membersError) throw membersError
    const categoryIds = (memberRows || []).map((r: any) => r.category_id)
    if (categoryIds.length === 0) return NextResponse.json([])

    const { data: tasks, error: tasksError } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .in('category_id', categoryIds)
      .order('favorited', { ascending: false })
      .order('date', { ascending: true })

    if (tasksError) throw tasksError
    return NextResponse.json(tasks || [])
  } catch (e: any) {
    console.error('GET /api/tasks error:', e)
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, date, category_id } = body || {}
    if (!name || !date || !category_id) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)

    const role = await getUserRoleForCategory(appUserId, category_id)
    if (!canEdit(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .insert({ name, date, category_id, user_id: appUserId, completed: false, favorited: false })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (e: any) {
    console.error('POST /api/tasks error:', e)
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}


