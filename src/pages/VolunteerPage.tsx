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
  MenuItem,
  Tooltip,
  Badge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Select,
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputLeftElement
} from '@chakra-ui/react'
import { CheckIcon, ChevronDownIcon, SearchIcon } from '@chakra-ui/icons'
import { keyframes } from '@emotion/react'
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

interface Volunteer {
  id: string
  user_id: string
  worship_service_id: string
  created_at: string
  profiles: {
    first_name: string
    last_name: string
    email: string
  }
  instruments?: string[]
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
  const [serviceIdToVolunteers, setServiceIdToVolunteers] = useState<Record<string, Volunteer[]>>({})
  const [loadingVolunteers, setLoadingVolunteers] = useState(false)
  const [assigningService, setAssigningService] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [organizationLoaded, setOrganizationLoaded] = useState(cached?.loaded.organization || false)
  const [servicesLoaded, setServicesLoaded] = useState(cached?.loaded.services || false)
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(cached?.loaded.assignments || false)

  // Instrument selection modal state
  const { isOpen: isInstrumentModalOpen, onOpen: onInstrumentModalOpen, onClose: onInstrumentModalClose } = useDisclosure()
  const [selectedServiceForInstrument, setSelectedServiceForInstrument] = useState<string | null>(null)
  const [availableInstruments, setAvailableInstruments] = useState<Array<{id: string, name: string}>>([])
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>('')
  const [loadingInstruments, setLoadingInstruments] = useState(false)
  const [instrumentSearchQuery, setInstrumentSearchQuery] = useState<string>('')
  const [isReloading, setIsReloading] = useState(false)

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
      
      // Get today's date in YYYY-MM-DD format for filtering
      const today = new Date().toISOString().split('T')[0]
      
      // Get published services that are upcoming (not past) and limit to 16
      const { data: services, error: servicesError } = await supabase
        .from('worship_services')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('status', 'published')
        .gte('service_date', today)
        .order('service_date', { ascending: true })
        .limit(16)

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

  const loadVolunteersForServices = useCallback(async (serviceIds: string[]) => {
    if (!organization || serviceIds.length === 0) return
    
    try {
      setLoadingVolunteers(true)
      console.log('Loading volunteers for service IDs:', serviceIds)
      
      // First get the volunteer records
      const { data: volunteerRecords, error: volunteerError } = await supabase
        .from('worship_service_volunteers')
        .select('*')
        .in('worship_service_id', serviceIds)
        .order('created_at', { ascending: true })

      if (volunteerError) {
        console.error('Error loading volunteers:', volunteerError)
        return
      }

      if (!volunteerRecords || volunteerRecords.length === 0) {
        setServiceIdToVolunteers({})
        return
      }

      // Then get the profile information for each volunteer
      const userIds = [...new Set(volunteerRecords.map(v => v.user_id))]
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', userIds)

      if (profilesError) {
        console.error('Error loading profiles:', profilesError)
        return
      }

      // Get instrument assignments for volunteers
      const volunteerIds = volunteerRecords.map(v => v.id)
      let volunteerInstruments: Record<string, string[]> = {}
      let allInstruments: Record<string, string> = {}
      
      if (volunteerIds.length > 0) {
        // First get the instrument assignments
        const { data: assignments, error: assignmentsError } = await supabase
          .from('volunteer_instruments')
          .select('volunteer_id, instrument_id')
          .in('volunteer_id', volunteerIds)

        if (!assignmentsError && assignments) {
          // Get all unique instrument IDs
          const instrumentIds = [...new Set(assignments.map(a => a.instrument_id))]
          
          if (instrumentIds.length > 0) {
            // Get instrument names
            const { data: instruments, error: instrumentsError } = await supabase
              .from('instruments')
              .select('id, name')
              .in('id', instrumentIds)

            if (!instrumentsError && instruments) {
              // Create instrument ID to name mapping
              instruments.forEach(instrument => {
                allInstruments[instrument.id] = instrument.name
              })
            }
          }

          // Create volunteer to instrument names mapping
          assignments.forEach(assignment => {
            const volunteerId = assignment.volunteer_id
            const instrumentName = allInstruments[assignment.instrument_id]
            
            if (instrumentName) {
              if (!volunteerInstruments[volunteerId]) {
                volunteerInstruments[volunteerId] = []
              }
              volunteerInstruments[volunteerId].push(instrumentName)
            }
          })
        }
      }

      // Combine the data and create the mapping
      const mapping: Record<string, Volunteer[]> = {}
      volunteerRecords.forEach((volunteer) => {
        const profile = profiles?.find(p => p.id === volunteer.user_id)
        const instruments = volunteerInstruments[volunteer.id] || []
        
        const volunteerWithProfile = {
          ...volunteer,
          profiles: profile || { first_name: 'Unknown', last_name: 'User', email: 'N/A' },
          instruments: instruments
        }
        
        const svcId = volunteer.worship_service_id
        if (!mapping[svcId]) mapping[svcId] = []
        mapping[svcId].push(volunteerWithProfile as Volunteer)
      })
      
      console.log('Volunteers mapping:', mapping)
      setServiceIdToVolunteers(mapping)
    } catch (error) {
      console.error('Error loading volunteers:', error)
    } finally {
      setLoadingVolunteers(false)
    }
  }, [organization])

  const loadAvailableInstruments = useCallback(async (serviceId: string) => {
    if (!organization || loadingInstruments) return
    
    try {
      setLoadingInstruments(true)
      
      // Get all instruments for this organization
      const { data: instruments, error: instrumentsError } = await supabase
        .from('instruments')
        .select('id, name')
        .eq('organization_id', organization.id)
        .order('name', { ascending: true })

      if (instrumentsError) {
        console.error('Error loading instruments:', instrumentsError)
        return
      }

      // Get already taken instruments for this service
      const volunteers = serviceIdToVolunteers[serviceId] || []
      const takenInstrumentNames = new Set<string>()
      volunteers.forEach(volunteer => {
        volunteer.instruments?.forEach(instrument => {
          takenInstrumentNames.add(instrument)
        })
      })

      // Filter out already taken instruments
      const availableInstruments = (instruments || []).filter(instrument => 
        !takenInstrumentNames.has(instrument.name)
      )

      setAvailableInstruments(availableInstruments)
    } catch (error) {
      console.error('Error loading instruments:', error)
    } finally {
      setLoadingInstruments(false)
    }
  }, [organization, loadingInstruments, serviceIdToVolunteers])

  const handleVolunteerClick = (serviceId: string, isAssigned: boolean) => {
    if (isAssigned) {
      // If already assigned, remove directly
      toggleVolunteerStatus(serviceId, true)
    } else {
      // If not assigned, show instrument selection modal
      setSelectedServiceForInstrument(serviceId)
      setSelectedInstrumentId('')
      setInstrumentSearchQuery('')
      loadAvailableInstruments(serviceId)
      onInstrumentModalOpen()
    }
  }

  const handleInstrumentSelection = async (instrumentId: string) => {
    if (!selectedServiceForInstrument) return
    
    // Close modal immediately
    onInstrumentModalClose()
    setSelectedServiceForInstrument(null)
    setSelectedInstrumentId('')
    
    // Then process the selection
    await toggleVolunteerStatus(selectedServiceForInstrument, false, instrumentId)
  }

  const toggleVolunteerStatus = async (serviceId: string, isAssigned: boolean, instrumentId?: string) => {
    if (!user || !organization) return
    
    try {
      setAssigningService(serviceId)
      setIsReloading(true)
      
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

        // If an instrument was selected, assign it to the volunteer
        if (instrumentId) {
          const { data: volunteerRecord } = await supabase
            .from('worship_service_volunteers')
            .select('id')
            .eq('user_id', user.id)
            .eq('worship_service_id', serviceId)
            .single()

          if (volunteerRecord) {
            await supabase
              .from('volunteer_instruments')
              .insert({
                volunteer_id: volunteerRecord.id,
                instrument_id: instrumentId
              })
          }
        }
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
      
      // Also refresh the volunteers list for all services
      if (availableServices.length > 0) {
        const serviceIds = availableServices.map(service => service.id)
        await loadVolunteersForServices(serviceIds)
      }
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
      setIsReloading(false)
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

  useEffect(() => {
    // Load volunteers for all available services
    if (availableServices.length > 0) {
      const serviceIds = availableServices.map(service => service.id)
      loadVolunteersForServices(serviceIds)
    }
  }, [availableServices, loadVolunteersForServices])

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
          <HStack justify="space-between" align="flex-start" mb={{ base: 6, md: 8 }} mt={{ base: 4, md: 8 }}>
            <VStack spacing={2} align="flex-start" flex="1">
              <Heading as="h1" size={{ base: "lg", md: "xl" }} color={titleColor} fontWeight="600" textAlign="left">
                {t('volunteerPage.title', { organizationName: organization.name })}
              </Heading>
              <Text color={subtitleColor} fontSize={{ base: "md", md: "lg" }} textAlign="left">
                {t('volunteerPage.subtitle')}
              </Text>
            </VStack>
            
            {/* Language Dropdown - Moved to header */}
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
          </HStack>
        )}

        {/* Header for non-logged in users */}
        {!user && (
          <HStack justify="space-between" align="flex-start" mb={{ base: 6, md: 8 }} mt={{ base: 4, md: 8 }}>
            <VStack spacing={2} align="flex-start" flex="1">
              <Heading as="h1" size={{ base: "lg", md: "xl" }} color={titleColor} fontWeight="600" textAlign="left">
                {t('volunteerPage.title', { organizationName: organization.name })}
              </Heading>
            </VStack>
            
            {/* Language Dropdown - For non-logged in users */}
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
          </HStack>
        )}

        {/* Login Section */}
        {!user && (
          <Box bg={cardBg} mb={6} p={{ base: 4, md: 6 }} borderRadius="lg">
            <VStack spacing={4}>
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
                const volunteers = serviceIdToVolunteers[service.id] || []
                
                return (
                  <Box
                    key={service.id}
                    bg={isAssigned ? greenBg : cardBg}
                    border="2px"
                    borderColor={isAssigned ? greenBorder : grayBorder}
                    borderRadius="lg"
                    py={{ base: 6, md: 7 }}
                    px={{ base: 4, md: 5 }}
                    cursor={assigningService === service.id || isReloading ? 'not-allowed' : 'pointer'}
                    opacity={assigningService === service.id || isReloading ? 0.6 : 1}
                    onClick={() => !assigningService && !isReloading && handleVolunteerClick(service.id, isAssigned)}
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
                    
                    <VStack spacing={3} align="stretch" w="100%">
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

                      {/* Volunteer List */}
                      {loadingVolunteers ? (
                        <HStack spacing={2} align="center">
                          <Spinner size="sm" />
                          <Text fontSize="sm" color={subtitleColor}>
                            {t('volunteerPage.loadingVolunteers')}
                          </Text>
                        </HStack>
                      ) : volunteers.length > 0 ? (
                        <VStack spacing={2} align="stretch">
                          <Text fontSize="sm" fontWeight="600" color={subtitleColor}>
                            {t('volunteerPage.currentVolunteers')}:
                          </Text>
                          <HStack spacing={2} align="flex-start" flexWrap="wrap">
                            {volunteers
                              .sort((a, b) => {
                                const aInstruments = a.instruments || []
                                const bInstruments = b.instruments || []
                                
                                // Check if volunteer has Mic 1
                                const aHasMic1 = aInstruments.some(instrument => 
                                  instrument.toLowerCase().includes('mic 1') || 
                                  instrument.toLowerCase() === 'mic1'
                                )
                                const bHasMic1 = bInstruments.some(instrument => 
                                  instrument.toLowerCase().includes('mic 1') || 
                                  instrument.toLowerCase() === 'mic1'
                                )
                                
                                // Mic 1 volunteers come first
                                if (aHasMic1 && !bHasMic1) return -1
                                if (!aHasMic1 && bHasMic1) return 1
                                
                                // For non-Mic 1 volunteers, sort alphabetically by first name
                                const aFirstName = a.profiles.first_name || 'Unknown'
                                const bFirstName = b.profiles.first_name || 'Unknown'
                                return aFirstName.localeCompare(bFirstName)
                              })
                              .map((volunteer) => {
                                const firstName = volunteer.profiles.first_name || 'Unknown'
                                const lastName = volunteer.profiles.last_name || ''
                                const fullName = `${firstName} ${lastName}`.trim()
                                const instruments = volunteer.instruments || []
                                const role = instruments.length > 0 ? instruments.join(', ') : 'Volunteer'
                                
                                // Check if this is the current user
                                const isCurrentUser = user && volunteer.user_id === user.id
                                
                                // Check if volunteer has Mic 1 or Worship Leader role
                                const hasMic1OrWorshipLeader = instruments.some(instrument => {
                                  const lowerInstrument = instrument.toLowerCase()
                                  return lowerInstrument.includes('mic 1') || 
                                         lowerInstrument === 'mic1' ||
                                         lowerInstrument.includes('worship leader') ||
                                         lowerInstrument === 'worship leader'
                                })
                                
                                // Use darker blue for current user or Mic 1/Worship Leader, lighter blue for others
                                const shouldUseDarkBlue = isCurrentUser || hasMic1OrWorshipLeader
                                
                                return (
                                  <Box
                                    key={volunteer.id}
                                    bg={shouldUseDarkBlue ? "blue.500" : useColorModeValue("blue.100", "blue.300")}
                                    color={shouldUseDarkBlue ? "white" : useColorModeValue("blue.800", "blue.900")}
                                    px={3}
                                    py={2}
                                    borderRadius="lg"
                                    textAlign="center"
                                    minW="fit-content"
                                  >
                                    <VStack spacing={0}>
                                      <Text fontSize="xs" fontWeight="600" lineHeight="1.2">
                                        {fullName}
                                      </Text>
                                      <Text 
                                        fontSize="2xs" 
                                        fontWeight="400" 
                                        opacity={shouldUseDarkBlue ? 0.9 : 0.8} 
                                        lineHeight="1.1"
                                      >
                                        {role}
                                      </Text>
                                    </VStack>
                                  </Box>
                                )
                              })}
                          </HStack>
                        </VStack>
                      ) : (
                        <Text fontSize="sm" color={subtitleColor} fontStyle="italic">
                          {t('volunteerPage.noVolunteersYet')}
                        </Text>
                      )}
                    </VStack>
                  </Box>
                )
                })}
              </VStack>
            )}

            <Box
              position={{ base: "fixed", md: "static" }}
              bottom={{ base: 0, md: "auto" }}
              left={{ base: 0, md: "auto" }}
              right={{ base: 0, md: "auto" }}
              zIndex={10}
              bg={{ base: "white", md: "transparent" }}
              borderTop={{ base: "1px", md: "none" }}
              borderColor={{ base: grayBorderTop, md: "transparent" }}
            >
              <Box px={{ base: 4, md: 0 }} pt={{ base: 4, md: 0 }} pb={{ base: 4, md: 0 }}>
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
            </Box>
          </VStack>
        )}


        {/* Instrument Selection Modal */}
        <Modal isOpen={isInstrumentModalOpen} onClose={onInstrumentModalClose} isCentered>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Select Your Instrument/Role</ModalHeader>
            <ModalCloseButton />
            <ModalBody p={0}>
              {loadingInstruments ? (
                <Center py={8}>
                  <VStack spacing={3}>
                    <Spinner size="lg" />
                    <Text color={subtitleColor}>Loading instruments...</Text>
                  </VStack>
                </Center>
              ) : availableInstruments.length === 0 ? (
                <Center py={8}>
                  <Text color={subtitleColor}>No instruments available</Text>
                </Center>
              ) : (
                <>
                  {/* Search Field */}
                  <Box p={4} borderBottom="1px" borderColor={useColorModeValue('gray.200', 'gray.600')}>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none">
                        <SearchIcon color={subtitleColor} />
                      </InputLeftElement>
                      <Input
                        placeholder="Search instruments..."
                        value={instrumentSearchQuery}
                        onChange={(e) => setInstrumentSearchQuery(e.target.value)}
                        size="md"
                      />
                    </InputGroup>
                  </Box>

                  {/* Scrollable List */}
                  <Box position="relative">
                    <VStack 
                      spacing={0} 
                      align="stretch" 
                      maxH="350px" 
                      overflowY="auto"
                      id="instrument-list"
                    >
                      {(() => {
                        const filteredInstruments = availableInstruments.filter(instrument =>
                          instrument.name.toLowerCase().includes(instrumentSearchQuery.toLowerCase())
                        )

                        if (filteredInstruments.length === 0) {
                          return (
                            <Center py={8}>
                              <Text color={subtitleColor}>No instruments match your search</Text>
                            </Center>
                          )
                        }

                        return filteredInstruments.map((instrument) => (
                          <Box
                            key={instrument.id}
                            px={6}
                            py={4}
                            cursor="pointer"
                            _hover={{ bg: useColorModeValue('gray.50', 'gray.700') }}
                            borderBottom="1px"
                            borderColor={useColorModeValue('gray.200', 'gray.600')}
                            onClick={() => handleInstrumentSelection(instrument.id)}
                            transition="background-color 0.2s"
                          >
                            <Text fontWeight="500" color={textColor}>
                              {instrument.name}
                            </Text>
                          </Box>
                        ))
                      })()}
                    </VStack>

                    {/* Pulsing Chevron Down - Only show if there are more items to scroll */}
                    {(() => {
                      const filteredInstruments = availableInstruments.filter(instrument =>
                        instrument.name.toLowerCase().includes(instrumentSearchQuery.toLowerCase())
                      )
                      
                      // Show chevron if there are more than 7 items (approximate items visible in 350px)
                      if (filteredInstruments.length > 7) {
                        const chevronPulse = keyframes`
                          0% { opacity: 0.4; transform: translateY(0px); }
                          50% { opacity: 1; transform: translateY(3px); }
                          100% { opacity: 0.4; transform: translateY(0px); }
                        `

                        return (
                          <Box
                            position="absolute"
                            bottom="10px"
                            left="50%"
                            transform="translateX(-50%)"
                            pointerEvents="none"
                            zIndex={1}
                          >
                            <ChevronDownIcon
                              boxSize={6}
                              color={useColorModeValue('blue.500', 'blue.300')}
                              animation={`${chevronPulse} 2s ease-in-out infinite`}
                            />
                          </Box>
                        )
                      }
                      return null
                    })()}
                  </Box>
                </>
              )}
            </ModalBody>
          </ModalContent>
        </Modal>

        {/* Global Loading Overlay */}
        {isReloading && (
          <Box
            position="fixed"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="rgba(0, 0, 0, 0.3)"
            zIndex={9999}
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <VStack spacing={4}>
              <Spinner size="xl" color="blue.500" thickness="4px" />
              <Text color="white" fontWeight="600" fontSize="lg">
                Updating volunteer assignment...
              </Text>
            </VStack>
          </Box>
        )}
      </Box>
    </Box>
  )
}
