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
  AlertIcon,
  Menu,
  MenuButton,
  MenuList,
  MenuItem
} from '@chakra-ui/react'
import { CheckIcon, ChevronDownIcon } from '@chakra-ui/icons'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../hooks/useLanguage'
import { supabase } from '../lib/supabase'
import { signInWithGoogleFromVolunteer, ensureUserProfileAndMembership } from '../lib/auth'

// Module-level cache to persist across component remounts
const cache = new Map<string, {
  organization: OrganizationData | null
  services: WorshipService[]
  assignments: VolunteerAssignment[]
  loaded: {
    organization: boolean
    services: boolean
    assignments: boolean
  }
}>()

// Clear cache function for debugging
;(window as any).clearVolunteerCache = () => {
  cache.clear()
  console.log('Volunteer cache cleared')
}

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
  const { t } = useTranslation()
  const { currentLanguage, changeLanguage, availableLanguages } = useLanguage()
  
  const cacheKey = `volunteer-${publicUrl}`
  const cached = cache.get(cacheKey)
  
  const [loading, setLoading] = useState(!cached?.loaded.organization)
  const [user, setUser] = useState<any>(null)
  const [organization, setOrganization] = useState<OrganizationData | null>(cached?.organization || null)
  const [availableServices, setAvailableServices] = useState<WorshipService[]>(cached?.services || [])
  const [loadingServices, setLoadingServices] = useState(false)
  const [userVolunteerAssignments, setUserVolunteerAssignments] = useState<VolunteerAssignment[]>(cached?.assignments || [])
  const [assigningService, setAssigningService] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [organizationLoaded, setOrganizationLoaded] = useState(cached?.loaded.organization || false)
  const [servicesLoaded, setServicesLoaded] = useState(cached?.loaded.services || false)
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(cached?.loaded.assignments || false)

  const bgColor = useColorModeValue('gray.50', 'gray.900')
  const cardBg = useColorModeValue('white', 'gray.800')
  const titleColor = useColorModeValue('gray.800', 'white')
  const subtitleColor = useColorModeValue('gray.600', 'gray.300')
  const textColor = useColorModeValue('gray.700', 'gray.200')
  const greenBg = useColorModeValue('green.50', 'green.900')
  const greenBorder = useColorModeValue('green.300', 'green.600')
  const grayBorder = useColorModeValue('gray.200', 'gray.600')
  const greenHover = useColorModeValue('green.400', 'green.500')
  const blueHover = useColorModeValue('blue.300', 'blue.400')
  const grayCheckBorder = useColorModeValue('gray.300', 'gray.600')
  const whiteCardBg = useColorModeValue('white', 'gray.800')
  const grayBorderTop = useColorModeValue('gray.200', 'gray.700')

  const loadOrganization = useCallback(async () => {
    if (!publicUrl) return
    if (organizationLoaded) return
    
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
        setError(t('volunteerPage.errors.invalidLink'))
        setLoading(false)
        return
      }

      // Handle the organizations data structure properly
      const orgData = volunteerLink.organizations as any
      if (orgData && typeof orgData === 'object' && 'id' in orgData) {
        console.log('Found organization:', orgData.name)
        setOrganization(orgData as OrganizationData)
        setOrganizationLoaded(true)
        
        // Update cache
        const current = cache.get(cacheKey) || { organization: null, services: [], assignments: [], loaded: { organization: false, services: false, assignments: false } }
        cache.set(cacheKey, { ...current, organization: orgData as OrganizationData, loaded: { ...current.loaded, organization: true } })
      } else {
        console.error('Invalid organization data structure:', orgData)
        setError(t('volunteerPage.errors.invalidData'))
        setLoading(false)
        return
      }
      
      setLoading(false)
    } catch (err) {
      console.error('Unexpected error loading organization:', err)
      setError(t('volunteerPage.errors.failedToLoad'))
      setLoading(false)
    }
  }, [publicUrl])

  const loadAvailableServices = useCallback(async () => {
    if (!organization) return
    if (servicesLoaded) return
    
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
      setServicesLoaded(true)
      
      // Update cache
      const current = cache.get(cacheKey) || { organization: null, services: [], assignments: [], loaded: { organization: false, services: false, assignments: false } }
      cache.set(cacheKey, { ...current, services: services || [], loaded: { ...current.loaded, services: true } })
    } catch (err) {
      console.error('Unexpected error loading services:', err)
    } finally {
      setLoadingServices(false)
    }
  }, [organization])

  const loadUserVolunteerAssignments = useCallback(async () => {
    if (!user || !organization) return
    if (assignmentsLoaded) return
    
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
      setAssignmentsLoaded(true)
      
      // Update cache
      const current = cache.get(cacheKey) || { organization: null, services: [], assignments: [], loaded: { organization: false, services: false, assignments: false } }
      cache.set(cacheKey, { ...current, assignments: assignments || [], loaded: { ...current.loaded, assignments: true } })
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
            description: t('volunteerPage.errors.removeFailed'),
            status: 'error',
            duration: 3000,
            isClosable: true
          })
          return
        }

        toast({
          title: 'Success!',
          description: t('volunteerPage.success.removed'),
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
            description: t('volunteerPage.errors.assignmentFailed'),
            status: 'error',
            duration: 3000,
            isClosable: true
          })
          return
        }

        toast({
          title: 'Success!',
          description: t('volunteerPage.success.assigned'),
          status: 'success',
          duration: 3000,
          isClosable: true
        })
      }

      // Refresh assignments by clearing cache and reloading
      setAssignmentsLoaded(false)
      setUserVolunteerAssignments([])
      
      // Clear cache for assignments
      const current = cache.get(cacheKey)
      if (current) {
        cache.set(cacheKey, { ...current, assignments: [], loaded: { ...current.loaded, assignments: false } })
      }
      
      await loadUserVolunteerAssignments()
    } catch (err) {
      console.error('Unexpected error toggling volunteer status:', err)
      toast({
        title: 'Error',
        description: t('volunteerPage.errors.updateFailed'),
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
      setError(error.message || t('loginPage.errors.googleSignInFailed'))
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
            description: t('volunteerPage.warning.profileFailed'),
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
  }, [toast])

  useEffect(() => {
    if (publicUrl) {
      loadOrganization()
    }
  }, [publicUrl])

  useEffect(() => {
    // Load services immediately when organization is available
    if (organization) {
      loadAvailableServices()
      
      // Load user assignments only if user is authenticated
      if (user) {
        loadUserVolunteerAssignments()
      }
    }
  }, [organization, user])

  // Only show loading spinner if we're still loading the organization
  if (loading && !organization) {
    return (
      <Box minH="100vh" bg={bgColor} display="flex" alignItems="center" justifyContent="center">
        <Center>
          <VStack spacing={4}>
            <Spinner size="xl" color="blue.500" />
            <Text color={subtitleColor}>{t('volunteerPage.loadingPage')}</Text>
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
            <Button onClick={() => navigate('/')}>{t('volunteerPage.goHome')}</Button>
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
            <Text color={subtitleColor}>{t('volunteerPage.organizationNotFound')}</Text>
            <Button onClick={() => navigate('/')}>{t('volunteerPage.goHome')}</Button>
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
              {t('volunteerPage.title', { organizationName: organization.name })}
            </Heading>
            <Text color={subtitleColor} fontSize={{ base: "md", md: "lg" }}>
              {t('volunteerPage.subtitle')}
            </Text>
          </VStack>
        )}

        {/* Login Section */}
        {!user && (
          <Box bg={cardBg} mb={6} p={{ base: 4, md: 6 }} borderRadius="lg">
            <VStack spacing={4}>
              <Heading as="h1" size={{ base: "md", md: "lg" }} color={titleColor} fontWeight="600" textAlign="center">
                {t('volunteerPage.title', { organizationName: organization.name })}
              </Heading>
              <Text color={textColor} textAlign="center" fontSize={{ base: "sm", md: "md" }}>
                {t('volunteerPage.signInPrompt')}
              </Text>
              
              <Button
                onClick={handleGoogleSignIn}
                isLoading={googleLoading}
                loadingText={t('volunteerPage.signingIn')}
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
                {t('volunteerPage.continueWithGoogle')}
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
                  <Text color={subtitleColor}>{t('volunteerPage.loadingServices')}</Text>
                </VStack>
              </Center>
            ) : availableServices.length === 0 ? (
              <Box bg={cardBg} p={{ base: 4, md: 6 }} borderRadius="lg">
                <Text color={subtitleColor} textAlign="center" fontSize={{ base: "sm", md: "md" }}>
                  {t('volunteerPage.noServicesAvailable')}
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
                    bg={isAssigned ? greenBg : cardBg}
                    border="2px"
                    borderColor={isAssigned ? greenBorder : grayBorder}
                    borderRadius="lg"
                    py={{ base: 6, md: 7 }}
                    px={{ base: 4, md: 5 }}
                    cursor={assigningService === service.id ? 'not-allowed' : 'pointer'}
                    opacity={assigningService === service.id ? 0.6 : 1}
                    onClick={() => assigningService !== service.id && toggleVolunteerStatus(service.id, isAssigned)}
                    _hover={assigningService !== service.id ? {
                      transform: 'translateY(-2px)',
                      boxShadow: 'lg',
                      borderColor: isAssigned ? greenHover : blueHover
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
                        borderColor={grayCheckBorder}
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
              bg={{ base: whiteCardBg, md: "transparent" }}
              pt={{ base: 4, md: 0 }}
              borderTop={{ base: "1px", md: "none" }}
              borderColor={{ base: grayBorderTop, md: "transparent" }}
            >
              <Button
                size="lg"
                colorScheme="blue"
                onClick={() => navigate('/dashboard')}
                w="full"
                fontSize={{ base: "lg", md: "xl" }}
                py={{ base: 6, md: 6 }}
              >
                {t('volunteerPage.viewDashboard', { organizationName: organization.name })}
              </Button>
            </Box>
          </VStack>
        )}

        {/* Language Dropdown - Fixed at Bottom */}
        <Box
          position="fixed"
          bottom={4}
          right={4}
          zIndex={20}
        >
          <Menu>
            <MenuButton as={Button} variant="outline" size="sm" rightIcon={<ChevronDownIcon />}>
              <Text fontSize="sm">{availableLanguages.find(lang => lang.code === currentLanguage)?.name || 'EN'}</Text>
            </MenuButton>
            <MenuList>
              {availableLanguages.map((language) => (
                <MenuItem
                  key={language.code}
                  onClick={() => changeLanguage(language.code)}
                  bg={currentLanguage === language.code ? useColorModeValue('blue.50', 'blue.900') : 'transparent'}
                >
                  {language.name}
                </MenuItem>
              ))}
            </MenuList>
          </Menu>
        </Box>
      </Box>
    </Box>
  )
}
