import { supabaseAdmin } from './supabase-admin'

const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'image/gif',
  // Documents
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/msword', // doc
  'text/markdown',
  'text/plain',
  'text/html',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
  'application/gzip',
  'application/x-gzip',
  'application/x-tar',
  // Code
  'text/javascript',
  'application/javascript',
  'text/x-python',
  'application/json',
  'text/css',
]

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size exceeds 50MB limit' }
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: `File type ${file.type} is not allowed` }
  }

  return { valid: true }
}

export async function uploadTaskAttachment(
  taskId: string,
  userId: string,
  file: File
): Promise<{ success: boolean; attachment?: unknown; error?: string }> {
  try {
    const validation = validateFile(file)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    // Create unique storage path
    const timestamp = Date.now()
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `task-attachments/${taskId}/${timestamp}-${sanitizedFileName}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('task-attachments')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return { success: false, error: 'Failed to upload file to storage' }
    }

    // Create database record
    const { data: attachment, error: dbError } = await supabaseAdmin
      .from('task_attachments')
      .insert({
        task_id: taskId,
        uploaded_by: userId,
        file_name: file.name,
        file_type: file.type.split('/')[1] || 'unknown',
        file_size: file.size,
        storage_path: storagePath,
        mime_type: file.type,
      })
      .select()
      .single()

    if (dbError) {
      // Cleanup storage if DB insert fails
      await supabaseAdmin.storage.from('task-attachments').remove([storagePath])
      console.error('Database insert error:', dbError)
      return { success: false, error: 'Failed to create attachment record' }
    }

    return { success: true, attachment }
  } catch (error) {
    console.error('Upload error:', error)
    return { success: false, error: 'Upload failed' }
  }
}

export async function deleteTaskAttachment(
  attachmentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get attachment info
    const { data: attachment, error: fetchError } = await supabaseAdmin
      .from('task_attachments')
      .select('storage_path')
      .eq('id', attachmentId)
      .single()

    if (fetchError || !attachment) {
      return { success: false, error: 'Attachment not found' }
    }

    // Delete from storage
    const { error: storageError } = await supabaseAdmin.storage
      .from('task-attachments')
      .remove([attachment.storage_path])

    if (storageError) {
      console.error('Storage deletion error:', storageError)
      // Continue with DB deletion even if storage fails
    }

    // Delete database record
    const { error: dbError } = await supabaseAdmin
      .from('task_attachments')
      .delete()
      .eq('id', attachmentId)

    if (dbError) {
      console.error('Database deletion error:', dbError)
      return { success: false, error: 'Failed to delete attachment record' }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete error:', error)
    return { success: false, error: 'Delete failed' }
  }
}

export async function getAttachmentUrl(
  storagePath: string,
  expiresIn: number = 3600
): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from('task-attachments')
      .createSignedUrl(storagePath, expiresIn)

    if (error || !data) {
      console.error('Error creating signed URL:', error)
      return null
    }

    return data.signedUrl
  } catch (error) {
    console.error('Get URL error:', error)
    return null
  }
}

export async function getTaskAttachments(taskId: string) {
  const { data, error } = await supabaseAdmin
    .from('task_attachments')
    .select('*')
    .eq('task_id', taskId)
    .order('inserted_at', { ascending: false })

  if (error) {
    console.error('Error fetching attachments:', error)
    return []
  }

  return data || []
}
