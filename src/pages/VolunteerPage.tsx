import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  Spinner,
  Center,
  Badge,
  useColorModeValue,
  useToast,
  Alert,
  AlertIcon
} from '@chakra-ui/react'
import { supabase } from '../lib/supabase'
import { signInWithGoogleFromVolunteer, ensureUserProfileAndMembership } from '../lib/auth'

interface OrganizationData {
  id: string
  name: string
  slug: string
}

interface WorshipService {
  id: string
  title: string
  service_date: string
  service_time?: string
  description?: string
  status: 'draft' | 'published' | 'completed'
}

interface VolunteerAssignment {
  id: string
  worship_service_id: string
  user_id: string
  created_at: string
}

export function VolunteerPage() {
  const { publicUrl } = useParams<{ publicUrl: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [availableServices, setAvailableServices] = useState<WorshipService[]>([])
  const [loadingServices, setLoadingServices] = useState(false)
  const [userVolunteerAssignments, setUserVolunteerAssignments] = useState<VolunteerAssignment[]>([])
  const [assigningService, setAssigningService] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  const bgColor = useColorModeValue('gray.50', 'gray.900')
  const cardBg = useColorModeValue('white', 'gray.800')
  const titleColor = useColorModeValue('gray.800', 'white')
  const subtitleColor = useColorModeValue('gray.600', 'gray.300')
  const textColor = useColorModeValue('gray.700', 'gray.200')

  const loadOrganization = useCallback(async () => {
    if (!publicUrl) return
    
    try {
      setLoading(true)
      setError('')
      console.log('Loading organization for volunteer link:', publicUrl)

      // Find organization by volunteer link
      const { data: volunteerLink, error: linkError } = await supabase
        .from('organization_volunteer_links')
        .select(`
          organization_id,
          organizations (
            id,
            name,
            slug
          )
        `)
        .eq('public_url', publicUrl)
        .single()

      if (linkError || !volunteerLink) {
        console.error('Error loading volunteer link:', linkError)
        setError('Invalid volunteer link')
        setLoading(false)
        return
      }

      // Handle the organizations data structure properly
      const orgData = volunteerLink.organizations as any
      if (orgData && typeof orgData === 'object' && 'id' in orgData) {
        console.log('Found organization:', orgData.name)
        setOrganization(orgData as OrganizationData)
      } else {
        console.error('Invalid organization data structure:', orgData)
        setError('Invalid organization data')
        setLoading(false)
        return
      }
      
      setLoading(false)
    } catch (err) {
      console.error('Unexpected error loading organization:', err)
      setError('Failed to load organization')
      setLoading(false)
    }
  }, [publicUrl])

  const loadAvailableServices = useCallback(async () => {
    if (!organization) return
    
    try {
      setLoadingServices(true)
      
      // Get published services that are not completed
      const { data: services, error: servicesError } = await supabase
        .from('worship_services')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('status', 'published')
        .order('service_date', { ascending: true })

      if (servicesError) {
        console.error('Error loading services:', servicesError)
        return
      }

      setAvailableServices(services || [])
    } catch (err) {
      console.error('Unexpected error loading services:', err)
    } finally {
      setLoadingServices(false)
    }
  }, [organization])

  const loadUserVolunteerAssignments = useCallback(async () => {
    if (!user || !organization) return
    
    try {
      // First, ensure user is a member of this organization
      const { data: membership, error: membershipError } = await supabase
        .from('organization_memberships')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()

      if (membershipError && membershipError.code !== 'PGRST116') {
        console.error('Error checking membership:', membershipError)
      }

      // If user is not a member, add them automatically
      if (!membership) {
        console.log('Adding user to organization:', user.id)
        const { error: addMemberError } = await supabase
          .from('organization_memberships')
          .insert({
            organization_id: organization.id,
            user_id: user.id,
            role: 'member',
            status: 'active'
          })

        if (addMemberError) {
          console.error('Error adding user to organization:', addMemberError)
        }
      }

      // Now load volunteer assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from('worship_service_volunteers')
        .select('*')
        .eq('user_id', user.id)

      if (assignmentsError) {
        console.error('Error loading volunteer assignments:', assignmentsError)
        return
      }

      setUserVolunteerAssignments(assignments || [])
    } catch (err) {
      console.error('Unexpected error loading volunteer assignments:', err)
    }
  }, [user, organization])

  const toggleVolunteerStatus = async (serviceId: string, isAssigned: boolean) => {
    if (!user || !organization) return
    
    try {
      setAssigningService(serviceId)
      
      // If already assigned, remove the assignment
      if (isAssigned) {
        const { error: removeError } = await supabase
          .from('worship_service_volunteers')
          .delete()
          .eq('user_id', user.id)
          .eq('worship_service_id', serviceId)

        if (removeError) {
          console.error('Error removing volunteer assignment:', removeError)
          toast({
            title: 'Error',
            description: 'Failed to remove volunteer assignment',
            status: 'error',
            duration: 3000,
            isClosable: true
          })
          return
        }

        toast({
          title: 'Success!',
          description: 'You have been removed from this service',
          status: 'success',
          duration: 3000,
          isClosable: true
        })
      } else {
        // If not assigned, add the assignment
        const { error: assignmentError } = await supabase
          .from('worship_service_volunteers')
          .insert({
            worship_service_id: serviceId,
            user_id: user.id
          })

        if (assignmentError) {
          console.error('Error assigning to service:', assignmentError)
          toast({
            title: 'Error',
            description: 'Failed to assign you to this service',
            status: 'error',
            duration: 3000,
            isClosable: true
          })
          return
        }

        toast({
          title: 'Success!',
          description: 'You have been assigned to this service',
          status: 'success',
          duration: 3000,
          isClosable: true
        })
      }

      // Refresh assignments
      await loadUserVolunteerAssignments()
    } catch (err) {
      console.error('Unexpected error toggling volunteer status:', err)
      toast({
        title: 'Error',
        description: 'Failed to update volunteer status',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    } finally {
      setAssigningService(null)
    }
  }

  const handleGoogleSignIn = async () => {
    if (!organization) return
    
    setGoogleLoading(true)
    setError('')

    try {
      await signInWithGoogleFromVolunteer()
      // The redirect will happen automatically via Supabase OAuth
    } catch (error: any) {
      setError(error.message || 'Failed to sign in with Google')
      setGoogleLoading(false)
    }
  }

  // Simple auth state listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('VolunteerPage: Auth state change:', event, session?.user?.id)
      
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        
        // Ensure user has profile and organization membership
        try {
          if (organization) {
            await ensureUserProfileAndMembership(session.user, organization.id)
            console.log('User profile and membership ensured')
          }
        } catch (error) {
          console.error('Error ensuring user profile and membership:', error)
          toast({
            title: 'Warning',
            description: 'Failed to create user profile. Some features may not work properly.',
            status: 'warning',
            duration: 5000,
            isClosable: true
          })
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
      }
    })

    // Check initial session
    const checkInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        
        // Ensure user has profile and organization membership for existing sessions
        try {
          if (organization) {
            await ensureUserProfileAndMembership(session.user, organization.id)
            console.log('Existing user profile and membership ensured')
          }
        } catch (error) {
          console.error('Error ensuring existing user profile and membership:', error)
        }
      }
    }
    
    checkInitialSession()
    
    return () => subscription.unsubscribe()
  }, [organization, toast])

  useEffect(() => {
    if (publicUrl) {
      loadOrganization()
    }
  }, [publicUrl, loadOrganization])

  useEffect(() => {
    if (organization && user) {
      loadAvailableServices()
      loadUserVolunteerAssignments()
    } else if (organization) {
      loadAvailableServices()
    }
  }, [organization, user, loadAvailableServices, loadUserVolunteerAssignments])

  // Only show loading spinner if we're still loading the organization
  if (loading && !organization) {
    return (
      <Box minH="100vh" bg={bgColor} display="flex" alignItems="center" justifyContent="center">
        <Center>
          <VStack spacing={4}>
            <Spinner size="xl" color="blue.500" />
            <Text color={subtitleColor}>Loading volunteer page...</Text>
          </VStack>
        </Center>
      </Box>
    )
  }

  if (error) {
    return (
      <Box minH="100vh" bg={bgColor} display="flex" alignItems="center" justifyContent="center">
        <Center>
          <VStack spacing={4}>
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              {error}
            </Alert>
            <Button onClick={() => navigate('/')}>Go Home</Button>
          </VStack>
        </Center>
      </Box>
    )
  }

  if (!organization) {
    return (
      <Box minH="100vh" bg={bgColor} display="flex" alignItems="center" justifyContent="center">
        <Center>
          <VStack spacing={4}>
            <Text color={subtitleColor}>Organization not found</Text>
            <Button onClick={() => navigate('/')}>Go Home</Button>
          </VStack>
        </Center>
      </Box>
    )
  }

  return (
    <Box minH="100vh" bg={bgColor} display="flex" alignItems="center" justifyContent="center">
      <Box as="main" maxW="800px" mx="auto" p={{ base: 6, md: 8 }}>
        {/* Header */}
        {user && (
          <VStack spacing={4} mb={8} mt={8} textAlign="center">
            <Heading as="h1" size="xl" color={titleColor} fontWeight="600">
              Volunteer for {organization.name}
            </Heading>
            <Text color={subtitleColor} fontSize="lg">
              Choose a service to volunteer for
            </Text>
            
            <Button
              size="md"
              colorScheme="blue"
              variant="outline"
              onClick={() => navigate('/dashboard')}
            >
              Back to Dashboard
            </Button>
          </VStack>
        )}

        {/* Login Section */}
        {!user && (
          <Box bg={cardBg} mb={6} p={6} borderRadius="lg">
            <VStack spacing={4}>
              <Heading as="h1" size="lg" color={titleColor} fontWeight="600" textAlign="center">
                Volunteer for {organization.name}
              </Heading>
              <Text color={textColor} textAlign="center">
                Please sign in with Google to volunteer for services
              </Text>
              
              <Button
                onClick={handleGoogleSignIn}
                isLoading={googleLoading}
                loadingText="Signing in..."
                size="lg"
                w="full"
                colorScheme="blue"
                leftIcon={
                  <Box as="svg" viewBox="0 0 24 24" w={5} h={5}>
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </Box>
                }
              >
                Continue with Google
              </Button>
            </VStack>
          </Box>
        )}

        {/* Services Section */}
        {user && (
          <VStack spacing={6} align="stretch">
            <Heading as="h2" size="lg" color={titleColor} fontWeight="600">
              Available Services
            </Heading>

            {loadingServices ? (
              <Center py={8}>
                <VStack spacing={3}>
                  <Spinner size="lg" />
                  <Text color={subtitleColor}>Loading available services...</Text>
                </VStack>
              </Center>
            ) : availableServices.length === 0 ? (
              <Box bg={cardBg} p={6} borderRadius="lg">
                <Text color={subtitleColor} textAlign="center">
                  No services available for volunteering at the moment
                </Text>
              </Box>
            ) : (
              availableServices.map(service => {
                const isAssigned = userVolunteerAssignments.some(
                  assignment => assignment.worship_service_id === service.id
                )
                
                return (
                  <Box
                    key={service.id}
                    bg={cardBg}
                    border="1px"
                    borderColor={useColorModeValue('gray.200', 'gray.600')}
                    borderRadius="lg"
                    p={4}
                  >
                    <HStack justify="space-between" align="center" w="100%">
                      <HStack spacing={6} flex={1}>
                        <HStack spacing={2} minW="140px">
                          <Text color={textColor} fontWeight="500">
                            {new Date(service.service_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </Text>
                          
                          {service.service_time && (
                            <Text color={textColor} fontWeight="500">
                              {new Date(`2000-01-01T${service.service_time}`).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                              })}
                            </Text>
                          )}
                        </HStack>
                        
                        <Text color={titleColor} fontWeight="600" flex={1}>
                          {service.title}
                        </Text>
                      </HStack>
                      
                      <HStack spacing={3}>
                        {isAssigned && (
                          <Badge colorScheme="blue" size="sm">
                            Assigned
                          </Badge>
                        )}
                        
                        <Box
                          as="input"
                          type="checkbox"
                          checked={isAssigned}
                          onChange={() => toggleVolunteerStatus(service.id, isAssigned)}
                          disabled={assigningService === service.id}
                          opacity={assigningService === service.id ? 0.5 : 1}
                          cursor={assigningService === service.id ? 'not-allowed' : 'pointer'}
                          w="20px"
                          h="20px"
                          accentColor={useColorModeValue('blue.500', 'blue.300')}
                          _disabled={{
                            cursor: 'not-allowed',
                            opacity: 0.5
                          }}
                        />
                      </HStack>
                    </HStack>
                  </Box>
                )
              })
            )}
          </VStack>
        )}
      </Box>
    </Box>
  )
}
