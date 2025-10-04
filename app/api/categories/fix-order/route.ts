import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOrCreateAppUserId, requireSessionUser } from '@/lib/auth-helpers'

/**
 * GET endpoint to check and fix category sort_order values
 * This ensures all user's categories have sequential sort_order (0, 1, 2, ...)
 */
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
      return NextResponse.json({ 
        message: 'No categories found',
        fixed: 0,
        categories: []
      })
    }

    // Fetch categories with current sort_order
    const { data: categories, error: catsError } = await supabaseAdmin
      .from('categories')
      .select('id, name, sort_order')
      .in('id', categoryIds)
      .order('sort_order', { ascending: true })

    if (catsError) throw catsError

    // Check if any categories have duplicate or missing sort_order
    const currentOrders = (categories || []).map(c => c.sort_order)
    const hasDuplicates = currentOrders.length !== new Set(currentOrders).size
    const hasNulls = currentOrders.some(o => o === null || o === undefined)
    
    // Re-assign sequential sort_order values
    const updates = (categories || []).map((category, index) => ({
      id: category.id,
      sort_order: index
    }))

    // Update all categories with new sort_order (update each one individually)
    if (updates.length > 0) {
      for (const update of updates) {
        const { error: updateError } = await supabaseAdmin
          .from('categories')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id)

        if (updateError) throw updateError
      }
    }

    return NextResponse.json({
      message: `Fixed ${updates.length} categories`,
      fixed: updates.length,
      hadIssues: hasDuplicates || hasNulls,
      categories: updates.map((u, idx) => ({
        id: u.id,
        name: categories!.find(c => c.id === u.id)?.name,
        oldOrder: categories!.find(c => c.id === u.id)?.sort_order,
        newOrder: idx
      }))
    })

  } catch (e: any) {
    console.error('GET /api/categories/fix-order error:', e)
    return NextResponse.json({ 
      error: e.message 
    }, { 
      status: e.message === 'Unauthorized' ? 401 : 500 
    })
  }
}

