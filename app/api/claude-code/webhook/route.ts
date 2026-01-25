import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const webhookSecret = request.headers.get('X-Webhook-Secret')

    const { run_id } = body

    if (!run_id) {
      return NextResponse.json({ error: 'run_id required' }, { status: 400 })
    }

    const { data: run } = await supabaseAdmin
      .from('claude_code_runs')
      .select('id, category_id')
      .eq('id', run_id)
      .single()

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    const { data: repoLink } = await supabaseAdmin
      .from('category_github_repos')
      .select('webhook_secret')
      .eq('category_id', run.category_id)
      .single()

    if (repoLink?.webhook_secret && webhookSecret !== repoLink.webhook_secret) {
      return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 })
    }

    const status = body.status === 'success' ? 'completed' : 'failed'

    const updateData: Record<string, unknown> = {
      status,
      workflow_run_id: body.workflow_run_id,
      workflow_run_url: body.workflow_run_url,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (body.branch_name) updateData.branch_name = body.branch_name
    if (body.commit_sha) updateData.commit_sha = body.commit_sha
    if (body.pr_number) {
      updateData.github_pr_number = parseInt(body.pr_number)
      updateData.result_type = 'pr'
    }
    if (body.pr_url) updateData.github_pr_url = body.pr_url

    if (body.claude_output) {
      updateData.summary = body.claude_output.summary || null
      updateData.files_changed = body.claude_output.files_changed || null
    }

    if (status === 'failed' && body.error) {
      updateData.error_message = body.error
    }

    await supabaseAdmin.from('claude_code_runs').update(updateData).eq('id', run_id)

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error('Webhook error:', e)
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
