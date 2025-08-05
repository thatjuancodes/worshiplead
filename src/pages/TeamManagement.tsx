import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser, getUserPrimaryOrganization } from '../lib/auth'
import { DashboardHeader } from '../components'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import './TeamManagement.css'

interface OrganizationData {
  organization_id: string
  role: string
  organizations: {
    name: string
    slug: string
  } | {
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

interface OrganizationMember {
  id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  status: 'active' | 'inactive' | 'suspended'
  joined_at: string
  profiles: {
    first_name: string
    last_name: string
    email: string
  } | null
}

export function TeamManagement() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [invites, setInvites] = useState<OrganizationInvite[]>([])
  const [members, setMembers] = useState<OrganizationMember[]>([])
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
      console.log('User organization data:', userOrg) // Debug log
      
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

  const loadMembers = useCallback(async () => {
    if (!organization) return

    try {
      console.log('Loading members for organization:', organization.organization_id)
      
      // First, get the memberships
      const { data: memberships, error: membershipsError } = await supabase
        .from('organization_memberships')
        .select(`
          id,
          user_id,
          role,
          status,
          joined_at
        `)
        .eq('organization_id', organization.organization_id)
        .eq('status', 'active')
        .order('joined_at', { ascending: true })

      console.log('Memberships query result:', { memberships, membershipsError })

      if (membershipsError) {
        console.error('Error loading memberships:', membershipsError)
        return
      }

      if (!memberships || memberships.length === 0) {
        setMembers([])
        return
      }

      // Then, get the profiles for all user IDs
      const userIds = memberships.map(m => m.user_id)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', userIds)

      console.log('Profiles query result:', { profiles, profilesError })

      if (profilesError) {
        console.error('Error loading profiles:', profilesError)
        return
      }

      // Combine the data
      const membersWithProfiles = memberships.map(membership => {
        const profile = profiles?.find(p => p.id === membership.user_id)
        return {
          ...membership,
          profiles: profile || null
        }
      })

      console.log('Combined members data:', membersWithProfiles)
      setMembers(membersWithProfiles)
    } catch (error) {
      console.error('Error loading members:', error)
    }
  }, [organization])

  useEffect(() => {
    checkUserAndOrganization()
  }, [checkUserAndOrganization])

  useEffect(() => {
    if (organization) {
      loadInvites()
      loadMembers()
    }
  }, [organization, loadInvites, loadMembers])

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization || !inviteEmail.trim()) return

    setInviting(true)
    setError('')
    setSuccess('')

    try {
      // Check if invitation already exists for this email
      const { data: existingInvites, error: inviteError } = await supabase
        .from('organization_invites')
        .select('id, status')
        .eq('organization_id', organization.organization_id)
        .eq('email', inviteEmail.trim())
        .eq('status', 'pending')

      if (inviteError) {
        console.error('Error checking existing invites:', inviteError)
      } else if (existingInvites && existingInvites.length > 0) {
        setError('An invitation has already been sent to this email address.')
        setInviting(false)
        return
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

      // Create invitation link for manual sharing
      const inviteUrl = `${window.location.origin}/onboarding`
      const organizationName = organization?.organizations ? 
        (Array.isArray(organization.organizations) ? 
          organization.organizations[0]?.name : 
          organization.organizations.name) || 'Your Organization' : 
        'Your Organization'
      const invitedByName = user?.user_metadata?.first_name + ' ' + user?.user_metadata?.last_name || 'A team member'

      // Call the Edge Function to send the invitation email
      try {
        await supabase.functions.invoke('clever-worker', {
          body: {
            email: inviteEmail.trim(),
            organizationName,
            invitedBy: invitedByName,
            organizationId: organization.organization_id,
            inviteId: inviteData.id
          }
        })
      } catch (error) {
        console.log('Edge function call failed (expected for now):', error)
      }

      setInviteEmail('')
      setSuccess(`Invitation created successfully! Copy and share this link: ${inviteUrl}`)
      await loadInvites()
      await loadMembers()
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

  const handleCopyInviteLink = async (inviteId: string) => {
    try {
      const inviteUrl = `${window.location.origin}/signup?invite=${inviteId}`
      await navigator.clipboard.writeText(inviteUrl)
      setSuccess('Invitation link copied to clipboard!')
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error copying invite link:', error)
      setError('Failed to copy invitation link')
      
      // Clear error message after 3 seconds
      setTimeout(() => setError(''), 3000)
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
      <DashboardHeader user={user} organization={organization} />

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
            <div className="team-sections-grid">
              <div className="team-section">
                <h3>Team Members ({members.length})</h3>
                {members.length === 0 ? (
                  <div className="no-members">
                    <p>No members found</p>
                    <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                      Debug: Members data: {JSON.stringify(members, null, 2)}
                    </p>
                  </div>
                ) : (
                  <div className="members-list">
                    {members.map(member => (
                      <div key={member.id} className="member-item">
                        <div className="member-info">
                          <div className="member-name">
                            {member.profiles?.first_name || 'Unknown'} {member.profiles?.last_name || 'User'}
                          </div>
                          <div className="member-details">
                            <span className="member-email">{member.profiles?.email || 'No email'}</span>
                            <span className="member-joined">
                              Joined {new Date(member.joined_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="member-role">
                          <span className={`role-badge role-${member.role}`}>
                            {member.role}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

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

                <div className="pending-invites-section">
                  <h4>Pending Invitations</h4>
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
                            <div className="invite-details">
                              <span className="invite-date">
                                Sent {new Date(invite.created_at).toLocaleDateString()}
                              </span>
                              <span className={`invite-status invite-status-${invite.status}`}>
                                {invite.status}
                              </span>
                            </div>
                          </div>
                          <div className="invite-actions">
                            <button
                              onClick={() => handleCopyInviteLink(invite.id)}
                              className="btn btn-secondary btn-small"
                            >
                              Copy Link
                            </button>
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
          </div>
        </div>
      </main>
    </div>
  )
} 