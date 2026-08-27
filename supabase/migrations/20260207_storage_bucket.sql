-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for task attachments
-- Users can read files from tasks they have access to
CREATE POLICY "Users can read task attachments for accessible categories"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'task-attachments'
  AND EXISTS (
    SELECT 1 FROM task_attachments ta
    JOIN tasks t ON t.id = ta.task_id
    JOIN category_members cm ON cm.category_id = t.category_id
    WHERE storage.foldername(name)[1] = 'task-attachments'
    AND storage.foldername(name)[2] = ta.task_id::text
    AND cm.user_id = auth.uid()
  )
);

-- Users can upload files to tasks in categories they can edit
CREATE POLICY "Users can upload task attachments for editable categories"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'task-attachments'
  AND EXISTS (
    SELECT 1 FROM tasks t
    JOIN category_members cm ON cm.category_id = t.category_id
    WHERE storage.foldername(name)[2] = t.id::text
    AND cm.user_id = auth.uid()
    AND cm.role IN ('owner', 'editor')
  )
);

-- Users can delete their own uploads or if they're category owners
CREATE POLICY "Users can delete their own attachments or as category owner"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'task-attachments'
  AND (
    EXISTS (
      SELECT 1 FROM task_attachments ta
      WHERE ta.storage_path = name
      AND ta.uploaded_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM task_attachments ta
      JOIN tasks t ON t.id = ta.task_id
      JOIN category_members cm ON cm.category_id = t.category_id
      WHERE ta.storage_path = name
      AND cm.user_id = auth.uid()
      AND cm.role = 'owner'
    )
  )
);
