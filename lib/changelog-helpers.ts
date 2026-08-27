import { supabaseAdmin } from './supabase-admin'
import { ChangelogEventType, ChangelogEntry } from './types'

interface CreateChangelogParams {
  eventType: ChangelogEventType
  entityType: 'task' | 'category' | 'attachment' | 'claude_code_run' | 'member'
  entityId: string
  userId: string
  categoryId?: string
  description: string
  metadata?: Record<string, unknown>
}

export async function createChangelogEntry(
  params: CreateChangelogParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.from('task_manager_changelog').insert({
      event_type: params.eventType,
      entity_type: params.entityType,
      entity_id: params.entityId,
      user_id: params.userId,
      category_id: params.categoryId || null,
      description: params.description,
      metadata: params.metadata || null,
    })

    if (error) {
      console.error('Changelog insert error:', error)
      return { success: false, error: 'Failed to create changelog entry' }
    }

    return { success: true }
  } catch (error) {
    console.error('Changelog error:', error)
    return { success: false, error: 'Changelog creation failed' }
  }
}

export async function getCategoryChangelog(
  categoryId: string,
  limit: number = 50
): Promise<ChangelogEntry[]> {
  const { data, error } = await supabaseAdmin
    .from('task_manager_changelog')
    .select('*')
    .eq('category_id', categoryId)
    .order('inserted_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching changelog:', error)
    return []
  }

  return (data || []) as ChangelogEntry[]
}

export async function getUserChangelog(
  userId: string,
  limit: number = 50
): Promise<ChangelogEntry[]> {
  const { data, error } = await supabaseAdmin
    .from('task_manager_changelog')
    .select('*')
    .eq('user_id', userId)
    .order('inserted_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching user changelog:', error)
    return []
  }

  return (data || []) as ChangelogEntry[]
}

export async function getRecentChangelog(limit: number = 100): Promise<ChangelogEntry[]> {
  const { data, error } = await supabaseAdmin
    .from('task_manager_changelog')
    .select('*')
    .order('inserted_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching recent changelog:', error)
    return []
  }

  return (data || []) as ChangelogEntry[]
}

// Generate natural language descriptions
export function generateTaskDescription(
  action: 'created' | 'updated' | 'completed' | 'deleted',
  taskName: string,
  userEmail?: string
): string {
  const user = userEmail ? userEmail.split('@')[0] : 'Someone'

  switch (action) {
    case 'created':
      return `${user} created task "${taskName}"`
    case 'updated':
      return `${user} updated task "${taskName}"`
    case 'completed':
      return `${user} completed task "${taskName}"`
    case 'deleted':
      return `${user} deleted task "${taskName}"`
    default:
      return `${user} modified task "${taskName}"`
  }
}

export function generateAttachmentDescription(
  action: 'added' | 'deleted',
  fileName: string,
  taskName: string,
  userEmail?: string
): string {
  const user = userEmail ? userEmail.split('@')[0] : 'Someone'

  if (action === 'added') {
    return `${user} attached "${fileName}" to task "${taskName}"`
  } else {
    return `${user} removed attachment "${fileName}" from task "${taskName}"`
  }
}

export function generateCategoryDescription(
  action: 'created' | 'updated' | 'archived',
  categoryName: string,
  userEmail?: string
): string {
  const user = userEmail ? userEmail.split('@')[0] : 'Someone'

  switch (action) {
    case 'created':
      return `${user} created category "${categoryName}"`
    case 'updated':
      return `${user} updated category "${categoryName}"`
    case 'archived':
      return `${user} archived category "${categoryName}"`
    default:
      return `${user} modified category "${categoryName}"`
  }
}

export function generateClaudeCodeDescription(
  action: 'triggered' | 'completed',
  taskName: string,
  status?: string,
  userEmail?: string
): string {
  const user = userEmail ? userEmail.split('@')[0] : 'Someone'

  if (action === 'triggered') {
    return `${user} triggered Claude Code for task "${taskName}"`
  } else {
    return `Claude Code run for "${taskName}" ${status || 'completed'}`
  }
}

export function generateMemberDescription(
  action: 'added' | 'removed',
  memberEmail: string,
  role: string,
  categoryName: string,
  userEmail?: string
): string {
  const user = userEmail ? userEmail.split('@')[0] : 'Someone'
  const member = memberEmail.split('@')[0]

  if (action === 'added') {
    return `${user} added ${member} as ${role} to "${categoryName}"`
  } else {
    return `${user} removed ${member} from "${categoryName}"`
  }
}
