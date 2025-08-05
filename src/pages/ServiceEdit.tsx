import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCurrentUser, getUserPrimaryOrganization } from '../lib/auth'
import { DashboardHeader } from '../components'
import type { User } from '@supabase/supabase-js'
import './ServiceEdit.css'
import './Dashboard.css'

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

export function ServiceEdit() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [service, setService] = useState<WorshipService | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    service_date: '',
    service_time: '',
    description: '',
    status: 'draft' as 'draft' | 'published' | 'completed'
  })

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
    if (!id) return

    try {
      const { data, error } = await supabase
        .from('worship_services')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        console.error('Error loading service:', error)
        setError('Failed to load service details.')
        return
      }

      if (!data) {
        setError('Service not found.')
        return
      }

      setService(data)
      
      // Set form data
      setFormData({
        title: data.title || '',
        service_date: data.service_date ? data.service_date.split('T')[0] : '',
        service_time: data.service_time || '',
        description: data.description || '',
        status: data.status || 'draft'
      })
    } catch (error) {
      console.error('Error loading service:', error)
      setError('Failed to load service details.')
    }
  }, [id])

  useEffect(() => {
    const initialize = async () => {
      await checkUserAndOrganization()
      await loadService()
      setLoading(false)
    }
    initialize()
  }, [checkUserAndOrganization, loadService])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!service) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error } = await supabase
        .from('worship_services')
        .update({
          title: formData.title,
          service_date: formData.service_date,
          service_time: formData.service_time || null,
          description: formData.description || null,
          status: formData.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', service.id)

      if (error) {
        console.error('Error updating service:', error)
        setError('Failed to update service.')
        return
      }

      setSuccess('Service updated successfully!')
      setTimeout(() => {
        navigate(`/service/${service.id}`)
      }, 1500)
    } catch (error) {
      console.error('Error updating service:', error)
      setError('Failed to update service.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    navigate(`/service/${id}`)
  }



  if (loading) {
    return (
      <div className="service-edit">
        <div className="service-loading">
          <div className="loading-spinner">
            <div className="spinner"></div>
          </div>
          <p>Loading service details...</p>
        </div>
      </div>
    )
  }

  if (error && !service) {
    return (
      <div className="service-edit">
        <DashboardHeader user={user} organization={organization} />

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
      <div className="service-edit">
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
    <div className="service-edit">
      <DashboardHeader user={user} organization={organization} />

      <main className="service-main">
        <div className="service-container">
          <div className="service-header-section">
            <div className="service-title">
              <h2>Edit Service</h2>
              <p>Update your worship service details</p>
            </div>
            <div className="service-actions">
              <button
                onClick={handleCancel}
                className="btn btn-secondary"
              >
                Cancel
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

          <div className="service-content">
            <form onSubmit={handleSubmit} className="edit-service-form">
              <div className="form-group">
                <label htmlFor="title">Service Title *</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="form-input"
                  placeholder="e.g., Sunday Morning Service"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="service_date">Service Date *</label>
                  <input
                    type="date"
                    id="service_date"
                    name="service_date"
                    value={formData.service_date}
                    onChange={handleInputChange}
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="service_time">Service Time</label>
                  <input
                    type="time"
                    id="service_time"
                    name="service_time"
                    value={formData.service_time}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="form-select"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="form-textarea"
                  rows={4}
                  placeholder="Add any additional details about this service..."
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="btn btn-secondary"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
} 