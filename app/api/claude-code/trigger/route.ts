import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOrCreateAppUserId, requireSessionUser } from '@/lib/auth-helpers'
import { getUserRoleForCategory, canEdit } from '@/lib/permissions'
import { decrypt } from '@/lib/encryption'
import { createOctokit } from '@/lib/github'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { task_id } = await request.json()

    if (!task_id) {
      return NextResponse.json({ error: 'task_id required' }, { status: 400 })
    }

    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)

    const { data: task, error: taskErr } = await supabaseAdmin
      .from('tasks')
      .select('id, category_id, name')
      .eq('id', task_id)
      .single()

    if (taskErr || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const role = await getUserRoleForCategory(appUserId, task.category_id)
    if (!canEdit(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: repoLink } = await supabaseAdmin
      .from('category_github_repos')
      .select('*')
      .eq('category_id', task.category_id)
      .single()

    if (!repoLink) {
      return NextResponse.json({ error: 'No GitHub repo linked to this category' }, { status: 400 })
    }

    const { data: githubConn } = await supabaseAdmin
      .from('github_connections')
      .select('access_token')
      .eq('user_id', appUserId)
      .single()

    if (!githubConn) {
      return NextResponse.json({ error: 'GitHub not connected' }, { status: 400 })
    }

    const branchName = `claude-code/${task_id.slice(0, 8)}-${Date.now()}`
    const prompt = task.name

    const { data: run, error: runErr } = await supabaseAdmin
      .from('claude_code_runs')
      .insert({
        task_id,
        category_id: task.category_id,
        triggered_by: appUserId,
        prompt,
        repo_full_name: repoLink.repo_full_name,
        branch_name: branchName,
        status: 'pending',
      })
      .select()
      .single()

    if (runErr) throw runErr

    const token = decrypt(githubConn.access_token)
    const octokit = createOctokit(token)

    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/claude-code/webhook`

    try {
      await octokit.actions.createWorkflowDispatch({
        owner: repoLink.repo_owner,
        repo: repoLink.repo_name,
        workflow_id: 'claude-code.yml',
        ref: repoLink.default_branch,
        inputs: {
          task_prompt: prompt,
          run_id: run.id,
          callback_url: callbackUrl,
          branch_name: branchName,
        },
      })

      await supabaseAdmin
        .from('claude_code_runs')
        .update({ status: 'queued' })
        .eq('id', run.id)

      return NextResponse.json({ run_id: run.id, status: 'queued' })
    } catch (workflowErr: unknown) {
      await supabaseAdmin
        .from('claude_code_runs')
        .update({
          status: 'failed',
          error_message:
            workflowErr instanceof Error
              ? workflowErr.message
              : 'Failed to trigger workflow',
          completed_at: new Date().toISOString(),
        })
        .eq('id', run.id)

      const message = workflowErr instanceof Error ? workflowErr.message : 'Unknown error'
      return NextResponse.json(
        { error: `Failed to trigger workflow: ${message}` },
        { status: 500 }
      )
    }
  } catch (e: unknown) {
    console.error('Claude Code trigger error:', e)
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
