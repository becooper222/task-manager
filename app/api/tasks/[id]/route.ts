import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOrCreateAppUserId, requireSessionUser } from '@/lib/auth-helpers'
import { getUserRoleForCategory, canEdit } from '@/lib/permissions'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const body = await request.json()

    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)

    // fetch task's category to check permission
    const { data: task, error: taskErr } = await supabaseAdmin
      .from('tasks')
      .select('id, category_id')
      .eq('id', id)
      .single()
    if (taskErr) throw taskErr

    const role = await getUserRoleForCategory(appUserId, task.category_id)
    if (!canEdit(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .update(body)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (e: any) {
    console.error('PUT /api/tasks/[id] error:', e)
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)

    const { data: task, error: taskErr } = await supabaseAdmin
      .from('tasks')
      .select('id, category_id')
      .eq('id', id)
      .single()
    if (taskErr) throw taskErr

    const role = await getUserRoleForCategory(appUserId, task.category_id)
    if (!canEdit(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabaseAdmin.from('tasks').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('DELETE /api/tasks/[id] error:', e)
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}


