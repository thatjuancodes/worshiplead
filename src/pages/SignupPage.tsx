import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { createUserAccount } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { EntryShell } from '../components/EntryShell'

export function SignupPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [invitation, setInvitation] = useState<{
    id: string
    organization_id: string
    email: string
    invited_by: string
    expires_at: string
    organizations?: { name: string; slug: string }
  } | null>(null)
  const [invitationLoading, setInvitationLoading] = useState(true)

  useEffect(() => {
    const inviteToken = searchParams.get('invite')
    if (inviteToken) {
      checkInvitation(inviteToken)
    } else {
      setInvitationLoading(false)
    }
  }, [searchParams])

  const checkInvitation = async (token: string) => {
    try {
      const { data, error: invitationError } = await supabase
        .from('organization_invites')
        .select(`
          *,
          organizations (
            name,
            slug
          )
        `)
        .eq('id', token)
        .eq('status', 'pending')

      if (invitationError || !data || data.length === 0) {
        console.error('Database error checking invitation:', invitationError)
        setError('Invalid or expired invitation link')
        setInvitationLoading(false)
        return
      }

      const pendingInvitation = data[0]
      const now = new Date()
      const expiresAt = new Date(pendingInvitation.expires_at)

      if (now > expiresAt) {
        setError('This invitation has expired. Please request a new one.')
        setInvitationLoading(false)
        return
      }

      setInvitation(pendingInvitation)
      setFormData((prev) => ({ ...prev, email: pendingInvitation.email }))
      setInvitationLoading(false)
    } catch (invitationError) {
      console.error('Error checking invitation:', invitationError)
      setError('Invalid or expired invitation link')
      setInvitationLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    if (error) {
      setError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long')
      setIsLoading(false)
      return
    }

    try {
      let user
      let session

      if (invitation) {
        const { user: newUser, session: newSession } = await createUserAccount(
          {
            email: formData.email,
            password: formData.password,
            firstName: formData.firstName,
            lastName: formData.lastName,
          },
          true,
        )

        user = newUser
        session = newSession

        if (user) {
          try {
            const { error: membershipError } = await supabase
              .from('organization_memberships')
              .insert({
                organization_id: invitation.organization_id,
                user_id: user.id,
                role: 'member',
                status: 'active',
                invited_by: invitation.invited_by,
                accepted_at: new Date().toISOString(),
              })

            if (membershipError) {
              console.error('Error creating membership:', membershipError)
              setError(
                'Account created successfully, but there was an issue adding you to the organization. Please contact your administrator.',
              )
              setIsLoading(false)
              return
            }

            const { error: inviteUpdateError } = await supabase
              .from('organization_invites')
              .update({
                status: 'accepted',
                accepted_at: new Date().toISOString(),
              })
              .eq('id', invitation.id)

            if (inviteUpdateError) {
              console.error('Error updating invite status:', inviteUpdateError)
            }

            navigate('/dashboard')
            return
          } catch (inviteError) {
            console.error('Error in invitation flow:', inviteError)
            setError(
              'Account created successfully, but there was an issue with the invitation. Please contact your administrator.',
            )
            setIsLoading(false)
            return
          }
        }
      } else {
        const { user: newUser, session: newSession } = await createUserAccount({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
        })

        user = newUser
        session = newSession
      }

      if (user) {
        if (session) {
          navigate('/dashboard')
        } else {
          setError('Please check your email to confirm your account before signing in.')
        }
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const title = t('signupPage.title')
  const description = invitation
    ? `${t('signupPage.subtitleInvited')} ${invitation.organizations?.name || ''}`.trim()
    : t('signupPage.subtitleDefault')

  if (invitationLoading) {
    return (
      <EntryShell
        accentBody="Set up your account, land in your organization faster, and keep onboarding as clean as the planning experience."
        cardClassName="max-w-lg"
        description={t('signupPage.verifyingInvitation')}
        title={title}
      >
        <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-100 border-t-primary-600" />
          <p className="text-sm text-text-muted">{t('signupPage.verifyingInvitation')}</p>
        </div>
      </EntryShell>
    )
  }

  return (
    <EntryShell
      accentBody="The onboarding flow now matches the same calm, light control surface as the rest of the product."
      accentItems={[
        'Invite-based signup can prefill the right organization and email.',
        'First-time setup stays short, clear, and mobile-friendly.',
        'All forms use the same spacing, font scale, and color system.',
      ]}
      cardClassName="max-w-2xl"
      description={description}
      title={title}
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        {error ? (
          <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-text-primary">{t('signupPage.firstName')}</span>
            <input
              className="input-field"
              name="firstName"
              onChange={handleInputChange}
              placeholder={t('signupPage.placeholders.firstName')}
              type="text"
              value={formData.firstName}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-text-primary">{t('signupPage.lastName')}</span>
            <input
              className="input-field"
              name="lastName"
              onChange={handleInputChange}
              placeholder={t('signupPage.placeholders.lastName')}
              type="text"
              value={formData.lastName}
            />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-text-primary">{t('signupPage.email')}</span>
          <input
            className={`input-field ${invitation ? 'cursor-not-allowed bg-slate-50 text-text-muted' : ''}`}
            disabled={!!invitation}
            name="email"
            onChange={handleInputChange}
            placeholder={t('signupPage.placeholders.email')}
            type="email"
            value={formData.email}
          />
          {invitation ? (
            <p className="text-xs text-text-muted">{t('signupPage.emailPreFilled')}</p>
          ) : null}
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-text-primary">{t('signupPage.password')}</span>
            <input
              className="input-field"
              name="password"
              onChange={handleInputChange}
              placeholder={t('signupPage.placeholders.password')}
              type="password"
              value={formData.password}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-text-primary">{t('signupPage.confirmPassword')}</span>
            <input
              className="input-field"
              name="confirmPassword"
              onChange={handleInputChange}
              placeholder={t('signupPage.placeholders.confirmPassword')}
              type="password"
              value={formData.confirmPassword}
            />
          </label>
        </div>

        <button
          className="btn-primary w-full justify-center py-3"
          disabled={isLoading}
          type="submit"
        >
          {isLoading ? t('signupPage.creatingAccount') : t('signupPage.createAccount')}
        </button>
      </form>

      <div className="text-center text-sm text-text-muted">
        {t('signupPage.alreadyHaveAccount')}{' '}
        <Link className="font-semibold text-primary-700 hover:text-primary-800" to="/login">
          {t('signupPage.signIn')}
        </Link>
      </div>
    </EntryShell>
  )
}
