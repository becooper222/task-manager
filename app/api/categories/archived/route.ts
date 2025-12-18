import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOrCreateAppUserId, requireSessionUser } from '@/lib/auth-helpers'

export async function GET() {
  try {
    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)

    // Get user's archived category memberships
    const { data: memberRows, error: membersError } = await supabaseAdmin
      .from('category_members')
      .select('category_id')
      .eq('user_id', appUserId)
      .eq('archived', true)

    if (membersError) throw membersError
    const categoryIds = (memberRows || []).map((r: any) => r.category_id)

    if (categoryIds.length === 0) {
      return NextResponse.json([])
    }

    // Get archived categories
    const { data: categories, error: catsError } = await supabaseAdmin
      .from('categories')
      .select('id, name, sort_order')
      .in('id', categoryIds)
      .order('sort_order', { ascending: true })

    if (catsError) throw catsError

    // Get task counts for each archived category
    const categoriesWithCounts = await Promise.all(
      (categories || []).map(async (cat: any) => {
        const { count, error: countError } = await supabaseAdmin
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('category_id', cat.id)

        if (countError) {
          console.error('Error counting tasks:', countError)
          return { ...cat, archived: true, task_count: 0 }
        }

        return { ...cat, archived: true, task_count: count || 0 }
      })
    )

    return NextResponse.json(categoriesWithCounts)
  } catch (e: any) {
    console.error('GET /api/categories/archived error:', e)
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}
