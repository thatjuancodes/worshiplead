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
import { getCurrentUser } from '../lib/auth'

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

  // Check for existing auth session immediately
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        console.log('Checking for existing auth session...')
        const currentUser = await getCurrentUser()
        if (currentUser) {
          console.log('Found existing user:', currentUser.id)
          setUser(currentUser)
        } else {
          console.log('No existing user found')
        }
      } catch (error) {
        console.error('Error checking existing session:', error)
      } finally {
        console.log('Finished checking auth session')
      }
    }
    
    checkExistingSession()
  }, [])

  useEffect(() => {
    if (publicUrl) {
      console.log('Loading organization for publicUrl:', publicUrl)
      loadOrganization()
    }
  }, [publicUrl, loadOrganization])

  useEffect(() => {
    console.log('Organization or user changed:', { organization: !!organization, user: !!user })
    if (organization && user) {
      console.log('Loading services and assignments for authenticated user')
      loadAvailableServices()
      loadUserVolunteerAssignments()
    } else if (organization) {
      console.log('Loading services for organization (no user yet)')
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
                Please log in to volunteer for services
              </Text>
              <HStack spacing={4}>
                <Button colorScheme="blue" onClick={() => navigate('/login')}>
                  Log In
                </Button>
                <Button variant="outline" onClick={() => navigate('/signup')}>
                  Sign Up
                </Button>
              </HStack>
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
