import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { createUserAccount } from '../lib/auth'
import { supabase } from '../lib/supabase'
import './SignupPage.css'

export function SignupPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
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

  // Check for invitation token on component mount
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
      const { data, error } = await supabase
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

      if (error) {
        console.error('Database error checking invitation:', error)
        setError('Invalid or expired invitation link')
        setInvitationLoading(false)
        return
      }

      // Check if we got any results
      if (!data || data.length === 0) {
        setError('Invalid or expired invitation link')
        setInvitationLoading(false)
        return
      }

      const invitation = data[0] // Get the first (and should be only) invitation

      // Check if invitation has expired
      const now = new Date()
      const expiresAt = new Date(invitation.expires_at)
      if (now > expiresAt) {
        setError('This invitation has expired. Please request a new one.')
        setInvitationLoading(false)
        return
      }

      setInvitation(invitation)
      setFormData(prev => ({ ...prev, email: invitation.email }))
      setInvitationLoading(false)
    } catch (error) {
      console.error('Error checking invitation:', error)
      setError('Invalid or expired invitation link')
      setInvitationLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    if (error) setError(null)
  }

  // joinOrganizationFromInvitation function removed as it's no longer used

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // Basic validation
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
      // For invited users, we'll handle the signup differently
      let user, session
      
      if (invitation) {
        // For invited users, create account and immediately confirm email via Edge Function
        const { user: newUser, session: newSession } = await createUserAccount({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName
        })
        
        user = newUser
        session = newSession
        
        console.log('Invited user signup result:', { user, session, invitation })
        
        if (user) {
          // Immediately call Edge Function to confirm email and add to organization
          try {
            console.log('Calling Edge Function with inviteId:', invitation.id)
            const { data, error } = await supabase.functions.invoke('rapid-endpoint', {
              body: { inviteId: invitation.id }
            })

            console.log('Edge Function response:', { data, error })

            if (error) {
              console.error('Error confirming invitation:', error)
              let errorMessage = 'Unknown error occurred'
              
              if (error.message) {
                errorMessage = error.message
              } else if (error.error) {
                errorMessage = error.error
              } else if (typeof error === 'string') {
                errorMessage = error
              }
              
              setError(`Account created successfully, but there was an issue with the invitation: ${errorMessage}. Please contact your administrator.`)
              setIsLoading(false)
              return
            } else {
              // Success - user is confirmed and added to organization
              // Refresh the session to get the updated user data
              const { error: refreshError } = await supabase.auth.refreshSession()
              
              if (refreshError) {
                console.error('Error refreshing session:', refreshError)
              }
              
              navigate('/dashboard')
              return
            }
          } catch (inviteError) {
            console.error('Error in invitation flow:', inviteError)
            setError('Account created successfully, but there was an issue with the invitation. Please contact your administrator.')
            setIsLoading(false)
            return
          }
        }
      } else {
        // Regular signup
        const { user: newUser, session: newSession } = await createUserAccount({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName
        })
        
        user = newUser
        session = newSession
        
        console.log('Regular signup result:', { user, session })
      }

      if (user) {
        // Regular signup - check if we have a session
        if (session) {
          navigate('/dashboard')
        } else {
          // Email confirmation required for regular signup
          setError('Please check your email to confirm your account before signing in.')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (invitationLoading) {
    return (
      <div className="signup-page">
        <div className="signup-header-top">
          <Link to="/" className="logo-link">
            <h1>Worship Lead</h1>
          </Link>
        </div>
        <div className="signup-container">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Verifying invitation...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="signup-page">
      <div className="signup-header-top">
        <Link to="/" className="logo-link">
          <h1>Worship Lead</h1>
        </Link>
      </div>

      <div className="signup-container">
        <div className="signup-header">
          <h2>Create your account</h2>
          {invitation ? (
            <p>You've been invited to join <strong>{invitation.organizations?.name}</strong></p>
          ) : (
            <p>Join Worship Lead and start organizing your worship team</p>
          )}
        </div>

        <form className="signup-form" onSubmit={handleSubmit}>
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">First Name</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                required
                placeholder="Enter your first name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="lastName">Last Name</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                required
                placeholder="Enter your last name"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              placeholder="Enter your email"
              disabled={!!invitation}
            />
            {invitation && (
              <small className="form-help">
                Email is pre-filled from your invitation
              </small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              placeholder="Create a password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              required
              placeholder="Confirm your password"
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-full"
            disabled={isLoading}
          >
            {isLoading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div className="signup-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="link">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="signup-copyright">
        <p>&copy; {new Date().getFullYear()} Worship Lead. All rights reserved.</p>
      </div>
    </div>
  )
} 