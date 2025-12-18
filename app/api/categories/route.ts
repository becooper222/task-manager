import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOrCreateAppUserId, requireSessionUser } from '@/lib/auth-helpers'

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)

    // Check for query params
    const { searchParams } = new URL(request.url)
    const includeArchived = searchParams.get('include_archived') === 'true'

    // Get user's category memberships with archived status
    let memberQuery = supabaseAdmin
      .from('category_members')
      .select('category_id, archived')
      .eq('user_id', appUserId)
    
    if (!includeArchived) {
      memberQuery = memberQuery.eq('archived', false)
    }

    const { data: memberRows, error: membersError } = await memberQuery

    if (membersError) throw membersError
    
    if (!memberRows || memberRows.length === 0) {
      return NextResponse.json([])
    }

    const categoryIds = memberRows.map((r: any) => r.category_id)
    const archivedMap = new Map(memberRows.map((r: any) => [r.category_id, r.archived]))

    // Get categories
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
          return { ...cat, archived: archivedMap.get(cat.id) || false, member_count: 1 }
        }
        
        return { ...cat, archived: archivedMap.get(cat.id) || false, member_count: members?.length || 1 }
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

    // Get user's archived category memberships
    const { data: archivedMemberRows, error: membersError } = await supabaseAdmin
      .from('category_members')
      .select('category_id')
      .eq('user_id', appUserId)
      .eq('archived', true)

    if (membersError) throw membersError
    const archivedCategoryIds = (archivedMemberRows || []).map((r: any) => r.category_id)

    // Check if there's an archived category with the same name
    if (archivedCategoryIds.length > 0) {
      const { data: existingArchived, error: archivedCheckError } = await supabaseAdmin
        .from('categories')
        .select('id, name')
        .in('id', archivedCategoryIds)
        .ilike('name', name)
        .single()

      if (archivedCheckError && archivedCheckError.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is expected
        throw archivedCheckError
      }

      if (existingArchived) {
        return NextResponse.json(
          { error: 'A category with this name already exists in your archived categories. Please restore it or use a different name.' },
          { status: 409 }
        )
      }
    }

    // Get all user's categories to determine next sort order
    const { data: allMemberRows, error: allMembersError } = await supabaseAdmin
      .from('category_members')
      .select('category_id')
      .eq('user_id', appUserId)

    if (allMembersError) throw allMembersError
    const allCategoryIds = (allMemberRows || []).map((r: any) => r.category_id)

    // Determine next sort order from user's categories
    let nextOrder = 0
    if (allCategoryIds.length > 0) {
      const { data: cats, error: catsError } = await supabaseAdmin
        .from('categories')
        .select('sort_order')
        .in('id', allCategoryIds)
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
      .insert({ category_id: category.id, user_id: appUserId, role: 'owner', archived: false })

    if (memberErr) throw memberErr

    return NextResponse.json({ ...category, archived: false })
  } catch (e: any) {
    console.error('POST /api/categories error:', e)
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}
