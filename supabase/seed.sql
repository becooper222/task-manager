-- Enable the uuid-ossp extension if it hasn't been enabled yet.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Create the "categories" table
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid NOT NULL, -- Reference to the authenticated user
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  inserted_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- Create the "tasks" table
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid NOT NULL, -- Ensures tasks are specific to each user
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  date date NOT NULL,       -- Date assigned for the task (client can override default to today)
  completed boolean NOT NULL DEFAULT false, -- Defaults to incomplete
  favorited boolean NOT NULL DEFAULT false, -- Defaults to not favorited
  inserted_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- Enable Row-Level Security (RLS)
-- ============================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for Categories
-- ============================================

-- Allow users to SELECT only their own categories.
CREATE POLICY "Allow select categories for user"
  ON categories
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to INSERT categories only for themselves.
CREATE POLICY "Allow insert categories for user"
  ON categories
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to UPDATE their own categories.
CREATE POLICY "Allow update categories for user"
  ON categories
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to DELETE their own categories.
CREATE POLICY "Allow delete categories for user"
  ON categories
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- RLS Policies for Tasks
-- ============================================

-- Allow users to SELECT only their own tasks.
CREATE POLICY "Allow select tasks for user"
  ON tasks
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to INSERT tasks only for themselves.
CREATE POLICY "Allow insert tasks for user"
  ON tasks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to UPDATE their own tasks.
CREATE POLICY "Allow update tasks for user"
  ON tasks
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to DELETE their own tasks.
CREATE POLICY "Allow delete tasks for user"
  ON tasks
  FOR DELETE
  USING (auth.uid() = user_id);

-- Get the first user from auth.users (or you can specify a specific user's ID)
DO $$
DECLARE
    first_user_id UUID;
BEGIN
    -- Get the first user's ID from auth.users
    SELECT id INTO first_user_id FROM auth.users LIMIT 1;

    -- Insert sample categories
    INSERT INTO categories (user_id, name, sort_order)
    VALUES 
      (first_user_id, 'Work', 1),
      (first_user_id, 'Personal', 2),
      (first_user_id, 'Shopping', 3);

    -- Insert sample tasks
    INSERT INTO tasks (user_id, category_id, name, date)
    VALUES 
      (first_user_id, (SELECT id FROM categories WHERE name = 'Work' LIMIT 1), 'Complete project proposal', CURRENT_DATE),
      (first_user_id, (SELECT id FROM categories WHERE name = 'Personal' LIMIT 1), 'Gym workout', CURRENT_DATE),
      (first_user_id, (SELECT id FROM categories WHERE name = 'Shopping' LIMIT 1), 'Buy groceries', CURRENT_DATE);
END $$;
