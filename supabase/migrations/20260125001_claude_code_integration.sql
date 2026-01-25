-- Claude Code integration: GitHub connections, category repo links, and run tracking

-- GitHub OAuth connections for users
CREATE TABLE github_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  github_user_id text NOT NULL,
  github_username text NOT NULL,
  access_token text NOT NULL,  -- encrypted
  scope text,
  inserted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX idx_github_connections_user ON github_connections(user_id);

-- Link categories to GitHub repositories
CREATE TABLE category_github_repos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  repo_owner text NOT NULL,
  repo_name text NOT NULL,
  repo_full_name text NOT NULL,
  default_branch text DEFAULT 'main',
  webhook_secret text,
  connected_by uuid REFERENCES app_users(id),
  inserted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(category_id)
);

CREATE INDEX idx_category_repos_category ON category_github_repos(category_id);

-- Claude Code execution runs
CREATE TABLE claude_code_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  triggered_by uuid NOT NULL REFERENCES app_users(id),
  prompt text NOT NULL,
  repo_full_name text NOT NULL,
  branch_name text,
  workflow_run_id bigint,
  workflow_run_url text,
  status text NOT NULL DEFAULT 'pending',  -- pending, queued, running, completed, failed
  started_at timestamptz,
  completed_at timestamptz,
  result_type text,  -- pr, issue, commit, none
  github_pr_number integer,
  github_pr_url text,
  commit_sha text,
  summary text,
  files_changed jsonb,
  error_message text,
  inserted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_runs_task ON claude_code_runs(task_id);
CREATE INDEX idx_runs_category ON claude_code_runs(category_id);
CREATE INDEX idx_runs_status ON claude_code_runs(status);
CREATE INDEX idx_runs_workflow ON claude_code_runs(workflow_run_id);

-- Enable RLS (deny all by default, service role bypasses)
ALTER TABLE github_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_github_repos ENABLE ROW LEVEL SECURITY;
ALTER TABLE claude_code_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_all_github_connections" ON github_connections FOR ALL TO public USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_category_github_repos" ON category_github_repos FOR ALL TO public USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_claude_code_runs" ON claude_code_runs FOR ALL TO public USING (false) WITH CHECK (false);
