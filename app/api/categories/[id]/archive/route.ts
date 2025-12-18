import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOrCreateAppUserId, requireSessionUser } from '@/lib/auth-helpers'

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

    // Check if user is a member of this category
    const { data: membership, error: memberError } = await supabaseAdmin
      .from('category_members')
      .select('role')
      .eq('category_id', id)
      .eq('user_id', appUserId)
      .single()

    if (memberError || !membership) {
      return NextResponse.json({ error: 'Category not found or access denied' }, { status: 404 })
    }

    // Update the archived status for this user's membership only
    const { error } = await supabaseAdmin
      .from('category_members')
      .update({ archived, updated_at: new Date().toISOString() })
      .eq('category_id', id)
      .eq('user_id', appUserId)

    if (error) throw error

    // Get the updated category info
    const { data: category, error: catError } = await supabaseAdmin
      .from('categories')
      .select('id, name, sort_order')
      .eq('id', id)
      .single()

    if (catError) throw catError

    return NextResponse.json({ ...category, archived })
  } catch (e: any) {
    console.error('PUT /api/categories/[id]/archive error:', e)
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}
