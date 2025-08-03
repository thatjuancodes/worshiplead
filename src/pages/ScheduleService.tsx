import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCurrentUser, getUserPrimaryOrganization } from '../lib/auth'
import type { User } from '@supabase/supabase-js'

interface WorshipService {
  id: string
  organization_id: string
  title: string
  service_date: string
  service_time?: string
  description?: string
  status: 'draft' | 'published' | 'completed'
  created_at: string
  updated_at: string
}

interface Song {
  id: string
  title: string
  artist: string
  key?: string
  bpm?: number
  ccli_number?: string
  tags?: string[]
}

interface OrganizationData {
  organization_id: string
  role: string
  organizations: {
    name: string
    slug: string
  }[]
}

export function ScheduleService() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [services, setServices] = useState<WorshipService[]>([])
  const [creating, setCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  
  // Form state
  const [title, setTitle] = useState('')
  const [serviceDate, setServiceDate] = useState('')
  const [serviceTime, setServiceTime] = useState('')
  const [description, setDescription] = useState('')
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

  // Load services
  const loadServices = useCallback(async () => {
    if (!organization) return

    try {
      const { data, error } = await supabase
        .from('worship_services')
        .select('*')
        .eq('organization_id', organization.organization_id)
        .order('service_date', { ascending: false })

      if (error) {
        console.error('Error loading services:', error)
        return
      }

      setServices(data || [])
    } catch (error) {
      console.error('Error loading services:', error)
    }
  }, [organization])

  useEffect(() => {
    checkUserAndOrganization()
  }, [checkUserAndOrganization])

  useEffect(() => {
    if (organization) {
      loadServices()
    }
  }, [organization, loadServices])

  // Create new service
  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!organization || !user) {
      setError('You must be logged in to create a service.')
      return
    }

    if (!title.trim() || !serviceDate) {
      setError('Please fill in all required fields.')
      return
    }

    try {
      setCreating(true)
      setError('')

      const { data, error } = await supabase
        .from('worship_services')
        .insert({
          organization_id: organization.organization_id,
          title: title.trim(),
          service_date: serviceDate,
          service_time: serviceTime || null,
          description: description.trim() || null,
          status: 'draft',
          created_by: user.id
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating service:', error)
        setError('Failed to create service. Please try again.')
        return
      }

      setSuccess('Service created successfully!')
      setTitle('')
      setServiceDate('')
      setServiceTime('')
      setDescription('')
      setShowCreateForm(false)
      
      await loadServices()
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error creating service:', error)
      setError('Failed to create service. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const handleSignOut = async () => {
    try {
      const { signOut } = await import('../lib/auth')
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      draft: 'status-draft',
      published: 'status-published',
      completed: 'status-completed'
    }
    return `status-badge ${statusClasses[status as keyof typeof statusClasses] || 'status-draft'}`
  }

  if (loading) {
    return (
      <div className="schedule">
        <div className="schedule-loading">
          <div className="loading-spinner">
            <div className="spinner"></div>
          </div>
          <p>Loading services...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="schedule">
      <header className="schedule-header">
        <div className="schedule-header-content">
          <div className="schedule-logo">
            <h1>Worship Lead</h1>
          </div>
          <div className="schedule-user-info">
            <span className="user-name">
              {user?.user_metadata?.first_name} {user?.user_metadata?.last_name}
            </span>
            <span className="organization-name">
              {organization?.organizations?.[0]?.name || 'Loading...'}
            </span>
            <button onClick={handleSignOut} className="btn btn-secondary btn-small">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="schedule-main">
        <div className="schedule-container">
          <div className="schedule-header-section">
            <div className="schedule-title">
              <h2>Schedule Service</h2>
              <p>Create and manage worship services for your organization</p>
            </div>
            <div className="schedule-actions">
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="btn btn-primary"
              >
                {showCreateForm ? 'Cancel' : 'Create New Service'}
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="btn btn-secondary"
              >
                Back to Dashboard
              </button>
            </div>
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

          {showCreateForm && (
            <div className="schedule-section">
              <h3>Create New Service</h3>
              <form onSubmit={handleCreateService} className="service-form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="title">Service Title *</label>
                    <input
                      type="text"
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Sunday Morning Service"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="serviceDate">Service Date *</label>
                    <input
                      type="date"
                      id="serviceDate"
                      value={serviceDate}
                      onChange={(e) => setServiceDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="serviceTime">Service Time</label>
                    <input
                      type="time"
                      id="serviceTime"
                      value={serviceTime}
                      onChange={(e) => setServiceTime(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Optional description or notes..."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={creating || !title.trim() || !serviceDate}
                  >
                    {creating ? 'Creating Service...' : 'Create Service'}
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="schedule-section">
            <h3>Worship Services ({services.length})</h3>
            {services.length === 0 ? (
              <div className="no-services">
                <p>No services found</p>
                <p>Create your first worship service to get started.</p>
              </div>
            ) : (
              <div className="services-list">
                {services.map(service => (
                  <div key={service.id} className="service-item">
                    <div className="service-info">
                      <div className="service-header">
                        <h4 className="service-title">{service.title}</h4>
                        <span className={getStatusBadge(service.status)}>
                          {service.status}
                        </span>
                      </div>
                      <div className="service-details">
                        <span className="service-date">
                          {formatDate(service.service_date)}
                        </span>
                        {service.service_time && (
                          <span className="service-time">
                            {service.service_time}
                          </span>
                        )}
                        {service.description && (
                          <p className="service-description">
                            {service.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="service-actions">
                      <button
                        onClick={() => navigate(`/service/${service.id}`)}
                        className="btn btn-primary btn-small"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => navigate(`/service/${service.id}/edit`)}
                        className="btn btn-secondary btn-small"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
} 