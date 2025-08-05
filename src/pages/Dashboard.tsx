import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser, getUserPrimaryOrganization } from '../lib/auth'
import { DashboardHeader } from '../components'
import type { User } from '@supabase/supabase-js'
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



export function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<OrganizationData | null>(null)

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
        navigate('/organization-setup') // Redirect if no organization
        return
      }
      setOrganization(userOrg)
      setLoading(false)
    } catch (error) {
      console.error('Error checking user and organization:', error)
      navigate('/login')
    }
  }, [navigate])

  useEffect(() => {
    checkUserAndOrganization()
  }, [checkUserAndOrganization])





  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <DashboardHeader user={user} organization={organization} />

      <main className="dashboard-main">
        <div className="dashboard-container">
          <div className="dashboard-welcome">
            <h2>Welcome to Worship Lead</h2>
            <p>You're logged into your organization</p>
          </div>

          <div className="dashboard-content">
            <div className="dashboard-section">
              <h3>Quick Actions</h3>
              <div className="quick-actions">
                <div className="action-card">
                  <h4>Schedule Service</h4>
                  <p>Plan your next worship service</p>
                  <button 
                    onClick={() => navigate('/schedule')} 
                    className="btn btn-primary"
                  >
                    Manage Schedule
                  </button>
                </div>

                <div className="action-card">
                  <h4>Manage Team</h4>
                  <p>Add or manage team members</p>
                  <button 
                    onClick={() => navigate('/team')} 
                    className="btn btn-secondary"
                  >
                    View Team
                  </button>
                </div>

                <div className="action-card">
                  <h4>Song Library</h4>
                  <p>Manage your song collection</p>
                  <button 
                    onClick={() => navigate('/songbank')} 
                    className="btn btn-secondary"
                  >
                    Manage Songs
                  </button>
                </div>
              </div>
            </div>

            <div className="dashboard-section">
              <h3>Recent Activity</h3>
              <div className="activity-list">
                <div className="activity-item">
                  <div className="activity-icon">📅</div>
                  <div className="activity-content">
                    <p>No recent activity</p>
                    <small>Your activity will appear here</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 