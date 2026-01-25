import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireSessionUser, getOrCreateAppUserId } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)

    await supabaseAdmin.from('github_connections').delete().eq('user_id', appUserId)

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
