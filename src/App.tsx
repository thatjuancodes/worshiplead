import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
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

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/organization-setup" element={<OrganizationSetup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/songbank" element={<Songbank />} />
        <Route path="/team" element={<TeamManagement />} />
        <Route path="/schedule" element={<ScheduleService />} />
        <Route path="/service/:id" element={<ServiceDetail />} />
        <Route path="/service/:id/edit" element={<ServiceEdit />} />
      </Routes>
    </Router>
  )
}

export default App
