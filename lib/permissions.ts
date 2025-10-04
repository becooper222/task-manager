import { supabaseAdmin } from './supabase-admin'

export async function getUserRoleForCategory(appUserId: string, categoryId: string) {
  const { data, error } = await supabaseAdmin
    .from('category_members')
    .select('role')
    .eq('user_id', appUserId)
    .eq('category_id', categoryId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.role as 'owner' | 'editor' | 'viewer' | undefined
}

export function canEdit(role: string | undefined) {
  return role === 'owner' || role === 'editor'
}

export function canAdmin(role: string | undefined) {
  return role === 'owner'
}


