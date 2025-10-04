-- Create isolated schema to avoid conflicts with existing tables
create schema if not exists auth0_app;

-- UUID extension (usually already enabled)
create extension if not exists "uuid-ossp";

-- Roles enum (scoped to our schema)
do $$
begin
  if not exists (select 1 from pg_type t
                 join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'category_role' and n.nspname = 'auth0_app') then
    create type auth0_app.category_role as enum ('owner', 'editor', 'viewer');
  end if;
end $$;

-- Users mapped from Auth0 subject
create table if not exists auth0_app.app_users (
  id uuid primary key default uuid_generate_v4(),
  auth0_sub text unique not null,
  email text,
  inserted_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Categories (no owner column; ownership lives in category_members)
create table if not exists auth0_app.categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  sort_order integer not null default 0,
  inserted_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Memberships and roles per category
create table if not exists auth0_app.category_members (
  category_id uuid not null references auth0_app.categories(id) on delete cascade,
  user_id uuid not null references auth0_app.app_users(id) on delete cascade,
  role auth0_app.category_role not null default 'owner',
  inserted_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (category_id, user_id)
);

-- Tasks
create table if not exists auth0_app.tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth0_app.app_users(id) on delete cascade,
  category_id uuid not null references auth0_app.categories(id) on delete cascade,
  name text not null,
  date date not null,
  completed boolean not null default false,
  favorited boolean not null default false,
  inserted_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Touch-safe trigger to keep updated_at fresh
create or replace function auth0_app.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'trg_set_updated_at_app_users'
      and n.nspname = 'auth0_app'
      and c.relname = 'app_users'
      and not t.tgisinternal
  ) then
    create trigger trg_set_updated_at_app_users
    before update on auth0_app.app_users
    for each row execute function auth0_app.set_updated_at();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'trg_set_updated_at_categories'
      and n.nspname = 'auth0_app'
      and c.relname = 'categories'
      and not t.tgisinternal
  ) then
    create trigger trg_set_updated_at_categories
    before update on auth0_app.categories
    for each row execute function auth0_app.set_updated_at();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'trg_set_updated_at_category_members'
      and n.nspname = 'auth0_app'
      and c.relname = 'category_members'
      and not t.tgisinternal
  ) then
    create trigger trg_set_updated_at_category_members
    before update on auth0_app.category_members
    for each row execute function auth0_app.set_updated_at();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'trg_set_updated_at_tasks'
      and n.nspname = 'auth0_app'
      and c.relname = 'tasks'
      and not t.tgisinternal
  ) then
    create trigger trg_set_updated_at_tasks
    before update on auth0_app.tasks
    for each row execute function auth0_app.set_updated_at();
  end if;
end $$;

-- Helpful indexes
create index if not exists idx_category_members_user on auth0_app.category_members(user_id);
create index if not exists idx_category_members_category on auth0_app.category_members(category_id);
create index if not exists idx_tasks_category on auth0_app.tasks(category_id);
create index if not exists idx_tasks_user on auth0_app.tasks(user_id);
create index if not exists idx_categories_sort on auth0_app.categories(sort_order);

-- Enable RLS and deny-by-default (service role in API bypasses RLS; public cannot access)
alter table auth0_app.app_users enable row level security;
alter table auth0_app.categories enable row level security;
alter table auth0_app.category_members enable row level security;
alter table auth0_app.tasks enable row level security;

do $$
begin
  perform 1
  from pg_policies
  where schemaname = 'auth0_app' and tablename = 'app_users' and policyname = 'deny_all_app_users';
  if not found then
    create policy "deny_all_app_users" on auth0_app.app_users for all using (false) with check (false);
  end if;
end $$;

do $$
begin
  perform 1
  from pg_policies
  where schemaname = 'auth0_app' and tablename = 'categories' and policyname = 'deny_all_categories';
  if not found then
    create policy "deny_all_categories" on auth0_app.categories for all using (false) with check (false);
  end if;
end $$;

do $$
begin
  perform 1
  from pg_policies
  where schemaname = 'auth0_app' and tablename = 'category_members' and policyname = 'deny_all_category_members';
  if not found then
    create policy "deny_all_category_members" on auth0_app.category_members for all using (false) with check (false);
  end if;
end $$;

do $$
begin
  perform 1
  from pg_policies
  where schemaname = 'auth0_app' and tablename = 'tasks' and policyname = 'deny_all_tasks';
  if not found then
    create policy "deny_all_tasks" on auth0_app.tasks for all using (false) with check (false);
  end if;
end $$;