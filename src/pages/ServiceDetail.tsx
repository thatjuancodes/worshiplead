import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCurrentUser, getUserPrimaryOrganization } from '../lib/auth'
import type { User } from '@supabase/supabase-js'
import './ServiceDetail.css'

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

interface OrganizationData {
  organization_id: string
  role: string
  organizations: {
    name: string
    slug: string
  }[]
}

export function ServiceDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [service, setService] = useState<WorshipService | null>(null)
  const [error, setError] = useState('')

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
    } catch (error) {
      console.error('Error checking user and organization:', error)
      navigate('/login')
    }
  }, [navigate])

  const loadService = useCallback(async () => {
    if (!id || !organization) return

    try {
      const { data, error } = await supabase
        .from('worship_services')
        .select('*')
        .eq('id', id)
        .eq('organization_id', organization.organization_id)
        .single()

      if (error) {
        console.error('Error loading service:', error)
        if (error.code === 'PGRST116') {
          setError('Service not found or you do not have access to it.')
        } else {
          setError('Failed to load service details.')
        }
        return
      }

      setService(data)
    } catch (error) {
      console.error('Error loading service:', error)
      setError('Failed to load service details.')
    } finally {
      setLoading(false)
    }
  }, [id, organization])

  useEffect(() => {
    checkUserAndOrganization()
  }, [checkUserAndOrganization])

  useEffect(() => {
    if (organization) {
      loadService()
    }
  }, [organization, loadService])

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
      <div className="service-detail">
        <div className="service-loading">
          <div className="loading-spinner">
            <div className="spinner"></div>
          </div>
          <p>Loading service details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="service-detail">
        <header className="service-header">
          <div className="service-header-content">
            <div className="service-logo">
              <h1>Worship Lead</h1>
            </div>
            <div className="service-user-info">
              <span className="user-name">
                {user?.user_metadata?.first_name} {user?.user_metadata?.last_name}
              </span>
              <span className="organization-name">
                {organization?.organizations?.name || organization?.organizations?.[0]?.name || 'Loading...'}
              </span>
              <button onClick={handleSignOut} className="btn btn-secondary btn-small">
                Sign Out
              </button>
            </div>
          </div>
        </header>

        <main className="service-main">
          <div className="service-container">
            <div className="error-section">
              <h2>Error</h2>
              <p>{error}</p>
              <button onClick={() => navigate('/schedule')} className="btn btn-primary">
                Back to Services
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!service) {
    return (
      <div className="service-detail">
        <div className="service-loading">
          <p>Service not found</p>
          <button onClick={() => navigate('/schedule')} className="btn btn-primary">
            Back to Services
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="service-detail">
      <header className="service-header">
        <div className="service-header-content">
          <div className="service-logo">
            <h1>Worship Lead</h1>
          </div>
          <div className="service-user-info">
            <span className="user-name">
              {user?.user_metadata?.first_name} {user?.user_metadata?.last_name}
            </span>
            <span className="organization-name">
              {organization?.organizations?.name || organization?.organizations?.[0]?.name || 'Loading...'}
            </span>
            <button onClick={handleSignOut} className="btn btn-secondary btn-small">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="service-main">
        <div className="service-container">
          <div className="service-header-section">
            <div className="service-title">
              <h2>Service Details</h2>
              <p>View and manage your worship service</p>
            </div>
            <div className="service-actions">
              <button
                onClick={() => navigate(`/service/${service.id}/edit`)}
                className="btn btn-primary"
              >
                Edit Service
              </button>
              <button
                onClick={() => navigate('/schedule')}
                className="btn btn-secondary"
              >
                Back to Services
              </button>
            </div>
          </div>

          <div className="service-content">
            <div className="service-info-section">
              <div className="service-header-info">
                <h3>{service.title}</h3>
                <span className={getStatusBadge(service.status)}>
                  {service.status}
                </span>
              </div>

              <div className="service-details-grid">
                <div className="detail-item">
                  <label>Service Date</label>
                  <span>{formatDate(service.service_date)}</span>
                </div>

                {service.service_time && (
                  <div className="detail-item">
                    <label>Service Time</label>
                    <span>{service.service_time}</span>
                  </div>
                )}

                <div className="detail-item">
                  <label>Created</label>
                  <span>{formatDate(service.created_at)}</span>
                </div>

                <div className="detail-item">
                  <label>Last Updated</label>
                  <span>{formatDate(service.updated_at)}</span>
                </div>
              </div>

              {service.description && (
                <div className="service-description">
                  <label>Description</label>
                  <p>{service.description}</p>
                </div>
              )}
            </div>

            <div className="service-songs-section">
              <div className="section-header">
                <h3>Service Songs</h3>
                <button className="btn btn-primary btn-small">
                  Add Songs
                </button>
              </div>
              
              <div className="no-songs">
                <p>No songs added to this service yet</p>
                <p>Add songs from your songbank to create a setlist</p>
              </div>
            </div>

            <div className="service-notes-section">
              <div className="section-header">
                <h3>Service Notes</h3>
                <button className="btn btn-secondary btn-small">
                  Add Notes
                </button>
              </div>
              
              <div className="no-notes">
                <p>No notes added yet</p>
                <p>Add notes for the worship team, announcements, or special instructions</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 