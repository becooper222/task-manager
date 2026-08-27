import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireSessionUser } from '@/lib/auth-helpers'

export async function GET() {
  try {
    await requireSessionUser()

    const { data, error } = await supabaseAdmin
      .from('jbox_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (e: any) {
    console.error('GET /api/jbox/messages error:', e)
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { body, occasion } = (await request.json()) || {}
    if (!body || typeof body !== 'string' || body.trim().length === 0) {
      return NextResponse.json({ error: 'Message body is required' }, { status: 400 })
    }
    if (body.length > 2000) {
      return NextResponse.json({ error: 'Message is too long (2000 chars max)' }, { status: 400 })
    }

    await requireSessionUser()

    const { data, error } = await supabaseAdmin
      .from('jbox_messages')
      .insert({ body: body.trim(), occasion: occasion || null })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e: any) {
    console.error('POST /api/jbox/messages error:', e)
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}
