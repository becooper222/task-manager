import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { requireSessionUser } from '@/lib/auth-helpers'
import { getGitHubAuthUrl } from '@/lib/github'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireSessionUser()

    const state = crypto.randomBytes(16).toString('hex')
    const cookieStore = await cookies()
    cookieStore.set('github_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
    })

    const authUrl = getGitHubAuthUrl(state)
    return NextResponse.redirect(authUrl)
  } catch {
    return NextResponse.redirect(new URL('/dashboard?error=github_auth_failed', process.env.NEXT_PUBLIC_APP_URL!))
  }
}
