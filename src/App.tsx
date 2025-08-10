import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { 
  Box, 
  Spinner, 
  VStack, 
  Text, 
  useColorModeValue,
  Center
} from '@chakra-ui/react'

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
  const [isChecking, setIsChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const spinnerColor = useColorModeValue('blue.500', 'blue.300')
  const textColor = useColorModeValue('gray.600', 'gray.300')
  
  useEffect(() => {
    // Check if user is authenticated and needs onboarding
    const checkUserStatus = async () => {
      try {
        console.log('AuthenticatedHome: Checking user status...')
        
        // First check if there's an active session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('AuthenticatedHome: Session error:', sessionError)
          setError('Failed to check authentication status')
          return
        }
        
        if (session?.user) {
          console.log('AuthenticatedHome: Found authenticated user:', session.user.id)
          console.log('AuthenticatedHome: User metadata:', session.user.user_metadata)
          
          // Check if user has invitation data
          if (session.user.user_metadata?.invite_id) {
            console.log('AuthenticatedHome: Found invitation data, redirecting to onboarding')
            window.location.href = '/onboarding'
          } else {
            console.log('AuthenticatedHome: No invitation data found, user is fully authenticated')
          }
        } else {
          console.log('AuthenticatedHome: No authenticated user found - this is normal for new visitors')
        }
      } catch (error) {
        console.error('AuthenticatedHome: Unexpected error checking user status:', error)
        setError('An unexpected error occurred')
      } finally {
        setIsChecking(false)
      }
    }
    
    // Add a small delay to ensure auth is ready
    setTimeout(() => {
      checkUserStatus()
    }, 1000)
  }, [location])

  if (isChecking) {
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

  return <HomePage />
}

function App() {
  return (
    <Box minH="100vh" bg={useColorModeValue('white', 'gray.900')}>
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
    </Box>
  )
}

export default App
