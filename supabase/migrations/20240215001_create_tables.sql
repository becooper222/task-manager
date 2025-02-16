-- Enable the uuid-ossp extension if it hasn't been enabled yet.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Create the "categories" table
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Add foreign key to auth.users
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
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Add foreign key to auth.users
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