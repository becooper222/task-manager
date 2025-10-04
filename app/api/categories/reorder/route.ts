import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOrCreateAppUserId, requireSessionUser } from '@/lib/auth-helpers'

export async function PUT(request: Request) {
  try {
    const { items } = await request.json()
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid items' }, { status: 400 })
    }

    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)

    // Filter to only categories where user is a member
    const ids: string[] = items.map((i: any) => i.id)
    const { data: memberCats, error: memErr } = await supabaseAdmin
      .from('category_members')
      .select('category_id')
      .eq('user_id', appUserId)
      .in('category_id', ids)

    if (memErr) throw memErr
    const allowedIds = new Set((memberCats || []).map((r: any) => r.category_id))

    const updates = items
      .filter((i: any) => allowedIds.has(i.id) && Number.isInteger(i.sort_order))
      .map((i: any) => ({ id: i.id, sort_order: i.sort_order }))

    if (updates.length === 0) return NextResponse.json({ updated: 0 })

    // Update each category's sort_order individually
    for (const update of updates) {
      const { error: upErr } = await supabaseAdmin
        .from('categories')
        .update({ sort_order: update.sort_order })
        .eq('id', update.id)
      
      if (upErr) throw upErr
    }

    return NextResponse.json({ updated: updates.length })
  } catch (e: any) {
    console.error('PUT /api/categories/reorder error:', e)
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}


