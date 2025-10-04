-- Auth0 integration restructure: introduce app_users and category_members, rebuild categories/tasks

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing foreign keys and tables if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') THEN
    ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_user_id_fkey;
    ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_category_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM adinformation_schema.tables WHERE table_schema = 'public' AND table_name = 'categories') THEN
    ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_user_id_fkey;
  END IF;
  DROP TABLE IF EXISTS tasks CASCADE;
  DROP TABLE IF EXISTS categories CASCADE;
  DROP TABLE IF EXISTS category_members CASCADE;
  DROP TABLE IF EXISTS app_users CASCADE;
END $$;

-- Application users mapped from Auth0 subject
CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth0_sub text UNIQUE NOT NULL,
  email text,
  inserted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Categories owned by a user (owner recorded in category_members)
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  inserted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Category membership and roles
CREATE TYPE category_role AS ENUM ('owner', 'editor', 'viewer');

CREATE TABLE category_members (
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role category_role NOT NULL DEFAULT 'owner',
  inserted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (category_id, user_id)
);

-- Tasks belong to a category and are created by a user
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  date date NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  favorited boolean NOT NULL DEFAULT false,
  inserted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS enable
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Helper: get app_user.id by auth0_sub (requires setting request.jwt.claims.sub via API layer)
-- Note: Because we're using service role from API, we won't rely on auth.jwt(). We will enforce access in API code.

-- Open read only to service role; restrict general access
-- For safety, deny by default
DROP POLICY IF EXISTS "deny_all_app_users" ON app_users;
CREATE POLICY "deny_all_app_users" ON app_users FOR ALL TO public USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_all_categories" ON categories;
CREATE POLICY "deny_all_categories" ON categories FOR ALL TO public USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_all_category_members" ON category_members;
CREATE POLICY "deny_all_category_members" ON category_members FOR ALL TO public USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_all_tasks" ON tasks;
CREATE POLICY "deny_all_tasks" ON tasks FOR ALL TO public USING (false) WITH CHECK (false);


