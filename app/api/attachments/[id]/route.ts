import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOrCreateAppUserId, requireSessionUser } from '@/lib/auth-helpers'
import { getUserRoleForCategory, canEdit, canAdmin } from '@/lib/permissions'
import { deleteTaskAttachment, getAttachmentUrl } from '@/lib/file-helpers'
import {
  createChangelogEntry,
  generateAttachmentDescription,
} from '@/lib/changelog-helpers'

export const dynamic = 'force-dynamic'

// GET /api/attachments/[id] - Get signed URL for downloading attachment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: attachmentId } = await params
    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)

    // Get attachment with task info
    const { data: attachment, error: attachErr } = await supabaseAdmin
      .from('task_attachments')
      .select('*, tasks!inner(category_id)')
      .eq('id', attachmentId)
      .single()

    if (attachErr || !attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Check if user has access to the category
    const role = await getUserRoleForCategory(appUserId, attachment.tasks.category_id)
    if (!role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Generate signed URL
    const signedUrl = await getAttachmentUrl(attachment.storage_path)

    if (!signedUrl) {
      return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 })
    }

    return NextResponse.json({ url: signedUrl })
  } catch (e: unknown) {
    console.error('Get attachment URL error:', e)
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/attachments/[id] - Delete attachment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: attachmentId } = await params
    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)

    // Get attachment with task info
    const { data: attachment, error: attachErr } = await supabaseAdmin
      .from('task_attachments')
      .select('*, tasks!inner(id, category_id, name)')
      .eq('id', attachmentId)
      .single()

    if (attachErr || !attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Check if user can delete (must be uploader, editor, or owner)
    const role = await getUserRoleForCategory(appUserId, attachment.tasks.category_id)
    const isUploader = attachment.uploaded_by === appUserId
    const canDelete = isUploader || canEdit(role) || canAdmin(role)

    if (!canDelete) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete attachment
    const result = await deleteTaskAttachment(attachmentId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Create changelog entry
    await createChangelogEntry({
      eventType: 'attachment_deleted',
      entityType: 'attachment',
      entityId: attachmentId,
      userId: appUserId,
      categoryId: attachment.tasks.category_id,
      description: generateAttachmentDescription(
        'deleted',
        attachment.file_name,
        attachment.tasks.name,
        user.email || undefined
      ),
      metadata: {
        file_name: attachment.file_name,
        task_id: attachment.task_id,
        task_name: attachment.tasks.name,
      },
    })

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error('Delete attachment error:', e)
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
