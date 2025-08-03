import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createOrganizationAndMembership, joinOrganizationViaInvite, checkSlugAvailability } from '../lib/auth'
import type { OrganizationData } from '../lib/auth'
import './OrganizationSetup.css'

export function OrganizationSetup() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Organization creation form state
  const [orgForm, setOrgForm] = useState({
    name: '',
    slug: ''
  })

  // Join organization form state
  const [joinForm, setJoinForm] = useState({
    organizationSlug: ''
  })

  // Handle organization creation
  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Check slug availability
      const isAvailable = await checkSlugAvailability(orgForm.slug)
      if (!isAvailable) {
        setError('Organization slug already exists. Please choose a different name.')
        return
      }

      const orgData: OrganizationData = {
        name: orgForm.name,
        slug: orgForm.slug
      }

      // Get current user ID
      const { data: { user } } = await import('../lib/supabase').then(m => m.supabase.auth.getUser())
      
      if (!user) {
        setError('User not authenticated')
        return
      }

      await createOrganizationAndMembership(user.id, orgData)
      
      // Success! Redirect to dashboard
      navigate('/dashboard', { 
        state: { message: 'Organization created successfully!' }
      })
    } catch (err) {
      console.error('Organization creation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to create organization')
    } finally {
      setLoading(false)
    }
  }

  // Handle joining organization
  const handleJoinOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Get current user ID
      const { data: { user } } = await import('../lib/supabase').then(m => m.supabase.auth.getUser())
      
      if (!user) {
        setError('User not authenticated')
        return
      }

      await joinOrganizationViaInvite(user.id, joinForm.organizationSlug)
      
      // Success! Redirect to dashboard
      navigate('/dashboard', { 
        state: { message: 'Successfully joined organization!' }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join organization')
    } finally {
      setLoading(false)
    }
  }

  // Generate slug from organization name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const handleOrgNameChange = (name: string) => {
    setOrgForm(prev => ({
      ...prev,
      name,
      slug: generateSlug(name)
    }))
  }

  return (
    <div className="org-setup">
      <div className="org-setup-container">
        <div className="org-setup-header">
          <h1>Worship Lead</h1>
          <h2>Set Up Your Organization</h2>
          <p>Choose how you'd like to get started with Worship Lead</p>
        </div>

        <div className="org-setup-content">
          {/* Error Display */}
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Mode Selection */}
          {mode === 'select' && (
            <div className="mode-selection">
              <div className="mode-options">
                <div className="mode-card" onClick={() => setMode('create')}>
                  <h3>Create New Organization</h3>
                  <p>Start a new church or ministry organization</p>
                  <button className="btn btn-primary">Create New</button>
                </div>

                <div className="mode-card" onClick={() => setMode('join')}>
                  <h3>Join Existing Organization</h3>
                  <p>Join an organization you've been invited to</p>
                  <button className="btn btn-secondary">Join Existing</button>
                </div>
              </div>

              <div className="skip-section">
                <p>Not ready to set up an organization?</p>
                <button 
                  className="btn btn-text"
                  onClick={() => navigate('/dashboard')}
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}

          {/* Create Organization */}
          {mode === 'create' && (
            <form onSubmit={handleCreateOrganization} className="org-form">
              <h3>Create Your Organization</h3>
              <p>Set up your church or ministry organization</p>

              <div className="form-group">
                <label htmlFor="orgName">Organization Name</label>
                <input
                  type="text"
                  id="orgName"
                  value={orgForm.name}
                  onChange={(e) => handleOrgNameChange(e.target.value)}
                  placeholder="e.g., Grace Community Church"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="orgSlug">Organization URL</label>
                <div className="slug-input">
                  <span className="slug-prefix">worshiplead.com/</span>
                  <input
                    type="text"
                    id="orgSlug"
                    value={orgForm.slug}
                    onChange={(e) => setOrgForm(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="grace-community"
                    required
                  />
                </div>
                <small>This will be your unique organization URL</small>
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setMode('select')}
                >
                  ← Back
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Organization'}
                </button>
              </div>
            </form>
          )}

          {/* Join Organization */}
          {mode === 'join' && (
            <form onSubmit={handleJoinOrganization} className="org-form">
              <h3>Join Organization</h3>
              <p>Enter the organization slug from your invite</p>

              <div className="form-group">
                <label htmlFor="joinSlug">Organization Slug</label>
                <div className="slug-input">
                  <span className="slug-prefix">worshiplead.com/</span>
                  <input
                    type="text"
                    id="joinSlug"
                    value={joinForm.organizationSlug}
                    onChange={(e) => setJoinForm(prev => ({ ...prev, organizationSlug: e.target.value }))}
                    placeholder="organization-slug"
                    required
                  />
                </div>
                <small>Enter the organization slug from your invitation email</small>
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setMode('select')}
                >
                  ← Back
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Joining...' : 'Join Organization'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
} 