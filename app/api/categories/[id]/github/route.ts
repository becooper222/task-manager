import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOrCreateAppUserId, requireSessionUser } from '@/lib/auth-helpers'
import { getUserRoleForCategory, canAdmin } from '@/lib/permissions'
import { decrypt } from '@/lib/encryption'
import { createOctokit } from '@/lib/github'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: categoryId } = await params
    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)

    const role = await getUserRoleForCategory(appUserId, categoryId)
    if (!role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('category_github_repos')
      .select('id, repo_owner, repo_name, repo_full_name, default_branch, webhook_secret')
      .eq('category_id', categoryId)
      .maybeSingle()

    if (error) throw error
    return NextResponse.json({ repo: data })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: categoryId } = await params
    const { repo_full_name } = await request.json()

    if (!repo_full_name) {
      return NextResponse.json({ error: 'repo_full_name required' }, { status: 400 })
    }

    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)

    const role = await getUserRoleForCategory(appUserId, categoryId)
    if (!canAdmin(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: githubConn } = await supabaseAdmin
      .from('github_connections')
      .select('access_token')
      .eq('user_id', appUserId)
      .single()

    if (!githubConn) {
      return NextResponse.json({ error: 'GitHub not connected' }, { status: 400 })
    }

    const token = decrypt(githubConn.access_token)
    const octokit = createOctokit(token)

    const [owner, repo] = repo_full_name.split('/')
    const { data: repoData } = await octokit.repos.get({ owner, repo })

    const webhookSecret = crypto.randomBytes(32).toString('hex')

    const { data, error } = await supabaseAdmin
      .from('category_github_repos')
      .upsert(
        {
          category_id: categoryId,
          repo_owner: owner,
          repo_name: repo,
          repo_full_name: repo_full_name,
          default_branch: repoData.default_branch,
          webhook_secret: webhookSecret,
          connected_by: appUserId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'category_id' }
      )
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ repo: data })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: categoryId } = await params
    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)

    const role = await getUserRoleForCategory(appUserId, categoryId)
    if (!canAdmin(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await supabaseAdmin.from('category_github_repos').delete().eq('category_id', categoryId)

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
