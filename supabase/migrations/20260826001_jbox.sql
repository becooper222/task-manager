-- J-Box: love notes delivered to the Pi-powered box.
-- Accessed exclusively through the service-role API layer (app/api/jbox/*).

create table if not exists jbox_messages (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(body) between 1 and 2000),
  occasion text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz,
  hearted_at timestamptz
);

create index if not exists jbox_messages_created_at_idx
  on jbox_messages (created_at desc);

-- No policies on purpose: the public anon key must never see these.
-- The service role key bypasses RLS, so the API layer still has full access.
alter table jbox_messages enable row level security;
