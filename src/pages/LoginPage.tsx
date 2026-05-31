import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { signIn, signInWithGoogle, ensureUserProfileAndMembership } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { EntryShell } from '../components/EntryShell'

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleOAuthRedirect = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search)
        const hasOAuthParams =
          urlParams.has('code') || urlParams.has('access_token') || urlParams.has('error')

        if (hasOAuthParams) {
          await new Promise((resolve) => setTimeout(resolve, 1000))

          const {
            data: { session },
          } = await supabase.auth.getSession()

          if (session?.user) {
            try {
              await ensureUserProfileAndMembership(session.user)
              window.history.replaceState({}, document.title, window.location.pathname)
              navigate('/dashboard')
            } catch (oauthError) {
              console.error('LoginPage: Error ensuring user profile:', oauthError)
              navigate('/dashboard')
            }
          }
        }
      } catch (oauthError) {
        console.error('LoginPage: Error handling OAuth redirect:', oauthError)
      }
    }

    handleOAuthRedirect()
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { user, session } = await signIn({
        email: formData.email,
        password: formData.password,
      })

      if (user && session) {
        navigate('/dashboard')
      }
    } catch (submitError: any) {
      setError(submitError.message || 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setError('')

    try {
      await signInWithGoogle()
    } catch (googleError: any) {
      setError(googleError.message || 'Failed to sign in with Google')
      setGoogleLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  return (
    <EntryShell
      accentBody="Plan upcoming services, keep songs aligned, and coordinate volunteers from a cleaner command surface."
      accentItems={[
        'See your next services and team activity in one dashboard.',
        'Keep every worship plan and volunteer assignment organized.',
        'Designed for leaders who want speed without losing clarity.',
      ]}
      description={t('loginPage.subtitle')}
      title={t('loginPage.title')}
    >
      <div className="space-y-6">
        {error ? (
          <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {error}
          </div>
        ) : null}

        <button
          className="btn-secondary w-full justify-center py-3"
          disabled={googleLoading}
          onClick={handleGoogleSignIn}
          type="button"
        >
          <span className="flex items-center gap-3">
            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span>{googleLoading ? 'Signing in...' : t('loginPage.continueWithGoogle')}</span>
          </span>
        </button>

        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-text-muted">
            {t('loginPage.or')}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-text-primary">{t('loginPage.email')}</span>
            <input
              className="input-field"
              id="email"
              name="email"
              onChange={handleInputChange}
              placeholder={t('loginPage.placeholders.email')}
              type="email"
              value={formData.email}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-text-primary">{t('loginPage.password')}</span>
            <input
              className="input-field"
              id="password"
              name="password"
              onChange={handleInputChange}
              placeholder={t('loginPage.placeholders.password')}
              type="password"
              value={formData.password}
            />
          </label>

          <button
            className="btn-primary w-full justify-center py-3"
            disabled={loading}
            type="submit"
          >
            {loading ? t('loginPage.signingIn') : t('loginPage.signIn')}
          </button>
        </form>
      </div>

      <div className="text-center text-sm text-text-muted">
        {t('loginPage.noAccount')}{' '}
        <Link className="font-semibold text-primary-700 hover:text-primary-800" to="/signup">
          {t('loginPage.signUp')}
        </Link>
      </div>
    </EntryShell>
  )
}
