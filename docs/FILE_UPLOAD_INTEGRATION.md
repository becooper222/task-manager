# File Upload Integration Guide

Quick reference for developers working with the file upload system.

## Quick Start

### 1. Upload a File

```typescript
const formData = new FormData()
formData.append('file', file)

const response = await fetch(`/api/tasks/${taskId}/attachments`, {
  method: 'POST',
  body: formData,
})

const { attachment } = await response.json()
```

### 2. List Attachments

```typescript
const response = await fetch(`/api/tasks/${taskId}/attachments`)
const { attachments } = await response.json()
```

### 3. Download an Attachment

```typescript
const response = await fetch(`/api/attachments/${attachmentId}`)
const { url } = await response.json()
window.open(url, '_blank') // Opens the signed URL
```

### 4. Delete an Attachment

```typescript
await fetch(`/api/attachments/${attachmentId}`, {
  method: 'DELETE',
})
```

## API Endpoints

### Upload Attachment
```
POST /api/tasks/:taskId/attachments
Content-Type: multipart/form-data
Body: { file: File }

Response:
{
  attachment: {
    id: string,
    task_id: string,
    file_name: string,
    file_size: number,
    mime_type: string,
    ...
  }
}
```

### List Attachments
```
GET /api/tasks/:taskId/attachments

Response:
{
  attachments: TaskAttachment[]
}
```

### Get Download URL
```
GET /api/attachments/:attachmentId

Response:
{
  url: string  // Signed URL valid for 1 hour
}
```

### Delete Attachment
```
DELETE /api/attachments/:attachmentId

Response:
{
  success: true
}
```

### Get Changelog
```
GET /api/changelog?category_id=xxx
GET /api/changelog?user=true
GET /api/changelog?recent=true&limit=50

Response:
{
  entries: ChangelogEntry[]
}
```

## Helper Functions

### File Validation

```typescript
import { validateFile } from '@/lib/file-helpers'

const result = validateFile(file)
if (!result.valid) {
  console.error(result.error)
}
```

### Upload Helper

```typescript
import { uploadTaskAttachment } from '@/lib/file-helpers'

const result = await uploadTaskAttachment(taskId, userId, file)
if (result.success) {
  console.log(result.attachment)
}
```

### Changelog Entry

```typescript
import { createChangelogEntry } from '@/lib/changelog-helpers'

await createChangelogEntry({
  eventType: 'task_created',
  entityType: 'task',
  entityId: taskId,
  userId: userId,
  categoryId: categoryId,
  description: 'User created task "Fix bug"',
  metadata: { task_name: 'Fix bug' }
})
```

## TypeScript Types

```typescript
type TaskAttachment = {
  id: string
  task_id: string
  uploaded_by: string
  file_name: string
  file_type: string
  file_size: number
  storage_path: string
  mime_type: string | null
  inserted_at: string
  updated_at: string
}

type ChangelogEntry = {
  id: string
  event_type: ChangelogEventType
  entity_type: 'task' | 'category' | 'attachment' | 'claude_code_run' | 'member'
  entity_id: string
  user_id: string
  category_id: string | null
  description: string
  metadata: Record<string, unknown> | null
  inserted_at: string
}
```

## React Components

### TaskAttachmentsModal

```tsx
import TaskAttachmentsModal from '@/app/dashboard/TaskAttachmentsModal'

<TaskAttachmentsModal
  taskId={taskId}
  taskName={taskName}
  onClose={() => setShowModal(false)}
/>
```

### ChangelogModal

```tsx
import ChangelogModal from '@/app/dashboard/ChangelogModal'

<ChangelogModal
  categoryId={categoryId}
  categoryName={categoryName}
  onClose={() => setShowModal(false)}
/>
```

## Security Considerations

1. **File Type Validation:** Only allowed MIME types can be uploaded
2. **File Size Limit:** 50MB maximum per file
3. **Access Control:** Users must have access to the category
4. **Signed URLs:** Download URLs expire after 1 hour
5. **Storage Policies:** RLS enforces category membership

## Database Schema

### task_attachments

```sql
CREATE TABLE task_attachments (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES app_users(id),
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT,
  mime_type TEXT,
  inserted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

### task_manager_changelog

```sql
CREATE TABLE task_manager_changelog (
  id UUID PRIMARY KEY,
  event_type TEXT,
  entity_type TEXT,
  entity_id UUID,
  user_id UUID REFERENCES app_users(id),
  category_id UUID REFERENCES categories(id),
  description TEXT,
  metadata JSONB,
  inserted_at TIMESTAMPTZ
)
```

## Troubleshooting

### Upload Fails

1. Check file size (must be < 50MB)
2. Verify file type is allowed
3. Confirm user has edit permissions on category
4. Check Supabase storage bucket exists

### Download URL Doesn't Work

1. Signed URLs expire after 1 hour - generate a new one
2. Verify file exists in storage
3. Check user has access to the category

### Changelog Not Recording

1. Verify changelog entry creation is called
2. Check user_id and category_id are valid UUIDs
3. Confirm description is not null/empty

## Performance Tips

1. **Lazy Load Attachments:** Only fetch when modal opens
2. **Paginate Changelog:** Use limit parameter for large datasets
3. **Cache Signed URLs:** Reuse URLs within the 1-hour window
4. **Optimize Images:** Consider resizing large images before upload

## Testing

```typescript
// Example test for file upload
describe('File Upload', () => {
  it('should upload a valid file', async () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`/api/tasks/${taskId}/attachments`, {
      method: 'POST',
      body: formData,
    })

    expect(response.ok).toBe(true)
    const { attachment } = await response.json()
    expect(attachment.file_name).toBe('test.txt')
  })
})
```

## Migration Commands

```bash
# Run migrations
supabase db push

# Or manually apply
psql $DATABASE_URL -f supabase/migrations/20260207_task_attachments.sql
psql $DATABASE_URL -f supabase/migrations/20260207_storage_bucket.sql
```

## Common Patterns

### Upload with Progress

```typescript
const xhr = new XMLHttpRequest()
xhr.upload.addEventListener('progress', (e) => {
  const percent = (e.loaded / e.total) * 100
  console.log(`Upload progress: ${percent}%`)
})

xhr.open('POST', `/api/tasks/${taskId}/attachments`)
xhr.send(formData)
```

### Batch Download

```typescript
const downloadAll = async (attachments: TaskAttachment[]) => {
  for (const attachment of attachments) {
    const response = await fetch(`/api/attachments/${attachment.id}`)
    const { url } = await response.json()
    window.open(url, '_blank')
  }
}
```

### Filter by File Type

```typescript
const images = attachments.filter(a =>
  a.mime_type?.startsWith('image/')
)

const documents = attachments.filter(a =>
  a.mime_type?.includes('pdf') ||
  a.mime_type?.includes('document')
)
```

## Support

For issues or questions:
1. Check the main documentation: `CHANGELOG_FEATURE_SUMMARY.md`
2. Review the code comments in `lib/file-helpers.ts`
3. Examine the API route implementations
4. Test with the UI components in the dashboard
