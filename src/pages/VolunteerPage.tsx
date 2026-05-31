import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  VStack,
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
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Input,
  InputGroup,
  InputLeftElement,
} from '@chakra-ui/react'
import { CalendarIcon, CheckIcon, ChevronDownIcon, SearchIcon, TimeIcon } from '@chakra-ui/icons'
import { keyframes } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../hooks/useLanguage'
import { supabase } from '../lib/supabase'
import { signInWithGoogleFromVolunteer, ensureUserProfileAndMembership } from '../lib/auth'
import { formatServiceDate, getServiceTimeDisplay } from '../utils/dateTime'

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
  service_time: string // TIMESTAMPTZ - contains both date and time
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

function formatDay(dateStr: string) {
  return new Date(dateStr).getDate().toString()
}

function formatMonth(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
}

function daysUntil(dateStr: string) {
  const serviceDate = new Date(dateStr)
  const now = new Date()
  const diffMs = serviceDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays < 7) return `In ${diffDays} days`
  return `In ${Math.ceil(diffDays / 7)} weeks`
}

function getVolunteerInitials(firstName?: string, lastName?: string, email?: string) {
  const initials = `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.trim()
  if (initials) return initials.toUpperCase()
  return (email || 'U').slice(0, 2).toUpperCase()
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
  const [assigningService, setAssigningService] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [organizationLoaded, setOrganizationLoaded] = useState(cached?.loaded.organization || false)
  const [servicesLoaded, setServicesLoaded] = useState(cached?.loaded.services || false)
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(cached?.loaded.assignments || false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week'>('all')
  const [expandedService, setExpandedService] = useState<string | null>(null)

  // Instrument selection modal state
  const { isOpen: isInstrumentModalOpen, onOpen: onInstrumentModalOpen, onClose: onInstrumentModalClose } = useDisclosure()
  const [selectedServiceForInstrument, setSelectedServiceForInstrument] = useState<string | null>(null)
  const [availableInstruments, setAvailableInstruments] = useState<Array<{id: string, name: string}>>([])
  const [loadingInstruments, setLoadingInstruments] = useState(false)
  const [instrumentSearchQuery, setInstrumentSearchQuery] = useState<string>('')
  const [isReloading, setIsReloading] = useState(false)

  const bgColor = useColorModeValue('gray.50', 'gray.900')
  const subtitleColor = useColorModeValue('gray.600', 'gray.300')
  const textColor = useColorModeValue('gray.700', 'gray.200')

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
      
      // Get current timestamp for filtering upcoming services
      const now = new Date().toISOString()
      
      // Get published services that are upcoming (not past) and limit to 16
      const { data: services, error: servicesError } = await supabase
        .from('worship_services')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('status', 'published')
        .gte('service_time', now)
        .order('service_time', { ascending: true })
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

  const loadUserVolunteerAssignments = useCallback(async (forceReload = false) => {
    if (!user || !organization) return
    if (assignmentsLoaded && !forceReload) return
    
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

      // Update assignments optimistically to prevent UI flicker
      if (isAssigned) {
        // Remove the assignment from the current state
        setUserVolunteerAssignments(prev => 
          prev.filter(assignment => assignment.worship_service_id !== serviceId)
        )
        
        // Update cache
        const current = cache.get(cacheKey)
        if (current) {
          const updatedAssignments = current.assignments.filter(
            assignment => assignment.worship_service_id !== serviceId
          )
          cache.set(cacheKey, { 
            ...current, 
            assignments: updatedAssignments
          })
        }
      } else {
        // Add the new assignment to the current state
        const newAssignment = {
          id: `temp-${Date.now()}`, // Temporary ID
          worship_service_id: serviceId,
          user_id: user.id,
          created_at: new Date().toISOString()
        }
        
        setUserVolunteerAssignments(prev => [...prev, newAssignment])
        
        // Update cache
        const current = cache.get(cacheKey)
        if (current) {
          cache.set(cacheKey, { 
            ...current, 
            assignments: [...current.assignments, newAssignment]
          })
        }
      }
      
      // Refresh the volunteers list for all services (this doesn't affect the green border)
      if (availableServices.length > 0) {
        const serviceIds = availableServices.map(service => service.id)
        await loadVolunteersForServices(serviceIds)
      }
      
      // Optionally reload assignments in the background to sync with server
      // This happens after the UI has already updated, so no flicker
      setTimeout(async () => {
        try {
          await loadUserVolunteerAssignments(true) // Force reload for background sync
        } catch (error) {
          console.error('Background sync failed:', error)
        }
      }, 100)
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

  const filteredServices = availableServices.filter((service) => {
    const serviceLabel = `${service.title} ${formatServiceDate(service.service_time)} ${getServiceTimeDisplay(service.service_time)}`.toLowerCase()
    const matchesSearch = serviceLabel.includes(searchQuery.toLowerCase())

    if (!matchesSearch) return false

    if (timeFilter === 'today') return daysUntil(service.service_time) === 'Today'
    if (timeFilter === 'week') {
      const diffMs = new Date(service.service_time).getTime() - new Date().getTime()
      const diffDays = Math.ceil(diffMs / 86400000)
      return diffDays >= 0 && diffDays <= 7
    }

    return true
  })

  return (
    <Box minH="100vh" bg={bgColor}>
      <Box as="main" maxW="980px" mx="auto" px={{ base: 4, md: 8 }} py={{ base: 6, md: 8 }}>
        <div className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
                Volunteer Signup
              </h1>
              <p className="mt-1 text-sm text-text-muted">
                Sign up to serve at upcoming services for {organization.name}
              </p>
            </div>
            <Menu>
              <MenuButton as={Button} className="btn-secondary" rightIcon={<ChevronDownIcon />} size="sm" variant="outline">
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
          </div>

          {!user ? (
            <div className="rounded-xl border border-border bg-white p-5">
              <div className="space-y-4">
                <p className="text-sm text-text-muted">
                  {t('volunteerPage.signInPrompt')}
                </p>
                <Button
                  onClick={handleGoogleSignIn}
                  isLoading={googleLoading}
                  loadingText={t('volunteerPage.signingIn')}
                  className="btn-primary"
                  size="sm"
                >
                  {t('volunteerPage.continueWithGoogle')}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-xs">
              <InputGroup>
                <InputLeftElement color="gray.400" pointerEvents="none">
                  <SearchIcon />
                </InputLeftElement>
                <Input
                  type="text"
                  placeholder="Search services..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field pl-9"
                />
              </InputGroup>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn-secondary"
              type="button"
            >
              <span>Filters</span>
              <span aria-hidden="true" className={`transition-transform ${showFilters ? 'rotate-90' : ''}`}>›</span>
            </button>
          </div>

          {showFilters ? (
            <div className="sl-chip-row">
              {[
                { label: 'All Services', value: 'all' as const },
                { label: 'Today', value: 'today' as const },
                { label: 'This Week', value: 'week' as const },
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setTimeFilter(filter.value)}
                  className={`sl-chip ${timeFilter === filter.value ? 'sl-chip-active' : ''}`}
                  type="button"
                >
                  {filter.label}
                </button>
              ))}
            </div>
          ) : null}

          {loadingServices ? (
            <Center py={8}>
              <VStack spacing={3}>
                <Spinner size="lg" />
                <Text color={subtitleColor}>{t('volunteerPage.loadingServices')}</Text>
              </VStack>
            </Center>
          ) : filteredServices.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <CalendarIcon className="w-8 h-8 text-text-muted" />
              </div>
              <h3 className="mb-1 text-lg font-semibold text-text-primary">
                No services found
              </h3>
              <p className="mb-4 text-sm text-text-muted">
                {availableServices.length === 0 ? t('volunteerPage.noServicesAvailable') : 'Try adjusting your search or filters'}
              </p>
              <button
                onClick={() => {
                  setSearchQuery('')
                  setTimeFilter('all')
                }}
                className="btn-primary"
                type="button"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredServices.map((service) => {
                const isAssigned = !!user && userVolunteerAssignments.some(
                  (assignment) => assignment.worship_service_id === service.id
                )
                const isExpanded = expandedService === service.id
                const volunteers = serviceIdToVolunteers[service.id] || []
                const uniqueRoles = [...new Set(volunteers.flatMap((volunteer) => volunteer.instruments || []))].slice(0, 4)

                return (
                  <div
                    key={service.id}
                    className="overflow-hidden rounded-xl border border-border bg-white"
                  >
                    <div className="flex items-start gap-4 p-4 md:p-5">
                      <div className="flex w-14 flex-shrink-0 flex-col items-center">
                        <span className="text-xs font-semibold uppercase tracking-wider text-primary-600">
                          {formatMonth(service.service_time)}
                        </span>
                        <span className="text-2xl font-bold text-text-primary">
                          {formatDay(service.service_time)}
                        </span>
                        <span className="text-xs text-text-muted">
                          {daysUntil(service.service_time)}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base font-semibold text-text-primary">
                              {service.title}
                            </h3>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-text-muted">
                              <span className="flex items-center gap-1">
                                <TimeIcon className="w-3.5 h-3.5" />
                                {getServiceTimeDisplay(service.service_time)}
                              </span>
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="w-3.5 h-3.5" />
                                {formatServiceDate(service.service_time)}
                              </span>
                            </div>
                            {isAssigned ? (
                              <div className="mt-2">
                                <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-xs font-medium text-success-700">
                                  <CheckIcon className="w-3.5 h-3.5" />
                                  Signed Up
                                </span>
                              </div>
                            ) : null}
                          </div>
                          <div className="flex-shrink-0">
                            {isAssigned ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-xs font-medium text-success-700">
                                <CheckIcon className="w-3.5 h-3.5" />
                                Signed Up
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
                                {volunteers.length} volunteer{volunteers.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        {volunteers.length > 0 ? (
                          <div className="mt-3 flex items-center gap-2">
                            <div className="flex items-center">
                              {volunteers.slice(0, 4).map((volunteer, index) => {
                                const fullName = `${volunteer.profiles.first_name || ''} ${volunteer.profiles.last_name || ''}`.trim() || volunteer.profiles.email
                                const isCurrentUser = !!user && volunteer.user_id === user.id
                                return (
                                  <div
                                    key={volunteer.id}
                                    className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white"
                                    style={{
                                      zIndex: 4 - index,
                                      marginLeft: index > 0 ? '-8px' : 0,
                                      backgroundColor: isCurrentUser ? '#2563EB' : '#94A3B8',
                                    }}
                                    title={fullName}
                                  >
                                    {getVolunteerInitials(volunteer.profiles.first_name, volunteer.profiles.last_name, volunteer.profiles.email)}
                                  </div>
                                )
                              })}
                              {volunteers.length > 4 ? (
                                <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-xs font-medium text-text-muted" style={{ marginLeft: '-8px', zIndex: 0 }}>
                                  +{volunteers.length - 4}
                                </div>
                              ) : null}
                            </div>
                            <span className="text-xs text-text-muted">
                              {volunteers.length} volunteers
                            </span>
                          </div>
                        ) : null}

                        {uniqueRoles.length > 0 ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {uniqueRoles.map((role) => (
                              <span
                                key={role}
                                className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs text-text-muted"
                              >
                                {role}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="border-t border-border px-4 pb-4 md:px-5">
                        <div className="space-y-4 pt-4">
                          {service.description ? (
                            <div>
                              <h4 className="text-sm font-semibold text-text-primary">Description</h4>
                              <p className="mt-1 text-sm text-text-muted">{service.description}</p>
                            </div>
                          ) : null}

                          <div>
                            <h4 className="text-sm font-semibold text-text-primary">Current Volunteers</h4>
                            {volunteers.length === 0 ? (
                              <p className="mt-1 text-sm text-text-muted">No volunteers assigned yet.</p>
                            ) : (
                              <div className="mt-3 space-y-2">
                                {volunteers.map((volunteer) => {
                                  const fullName = `${volunteer.profiles.first_name || ''} ${volunteer.profiles.last_name || ''}`.trim() || volunteer.profiles.email
                                  const role = volunteer.instruments?.length ? volunteer.instruments.join(', ') : 'Volunteer'
                                  return (
                                    <div key={volunteer.id} className="flex items-center gap-3 rounded-lg bg-gray-50 p-2.5">
                                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                                        {getVolunteerInitials(volunteer.profiles.first_name, volunteer.profiles.last_name, volunteer.profiles.email)}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-text-primary">{fullName}</p>
                                        <p className="text-xs text-text-muted">{role}</p>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="flex items-center gap-2 border-t border-border bg-gray-50/50 px-4 py-3 md:px-5">
                      <button
                        onClick={() => setExpandedService(isExpanded ? null : service.id)}
                        className="btn-ghost flex-1 text-sm"
                        type="button"
                      >
                        {isExpanded ? 'Hide Details' : 'View Details'}
                        <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>›</span>
                      </button>
                      {user ? (
                        isAssigned ? (
                          <button
                            onClick={() => handleVolunteerClick(service.id, true)}
                            className="btn-secondary text-sm"
                            disabled={assigningService === service.id || isReloading}
                            type="button"
                          >
                            Cancel
                          </button>
                        ) : (
                          <button
                            onClick={() => handleVolunteerClick(service.id, false)}
                            className="btn-primary flex-1 text-sm"
                            disabled={assigningService === service.id || isReloading}
                            type="button"
                          >
                            Sign Up
                          </button>
                        )
                      ) : (
                        <button
                          onClick={handleGoogleSignIn}
                          className="btn-primary flex-1 text-sm"
                          disabled={googleLoading}
                          type="button"
                        >
                          Sign In to Serve
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex justify-center pt-6">
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-primary w-full justify-center"
              type="button"
            >
              {t('volunteerPage.viewDashboard')}
            </button>
          </div>
        </div>


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
