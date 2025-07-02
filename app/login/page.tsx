'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Refresh the page to let middleware handle the redirect
      window.location.reload()
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordReset = async () => {
    if (!email) {
      setError('Please enter your email address')
      return
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) throw error
      alert('Password reset instructions sent to your email')
    } catch (error: any) {
      setError(error.message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-8 p-6 lg:p-8 bg-primary rounded-lg shadow-medium">
        <div className="text-center">
          <h2 className="text-2xl lg:text-3xl font-bold text-text-primary mb-2">
            Sign in to your account
          </h2>
          <p className="text-text-secondary text-sm lg:text-base">
            Welcome back! Please enter your details.
          </p>
        </div>
        
        <form 
          className="mt-8 space-y-6" 
          onSubmit={(e) => {
            console.log('Form submit event triggered')
            handleLogin(e)
          }}
          method="POST"
        >
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-2">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                className="w-full px-4 py-3 bg-secondary border border-accent rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                className="w-full px-4 py-3 bg-secondary border border-accent rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-3 sm:space-y-0">
            <div className="text-sm">
              <button
                type="button"
                onClick={handlePasswordReset}
                className="font-medium text-accent hover:text-text-primary transition-colors duration-200"
              >
                Forgot your password?
              </button>
            </div>
            <div className="text-sm">
              <Link
                href="/signup"
                className="font-medium text-accent hover:text-text-primary transition-colors duration-200"
              >
                Don&apos;t have an account? Sign up
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              onClick={(e) => {
                console.log('Submit button clicked')
                if (!loading) {
                  handleLogin(e)
                }
              }}
              className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-text-primary bg-accent hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-primary focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-text-primary border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign in'
              )}
            </button>
          </div>
        </form>
        
        {/* Back to home link */}
        <div className="text-center pt-4 border-t border-accent">
          <Link
            href="https://www.benjamincooper.info/"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-200"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
} 