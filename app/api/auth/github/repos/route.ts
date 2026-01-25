import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireSessionUser, getOrCreateAppUserId } from '@/lib/auth-helpers'
import { createOctokit } from '@/lib/github'
import { decrypt } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)

    const { data: githubConn, error } = await supabaseAdmin
      .from('github_connections')
      .select('access_token')
      .eq('user_id', appUserId)
      .single()

    if (error || !githubConn) {
      return NextResponse.json({ error: 'GitHub not connected' }, { status: 400 })
    }

    const token = decrypt(githubConn.access_token)
    const octokit = createOctokit(token)

    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 100,
      affiliation: 'owner,collaborator,organization_member',
    })

    const repoList = repos.map((repo) => ({
      id: repo.id,
      full_name: repo.full_name,
      name: repo.name,
      owner: repo.owner.login,
      default_branch: repo.default_branch,
      private: repo.private,
    }))

    return NextResponse.json({ repos: repoList })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
