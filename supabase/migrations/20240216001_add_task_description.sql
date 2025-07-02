-- Add description field to tasks table for expandable task content
ALTER TABLE tasks ADD COLUMN description text;

-- Add a comment to document the purpose
COMMENT ON COLUMN tasks.description IS 'Full description/content of the task that can be expanded in the UI';