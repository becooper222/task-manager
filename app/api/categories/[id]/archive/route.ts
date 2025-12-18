import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOrCreateAppUserId, requireSessionUser } from '@/lib/auth-helpers'
import { getUserRoleForCategory, canAdmin } from '@/lib/permissions'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const body = await request.json()
    const archived: boolean = body?.archived

    if (typeof archived !== 'boolean') {
      return NextResponse.json({ error: 'Invalid archived value' }, { status: 400 })
    }

    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)

    const role = await getUserRoleForCategory(appUserId, id)
    if (!canAdmin(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: category, error } = await supabaseAdmin
      .from('categories')
      .update({ archived, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, name, sort_order, archived')
      .single()

    if (error) throw error

    return NextResponse.json(category)
  } catch (e: any) {
    console.error('PUT /api/categories/[id]/archive error:', e)
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}

