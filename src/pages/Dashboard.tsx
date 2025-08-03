import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser, getUserPrimaryOrganization } from '../lib/auth'
import './Dashboard.css'

export function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [organization, setOrganization] = useState<any>(null)

  useEffect(() => {
    checkUserAndOrganization()
  }, [])

  const checkUserAndOrganization = async () => {
    try {
      // Check if user is authenticated
      const currentUser = await getCurrentUser()
      
      if (!currentUser) {
        // User not authenticated, redirect to login
        navigate('/login')
        return
      }

      setUser(currentUser)

      // Check if user has an organization
      const userOrg = await getUserPrimaryOrganization(currentUser.id)
      
      if (!userOrg) {
        // User has no organization, redirect to organization setup
        navigate('/organization-setup')
        return
      }

      setOrganization(userOrg)
      setLoading(false)
    } catch (error) {
      console.error('Error checking user and organization:', error)
      // If there's an error, redirect to login
      navigate('/login')
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
      <header className="dashboard-header">
        <div className="dashboard-header-content">
          <div className="dashboard-logo">
            <h1>Worship Lead</h1>
          </div>
          
          <div className="dashboard-user-info">
            <span className="user-name">
              {user?.user_metadata?.first_name} {user?.user_metadata?.last_name}
            </span>
            <span className="organization-name">
              {organization?.organizations?.name}
            </span>
            <button onClick={handleSignOut} className="btn btn-secondary btn-small">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-container">
          <div className="dashboard-welcome">
            <h2>Welcome to Worship Lead</h2>
            <p>You're logged into <strong>{organization?.organizations?.name}</strong></p>
          </div>

          <div className="dashboard-content">
            <div className="dashboard-section">
              <h3>Quick Actions</h3>
              <div className="quick-actions">
                <div className="action-card">
                  <h4>Schedule Service</h4>
                  <p>Plan your next worship service</p>
                  <button className="btn btn-primary">Create Schedule</button>
                </div>

                <div className="action-card">
                  <h4>Manage Team</h4>
                  <p>Add or manage team members</p>
                  <button className="btn btn-secondary">View Team</button>
                </div>

                <div className="action-card">
                  <h4>Song Library</h4>
                  <p>Manage your song collection</p>
                  <button className="btn btn-secondary">Browse Songs</button>
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