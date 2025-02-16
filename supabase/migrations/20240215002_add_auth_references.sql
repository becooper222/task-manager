-- Drop existing policies
DROP POLICY IF EXISTS "Allow select categories for user" ON categories;
DROP POLICY IF EXISTS "Allow insert categories for user" ON categories;
DROP POLICY IF EXISTS "Allow update categories for user" ON categories;
DROP POLICY IF EXISTS "Allow delete categories for user" ON categories;

DROP POLICY IF EXISTS "Allow select tasks for user" ON tasks;
DROP POLICY IF EXISTS "Allow insert tasks for user" ON tasks;
DROP POLICY IF EXISTS "Allow update tasks for user" ON tasks;
DROP POLICY IF EXISTS "Allow delete tasks for user" ON tasks;

-- Add foreign key constraints to auth.users
ALTER TABLE categories 
  DROP CONSTRAINT IF EXISTS categories_user_id_fkey,
  ADD CONSTRAINT categories_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

ALTER TABLE tasks 
  DROP CONSTRAINT IF EXISTS tasks_user_id_fkey,
  ADD CONSTRAINT tasks_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

-- Recreate RLS policies
CREATE POLICY "Allow select categories for user"
  ON categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Allow insert categories for user"
  ON categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow update categories for user"
  ON categories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow delete categories for user"
  ON categories FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Allow select tasks for user"
  ON tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Allow insert tasks for user"
  ON tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow update tasks for user"
  ON tasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow delete tasks for user"
  ON tasks FOR DELETE
  USING (auth.uid() = user_id); 