import { Link } from 'react-router-dom'
import { signOut } from '../lib/auth'
import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'

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

interface DashboardHeaderProps {
  user: User | null
  organization: OrganizationData | null
}

// Helper function to get organization name
const getOrganizationName = (organization: OrganizationData | null): string => {
  if (!organization?.organizations) return 'Loading...'
  
  if (Array.isArray(organization.organizations)) {
    return organization.organizations[0]?.name || 'Loading...'
  }
  
  return organization.organizations.name || 'Loading...'
}

export function DashboardHeader({ user, organization }: DashboardHeaderProps) {
  const navigate = useNavigate()

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <header className="dashboard-header">
      <div className="dashboard-header-content">
        <div className="dashboard-logo">
          <Link to="/dashboard" className="logo-link">
            <h1>Worship Lead</h1>
          </Link>
        </div>
        
        <div className="dashboard-user-info">
          <span className="user-name">
            {user?.user_metadata?.first_name} {user?.user_metadata?.last_name}
          </span>
          <span className="organization-name">
            {getOrganizationName(organization)}
          </span>
          <button onClick={handleSignOut} className="btn btn-secondary btn-small">
            Sign Out
          </button>
        </div>
      </div>
    </header>
  )
} 