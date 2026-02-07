import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOrCreateAppUserId, requireSessionUser } from '@/lib/auth-helpers'
import { getUserRoleForCategory } from '@/lib/permissions'
import { getCategoryChangelog, getUserChangelog, getRecentChangelog } from '@/lib/changelog-helpers'

export const dynamic = 'force-dynamic'

// GET /api/changelog?category_id=xxx or ?user=true or ?recent=true
export async function GET(request: NextRequest) {
  try {
    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('category_id')
    const fetchUser = searchParams.get('user') === 'true'
    const fetchRecent = searchParams.get('recent') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    if (categoryId) {
      // Verify user has access to category
      const role = await getUserRoleForCategory(appUserId, categoryId)
      if (!role) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const entries = await getCategoryChangelog(categoryId, limit)
      return NextResponse.json({ entries })
    } else if (fetchUser) {
      const entries = await getUserChangelog(appUserId, limit)
      return NextResponse.json({ entries })
    } else if (fetchRecent) {
      // Get recent changes across all categories user has access to
      const { data: memberships } = await supabaseAdmin
        .from('category_members')
        .select('category_id')
        .eq('user_id', appUserId)

      const categoryIds = memberships?.map((m) => m.category_id) || []

      const { data: entries } = await supabaseAdmin
        .from('task_manager_changelog')
        .select('*')
        .in('category_id', categoryIds)
        .order('inserted_at', { ascending: false })
        .limit(limit)

      return NextResponse.json({ entries: entries || [] })
    } else {
      return NextResponse.json(
        { error: 'Must specify category_id, user=true, or recent=true' },
        { status: 400 }
      )
    }
  } catch (e: unknown) {
    console.error('Get changelog error:', e)
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
