import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCurrentUser } from '../lib/auth'
import './OnboardingFlow.css'

interface ProfileData {
  firstName: string
  lastName: string
  password: string
  confirmPassword: string
}

export function OnboardingFlow() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<'checking' | 'profile' | 'processing' | 'complete'>('checking')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: ''
  })
  const [hasInvitation, setHasInvitation] = useState(false)
  const [invitationData, setInvitationData] = useState<any>(null)

  useEffect(() => {
    checkUserStatus()
  }, [])

  const checkUserStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('OnboardingFlow: Checking user status...')

      // Get current user
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        console.log('OnboardingFlow: No authenticated user found')
        navigate('/login')
        return
      }

      setUser(currentUser)
      console.log('OnboardingFlow: User found:', currentUser.id)

      // Check if user has invitation data
      const { invite_id, organization_id, organization_name, invited_by } = currentUser.user_metadata
      console.log('OnboardingFlow: Full user metadata:', currentUser.user_metadata)
      console.log('OnboardingFlow: Extracted invitation data:', { invite_id, organization_id, organization_name, invited_by })
      
      if (invite_id && organization_id) {
        console.log('OnboardingFlow: Found invitation data:', { invite_id, organization_id })
        setHasInvitation(true)
        setInvitationData({ invite_id, organization_id, organization_name, invited_by })
      } else {
        console.log('OnboardingFlow: No invitation data found in metadata')
      }

      // Check if user has a profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', currentUser.id)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('OnboardingFlow: Error checking profile:', profileError)
        setError('Error checking user profile')
        setLoading(false)
        return
      }

      if (!profile) {
        console.log('OnboardingFlow: No profile found, prompting for profile creation')
        setStep('profile')
        setLoading(false)
        return
      }

      // User has profile, check organization membership
      await checkOrganizationMembership(currentUser)

    } catch (error) {
      console.error('OnboardingFlow: Error in checkUserStatus:', error)
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  const checkOrganizationMembership = async (currentUser: any) => {
    console.log('OnboardingFlow: Checking organization membership...')

    // Check if user has any organization memberships
    const { data: memberships, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('organization_id')
      .eq('user_id', currentUser.id)
      .eq('status', 'active')

    if (membershipError) {
      console.error('OnboardingFlow: Error checking memberships:', membershipError)
      setError('Error checking organization membership')
      setLoading(false)
      return
    }

    if (memberships && memberships.length > 0) {
      console.log('OnboardingFlow: User has organization membership, redirecting to dashboard')
      navigate('/dashboard')
      return
    }

    // No organization membership, check if they came from invitation
    if (hasInvitation) {
      console.log('OnboardingFlow: No organization membership but has invitation, processing invitation...')
      await processInvitation(currentUser)
    } else {
      console.log('OnboardingFlow: No organization membership and no invitation, redirecting to organization setup')
      navigate('/organization-setup')
    }
  }

  const processInvitation = async (currentUser: any) => {
    try {
      setStep('processing')
      console.log('OnboardingFlow: Processing invitation...')

      const { invite_id, organization_id, invited_by } = invitationData

      // Check if user is already a member
      const { data: existingMembership, error: checkError } = await supabase
        .from('organization_memberships')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('user_id', currentUser.id)
        .maybeSingle()

      if (checkError) {
        console.error('OnboardingFlow: Error checking existing membership:', checkError)
      }

      if (existingMembership) {
        console.log('OnboardingFlow: User is already a member of this organization')
        setSuccess('You are already a member of this organization!')
        setTimeout(() => navigate('/dashboard'), 2000)
        return
      }

      // Add user to organization using data from user metadata
      console.log('OnboardingFlow: Adding user to organization:', { organizationId: organization_id, userId: currentUser.id })
      
      const { error: membershipError } = await supabase
        .from('organization_memberships')
        .insert({
          organization_id: organization_id,
          user_id: currentUser.id,
          role: 'member',
          status: 'active',
          invited_by: invited_by || currentUser.id, // Use invited_by from metadata or fallback to current user
          accepted_at: new Date().toISOString()
        })

      if (membershipError) {
        console.error('OnboardingFlow: Error creating membership:', membershipError)
        setError('Failed to add you to the organization. Please contact your administrator.')
        setLoading(false)
        return
      }

      // Try to update invitation status (optional - don't fail if this doesn't work)
      try {
        const { error: updateError } = await supabase
          .from('organization_invites')
          .update({
            status: 'accepted',
            accepted_at: new Date().toISOString()
          })
          .eq('id', invite_id)

        if (updateError) {
          console.error('OnboardingFlow: Error updating invitation status:', updateError)
          // Don't fail the whole process for this
        }
      } catch (updateError) {
        console.error('OnboardingFlow: Error updating invitation status:', updateError)
        // Don't fail the whole process for this
      }

      console.log('OnboardingFlow: Successfully added user to organization')
      setStep('complete')
      setTimeout(() => navigate('/dashboard'), 2000)

    } catch (error) {
      console.error('OnboardingFlow: Error processing invitation:', error)
      setError('An unexpected error occurred while processing your invitation.')
      setLoading(false)
    }
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (profileData.password !== profileData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (profileData.password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    if (!profileData.firstName.trim() || !profileData.lastName.trim()) {
      setError('First name and last name are required')
      return
    }

    try {
      setStep('processing')

      // Update user metadata
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          first_name: profileData.firstName.trim(),
          last_name: profileData.lastName.trim()
        }
      })

      if (metadataError) {
        console.error('OnboardingFlow: Error updating user metadata:', metadataError)
        setError('Failed to update user information')
        setStep('profile')
        return
      }

      // Create profile record
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          first_name: profileData.firstName.trim(),
          last_name: profileData.lastName.trim()
        }, {
          onConflict: 'id'
        })

      if (profileError) {
        console.error('OnboardingFlow: Error creating profile:', profileError)
        setError('Failed to create user profile')
        setStep('profile')
        return
      }

      // Update password if provided
      if (profileData.password) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: profileData.password
        })

        if (passwordError) {
          console.error('OnboardingFlow: Error updating password:', passwordError)
          // Don't fail the whole process for password update
        }
      }

      console.log('OnboardingFlow: Profile created successfully')
      
      // Check organization membership after profile creation
      await checkOrganizationMembership(user)

    } catch (error) {
      console.error('OnboardingFlow: Error in profile submission:', error)
      setError('An unexpected error occurred')
      setStep('profile')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }))
    if (error) setError(null)
  }

  if (loading) {
    return (
      <div className="onboarding-flow">
        <div className="onboarding-container">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <h2>Setting up your account...</h2>
            <p>Please wait while we check your account status.</p>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'profile') {
    return (
      <div className="onboarding-flow">
        <div className="onboarding-container">
          <div className="profile-form">
            <h2>Complete Your Profile</h2>
            <p>Please provide your information to complete your account setup.</p>
            
            <form onSubmit={handleProfileSubmit}>
              <div className="form-group">
                <label htmlFor="firstName">First Name</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={profileData.firstName}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="lastName">Last Name</label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={profileData.lastName}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={profileData.password}
                  onChange={handleInputChange}
                  placeholder="Create a password for your account"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={profileData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm your password"
                  required
                />
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              {success && (
                <div className="success-message">
                  {success}
                </div>
              )}

              <button type="submit" className="btn btn-primary">
                Complete Setup
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'processing') {
    return (
      <div className="onboarding-flow">
        <div className="onboarding-container">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <h2>Processing...</h2>
            <p>Please wait while we complete your account setup.</p>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'complete') {
    return (
      <div className="onboarding-flow">
        <div className="onboarding-container">
          <div className="success-message">
            <h2>Welcome!</h2>
            <p>Your account has been successfully set up.</p>
            {success && <p>{success}</p>}
            <p>Redirecting you to the dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  return null
} 