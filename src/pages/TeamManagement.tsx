import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser, getUserPrimaryOrganization, signOut } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import './TeamManagement.css'

interface OrganizationData {
  organization_id: string
  role: string
  organizations: {
    name: string
    slug: string
  }[]
}

interface OrganizationInvite {
  id: string
  organization_id: string
  email: string
  status: 'pending' | 'accepted' | 'expired'
  invited_by: string
  created_at: string
  accepted_at?: string
}

export function TeamManagement() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [invites, setInvites] = useState<OrganizationInvite[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const checkUserAndOrganization = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        navigate('/login')
        return
      }
      setUser(currentUser)

      const userOrg = await getUserPrimaryOrganization(currentUser.id)
      if (!userOrg) {
        navigate('/organization-setup')
        return
      }
      setOrganization(userOrg)
      setLoading(false)
    } catch (error) {
      console.error('Error checking user and organization:', error)
      navigate('/login')
    }
  }, [navigate])

  const loadInvites = useCallback(async () => {
    if (!organization) return

    try {
      const { data, error } = await supabase
        .from('organization_invites')
        .select('*')
        .eq('organization_id', organization.organization_id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading invites:', error)
        return
      }

      setInvites(data || [])
    } catch (error) {
      console.error('Error loading invites:', error)
    }
  }, [organization])

  useEffect(() => {
    checkUserAndOrganization()
  }, [checkUserAndOrganization])

  useEffect(() => {
    if (organization) {
      loadInvites()
    }
  }, [organization, loadInvites])

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization || !inviteEmail.trim()) return

    setInviting(true)
    setError('')
    setSuccess('')

    try {
      // Check if user already exists by email
      const { data: existingUsers, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', inviteEmail.trim())

      if (userError) {
        console.error('Error checking existing user:', userError)
        // Continue anyway - the invitation will still work
      } else if (existingUsers && existingUsers.length > 0) {
        const existingUser = existingUsers[0]
        // User exists, check if they're already a member
        const { data: existingMembers, error: memberError } = await supabase
          .from('organization_memberships')
          .select('id')
          .eq('organization_id', organization.organization_id)
          .eq('user_id', existingUser.id)
          .eq('status', 'active')

        if (memberError) {
          console.error('Error checking existing membership:', memberError)
        } else if (existingMembers && existingMembers.length > 0) {
          setError('This user is already a member of your organization.')
          setInviting(false)
          return
        }
      }

      // Create our custom invite record for tracking FIRST
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      const { data: inviteData, error: dbError } = await supabase
        .from('organization_invites')
        .insert({
          organization_id: organization.organization_id,
          email: inviteEmail.trim(),
          invited_by: user?.id,
          status: 'pending',
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single()

      if (dbError) {
        console.error('Error creating invite record:', dbError)
        setError('Failed to create invitation record. Please try again.')
        return
      }

      // Now call the Edge Function to send invitation email
      const organizationName = organization.organizations?.[0]?.name || 'Your Organization'
      const invitedByName = user?.user_metadata?.first_name + ' ' + user?.user_metadata?.last_name || 'A team member'

      const { data: emailData, error: emailError } = await supabase.functions.invoke('clever-worker', {
        body: {
          email: inviteEmail.trim(),
          organizationName,
          invitedBy: invitedByName,
          organizationId: organization.organization_id,
          inviteId: inviteData.id
        }
      })

      if (emailError) {
        console.error('Error sending invite email:', emailError)
        // Don't fail completely - the invitation record was created successfully
        // Just show a warning that email failed
        setError(`Invitation created but email failed to send: ${emailError.message}. You can manually share the invitation link.`)
        await loadInvites() // Still reload the invites list
        return
      }

      setInviteEmail('')
      setSuccess('Invitation email sent successfully! The user will receive an email with signup instructions.')
      await loadInvites()
    } catch (error) {
      console.error('Error inviting user:', error)
      setError('Failed to send invitation. Please try again.')
    } finally {
      setInviting(false)
    }
  }



  const handleCancelInvite = async (inviteId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return

    try {
      const { error } = await supabase
        .from('organization_invites')
        .delete()
        .eq('id', inviteId)

      if (error) {
        console.error('Error canceling invite:', error)
        return
      }

      await loadInvites()
    } catch (error) {
      console.error('Error canceling invite:', error)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  if (loading) {
    return (
      <div className="team-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading team management...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="team">
      <header className="team-header">
        <div className="team-header-content">
          <div className="team-logo">
            <h1>Worship Lead</h1>
          </div>
          <div className="team-user-info">
            <span className="user-name">
              {user?.user_metadata?.first_name} {user?.user_metadata?.last_name}
            </span>
            <span className="organization-name">
              {organization?.organizations?.[0]?.name}
            </span>
            <button onClick={handleSignOut} className="btn btn-secondary btn-small">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="team-main">
        <div className="team-container">
          <div className="team-header-section">
            <div className="team-title">
              <h2>Team Management</h2>
              <p>Invite team members to collaborate on your worship planning</p>
            </div>
            <div className="team-actions">
              <button
                onClick={() => navigate('/dashboard')}
                className="btn btn-secondary"
              >
                Back to Dashboard
              </button>
            </div>
          </div>

          <div className="team-content">
            <div className="team-section">
              <h3>Invite Team Members</h3>
              <form onSubmit={handleInviteUser} className="invite-form">
                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Enter email address"
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={inviting || !inviteEmail.trim()}
                >
                  {inviting ? 'Sending Invitation...' : 'Send Invitation'}
                </button>
              </form>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              {success && (
                <div className="success-message">
                  <div className="success-content">
                    <span>{success}</span>
                    {success.includes('Copy and share this link:') && (
                      <button
                        onClick={() => {
                          const url = success.split('Copy and share this link: ')[1]
                          navigator.clipboard.writeText(url)
                          setSuccess('Link copied to clipboard!')
                        }}
                        className="btn btn-secondary btn-small"
                        style={{ marginLeft: '12px' }}
                      >
                        Copy Link
                      </button>
                    )}
                  </div>
                </div>
              )}


            </div>

            <div className="team-section">
              <h3>Pending Invitations</h3>
              {invites.length === 0 ? (
                <div className="no-invites">
                  <p>No pending invitations</p>
                </div>
              ) : (
                <div className="invites-list">
                  {invites.map(invite => (
                    <div key={invite.id} className="invite-item">
                      <div className="invite-info">
                        <span className="invite-email">{invite.email}</span>
                        <span className="invite-date">
                          Sent {new Date(invite.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="invite-actions">
                        <button
                          onClick={() => handleCancelInvite(invite.id)}
                          className="btn btn-danger btn-small"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 