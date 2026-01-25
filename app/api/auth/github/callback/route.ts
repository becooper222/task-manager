import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireSessionUser, getOrCreateAppUserId } from '@/lib/auth-helpers'
import { exchangeCodeForToken, createOctokit } from '@/lib/github'
import { encrypt } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!

  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const cookieStore = await cookies()
    const storedState = cookieStore.get('github_oauth_state')?.value

    if (!code || !state || state !== storedState) {
      return NextResponse.redirect(new URL('/dashboard?error=invalid_state', baseUrl))
    }

    cookieStore.delete('github_oauth_state')

    const user = await requireSessionUser()
    const appUserId = await getOrCreateAppUserId(user.sub!, user.email || null)

    const tokenData = await exchangeCodeForToken(code)

    if (!tokenData.access_token) {
      return NextResponse.redirect(new URL('/dashboard?error=github_token_failed', baseUrl))
    }

    const octokit = createOctokit(tokenData.access_token)
    const { data: githubUser } = await octokit.users.getAuthenticated()

    const encryptedToken = encrypt(tokenData.access_token)

    await supabaseAdmin
      .from('github_connections')
      .upsert(
        {
          user_id: appUserId,
          github_user_id: String(githubUser.id),
          github_username: githubUser.login,
          access_token: encryptedToken,
          scope: tokenData.scope,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    return NextResponse.redirect(new URL('/dashboard?github=connected', baseUrl))
  } catch (e) {
    console.error('GitHub OAuth callback error:', e)
    return NextResponse.redirect(new URL('/dashboard?error=github_auth_failed', baseUrl))
  }
}
