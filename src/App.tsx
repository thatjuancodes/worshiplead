import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import './App.css'
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
import { InvitationHandler } from './pages/InvitationHandler'

// Component to handle invitation redirects
function InvitationRedirect() {
  const location = useLocation()
  
  useEffect(() => {
    // Check if user has invitation data in their metadata
    const checkForInvitation = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.user_metadata?.invite_id) {
          console.log('Found invitation data, redirecting to /invitation')
          window.location.href = '/invitation'
        }
      } catch (error) {
        console.error('Error checking for invitation:', error)
      }
    }
    
    checkForInvitation()
  }, [location])

  return <HomePage />
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<InvitationRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/organization-setup" element={<OrganizationSetup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/songbank" element={<Songbank />} />
        <Route path="/team" element={<TeamManagement />} />
        <Route path="/schedule" element={<ScheduleService />} />
        <Route path="/service/:id" element={<ServiceDetail />} />
        <Route path="/service/:id/edit" element={<ServiceEdit />} />
        <Route path="/invitation" element={<InvitationHandler />} />
      </Routes>
    </Router>
  )
}

export default App
