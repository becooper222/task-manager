export type Category = {
  id: string
  name: string
  sort_order: number
  archived: boolean
  inserted_at: string
  updated_at: string
  member_count?: number
}

export type Task = {
  id: string
  user_id: string
  category_id: string
  name: string
  date: string
  completed: boolean
  favorited: boolean
  inserted_at: string
  updated_at: string
}

export type CategoryRole = 'owner' | 'editor' | 'viewer'

export type CategoryMember = {
  user_id: string
  email: string
  role: CategoryRole
  is_you: boolean
}

// GitHub Integration Types

export type GitHubConnection = {
  id: string
  user_id: string
  github_user_id: string
  github_username: string
  scope: string | null
  inserted_at: string
  updated_at: string
}

export type CategoryGitHubRepo = {
  id: string
  category_id: string
  repo_owner: string
  repo_name: string
  repo_full_name: string
  default_branch: string
  webhook_secret?: string
  connected_by: string | null
  inserted_at: string
  updated_at: string
}

export type ClaudeCodeRunStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed'

export type ClaudeCodeRun = {
  id: string
  task_id: string
  category_id: string
  triggered_by: string
  prompt: string
  repo_full_name: string
  branch_name: string | null
  workflow_run_id: number | null
  workflow_run_url: string | null
  status: ClaudeCodeRunStatus
  started_at: string | null
  completed_at: string | null
  result_type: 'pr' | 'issue' | 'commit' | 'none' | null
  github_pr_number: number | null
  github_pr_url: string | null
  commit_sha: string | null
  summary: string | null
  files_changed: { path: string; additions: number; deletions: number }[] | null
  error_message: string | null
  inserted_at: string
  updated_at: string
} 