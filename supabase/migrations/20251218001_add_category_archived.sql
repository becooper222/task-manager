-- Add archived column to categories table for soft-delete/archive functionality
ALTER TABLE categories ADD COLUMN archived boolean NOT NULL DEFAULT false;

-- Create index for faster queries filtering by archived status
CREATE INDEX idx_categories_archived ON categories(archived);

