import { getSession } from '@auth0/nextjs-auth0'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const auth0Sub = session.user.sub
  const email = session.user.email || null

  // Ensure app_user exists
  const { data: existingUser, error: selectError } = await supabaseAdmin
    .from('app_users')
    .select('*')
    .eq('auth0_sub', auth0Sub)
    .maybeSingle()

  if (selectError) {
    return NextResponse.json({ error: selectError.message }, { status: 500 })
  }

  if (existingUser) {
    return NextResponse.json({ user: existingUser })
  }

  const { data: created, error: insertError } = await supabaseAdmin
    .from('app_users')
    .insert({ auth0_sub: auth0Sub, email })
    .select('*')
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ user: created })
}


