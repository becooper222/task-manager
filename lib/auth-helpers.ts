import { getSession } from '@auth0/nextjs-auth0'
import { supabaseAdmin } from './supabase-admin'

export async function requireSessionUser() {
  const session = await getSession()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  return session.user
}

export async function getOrCreateAppUserId(auth0Sub: string, email: string | null) {
  const { data: existing, error: selectError } = await supabaseAdmin
    .from('app_users')
    .select('id')
    .eq('auth0_sub', auth0Sub)
    .maybeSingle()

  if (selectError) {
    throw new Error(selectError.message)
  }
  if (existing) return existing.id as string

  const { data: created, error: insertError } = await supabaseAdmin
    .from('app_users')
    .insert({ auth0_sub: auth0Sub, email })
    .select('id')
    .single()

  if (insertError) {
    throw new Error(insertError.message)
  }
  return created.id as string
}


