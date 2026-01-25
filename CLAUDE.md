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
- `lib/types.ts` - TypeScript types: `Category`, `Task`, `CategoryRole`, `CategoryMember`
- `app/dashboard/page.tsx` - Main UI (client component with all task/category state)
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
```
