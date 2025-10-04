import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOrCreateAppUserId, requireSessionUser } from '@/lib/auth-helpers'
import { getUserRoleForCategory, canAdmin } from '@/lib/permissions'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const categoryId = params.id
    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)
    
    // Check if user has access to this category
    const requesterRole = await getUserRoleForCategory(appUserId, categoryId)
    if (!requesterRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Fetch all members of this category with their details
    const { data: members, error } = await supabaseAdmin
      .from('category_members')
      .select(`
        role,
        user_id,
        app_users!inner(email, auth0_sub)
      `)
      .eq('category_id', categoryId)
    
    if (error) throw error

    // Transform the data to a cleaner format
    const memberList = members.map((m: any) => ({
      user_id: m.user_id,
      email: m.app_users.email,
      role: m.role,
      is_you: m.user_id === appUserId
    }))

    return NextResponse.json({ members: memberList, your_role: requesterRole })
  } catch (e: any) {
    console.error('GET /api/categories/[id]/members error:', e)
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const categoryId = params.id
    const { email, role } = await request.json()
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })
    const roleValue = role || 'editor'
    if (!['owner', 'editor', 'viewer'].includes(roleValue)) {
      return NextResponse.json({ error: 'invalid role' }, { status: 400 })
    }

    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)
    const requesterRole = await getUserRoleForCategory(appUserId, categoryId)
    if (!canAdmin(requesterRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: member, error: findErr } = await supabaseAdmin
      .from('app_users')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (findErr) throw findErr
    if (!member) return NextResponse.json({ error: 'user not found (have they signed in?)' }, { status: 404 })

    const { error: upsertErr } = await supabaseAdmin
      .from('category_members')
      .upsert({ category_id: categoryId, user_id: member.id, role: roleValue }, { onConflict: 'category_id,user_id' })
    if (upsertErr) throw upsertErr
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('POST /api/categories/[id]/members error:', e)
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const categoryId = params.id
    const { email } = await request.json()
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)
    const requesterRole = await getUserRoleForCategory(appUserId, categoryId)
    if (!canAdmin(requesterRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: member, error: findErr } = await supabaseAdmin
      .from('app_users')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (findErr) throw findErr
    if (!member) return NextResponse.json({ success: true })

    const { error: delErr } = await supabaseAdmin
      .from('category_members')
      .delete()
      .eq('category_id', categoryId)
      .eq('user_id', member.id)
    if (delErr) throw delErr
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('DELETE /api/categories/[id]/members error:', e)
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}


