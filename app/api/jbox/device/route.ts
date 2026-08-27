import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// The J-Box (Raspberry Pi) authenticates with a shared secret, not Auth0.
// Set JBOX_DEVICE_TOKEN in the environment (openssl rand -hex 32) and put
// the same value in the Pi's config.yaml.
function requireDeviceToken(request: Request) {
  const token = process.env.JBOX_DEVICE_TOKEN
  if (!token) throw new Error('JBOX_DEVICE_TOKEN is not configured')
  const header = request.headers.get('authorization') || ''
  if (header !== `Bearer ${token}`) throw new Error('Unauthorized')
}

export async function GET(request: Request) {
  try {
    requireDeviceToken(request)

    const { data, error } = await supabaseAdmin
      .from('jbox_messages')
      .select('id, body, occasion, created_at, delivered_at, read_at, hearted_at')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (e: any) {
    console.error('GET /api/jbox/device error:', e)
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}

const ACTION_COLUMNS: Record<string, string> = {
  delivered: 'delivered_at',
  read: 'read_at',
  heart: 'hearted_at',
}

export async function POST(request: Request) {
  try {
    requireDeviceToken(request)

    const { action, ids } = (await request.json()) || {}
    const column = ACTION_COLUMNS[action]
    if (!column || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Expected { action: delivered|read|heart, ids: [...] }' }, { status: 400 })
    }

    // Only stamp messages not already stamped, so the first timestamp is kept.
    const { error } = await supabaseAdmin
      .from('jbox_messages')
      .update({ [column]: new Date().toISOString() })
      .in('id', ids)
      .is(column, null)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('POST /api/jbox/device error:', e)
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}
