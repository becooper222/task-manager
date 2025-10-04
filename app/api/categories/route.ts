import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOrCreateAppUserId, requireSessionUser } from '@/lib/auth-helpers'

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

    if (categoryIds.length === 0) {
      return NextResponse.json([])
    }

    const { data: categories, error: catsError } = await supabaseAdmin
      .from('categories')
      .select('id, name, sort_order')
      .in('id', categoryIds)
      .order('sort_order', { ascending: true })

    if (catsError) throw catsError

    // Get member counts for each category
    const categoriesWithCounts = await Promise.all(
      (categories || []).map(async (cat: any) => {
        const { data: members, error: countError } = await supabaseAdmin
          .from('category_members')
          .select('user_id', { count: 'exact', head: false })
          .eq('category_id', cat.id)
        
        if (countError) {
          console.error('Error counting members:', countError)
          return { ...cat, member_count: 1 }
        }
        
        return { ...cat, member_count: members?.length || 1 }
      })
    )

    return NextResponse.json(categoriesWithCounts)
  } catch (e: any) {
    console.error('GET /api/categories error:', e)
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const name: string = body?.name
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
    }

    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)

    // Determine next sort order from user's categories
    const { data: memberRows, error: membersError } = await supabaseAdmin
      .from('category_members')
      .select('category_id')
      .eq('user_id', appUserId)

    if (membersError) throw membersError
    const categoryIds = (memberRows || []).map((r: any) => r.category_id)
    let nextOrder = 0
    if (categoryIds.length > 0) {
      const { data: cats, error: catsError } = await supabaseAdmin
        .from('categories')
        .select('sort_order')
        .in('id', categoryIds)
      if (catsError) throw catsError
      const maxSort = Math.max(-1, ...(cats || []).map((c: any) => c.sort_order))
      nextOrder = maxSort + 1
    }

    const { data: category, error: insertCatErr } = await supabaseAdmin
      .from('categories')
      .insert({ name, sort_order: nextOrder })
      .select('id, name, sort_order')
      .single()

    if (insertCatErr) throw insertCatErr

    const { error: memberErr } = await supabaseAdmin
      .from('category_members')
      .insert({ category_id: category.id, user_id: appUserId, role: 'owner' })

    if (memberErr) throw memberErr

    return NextResponse.json(category)
  } catch (e: any) {
    console.error('POST /api/categories error:', e)
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}


