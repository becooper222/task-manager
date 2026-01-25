import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireSessionUser, getOrCreateAppUserId } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)

    const { data, error } = await supabaseAdmin
      .from('github_connections')
      .select('github_username')
      .eq('user_id', appUserId)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      connected: !!data,
      username: data?.github_username || null,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
