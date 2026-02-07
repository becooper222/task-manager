import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOrCreateAppUserId, requireSessionUser } from '@/lib/auth-helpers'
import { getUserRoleForCategory, canEdit } from '@/lib/permissions'
import { uploadTaskAttachment, getTaskAttachments } from '@/lib/file-helpers'
import {
  createChangelogEntry,
  generateAttachmentDescription,
} from '@/lib/changelog-helpers'

export const dynamic = 'force-dynamic'

// GET /api/tasks/[id]/attachments - List attachments for a task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params
    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)

    // Verify task exists and user has access
    const { data: task, error: taskErr } = await supabaseAdmin
      .from('tasks')
      .select('id, category_id, name')
      .eq('id', taskId)
      .single()

    if (taskErr || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const role = await getUserRoleForCategory(appUserId, task.category_id)
    if (!role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const attachments = await getTaskAttachments(taskId)
    return NextResponse.json({ attachments })
  } catch (e: unknown) {
    console.error('Get attachments error:', e)
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/tasks/[id]/attachments - Upload attachment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params
    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)

    // Verify task exists and user can edit
    const { data: task, error: taskErr } = await supabaseAdmin
      .from('tasks')
      .select('id, category_id, name')
      .eq('id', taskId)
      .single()

    if (taskErr || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const role = await getUserRoleForCategory(appUserId, task.category_id)
    if (!canEdit(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Upload file
    const result = await uploadTaskAttachment(taskId, appUserId, file)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Create changelog entry
    await createChangelogEntry({
      eventType: 'attachment_added',
      entityType: 'attachment',
      entityId: (result.attachment as { id: string }).id,
      userId: appUserId,
      categoryId: task.category_id,
      description: generateAttachmentDescription('added', file.name, task.name, user.email || undefined),
      metadata: {
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        task_id: taskId,
        task_name: task.name,
      },
    })

    return NextResponse.json({ attachment: result.attachment })
  } catch (e: unknown) {
    console.error('Upload attachment error:', e)
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
