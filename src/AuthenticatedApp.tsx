import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { 
  Spinner, 
  VStack, 
  Text, 
  useColorModeValue,
  Center
} from '@chakra-ui/react'
import { useAuth } from './contexts'
import { OrganizationMembershipsProvider } from './contexts'

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
import { VolunteerPage } from './pages/VolunteerPage'
import { OrganizationAccessDemo } from './pages/OrganizationAccessDemo'

// Component to handle onboarding for authenticated users
function AuthenticatedHome() {
  const { user, isLoading, error } = useAuth()
  
  const spinnerColor = useColorModeValue('blue.500', 'blue.300')
  const textColor = useColorModeValue('gray.600', 'gray.300')
  
  if (isLoading) {
    return (
      <Center minH="100vh" bg={useColorModeValue('gray.50', 'gray.900')}>
        <VStack spacing={4}>
          <Spinner size="xl" color={spinnerColor} thickness="4px" />
          <Text color={textColor} fontSize="lg">
            Loading...
          </Text>
        </VStack>
      </Center>
    )
  }

  if (error) {
    return (
      <Center minH="100vh" bg={useColorModeValue('gray.50', 'gray.900')}>
        <VStack spacing={4}>
          <Text color="red.500" fontSize="lg" textAlign="center">
            {error}
          </Text>
          <Text color={textColor} fontSize="md" textAlign="center">
            Please refresh the page or try again later.
          </Text>
        </VStack>
      </Center>
    )
  }

  if (user) {
    // Check if user has invitation data
    if (user.user_metadata?.invite_id) {
      window.location.href = '/onboarding'
      return null // Don't render anything while redirecting
    }
  }

  return <HomePage />
}

function AppRoutes() {
  return (
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
      <Route path="/volunteer/:publicUrl" element={<VolunteerPage />} />
      <Route path="/org-access-demo" element={<OrganizationAccessDemo />} />
    </Routes>
  )
}

export function AuthenticatedApp() {
  const { user } = useAuth()

  return (
    <Router>
      <OrganizationMembershipsProvider userId={user?.id || null}>
        <AppRoutes />
      </OrganizationMembershipsProvider>
    </Router>
  )
}
