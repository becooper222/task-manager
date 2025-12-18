-- Add archived column to category_members table for per-user archive functionality
-- This allows each user to archive categories independently without affecting other members
ALTER TABLE category_members ADD COLUMN archived boolean NOT NULL DEFAULT false;

-- Create index for faster queries filtering by archived status
CREATE INDEX idx_category_members_archived ON category_members(user_id, archived);
