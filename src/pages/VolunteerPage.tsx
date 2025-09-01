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
  useColorModeValue,
  useToast,
  Alert,
  AlertIcon
} from '@chakra-ui/react'
import { CheckIcon } from '@chakra-ui/icons'
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
            
            // Reload services and assignments after successful auth
            loadAvailableServices()
            loadUserVolunteerAssignments()
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
    // Load services immediately when organization is available
    if (organization) {
      loadAvailableServices()
      
      // Load user assignments only if user is authenticated
      if (user) {
        loadUserVolunteerAssignments()
      }
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
    <Box minH="100vh" bg={bgColor}>
      <Box as="main" maxW="800px" mx="auto" p={{ base: 4, md: 8 }} py={{ base: 6, md: 8 }}>
        {/* Header */}
        {user && (
          <VStack spacing={4} mb={{ base: 6, md: 8 }} mt={{ base: 4, md: 8 }} textAlign="center">
            <Heading as="h1" size={{ base: "lg", md: "xl" }} color={titleColor} fontWeight="600">
              Volunteer for {organization.name}
            </Heading>
            <Text color={subtitleColor} fontSize={{ base: "md", md: "lg" }}>
              Choose a service to volunteer for
            </Text>
          </VStack>
        )}

        {/* Login Section */}
        {!user && (
          <Box bg={cardBg} mb={6} p={{ base: 4, md: 6 }} borderRadius="lg">
            <VStack spacing={4}>
              <Heading as="h1" size={{ base: "md", md: "lg" }} color={titleColor} fontWeight="600" textAlign="center">
                Volunteer for {organization.name}
              </Heading>
              <Text color={textColor} textAlign="center" fontSize={{ base: "sm", md: "md" }}>
                Please sign in with Google to volunteer for services
              </Text>
              
              <Button
                onClick={handleGoogleSignIn}
                isLoading={googleLoading}
                loadingText="Signing in..."
                size={{ base: "md", md: "lg" }}
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
          <VStack spacing={6} align="stretch" pb={{ base: 24, md: 8 }}>
            {loadingServices ? (
              <Center py={8}>
                <VStack spacing={3}>
                  <Spinner size="lg" />
                  <Text color={subtitleColor}>Loading available services...</Text>
                </VStack>
              </Center>
            ) : availableServices.length === 0 ? (
              <Box bg={cardBg} p={{ base: 4, md: 6 }} borderRadius="lg">
                <Text color={subtitleColor} textAlign="center" fontSize={{ base: "sm", md: "md" }}>
                  No services available for volunteering at the moment
                </Text>
              </Box>
            ) : (
              <VStack spacing={4} align="stretch">
                {availableServices.map(service => {
                const isAssigned = userVolunteerAssignments.some(
                  assignment => assignment.worship_service_id === service.id
                )
                
                return (
                  <Box
                    key={service.id}
                    bg={isAssigned ? useColorModeValue('green.50', 'green.900') : cardBg}
                    border="2px"
                    borderColor={isAssigned ? useColorModeValue('green.300', 'green.600') : useColorModeValue('gray.200', 'gray.600')}
                    borderRadius="lg"
                    py={{ base: 6, md: 7 }}
                    px={{ base: 4, md: 5 }}
                    cursor={assigningService === service.id ? 'not-allowed' : 'pointer'}
                    opacity={assigningService === service.id ? 0.6 : 1}
                    onClick={() => assigningService !== service.id && toggleVolunteerStatus(service.id, isAssigned)}
                    _hover={assigningService !== service.id ? {
                      transform: 'translateY(-2px)',
                      boxShadow: 'lg',
                      borderColor: isAssigned ? useColorModeValue('green.400', 'green.500') : useColorModeValue('blue.300', 'blue.400')
                    } : {}}
                    transition="all 0.2s ease-in-out"
                    position="relative"
                  >
                    {assigningService === service.id && (
                      <Box
                        position="absolute"
                        top="50%"
                        left="50%"
                        transform="translate(-50%, -50%)"
                        zIndex={2}
                      >
                        <Spinner size="lg" color="blue.500" />
                      </Box>
                    )}
                    
                    <HStack justify="space-between" align="center" w="100%">
                      <Text color={titleColor} fontWeight="700" fontSize={{ base: "lg", md: "xl" }} flex={1}>
                        {new Date(service.service_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                        {service.service_time && (
                          ` ${new Date(`2000-01-01T${service.service_time}`).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}`
                        )} - {service.title}
                      </Text>
                      
                      {/* Check Circle */}
                      <Box
                        w="28px"
                        h="28px"
                        borderRadius="full"
                        bg={isAssigned ? "green.500" : "transparent"}
                        border={isAssigned ? "none" : "2px"}
                        borderColor={useColorModeValue('gray.300', 'gray.600')}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        flexShrink={0}
                      >
                        {isAssigned && (
                          <CheckIcon color="white" w={4} h={4} />
                        )}
                      </Box>
                    </HStack>
                  </Box>
                )
                })}
              </VStack>
            )}

            <Box
              position={{ base: "fixed", md: "static" }}
              bottom={{ base: 4, md: "auto" }}
              left={{ base: 4, md: "auto" }}
              right={{ base: 4, md: "auto" }}
              zIndex={10}
              bg={{ base: useColorModeValue('white', 'gray.800'), md: "transparent" }}
              pt={{ base: 4, md: 0 }}
              borderTop={{ base: "1px", md: "none" }}
              borderColor={{ base: useColorModeValue('gray.200', 'gray.700'), md: "transparent" }}
            >
              <Button
                size="lg"
                colorScheme="blue"
                onClick={() => navigate('/dashboard')}
                w="full"
                fontSize={{ base: "lg", md: "xl" }}
                py={{ base: 6, md: 6 }}
              >
                View {organization.name} Dashboard
              </Button>
            </Box>
          </VStack>
        )}
      </Box>
    </Box>
  )
}
