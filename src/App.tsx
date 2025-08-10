import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import './pages/ScheduleService.css'
import './pages/ServiceDetail.css'
import './pages/ServiceEdit.css'

import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { OrganizationSetup } from './pages/OrganizationSetup'
import { Dashboard } from './pages/Dashboard'
import { Songbank } from './pages/Songbank'
import { TeamManagement } from './pages/TeamManagement'
import { ScheduleService } from './pages/ScheduleService'
import { ServiceDetail } from './pages/ServiceDetail'
import { ServiceEdit } from './pages/ServiceEdit'
import { OnboardingFlow } from './pages/OnboardingFlow'

// Component to handle onboarding for authenticated users
function AuthenticatedHome() {
  const location = useLocation()
  
  useEffect(() => {
    // Check if user is authenticated and needs onboarding
    const checkUserStatus = async () => {
      try {
        console.log('AuthenticatedHome: Checking user status...')
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (error) {
          console.error('AuthenticatedHome: Auth error:', error)
          return
        }
        
        if (user) {
          console.log('AuthenticatedHome: Found authenticated user:', user.id)
          console.log('AuthenticatedHome: User metadata:', user.user_metadata)
          
          // Check if user has invitation data
          if (user.user_metadata?.invite_id) {
            console.log('AuthenticatedHome: Found invitation data, redirecting to onboarding')
            window.location.href = '/onboarding'
          } else {
            console.log('AuthenticatedHome: No invitation data found')
          }
        } else {
          console.log('AuthenticatedHome: No authenticated user found')
        }
      } catch (error) {
        console.error('AuthenticatedHome: Error checking user status:', error)
      }
    }
    
    // Add a small delay to ensure auth is ready
    setTimeout(() => {
      checkUserStatus()
    }, 1000)
  }, [location])

  return <HomePage />
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AuthenticatedHome />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/organization-setup" element={<OrganizationSetup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/songbank" element={<Songbank />} />
        <Route path="/team" element={<TeamManagement />} />
        <Route path="/schedule" element={<ScheduleService />} />
        <Route path="/service/:id" element={<ServiceDetail />} />
        <Route path="/service/:id/edit" element={<ServiceEdit />} />
        <Route path="/onboarding" element={<OnboardingFlow />} />
      </Routes>
    </Router>
  )
}

export default App
