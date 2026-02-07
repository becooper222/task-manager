-- Task attachments table
CREATE TABLE task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES app_users(id),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by task
CREATE INDEX idx_task_attachments_task_id ON task_attachments(task_id);

-- Index for fast lookups by user
CREATE INDEX idx_task_attachments_uploaded_by ON task_attachments(uploaded_by);

-- Changelog table for tracking changes
CREATE TABLE task_manager_changelog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'task_created', 'task_updated', 'task_completed', 'attachment_added', 'category_created', 'claude_code_triggered', etc.
  entity_type TEXT NOT NULL, -- 'task', 'category', 'attachment', 'claude_code_run'
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES app_users(id),
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  description TEXT NOT NULL, -- Natural language description
  metadata JSONB, -- Flexible field for additional context
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by entity
CREATE INDEX idx_changelog_entity ON task_manager_changelog(entity_type, entity_id);

-- Index for fast lookups by category
CREATE INDEX idx_changelog_category ON task_manager_changelog(category_id);

-- Index for chronological lookups
CREATE INDEX idx_changelog_inserted_at ON task_manager_changelog(inserted_at DESC);

-- Index for user activity
CREATE INDEX idx_changelog_user_id ON task_manager_changelog(user_id);

-- Updated_at trigger for task_attachments
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_task_attachments_updated_at BEFORE UPDATE ON task_attachments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies (using service role, but good practice to define)
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_manager_changelog ENABLE ROW LEVEL SECURITY;

-- Since we use service role, these policies are for future flexibility
-- Users can read attachments for tasks in categories they're members of
CREATE POLICY task_attachments_select ON task_attachments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN category_members cm ON cm.category_id = t.category_id
    WHERE t.id = task_attachments.task_id
    AND cm.user_id = auth.uid()
  )
);

-- Users can insert attachments for tasks in categories they can edit
CREATE POLICY task_attachments_insert ON task_attachments
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN category_members cm ON cm.category_id = t.category_id
    WHERE t.id = task_attachments.task_id
    AND cm.user_id = auth.uid()
    AND cm.role IN ('owner', 'editor')
  )
);

-- Users can delete their own attachments or if they're category owners
CREATE POLICY task_attachments_delete ON task_attachments
FOR DELETE USING (
  uploaded_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM tasks t
    JOIN category_members cm ON cm.category_id = t.category_id
    WHERE t.id = task_attachments.task_id
    AND cm.user_id = auth.uid()
    AND cm.role = 'owner'
  )
);

-- Changelog is read-only for users, written by service role
CREATE POLICY changelog_select ON task_manager_changelog
FOR SELECT USING (
  category_id IS NULL
  OR EXISTS (
    SELECT 1 FROM category_members cm
    WHERE cm.category_id = task_manager_changelog.category_id
    AND cm.user_id = auth.uid()
  )
);
