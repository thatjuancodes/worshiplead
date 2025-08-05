import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCurrentUser } from '../lib/auth'
import './InvitationHandler.css'

export function InvitationHandler() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    handleInvitation()
  }, [])

  const handleInvitation = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get the current user (should be authenticated after Supabase's invitation flow)
      const user = await getCurrentUser()
      if (!user) {
        setError('No authenticated user found. Please try signing up again.')
        setLoading(false)
        return
      }

      console.log('Processing invitation for user:', user.id)
      console.log('User metadata:', user.user_metadata)

      // Extract invitation data from user metadata
      const { invite_id, organization_id, organization_name, invited_by } = user.user_metadata

      if (!invite_id || !organization_id) {
        setError('Invalid invitation data. Please contact your administrator.')
        setLoading(false)
        return
      }

      // Verify the invitation exists and is valid
      const { data: invitation, error: inviteError } = await supabase
        .from('organization_invites')
        .select('*')
        .eq('id', invite_id)
        .eq('organization_id', organization_id)
        .eq('status', 'pending')
        .single()

      if (inviteError || !invitation) {
        console.error('Invitation verification error:', inviteError)
        setError('Invalid or expired invitation. Please request a new one.')
        setLoading(false)
        return
      }

      // Check if invitation has expired
      const now = new Date()
      const expiresAt = new Date(invitation.expires_at)
      if (now > expiresAt) {
        setError('This invitation has expired. Please request a new one.')
        setLoading(false)
        return
      }

      // Check if user is already a member
      const { data: existingMembership, error: checkError } = await supabase
        .from('organization_memberships')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (checkError) {
        console.error('Error checking existing membership:', checkError)
      }

      if (existingMembership) {
        console.log('User is already a member of this organization')
        setSuccess('You are already a member of this organization!')
        setTimeout(() => navigate('/dashboard'), 2000)
        return
      }

      // Add user to organization
      console.log('Adding user to organization:', { organizationId: organization_id, userId: user.id })
      
      const { error: membershipError } = await supabase
        .from('organization_memberships')
        .insert({
          organization_id: organization_id,
          user_id: user.id,
          role: 'member',
          status: 'active',
          invited_by: invitation.invited_by,
          accepted_at: new Date().toISOString()
        })

      if (membershipError) {
        console.error('Error creating membership:', membershipError)
        setError('Failed to add you to the organization. Please contact your administrator.')
        setLoading(false)
        return
      }

      // Update invitation status
      const { error: updateError } = await supabase
        .from('organization_invites')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', invite_id)

      if (updateError) {
        console.error('Error updating invitation:', updateError)
        // Don't fail the whole process for this
      }

      console.log('Successfully added user to organization')
      setSuccess('Welcome! You have been successfully added to the organization.')
      
      // Redirect to dashboard after a short delay
      setTimeout(() => navigate('/dashboard'), 2000)

    } catch (error) {
      console.error('Error in invitation handler:', error)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="invitation-handler">
        <div className="invitation-container">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <h2>Processing your invitation...</h2>
            <p>Please wait while we add you to the organization.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="invitation-handler">
      <div className="invitation-container">
        {error ? (
          <div className="error-message">
            <h2>Invitation Error</h2>
            <p>{error}</p>
            <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
              Go to Dashboard
            </button>
          </div>
        ) : success ? (
          <div className="success-message">
            <h2>Welcome!</h2>
            <p>{success}</p>
            <p>Redirecting you to the dashboard...</p>
          </div>
        ) : null}
      </div>
    </div>
  )
} 