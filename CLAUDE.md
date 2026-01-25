# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
npm run start    # Start production server
```

## Architecture

This is a Next.js 14 task manager application using Auth0 for authentication and Supabase for the database.

### Authentication Flow

Auth0 handles OAuth, but user data lives in Supabase:
1. Auth0 authenticates user → provides `auth0_sub`
2. `requireSessionUser()` gets Auth0 session in API routes
3. `getOrCreateAppUserId(auth0Sub, email)` upserts into `app_users` table
4. All subsequent queries use the app_user UUID, not the Auth0 sub

Important: Supabase service role key is used for all API operations (bypasses RLS). Authorization is enforced at the API layer via `lib/permissions.ts`.

### Database Schema

**app_users** - Maps Auth0 users to internal UUIDs
- `id`, `auth0_sub` (unique), `email`

**categories** - Task groupings (shared between users)
- `id`, `name`, `sort_order`

**category_members** - User-category relationships with RBAC
- `category_id`, `user_id`, `role` (owner|editor|viewer), `archived` (per-user)

**tasks** - Individual tasks
- `id`, `user_id`, `category_id`, `name`, `date`, `completed`, `favorited`

**github_connections** - GitHub OAuth tokens per user
- `id`, `user_id`, `github_user_id`, `github_username`, `access_token` (encrypted), `scope`

**category_github_repos** - Links categories to GitHub repos
- `id`, `category_id`, `repo_owner`, `repo_name`, `repo_full_name`, `default_branch`, `webhook_secret`

**claude_code_runs** - Claude Code execution history
- `id`, `task_id`, `category_id`, `triggered_by`, `prompt`, `status`, `github_pr_url`, `summary`

Key design: Archive status is per-membership, not per-category. Users can independently archive shared categories.

### Permission Model

```typescript
// lib/permissions.ts
getUserRoleForCategory(appUserId, categoryId) → 'owner' | 'editor' | 'viewer' | undefined
canEdit(role)  // owner or editor
canAdmin(role) // owner only
```

### Key Files

- `lib/auth-helpers.ts` - `requireSessionUser()`, `getOrCreateAppUserId()`
- `lib/supabase-admin.ts` - Server-side Supabase client (service role)
- `lib/permissions.ts` - Role checks for category access
- `lib/types.ts` - TypeScript types: `Category`, `Task`, `CategoryRole`, `CategoryMember`, `ClaudeCodeRun`
- `lib/github.ts` - GitHub OAuth helpers and Octokit client
- `lib/encryption.ts` - AES-256-GCM encryption for storing GitHub tokens
- `app/dashboard/page.tsx` - Main UI (client component with all task/category state)
- `app/dashboard/GitHubSettingsModal.tsx` - Link repos to categories
- `app/dashboard/ClaudeCodeRunsModal.tsx` - View and trigger Claude Code runs
- `middleware.ts` - Auth0 middleware protecting `/dashboard/*`

### API Routes

Categories:
- `GET/POST /api/categories` - List (with `?include_archived=true`) / Create
- `PUT /api/categories/[id]/archive` - Toggle archive status
- `GET/POST/DELETE /api/categories/[id]/members` - Member management
- `PUT /api/categories/reorder` - Batch update sort_order

Tasks:
- `GET/POST /api/tasks` - List / Create
- `PUT/DELETE /api/tasks/[id]` - Update / Delete

Backup:
- `GET /api/backup/export` - Export to Excel
- `POST /api/backup/import` - Import from Excel

GitHub OAuth:
- `GET /api/auth/github` - Initiate OAuth flow
- `GET /api/auth/github/callback` - Handle OAuth callback
- `POST /api/auth/github/disconnect` - Remove GitHub connection
- `GET /api/auth/github/status` - Check connection status
- `GET /api/auth/github/repos` - List user's accessible repos

Category GitHub:
- `GET/POST/DELETE /api/categories/[id]/github` - Link/unlink repo to category

Claude Code:
- `POST /api/claude-code/trigger` - Start a Claude Code run for a task
- `POST /api/claude-code/webhook` - Receive results from GitHub Action
- `GET /api/claude-code/runs?task_id=` - List runs for a task

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
AUTH0_SECRET
AUTH0_BASE_URL
AUTH0_ISSUER_BASE_URL
AUTH0_CLIENT_ID
AUTH0_CLIENT_SECRET
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
TOKEN_ENCRYPTION_KEY          # 32-byte hex string for AES-256
NEXT_PUBLIC_APP_URL           # For OAuth callback URLs
```

### Claude Code Integration

Categories can be linked to GitHub repositories. Tasks in linked categories show a trigger button (sparkle icon) that starts a Claude Code run via GitHub Actions.

**Setup requirements:**
1. Create GitHub OAuth App and set `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`
2. Generate 32-byte encryption key: `openssl rand -hex 32`
3. User connects GitHub account via the dashboard
4. Category owner links a repo via GitHub Settings
5. User adds `.github/workflows/claude-code.yml` workflow to repo
6. Repo needs secrets: `ANTHROPIC_API_KEY`, `TASK_MANAGER_WEBHOOK_SECRET`
