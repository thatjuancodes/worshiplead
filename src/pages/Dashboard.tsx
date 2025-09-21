import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { 
  Box, 
  VStack, 
  HStack, 
  Heading, 
  Text, 
  Button, 
  Spinner, 
  SimpleGrid, 
  Grid,
  GridItem, 
  IconButton,
  Select,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerCloseButton,
  Badge,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Alert,
  AlertIcon,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  useColorModeValue,
  useDisclosure,
  Center,
  useToast,
  Tooltip
} from '@chakra-ui/react'
import { CloseButton } from '@chakra-ui/react'
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, EditIcon } from '@chakra-ui/icons'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { keyframes } from '@emotion/react'
import { supabase } from '../lib/supabase'
import { getUserPrimaryOrganization, ensureUserProfileAndMembership } from '../lib/auth'
import { DashboardHeader } from '../components'
import { useOrganizationAccess } from '../hooks/useOrganizationAccess'
import { useAuth } from '../contexts'
import { formatServiceDate, getServiceTimeDisplay, getServiceDateISO, formatForDateTimeInput } from '../utils/dateTime'

interface OrganizationData {
  organization_id: string
  role: string
  organizations: {
    name: string
    slug: string
  } | {
    name: string
    slug: string
  }[]
}

interface WorshipService {
  id: string
  organization_id: string
  title: string
  service_time: string // TIMESTAMPTZ - contains both date and time
  description?: string
  status: 'draft' | 'published' | 'completed'
  created_at: string
  updated_at: string
}

interface Song {
  id: string
  title: string
  artist: string
  key?: string
  bpm?: number
  ccli_number?: string
  tags?: string[]
}

interface ServiceSong {
  id: string
  service_id: string
  song_id: string
  position: number
  notes?: string
  created_at: string
  updated_at: string
  songs: Song
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
}

interface Instrument {
  id: string
  organization_id: string
  name: string
  description?: string | null
  created_at?: string
  updated_at?: string
}

export function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { canManagePrimary } = useOrganizationAccess()
  const { user, isLoading: authLoading, error: authError } = useAuth()
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [services, setServices] = useState<WorshipService[]>([])
  const [displayYear, setDisplayYear] = useState<number | null>(null)
  const [displayMonth, setDisplayMonth] = useState<number | null>(null) // 0-11
  const createDrawer = useDisclosure()

  // Create service form state
  const [creating, setCreating] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDateTime, setFormDateTime] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formError, setFormError] = useState('')

  // Per-day services
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [dayServices, setDayServices] = useState<WorshipService[]>([])
  const [loadingDayServices, setLoadingDayServices] = useState(false)
  const [accordionIndex, setAccordionIndex] = useState<number[]>([])
  const [singleExpanded, setSingleExpanded] = useState(false)
  const [isAddingServiceMode, setIsAddingServiceMode] = useState(false)
  const firstServiceRef = useRef<HTMLDivElement | null>(null)

  // User volunteer dates
  const [userVolunteerDates, setUserVolunteerDates] = useState<string[]>([])

  // Recent songs usage
  interface RecentSongUsage {
    songId: string
    title: string
    artist: string
    usageCount: number
    lastUsedDate: string
  }
  const [recentSongs, setRecentSongs] = useState<RecentSongUsage[]>([])
  const [loadingRecentSongs, setLoadingRecentSongs] = useState(false)
  const [recentSongsError, setRecentSongsError] = useState('')

  // Add Song Drawer state
  const addSongDrawer = useDisclosure()
  const [isAddingSong, setIsAddingSong] = useState(false)
  const [songError, setSongError] = useState('')
  const [songTitle, setSongTitle] = useState('')
  const [songArtist, setSongArtist] = useState('')
  const [songYouTubeUrl, setSongYouTubeUrl] = useState('')
  const [songSpotifyUrl, setSongSpotifyUrl] = useState('')
  const [songKey, setSongKey] = useState('')
  const [songBpm, setSongBpm] = useState('')
  const [songCcli, setSongCcli] = useState('')
  const [songTags, setSongTags] = useState('')
  const [songLyrics, setSongLyrics] = useState('')

  // Songs data
  const [availableSongs, setAvailableSongs] = useState<Song[]>([])
  const [serviceIdToSongs, setServiceIdToSongs] = useState<Record<string, ServiceSong[]>>({})
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  const [removingServiceSongId, setRemovingServiceSongId] = useState<string | null>(null)
  const [selectedSongByService, setSelectedSongByService] = useState<Record<string, string>>({})
  const [songNotesByService, setSongNotesByService] = useState<Record<string, string>>({})
  const [, setAddingSongByService] = useState<Record<string, boolean>>({})
  const [serviceErrorByService, setServiceErrorByService] = useState<Record<string, string>>({})
  const [serviceIdToVolunteers, setServiceIdToVolunteers] = useState<Record<string, Volunteer[]>>({})

  // Enhanced Add Song inline search/create state
  const [songSearchByService, setSongSearchByService] = useState<Record<string, string>>({})
  const [showSongSuggestionsByService, setShowSongSuggestionsByService] = useState<Record<string, boolean>>({})
  const [inlineCreateSongOpenByService, setInlineCreateSongOpenByService] = useState<Record<string, boolean>>({})
  const [inlineCreateArtistByService, setInlineCreateArtistByService] = useState<Record<string, string>>({})
  const [inlineCreateDescriptionByService, setInlineCreateDescriptionByService] = useState<Record<string, string>>({})
  const [inlineCreatingSongByService, setInlineCreatingSongByService] = useState<Record<string, boolean>>({})
  const [showAddSongFormByService, setShowAddSongFormByService] = useState<Record<string, boolean>>({})

  // Instruments and assignments
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loadingInstruments, setLoadingInstruments] = useState(false)
  const [volunteerToInstrumentIds, setVolunteerToInstrumentIds] = useState<Record<string, string[]>>({})
  const [selectedInstrumentByVolunteer, setSelectedInstrumentByVolunteer] = useState<Record<string, string>>({})
  const [savingAssignmentByVolunteer, setSavingAssignmentByVolunteer] = useState<Record<string, boolean>>({})
  const [removingVolunteerById, setRemovingVolunteerById] = useState<Record<string, boolean>>({})

  // Add volunteer state
  const [showAddVolunteerByService, setShowAddVolunteerByService] = useState<Record<string, boolean>>({})
  const [volunteerSearchByService, setVolunteerSearchByService] = useState<Record<string, string>>({})
  const [volunteerSuggestionsVisible, setVolunteerSuggestionsVisible] = useState<Record<string, boolean>>({})
  const [addingVolunteerByService, setAddingVolunteerByService] = useState<Record<string, boolean>>({})
  const [availableUsers, setAvailableUsers] = useState<Array<{id: string, first_name: string, last_name: string, email: string}>>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [usersLoaded, setUsersLoaded] = useState(false)

  // Volunteer link state
  const [volunteerLink, setVolunteerLink] = useState<string>('')
  const [loadingVolunteerLink, setLoadingVolunteerLink] = useState(false)
  const [copyingLink, setCopyingLink] = useState(false)
  const [servicesLoaded, setServicesLoaded] = useState(false)
  const [recentSongsLoaded, setRecentSongsLoaded] = useState(false)
  const [volunteerLinkLoaded, setVolunteerLinkLoaded] = useState(false)
  const [userVolunteerDatesLoaded, setUserVolunteerDatesLoaded] = useState(false)
  const [instrumentsLoaded, setInstrumentsLoaded] = useState(false)
  const toast = useToast()

  const monthNames = [
    t('dashboard.calendar.months.january'),
    t('dashboard.calendar.months.february'),
    t('dashboard.calendar.months.march'),
    t('dashboard.calendar.months.april'),
    t('dashboard.calendar.months.may'),
    t('dashboard.calendar.months.june'),
    t('dashboard.calendar.months.july'),
    t('dashboard.calendar.months.august'),
    t('dashboard.calendar.months.september'),
    t('dashboard.calendar.months.october'),
    t('dashboard.calendar.months.november'),
    t('dashboard.calendar.months.december')
  ]

  function handlePrevMonth() {
    if (!displayMonth || !displayYear) return
    if (displayMonth === 0) {
      setDisplayMonth(11)
      setDisplayYear(displayYear - 1)
      return
    }
    setDisplayMonth(displayMonth - 1)
  }

  function handleNextMonth() {
    if (!displayMonth || !displayYear) return
    if (displayMonth === 11) {
      setDisplayMonth(0)
      setDisplayYear(displayYear + 1)
      return
    }
    setDisplayMonth(displayMonth + 1)
  }

  function handleSelectMonth(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = Number(e.target.value)
    if (Number.isNaN(next)) return
    setDisplayMonth(next)
  }

  const loadAvailableSongs = useCallback(async () => {
    if (!organization) return
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('organization_id', organization.organization_id)
        .order('title', { ascending: true })

      if (error) return
      setAvailableSongs(data || [])
    } catch {
      // ignore
    }
  }, [organization])

  function SortableServiceSongItem({ serviceSong, canManage, onRemove }: { serviceSong: ServiceSong, canManage: boolean, onRemove: (id: string) => void }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: serviceSong.id })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.6 : 1,
    }


    return (
      <Box
        ref={setNodeRef}
        style={style}
        bg="#f9f9f9"
        borderRadius="20px"
        p={4}
        display="flex"
        alignItems="center"
        gap={3}
        transition="all 0.2s ease"
        _hover={{ bg: "#f0f0f0" }}
        cursor={canManage ? 'grab' : 'default'}
        userSelect="none"
        {...attributes}
      >
        <Box
          bg="black"
          color="white"
          borderRadius="full"
          w={8}
          h={8}
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontWeight="600"
          fontSize="sm"
          flexShrink={0}
          position="relative"
          {...(canManage ? listeners : {})}
        >
          {serviceSong.position}
        </Box>

        <Box flex="1" minW="0" cursor={canManage ? 'grab' : 'default'} {...(canManage ? listeners : {})}>
          <Text fontWeight="600" color="black" fontSize="md" mb={0} noOfLines={1}>
            {serviceSong.songs.title}
          </Text>
          <Text color="gray.600" fontSize="sm" mb={0} noOfLines={1}>
            {serviceSong.songs.artist}
          </Text>
          {serviceSong.notes && (
            <Text color="gray.500" fontSize="xs" fontStyle="italic" noOfLines={2} mt={1}>
              {serviceSong.notes}
            </Text>
          )}
        </Box>

        {canManage && (
          <HStack spacing={2}>
            <Tooltip label="Edit song">
              <IconButton
                aria-label="Edit song"
                icon={<EditIcon boxSize="4" />}
                variant="ghost"
                colorScheme="gray"
                size="sm"
                borderRadius="full"
                _hover={{ bg: "gray.200" }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
              />
            </Tooltip>
            <Tooltip label="Remove song from service">
              <IconButton
                aria-label="Remove song from service"
                icon={removingServiceSongId === serviceSong.id ? <Spinner size="xs" /> : <CloseIcon boxSize="3" />}
                variant="ghost"
                colorScheme="red"
                size="sm"
                borderRadius="full"
                _hover={{ bg: "red.100" }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onRemove(serviceSong.id)
                }}
                isDisabled={removingServiceSongId === serviceSong.id}
              />
            </Tooltip>
          </HStack>
        )}
      </Box>
    )
  }

  async function handleCreateServiceSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!organization || !user) {
      setFormError('You must be logged in to create a service.')
      return
    }

    if (!canManagePrimary) {
      setFormError('You do not have permission to create services. Only admins and owners can create services.')
      return
    }

    if (!formTitle.trim() || !formDateTime) {
      setFormError('Please fill in all required fields.')
      return
    }

    try {
      setCreating(true)
      setFormError('')

      const { error } = await supabase
        .from('worship_services')
        .insert({
          organization_id: organization.organization_id,
          title: formTitle.trim(),
          service_time: new Date(formDateTime).toISOString(),
          description: formDescription.trim() || null,
          status: 'draft',
          created_by: user.id
        })
        .select()
        .single()

      if (error) {
        setFormError('Failed to create service. Please try again.')
        return
      }

      setFormTitle('')
      setFormDateTime('')
      setFormDescription('')

      if (selectedDate) {
        setIsAddingServiceMode(false)
        await loadServices()
        await loadServicesForDate(selectedDate)
      } else {
        setFormDateTime('')
        await loadServices()
        createDrawer.onClose()
      }
    } catch (err) {
      setFormError('Failed to create service. Please try again later.')
    } finally {
      setCreating(false)
    }
  }

  const loadServicesForDate = useCallback(async (isoDate: string) => {
    if (!organization) return
    try {
      setLoadingDayServices(true)
      const { data, error } = await supabase
        .from('worship_services')
        .select('id, title, service_time, description, status, created_at, updated_at')
        .eq('organization_id', organization.organization_id)
        .gte('service_time', `${isoDate}T00:00:00.000Z`)
        .lte('service_time', `${isoDate}T23:59:59.999Z`)

      if (error) {
        console.error('Error loading day services:', error)
        setDayServices([])
        return
      }

      const sorted = (data || []).sort((a: any, b: any) => {
        return new Date(a.service_time).getTime() - new Date(b.service_time).getTime()
      }) as WorshipService[]

      setDayServices(sorted)
      if (sorted.length) {
        await loadSongsForServices(sorted.map(s => s.id))
        await loadVolunteersForServices(sorted.map(s => s.id))
      }
    } catch (err) {
      console.error('Unexpected error loading day services:', err)
      setDayServices([])
    } finally {
      setLoadingDayServices(false)
    }
  }, [organization])

  useEffect(() => {
    // Reset when not a single-service case or still loading
    if (loadingDayServices || dayServices.length !== 1) {
      setAccordionIndex([])
      setSingleExpanded(false)
    }
  }, [loadingDayServices, dayServices])

  useEffect(() => {
    // Ensure the expanded panel is visible when auto-expanded
    if (createDrawer.isOpen && singleExpanded && accordionIndex.includes(0)) {
      setTimeout(() => firstServiceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
    }
  }, [createDrawer.isOpen, singleExpanded, accordionIndex])

  useEffect(() => {
    // 500ms delayed auto-expand after data loads to avoid race conditions
    if (createDrawer.isOpen && !loadingDayServices && dayServices.length === 1) {
      const t = setTimeout(() => {
        setSingleExpanded(true)
        setAccordionIndex([0])
      }, 500)
      return () => clearTimeout(t)
    }
  }, [createDrawer.isOpen, loadingDayServices, dayServices.length])

  const loadSongsForServices = useCallback(async (serviceIds: string[]) => {
    if (!organization || serviceIds.length === 0) return
    try {
      const { data, error } = await supabase
        .from('service_songs')
        .select(`*, songs(*)`)
        .in('service_id', serviceIds)
        .order('position', { ascending: true })

      if (error) return

      const mapping: Record<string, ServiceSong[]> = {}
      ;(data || []).forEach((row: any) => {
        const svcId = row.service_id as string
        if (!mapping[svcId]) mapping[svcId] = []
        mapping[svcId].push(row as ServiceSong)
      })
      setServiceIdToSongs(mapping)
    } catch {
      // ignore
    }
  }, [organization])

  const handleRemoveServiceSong = useCallback(async (serviceSongId: string, serviceId: string) => {
    try {
      setRemovingServiceSongId(serviceSongId)
      const { error } = await supabase
        .from('service_songs')
        .delete()
        .eq('id', serviceSongId)

      if (error) return
      await loadSongsForServices([serviceId])
    } catch {
      // ignore
    } finally {
      setRemovingServiceSongId(null)
    }
  }, [loadSongsForServices])

  const handleReorderServiceSongs = useCallback(async (serviceId: string, event: DragEndEvent) => {
    const songs = serviceIdToSongs[serviceId] || []
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = songs.findIndex(s => s.id === String(active.id))
    const newIndex = songs.findIndex(s => s.id === String(over.id))
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(songs, oldIndex, newIndex).map((s, idx) => ({ ...s, position: idx + 1 }))
    setServiceIdToSongs(prev => ({ ...prev, [serviceId]: reordered }))

    try {
      // two-phase update to avoid unique conflicts
      for (let i = 0; i < reordered.length; i++) {
        const song = reordered[i]
        const tempPos = -(i + 1)
        const { error } = await supabase
          .from('service_songs')
          .update({ position: tempPos })
          .eq('id', song.id)
        if (error) return
      }
      for (let i = 0; i < reordered.length; i++) {
        const song = reordered[i]
        const finalPos = i + 1
        const { error } = await supabase
          .from('service_songs')
          .update({ position: finalPos })
          .eq('id', song.id)
        if (error) return
      }
    } catch {
      // ignore
    }
  }, [serviceIdToSongs])

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
        // Don't clear all volunteer data, just ensure the requested services have empty arrays
        setServiceIdToVolunteers(prev => {
          const updated = { ...prev }
          serviceIds.forEach(serviceId => {
            updated[serviceId] = []
          })
          return updated
        })
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

      // Combine the data and create the mapping
      const newMapping: Record<string, Volunteer[]> = {}
      volunteerRecords.forEach((volunteer) => {
        const profile = profiles?.find(p => p.id === volunteer.user_id)
        const volunteerWithProfile = {
          ...volunteer,
          profiles: profile || { first_name: 'Unknown', last_name: 'User', email: 'N/A' }
        }
        
        const svcId = volunteer.worship_service_id
        if (!newMapping[svcId]) newMapping[svcId] = []
        newMapping[svcId].push(volunteerWithProfile as Volunteer)
      })
      
      console.log('Volunteers mapping:', newMapping)
      
      // Merge with existing volunteer data instead of replacing it
      setServiceIdToVolunteers(prev => {
        const updated = { ...prev }
        // Update only the services we just loaded
        Object.keys(newMapping).forEach(serviceId => {
          updated[serviceId] = newMapping[serviceId]
        })
        // Ensure services with no volunteers have empty arrays
        serviceIds.forEach(serviceId => {
          if (!updated[serviceId]) {
            updated[serviceId] = []
          }
        })
        return updated
      })

      // Load instrument assignments for these volunteers
      const volunteerIds = (volunteerRecords || []).map(v => v.id as string)
      if (volunteerIds.length) await loadVolunteerInstruments(volunteerIds)
    } catch {
      // ignore
    }
  }, [organization])

  const loadOrganizationInstruments = useCallback(async () => {
    if (!organization) return
    if (instrumentsLoaded) return
    try {
      setLoadingInstruments(true)
      const { data, error } = await supabase
        .from('instruments')
        .select('*')
        .eq('organization_id', organization.organization_id)
        .order('name', { ascending: true })

      if (error) return
      setInstruments(data || [])
      setInstrumentsLoaded(true)
    } catch {
      // ignore
    } finally {
      setLoadingInstruments(false)
    }
  }, [organization])

  const loadVolunteerInstruments = useCallback(async (volunteerIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('volunteer_instruments')
        .select('volunteer_id, instrument_id')
        .in('volunteer_id', volunteerIds)

      if (error) return

      const mapping: Record<string, string[]> = {}
      ;(data || []).forEach((row: any) => {
        const vId = row.volunteer_id as string
        const iId = row.instrument_id as string
        if (!mapping[vId]) mapping[vId] = []
        mapping[vId].push(iId)
      })
      setVolunteerToInstrumentIds(mapping)
    } catch {
      // ignore
    }
  }, [])

  const handleAssignInstrument = useCallback(async (volunteerId: string, instrumentId: string) => {
    if (!instrumentId) return
    try {
      // Prevent assigning instruments already assigned to any volunteer in the expanded services list
      const assignedInstrumentIds = new Set<string>(
        Object.values(volunteerToInstrumentIds).flat()
      )
      if (assignedInstrumentIds.has(instrumentId)) return
      setSavingAssignmentByVolunteer(prev => ({ ...prev, [volunteerId]: true }))
      const { error } = await supabase
        .from('volunteer_instruments')
        .insert({ volunteer_id: volunteerId, instrument_id: instrumentId })

      if (error) return

      setVolunteerToInstrumentIds(prev => {
        const existing = prev[volunteerId] || []
        if (existing.includes(instrumentId)) return prev
        return { ...prev, [volunteerId]: [...existing, instrumentId] }
      })
      setSelectedInstrumentByVolunteer(prev => ({ ...prev, [volunteerId]: '' }))
    } catch {
      // ignore
    } finally {
      setSavingAssignmentByVolunteer(prev => ({ ...prev, [volunteerId]: false }))
    }
  }, [])

  const handleRemoveInstrument = useCallback(async (volunteerId: string, instrumentId: string) => {
    try {
      setSavingAssignmentByVolunteer(prev => ({ ...prev, [volunteerId]: true }))
      const { error } = await supabase
        .from('volunteer_instruments')
        .delete()
        .eq('volunteer_id', volunteerId)
        .eq('instrument_id', instrumentId)

      if (error) return

      setVolunteerToInstrumentIds(prev => {
        const existing = prev[volunteerId] || []
        return { ...prev, [volunteerId]: existing.filter(id => id !== instrumentId) }
      })
    } catch {
      // ignore
    } finally {
      setSavingAssignmentByVolunteer(prev => ({ ...prev, [volunteerId]: false }))
    }
  }, [])

  const handleRemoveVolunteer = useCallback(async (volunteerId: string, serviceId: string) => {
    try {
      setRemovingVolunteerById(prev => ({ ...prev, [volunteerId]: true }))
      
      // Remove the volunteer from the service
      const { error } = await supabase
        .from('worship_service_volunteers')
        .delete()
        .eq('id', volunteerId)

      if (error) {
        console.error('Error removing volunteer:', error)
        toast({
          title: 'Error',
          description: 'Failed to remove volunteer from service',
          status: 'error',
          duration: 3000,
          isClosable: true
        })
        return
      }

      // Refresh volunteers for the affected service
      await loadVolunteersForServices([serviceId])
      
      toast({
        title: 'Success',
        description: 'Volunteer removed from service',
        status: 'success',
        duration: 3000,
        isClosable: true
      })
    } catch (err) {
      console.error('Unexpected error removing volunteer:', err)
      toast({
        title: 'Error', 
        description: 'Failed to remove volunteer from service',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    } finally {
      setRemovingVolunteerById(prev => ({ ...prev, [volunteerId]: false }))
    }
  }, [loadVolunteersForServices, toast])

  const loadAvailableUsers = useCallback(async () => {
    if (!organization || usersLoaded || loadingUsers) return
    
    try {
      setLoadingUsers(true)
      
      // Get all users who are members of this organization
      const { data: orgMembers, error: membersError } = await supabase
        .from('organization_memberships')
        .select('user_id')
        .eq('organization_id', organization.organization_id)

      if (membersError) {
        console.error('Error loading organization members:', membersError)
        setLoadingUsers(false)
        return
      }

      if (!orgMembers || orgMembers.length === 0) {
        setAvailableUsers([])
        setLoadingUsers(false)
        setUsersLoaded(true)
        return
      }

      // Get profiles for these users
      const userIds = orgMembers.map(m => m.user_id)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', userIds)
        .order('first_name', { ascending: true })

      if (profilesError) {
        console.error('Error loading user profiles:', profilesError)
        setLoadingUsers(false)
        return
      }

      setAvailableUsers(profiles || [])
      setUsersLoaded(true)
    } catch (err) {
      console.error('Unexpected error loading users:', err)
    } finally {
      setLoadingUsers(false)
    }
  }, [organization, usersLoaded])

  const handleAddVolunteer = useCallback(async (serviceId: string, userId: string) => {
    if (!serviceId || !userId) return
    
    try {
      setAddingVolunteerByService(prev => ({ ...prev, [serviceId]: true }))
      
      // Check if user is already volunteering for this service
      const { data: existing, error: checkError } = await supabase
        .from('worship_service_volunteers')
        .select('id')
        .eq('worship_service_id', serviceId)
        .eq('user_id', userId)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing volunteer:', checkError)
        toast({
          title: 'Error',
          description: 'Failed to check if user is already volunteering',
          status: 'error',
          duration: 3000,
          isClosable: true
        })
        return
      }

      if (existing) {
        toast({
          title: 'Already volunteering',
          description: 'This user is already volunteering for this service',
          status: 'info',
          duration: 3000,
          isClosable: true
        })
        return
      }

      // Add the volunteer
      const { error: insertError } = await supabase
        .from('worship_service_volunteers')
        .insert({
          worship_service_id: serviceId,
          user_id: userId
        })

      if (insertError) {
        console.error('Error adding volunteer:', insertError)
        toast({
          title: 'Error',
          description: 'Failed to add volunteer to service',
          status: 'error',
          duration: 3000,
          isClosable: true
        })
        return
      }

      // Refresh volunteers for this service
      await loadVolunteersForServices([serviceId])
      
      // Reset form
      setVolunteerSearchByService(prev => ({ ...prev, [serviceId]: '' }))
      setVolunteerSuggestionsVisible(prev => ({ ...prev, [serviceId]: false }))
      setShowAddVolunteerByService(prev => ({ ...prev, [serviceId]: false }))
      
      toast({
        title: 'Success',
        description: 'Volunteer added to service',
        status: 'success',
        duration: 3000,
        isClosable: true
      })
    } catch (err) {
      console.error('Unexpected error adding volunteer:', err)
      toast({
        title: 'Error',
        description: 'Failed to add volunteer to service',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    } finally {
      setAddingVolunteerByService(prev => ({ ...prev, [serviceId]: false }))
    }
  }, [loadVolunteersForServices, toast])

  useEffect(() => {
    if (createDrawer.isOpen) {
      loadAvailableSongs()
      loadAvailableUsers()
    }
  }, [createDrawer.isOpen, loadAvailableSongs, loadAvailableUsers])

  const loadRecentSongs = useCallback(async () => {
    if (!organization) return
    if (recentSongsLoaded) return
    try {
      setLoadingRecentSongs(true)
      setRecentSongsError('')

      // 1) Fetch all services for org (id -> service_time)
      const { data: servicesData, error: servicesErr } = await supabase
        .from('worship_services')
        .select('id, service_time')
        .eq('organization_id', organization.organization_id)

      if (servicesErr) {
        setRecentSongsError('Failed to load services for songs usage')
        setRecentSongs([])
        return
      }

      const serviceIdToDate = new Map<string, string>()
      const serviceIds: string[] = []
      ;(servicesData || []).forEach((s: any) => {
        serviceIdToDate.set(s.id as string, getServiceDateISO(s.service_time as string))
        serviceIds.push(s.id as string)
      })

      if (serviceIds.length === 0) {
        setRecentSongs([])
        return
      }

      // 2) Fetch all service_songs for these services with song info
      const { data: ssData, error: ssErr } = await supabase
        .from('service_songs')
        .select(`id, service_id, songs ( id, title, artist )`)
        .in('service_id', serviceIds)

      if (ssErr) {
        setRecentSongsError('Failed to load songs usage')
        setRecentSongs([])
        return
      }

      // 3) Aggregate usage by song
      const usageMap = new Map<string, { title: string, artist: string, count: number, last: string }>()
      ;(ssData || []).forEach((row: any) => {
        const song = row.songs
        if (!song) return
        const songId = song.id as string
        const title = song.title as string
        const artist = song.artist as string

        const svcDate = serviceIdToDate.get(row.service_id as string) || '1970-01-01'

        const prev = usageMap.get(songId)
        if (!prev) usageMap.set(songId, { title, artist, count: 1, last: svcDate })
        else {
          const last = prev.last > svcDate ? prev.last : svcDate
          usageMap.set(songId, { title, artist, count: prev.count + 1, last })
        }
      })

      const aggregated: RecentSongUsage[] = Array.from(usageMap.entries()).map(([songId, v]) => ({
        songId,
        title: v.title,
        artist: v.artist,
        usageCount: v.count,
        lastUsedDate: v.last
      }))

      // Sort by total usage desc, then by last used desc
      aggregated.sort((a, b) => {
        if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount
        return a.lastUsedDate < b.lastUsedDate ? 1 : -1
      })
      setRecentSongs(aggregated.slice(0, 5))
      setRecentSongsLoaded(true)
    } catch (err) {
      setRecentSongsError('Failed to load recent songs')
      setRecentSongs([])
    } finally {
      setLoadingRecentSongs(false)
    }
  }, [organization])

  const loadVolunteerLink = useCallback(async () => {
    if (!organization) return
    if (volunteerLinkLoaded) return
    try {
      setLoadingVolunteerLink(true)
      console.log('Loading volunteer link for organization:', organization.organization_id)
      
      // Check if organization already has a volunteer link
      const { data: existingLink, error: fetchError } = await supabase
        .from('organization_volunteer_links')
        .select('public_url')
        .eq('organization_id', organization.organization_id)
        .single()

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // PGRST116 is "no rows returned" - that's expected if no link exists
          console.log('No existing volunteer link found, creating new one...')
        } else {
          console.error('Error fetching volunteer link:', fetchError)
          toast({
            title: 'Error',
            description: 'Failed to check existing volunteer link',
            status: 'error',
            duration: 3000,
            isClosable: true
          })
          return
        }
      }

      if (existingLink) {
        console.log('Found existing volunteer link:', existingLink.public_url)
        setVolunteerLink(existingLink.public_url)
        setVolunteerLinkLoaded(true)
        return
      }

      // Create new volunteer link if none exists
      const publicUrl = `volunteer-${organization.organization_id.slice(0, 8)}`
      console.log('Creating new volunteer link:', publicUrl)
      
      const { error: createError } = await supabase
        .from('organization_volunteer_links')
        .insert({
          organization_id: organization.organization_id,
          public_url: publicUrl
        })

      if (createError) {
        console.error('Error creating volunteer link:', createError)
        toast({
          title: 'Error',
          description: `Failed to create volunteer link: ${createError.message}`,
          status: 'error',
          duration: 5000,
          isClosable: true
        })
        return
      }

      console.log('Successfully created volunteer link:', publicUrl)
      setVolunteerLink(publicUrl)
      setVolunteerLinkLoaded(true)
    } catch (err) {
      console.error('Unexpected error loading volunteer link:', err)
      toast({
        title: 'Error',
        description: 'Failed to load volunteer link',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    } finally {
      setLoadingVolunteerLink(false)
    }
  }, [organization, toast])

  const loadUserVolunteerDates = useCallback(async () => {
    if (!organization || !user) return
    if (userVolunteerDatesLoaded) return
    try {
      // Get all services where the current user has volunteered
      const { data: volunteerRecords, error: volunteerError } = await supabase
        .from('worship_service_volunteers')
        .select('worship_service_id')
        .eq('user_id', user.id)

      if (volunteerError) {
        console.error('Error loading user volunteer dates:', volunteerError)
        setUserVolunteerDates([])
        return
      }

      if (!volunteerRecords || volunteerRecords.length === 0) {
        setUserVolunteerDates([])
        return
      }

      // Get the service dates for these volunteer records
      const serviceIds = volunteerRecords.map(record => record.worship_service_id)
      const { data: services, error: servicesError } = await supabase
        .from('worship_services')
        .select('id, service_time')
        .in('id', serviceIds)
        .eq('organization_id', organization.organization_id)

      if (servicesError) {
        console.error('Error loading service dates:', servicesError)
        setUserVolunteerDates([])
        return
      }

      // Extract the service dates from service_time timestamps
      const dates = (services || [])
        .map(service => getServiceDateISO(service.service_time))
        .filter(date => date) as string[]

      setUserVolunteerDates(dates)

      // Ensure volunteer, instrument, and song data is loaded for these services
      if (serviceIds.length) {
        await Promise.all([
          loadVolunteersForServices(serviceIds),
          loadSongsForServices(serviceIds)
        ])
      }

      // Find the next upcoming volunteer service and set calendar to that month
      if (dates.length > 0) {
        const today = new Date()
        const upcomingDates = dates
          .filter(date => new Date(date) >= today)
          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

        if (upcomingDates.length > 0) {
          const nextVolunteerDate = new Date(upcomingDates[0])
          const nextYear = nextVolunteerDate.getFullYear()
          const nextMonth = nextVolunteerDate.getMonth() // 0-11
          
          // Only update if it's different from current display
          if (nextYear !== displayYear || nextMonth !== displayMonth) {
            setDisplayYear(nextYear)
            setDisplayMonth(nextMonth)
          }
        } else {
          // No upcoming dates, set to current month if not already set
          if (displayYear === null || displayMonth === null) {
            const now = new Date()
            setDisplayYear(now.getFullYear())
            setDisplayMonth(now.getMonth())
          }
        }
      } else {
        // No volunteer dates at all, set to current month if not already set
        if (displayYear === null || displayMonth === null) {
          const now = new Date()
          setDisplayYear(now.getFullYear())
          setDisplayMonth(now.getMonth())
        }
      }
      setUserVolunteerDatesLoaded(true)
    } catch (error) {
      console.error('Error loading user volunteer dates:', error)
      setUserVolunteerDates([])
    }
  }, [organization, user, displayYear, displayMonth, loadVolunteersForServices])

  const copyVolunteerLink = async () => {
    try {
      setCopyingLink(true)
      
      // If no volunteer link exists, create one first
      if (!volunteerLink) {
        await loadVolunteerLink()
        // Wait a moment for the state to update
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      if (!volunteerLink) {
        toast({
          title: 'Error',
          description: 'Failed to create volunteer link',
          status: 'error',
          duration: 3000,
          isClosable: true
        })
        return
      }
      
      const fullUrl = `${window.location.origin}/volunteer/${volunteerLink}`
      await navigator.clipboard.writeText(fullUrl)
      
      toast({
        title: 'Link copied!',
        description: 'Volunteer link copied to clipboard',
        status: 'success',
        duration: 3000,
        isClosable: true
      })
    } catch (err) {
      console.error('Failed to copy link:', err)
      toast({
        title: 'Error',
        description: 'Failed to copy link to clipboard',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    } finally {
      setCopyingLink(false)
    }
  }


  async function handleAddSongToService(serviceId: string, overrideSongId?: string) {
    if (!serviceId) return
    
    if (!canManagePrimary) {
      setServiceErrorByService(prev => ({ ...prev, [serviceId]: 'You do not have permission to add songs. Only admins and owners can add songs to services.' }))
      return
    }
    
    const selectedSongId = overrideSongId || selectedSongByService[serviceId]
    const notes = (songNotesByService[serviceId] || '').trim()
    if (!selectedSongId) {
      setServiceErrorByService(prev => ({ ...prev, [serviceId]: 'Please select a song.' }))
      return
    }

    try {
      setAddingSongByService(prev => ({ ...prev, [serviceId]: true }))
      setServiceErrorByService(prev => ({ ...prev, [serviceId]: '' }))

      const currentSongs = serviceIdToSongs[serviceId] || []
      const nextPosition = currentSongs.length + 1

      const { error } = await supabase
        .from('service_songs')
        .insert({
          service_id: serviceId,
          song_id: selectedSongId,
          position: nextPosition,
          notes: notes || null
        })
        .select(`*, songs(*)`)
        .single()

      if (error) {
        setServiceErrorByService(prev => ({ ...prev, [serviceId]: 'Failed to add song. Please try again.' }))
        return
      }

      // Refresh songs for this service
      await loadSongsForServices([serviceId])
      setSelectedSongByService(prev => ({ ...prev, [serviceId]: '' }))
      setSongNotesByService(prev => ({ ...prev, [serviceId]: '' }))
    } catch {
      setServiceErrorByService(prev => ({ ...prev, [serviceId]: 'Failed to add song. Please try again.' }))
    } finally {
      setAddingSongByService(prev => ({ ...prev, [serviceId]: false }))
    }
  }

  const loadOrganization = useCallback(async () => {
    if (!user) return
    
    try {
      console.log('Dashboard: Loading organization for user:', user.id)
      
      // Ensure user has profile and basic setup
      try {
        await ensureUserProfileAndMembership(user)
        console.log('Dashboard: User profile and membership ensured')
      } catch (error) {
        console.error('Dashboard: Error ensuring user profile and membership:', error)
        toast({
          title: 'Warning',
          description: 'Failed to create user profile. Some features may not work properly.',
          status: 'warning',
          duration: 5000,
          isClosable: true
        })
      }

      const userOrg = await getUserPrimaryOrganization(user.id)
      console.log('Dashboard: User organization data:', userOrg)
      if (!userOrg) {
        console.log('Dashboard: No organization found, redirecting to organization-setup')
        navigate('/organization-setup')
        return
      }
      setOrganization(userOrg)
      const now = new Date()
      setDisplayYear(now.getFullYear())
      setDisplayMonth(now.getMonth())
    } catch (error) {
      console.error('Dashboard: Error loading organization:', error)
      navigate('/login')
    }
  }, [user, navigate, toast])

  // Wait for auth to complete, then load organization
  useEffect(() => {
    if (authLoading) {
      console.log('Dashboard: Waiting for auth to complete...')
      return
    }
    
    if (authError) {
      console.error('Dashboard: Auth error:', authError)
      navigate('/login')
      return
    }
    
    if (!user) {
      console.log('Dashboard: No user from auth, redirecting to login')
      navigate('/login')
      return
    }
    
    console.log('Dashboard: Auth complete, loading organization...')
    loadOrganization()
  }, [authLoading, authError, user, loadOrganization, navigate])

  const loadServices = useCallback(async () => {
    if (!organization) return
    if (servicesLoaded) return

    try {
      const { data, error } = await supabase
        .from('worship_services')
        .select('id, service_time, title, status')
        .eq('organization_id', organization.organization_id)

      if (error) {
        console.error('Error loading services:', error)
        return
      }

      setServices((data || []) as unknown as WorshipService[])
      setServicesLoaded(true)
    } catch (err) {
      console.error('Unexpected error loading services:', err)
    }
  }, [organization])

  // When organization is ready, trigger all data loads in parallel
  useEffect(() => {
    if (!organization) return
    loadServices()
    loadRecentSongs()
    loadVolunteerLink()
    loadUserVolunteerDates()
    loadOrganizationInstruments()
  }, [organization])

  // Load volunteers for upcoming services when services are loaded
  useEffect(() => {
    if (!organization || services.length === 0) return
    
    // Get upcoming services (same logic as in the render)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const upcomingServices = services
      .filter(service => {
        const serviceDate = new Date(service.service_time)
        return serviceDate >= today
      })
      .slice(0, 8) // Show next 8 upcoming services
    
    if (upcomingServices.length > 0) {
      const serviceIds = upcomingServices.map(service => service.id)
      loadVolunteersForServices(serviceIds)
    }
  }, [organization, services, loadVolunteersForServices])

  const bgColor = useColorModeValue('gray.50', 'gray.900')
  const cardBg = useColorModeValue('white', 'gray.800')
  const cardBorderColor = useColorModeValue('gray.200', 'gray.600')
  // Removed quick actions; hover styles unused
  const titleColor = useColorModeValue('gray.800', 'white')
  const subtitleColor = useColorModeValue('gray.600', 'gray.300')
  const textColor = useColorModeValue('gray.700', 'gray.200')
  const mutedTextColor = useColorModeValue('gray.500', 'gray.400')
  const rankColors = ['blue.500', 'blue.400', 'blue.300', 'blue.200', 'blue.100']
  function getRankColor(index: number) {
    return rankColors[index] || 'blue.100'
  }
  const addSongPulse = keyframes`
    0% { box-shadow: 0 0 0 0 rgba(49, 130, 206, 0.45) }
    70% { box-shadow: 0 0 0 10px rgba(49, 130, 206, 0) }
    100% { box-shadow: 0 0 0 0 rgba(49, 130, 206, 0) }
  `
  const volunteerPulse = keyframes`
    0% { box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.6) }
    70% { box-shadow: 0 0 0 8px rgba(33, 150, 243, 0) }
    100% { box-shadow: 0 0 0 0 rgba(33, 150, 243, 0) }
  `
  const mobileTextSx = {
    '@media (max-width: 48em)': {
      '& .chakra-text': { fontSize: 'lg' },
      '& .chakra-heading': { fontSize: 'xl' },
      '& .chakra-button': { fontSize: 'md' },
      '& .chakra-badge': { fontSize: 'sm' },
      '& .chakra-input, & .chakra-select, & .chakra-textarea': { fontSize: 'md' },
      '& .chakra-icon': { width: '1.1em', height: '1.1em' }
    }
  }
  // Removed unused activity styles after replacing Recent Activity with Songs

  if (authLoading) {
    return (
      <Box
        minH="100vh"
        bg={bgColor}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Center>
          <VStack spacing={4}>
            <Spinner
              thickness="4px"
              speed="0.65s"
              emptyColor="gray.200"
              color="blue.500"
              size="xl"
            />
            <Text color={subtitleColor} fontSize="md" m={0}>
              {authLoading ? t('dashboard.loading.authenticating') : t('dashboard.loading.loadingDashboard')}
            </Text>
          </VStack>
        </Center>
      </Box>
    )
  }

  return (
    <Box minH="100vh" bg={bgColor} sx={mobileTextSx}>
      <DashboardHeader user={user} organization={organization} />

      <Box as="main" maxW="1200px" mx="auto" p={{ base: 6, md: 8 }} pb={{ base: '200px', md: 8 }} sx={mobileTextSx}>
        {/* Dashboard Content */}
        <VStack spacing={8}>
          {/* Main Content Grid */}
          <Grid templateColumns={{ base: '1fr', md: 'repeat(12, 1fr)' }} gap={6} w="100%">
            {/* Left Column (8/12) - Upcoming + Calendar */}
            <GridItem colSpan={{ base: 12, md: 8 }}>
              <VStack spacing={6} align="stretch">
                {/* Upcoming Section */}
                <Box
                  bg={cardBg}
                  borderRadius="xl"
                  p={{ base: 5, md: 6 }}
                  boxShadow="sm"
                  w="100%"
                >
                  <Heading
                    as="h3"
                    size="lg"
                    color={titleColor}
                    mb={4}
                    fontWeight="600"
                  >
                    Upcoming 📅
                  </Heading>
                  
                  {(() => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0) // Set to start of today for accurate comparison
                    
                    // Get all services from today forward, ordered chronologically
                    const upcomingServices = services
                      .filter(service => {
                        const serviceDate = new Date(service.service_time)
                        return serviceDate >= today
                      })
                      .sort((a, b) => new Date(a.service_time).getTime() - new Date(b.service_time).getTime())
                      .slice(0, 8) // Show next 8 upcoming services
                    
                    console.log('Debug - All services:', services.length)
                    console.log('Debug - Upcoming services:', upcomingServices.length)
                    console.log('Debug - Services statuses:', services.map(s => ({ id: s.id, status: s.status, date: getServiceDateISO(s.service_time) })))
                    
                    return upcomingServices.length === 0 ? (
                      <Text color={mutedTextColor} textAlign="center" py={4}>
                        No upcoming services
                      </Text>
                    ) : (
                      <VStack spacing={3} align="stretch">
                        {upcomingServices.map((service, index) => {
                          const volunteers = serviceIdToVolunteers[service.id] || []
                          const isUserVolunteer = user && volunteers.some(v => v.user_id === user.id)
                          const isNextService = index < 2 // First 2 services are "Next Service"
                          
                          return (
                            <Box
                              key={service.id}
                              bg={isUserVolunteer 
                                ? useColorModeValue('rgba(33, 150, 243, 0.05)', 'rgba(33, 150, 243, 0.1)') 
                                : useColorModeValue('#f9f9f9', 'gray.700')
                              }
                              borderRadius="20px"
                              p="12px 16px"
                              cursor="pointer"
                              _hover={{ 
                                bg: isUserVolunteer 
                                  ? useColorModeValue('rgba(33, 150, 243, 0.08)', 'rgba(33, 150, 243, 0.15)')
                                  : useColorModeValue('#f0f0f0', 'gray.600'),
                                transform: 'translateY(-1px)'
                              }}
                              transition="all 0.2s"
                              onClick={() => {
                                const serviceDate = getServiceDateISO(service.service_time)
                                setFormDateTime(formatForDateTimeInput(service.service_time))
                                setSelectedDate(serviceDate)
                                loadServicesForDate(serviceDate)
                                setIsAddingServiceMode(false)
                                createDrawer.onOpen()
                              }}
                              position="relative"
                              {...(isUserVolunteer ? {
                                animation: `${volunteerPulse} 2s ease-in-out infinite`,
                                border: '2px solid #2196f3',
                                boxShadow: '0 0 0 2px rgba(33, 150, 243, 0.3)'
                              } : {})}
                            >
                              {(() => {
                                const serviceDate = new Date(service.service_time)
                                const dateStr = formatServiceDate(service.service_time)
                                
                                // Get ordinal for the Sunday of the month
                                const firstDayOfMonth = new Date(serviceDate.getFullYear(), serviceDate.getMonth(), 1)
                                const firstSunday = new Date(firstDayOfMonth)
                                while (firstSunday.getDay() !== 0) {
                                  firstSunday.setDate(firstSunday.getDate() + 1)
                                }
                                
                                const weekNumber = Math.ceil((serviceDate.getDate() - firstSunday.getDate() + 1) / 7)
                                const ordinals = ['', '1st', '2nd', '3rd', '4th', '5th']
                                const ordinal = ordinals[weekNumber] || `${weekNumber}th`
                                
                                const timePart = getServiceTimeDisplay(service.service_time).toLowerCase().replace(' ', '')
                                
                                
                                return (
                                  <>
                                    {/* Desktop: Single row layout */}
                                    <HStack justify="space-between" align="center" w="100%" display={{ base: "none", md: "flex" }}>
                                      {/* Date | Ordinal SUN | Time */}
                                      <HStack spacing={3} align="center" flex="1">
                                        <Box minW="90px">
                                          <Text fontWeight="600" color={textColor} fontSize="sm" textAlign="left">
                                            {dateStr}
                                          </Text>
                                        </Box>
                                        <Text color={mutedTextColor} fontSize="sm">
                                          |
                                        </Text>
                                        <Box minW="65px">
                                          <Text fontWeight="500" color={mutedTextColor} fontSize="sm" textAlign="center">
                                            {ordinal} SUN
                                          </Text>
                                        </Box>
                                        <Text color={mutedTextColor} fontSize="sm">
                                          |
                                        </Text>
                                        <Box minW="45px">
                                          <Text fontWeight="500" color={textColor} fontSize="sm" textAlign="left">
                                            {timePart}
                                          </Text>
                                        </Box>
                                        {isNextService && (
                                          <Badge
                                            colorScheme="orange"
                                            variant="solid"
                                            fontSize="xs"
                                            px={2}
                                            py={1}
                                            borderRadius="md"
                                            ml={2}
                                          >
                                            Next Service
                                          </Badge>
                                        )}
                                      </HStack>
                                      
                                      {/* Desktop: Volunteer circles on same row */}
                                      <HStack spacing={2} align="center">
                                        <HStack spacing={1}>
                                          {(() => {
                                            // Sort volunteers to put current user first
                                            const sortedVolunteers = [...volunteers].sort((a, b) => {
                                              if (user && a.user_id === user.id) return -1
                                              if (user && b.user_id === user.id) return 1
                                              return 0
                                            })
                                            
                                            return sortedVolunteers.map((volunteer) => {
                                              const firstName = volunteer.profiles.first_name || 'U'
                                              const lastName = volunteer.profiles.last_name || 'U'
                                              const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
                                              const isCurrentUser = user && volunteer.user_id === user.id
                                              
                                              return (
                                                <Tooltip 
                                                  key={volunteer.id}
                                                  label={`${firstName} ${lastName}`}
                                                  placement="top"
                                                  hasArrow
                                                >
                                                  <Box
                                                    bg={isCurrentUser 
                                                      ? useColorModeValue('#2196f3', '#1976d2') 
                                                      : useColorModeValue('#eee', 'gray.600')
                                                    }
                                                    borderRadius="50%"
                                                    w="30px"
                                                    h="30px"
                                                    display="flex"
                                                    alignItems="center"
                                                    justifyContent="center"
                                                    fontSize="14px"
                                                    fontWeight="600"
                                                    color={isCurrentUser ? 'white' : textColor}
                                                    cursor="pointer"
                                                  >
                                                    {initials}
                                                  </Box>
                                                </Tooltip>
                                              )
                                            })
                                          })()}
                                        </HStack>
                                        
                                      </HStack>
                                    </HStack>

                                    {/* Mobile: Two row layout */}
                                    <VStack spacing={2} align="stretch" w="100%" display={{ base: "flex", md: "none" }}>
                                      {/* Mobile: Service details row */}
                                      <HStack spacing={2} align="center" w="100%">
                                        <Box minW="115px">
                                          <Text fontWeight="600" color={textColor} fontSize="sm" textAlign="left">
                                            {dateStr}
                                          </Text>
                                        </Box>
                                        <Text color={mutedTextColor} fontSize="sm">
                                          |
                                        </Text>
                                        <Box minW="55px">
                                          <Text fontWeight="500" color={mutedTextColor} fontSize="sm" textAlign="center">
                                            {ordinal} SUN
                                          </Text>
                                        </Box>
                                        <Text color={mutedTextColor} fontSize="sm">
                                          |
                                        </Text>
                                        <Box minW="35px">
                                          <Text fontWeight="500" color={textColor} fontSize="sm" textAlign="left">
                                            {timePart}
                                          </Text>
                                        </Box>
                                      </HStack>
                                      
                                      {/* Mobile: Next Service badge row */}
                                      {isNextService && (
                                        <HStack spacing={2} align="center" justify="flex-start" w="100%">
                                          <Badge
                                            colorScheme="orange"
                                            variant="solid"
                                            fontSize="xs"
                                            px={2}
                                            py={1}
                                            borderRadius="md"
                                          >
                                            Next Service
                                          </Badge>
                                        </HStack>
                                      )}
                                      
                                      {/* Mobile: Volunteer circles on separate row */}
                                      {volunteers.length > 0 && (
                                        <HStack spacing={1} align="center" justify="flex-start" flexWrap="wrap">
                                          {(() => {
                                            // Sort volunteers to put current user first
                                            const sortedVolunteers = [...volunteers].sort((a, b) => {
                                              if (user && a.user_id === user.id) return -1
                                              if (user && b.user_id === user.id) return 1
                                              return 0
                                            })
                                            
                                            return sortedVolunteers.map((volunteer) => {
                                              const firstName = volunteer.profiles.first_name || 'U'
                                              const lastName = volunteer.profiles.last_name || 'U'
                                              const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
                                              const isCurrentUser = user && volunteer.user_id === user.id
                                              
                                              return (
                                                <Tooltip 
                                                  key={volunteer.id}
                                                  label={`${firstName} ${lastName}`}
                                                  placement="top"
                                                  hasArrow
                                                >
                                                  <Box
                                                    bg={isCurrentUser 
                                                      ? useColorModeValue('#2196f3', '#1976d2') 
                                                      : useColorModeValue('#eee', 'gray.600')
                                                    }
                                                    borderRadius="50%"
                                                    w="28px"
                                                    h="28px"
                                                    display="flex"
                                                    alignItems="center"
                                                    justifyContent="center"
                                                    fontSize="12px"
                                                    fontWeight="600"
                                                    color={isCurrentUser ? 'white' : textColor}
                                                    cursor="pointer"
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                    }}
                                                  >
                                                    {initials}
                                                  </Box>
                                                </Tooltip>
                                              )
                                            })
                                          })()}
                                        </HStack>
                                      )}
                                    </VStack>
                                  </>
                                )
                              })()}
                            </Box>
                          )
                          })
                          .filter(Boolean) // Remove any null entries
                      }
                      </VStack>
                    )
                  })()}
                </Box>

                {/* Service Calendar Section */}
                <Box
                  bg={cardBg}
                  borderRadius="xl"
                  p={{ base: 5, md: 6 }}
                  boxShadow="sm"
                  w="100%"
                  display={{ base: "none", md: "block" }}
                >

                <HStack justify="center" mb={4}>
                  <IconButton
                    aria-label={t('dashboard.calendar.previousMonth')}
                    icon={<ChevronLeftIcon />}
                    size="sm"
                    variant="outline"
                    onClick={handlePrevMonth}
                    isDisabled={displayYear === null || displayMonth === null}
                  />

                  <Select
                    value={displayMonth ?? new Date().getMonth()}
                    onChange={handleSelectMonth}
                    maxW={{ base: '200px', md: '220px' }}
                    size="sm"
                    isDisabled={displayYear === null || displayMonth === null}
                  >
                    {monthNames.map((label, idx) => (
                      <option key={label} value={idx}>{label}</option>
                    ))}
                  </Select>

                  <Text m={0} fontWeight="600" color={textColor}
                    minW="64px" textAlign="center">
                    {displayYear ?? new Date().getFullYear()}
                  </Text>

                  <IconButton
                    aria-label={t('dashboard.calendar.nextMonth')}
                    icon={<ChevronRightIcon />}
                    size="sm"
                    variant="outline"
                    onClick={handleNextMonth}
                    isDisabled={displayYear === null || displayMonth === null}
                  />
                </HStack>

                {displayYear === null || displayMonth === null ? (
                  <Center py={8}>
                    <Spinner />
                  </Center>
                ) : (
                  <CalendarGrid
                    year={displayYear}
                    month={displayMonth}
                    scheduledDates={[...new Set(services.map(s => getServiceDateISO(s.service_time)))]}
                    userVolunteerDates={userVolunteerDates}
                    onDateClick={(iso) => {
                      const defaultDateTime = `${iso}T10:00`
                      setFormDateTime(defaultDateTime)
                      setSelectedDate(iso)
                      loadServicesForDate(iso)
                      setIsAddingServiceMode(false)
                      createDrawer.onOpen()
                    }}
                  />
                )}

                {canManagePrimary && (
                  <Button
                    bg="#2196f3"
                    color="white"
                    border="none"
                    borderRadius="999px"
                    px="24px"
                    py="12px"
                    fontSize="15px"
                    fontWeight="bold"
                    boxShadow="0 2px 4px rgba(0,0,0,0.2)"
                    mt={4}
                    w="100%"
                    _hover={{ bg: "#1976d2" }}
                    _active={{ bg: "#1565c0" }}
                    onClick={() => {
                      setSelectedDate('')
                      setDayServices([])
                      setFormDateTime('')
                      setIsAddingServiceMode(true)
                      createDrawer.onOpen()
                    }}
                  >
                    Add New Schedule
                  </Button>
                )}
              </Box>
            </VStack>
          </GridItem>

          {/* Right Column (4/12) - Volunteer Link + Songs */}
          <GridItem colSpan={{ base: 12, md: 4 }}>
            <VStack spacing={6} align="stretch">
              {/* Volunteer Link Section */}
              <Box
                bg={{ base: useColorModeValue('white', 'gray.800'), md: cardBg }}
                borderRadius={{ base: '0', md: 'xl' }}
                p={{ base: 4, md: 6 }}
                boxShadow={{ base: 'lg', md: 'sm' }}
                w={{ base: '100%', md: '100%' }}
                position={{ base: 'fixed', md: 'static' }}
                bottom={{ base: 0, md: 'auto' }}
                left={{ base: 0, md: 'auto' }}
                right={{ base: 0, md: 'auto' }}
                zIndex={{ base: 1000, md: 'auto' }}
                borderTop={{ base: '1px', md: 'none' }}
                borderColor={{ base: 'gray.200', md: 'transparent' }}
              >
                <Heading
                  as="h3"
                  size="lg"
                  color={titleColor}
                  mb={4}
                  fontWeight="600"
                >
                  {t('dashboard.volunteerLink.title')}
                </Heading>
                
                <Text color={subtitleColor} fontSize="sm" mb={4} display={{ base: 'none', md: 'block' }}>
                  {t('dashboard.volunteerLink.description')}
                </Text>

                <VStack spacing={3} align="stretch">
                  <Button
                    bg="#2196f3"
                    color="white"
                    border="none"
                    borderRadius="999px"
                    px="24px"
                    py="12px"
                    fontSize="15px"
                    fontWeight="bold"
                    boxShadow="0 2px 4px rgba(0,0,0,0.2)"
                    _hover={{ bg: "#1976d2" }}
                    _active={{ bg: "#1565c0" }}
                    onClick={copyVolunteerLink}
                    isLoading={loadingVolunteerLink || copyingLink}
                    loadingText={loadingVolunteerLink ? t('dashboard.volunteerLink.loading') : t('dashboard.volunteerLink.copying')}
                    isDisabled={loadingVolunteerLink}
                    w="100%"
                  >
                    {loadingVolunteerLink 
                      ? t('dashboard.volunteerLink.loading')
                      : volunteerLink 
                        ? t('dashboard.volunteerLink.copyButton')
                        : t('dashboard.volunteerLink.createButton')
                    }
                  </Button>

                  {volunteerLink && (
                    <Button
                      bg="white"
                      color="black"
                      border="2px solid #000"
                      borderRadius="999px"
                      px="24px"
                      py="12px"
                      fontSize="15px"
                      fontWeight="bold"
                      boxShadow="0 2px 4px rgba(0,0,0,0.2)"
                      _hover={{ bg: "#f5f5f5" }}
                      _active={{ bg: "#e0e0e0" }}
                      onClick={() => navigate(`/volunteer/${volunteerLink}`)}
                      w="100%"
                    >
                      {t('dashboard.volunteerLink.visitButton')}
                    </Button>
                  )}
                </VStack>
              </Box>

              {/* Songs Section */}
              <Box
                bg={cardBg}
                borderRadius="xl"
                p={{ base: 5, md: 6 }}
                boxShadow="sm"
                w="100%"
                display={{ base: "none", md: "block" }}
              >
                <Heading
                    as="h3"
                    size="lg"
                    color={titleColor}
                    mb={5}
                    fontWeight="600"
                  >
                    {t('dashboard.songs.title')}
                  </Heading>

                  {recentSongsError && (
                  <Alert status="error" borderRadius="md" mb={4}>
                    <AlertIcon />
                    {recentSongsError}
                  </Alert>
                )}

                {loadingRecentSongs ? (
                  <Center py={6}>
                    <Spinner />
                  </Center>
                ) : recentSongs.length === 0 ? (
                  <Box textAlign="center" py={6}>
                    <Text color={mutedTextColor}>{t('dashboard.songs.noUsage')}</Text>
                  </Box>
                ) : (
                  <VStack spacing={3} align="stretch">
                    {recentSongs.map((song, idx) => (
              <HStack
                        key={song.songId}
                        p={3}
                border="1px"
                borderColor={cardBorderColor}
                borderRadius="lg"
                align="center"
                        justify="space-between"
                      >
                        <HStack>
                          <Box
                            w="28px"
                            h="28px"
                            borderRadius="full"
                            bg={getRankColor(idx)}
                            color="white"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                            fontWeight="700"
                            fontSize="sm"
                          >
                            {idx + 1}
                          </Box>

                          <Box>
                            <Text color={textColor} fontWeight="600" m={0}>
                              {song.title}
                            </Text>
                            <Text color={mutedTextColor} fontSize="sm" m={0}>
                              {song.artist}
                            </Text>
                          </Box>
                        </HStack>
                        <Box textAlign="right">
                          <Text color={textColor} fontSize="sm" m={0}>
                            {song.usageCount} uses
                          </Text>
                          <Text color={mutedTextColor} fontSize="xs" m={0}>
                            Last: {new Date(song.lastUsedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </Text>
                        </Box>
                      </HStack>
                    ))}
                  </VStack>
                )}

                {canManagePrimary && (
                  <Button
                    bg="#2196f3"
                    color="white"
                    border="none"
                    borderRadius="999px"
                    px="24px"
                    py="12px"
                    fontSize="15px"
                    fontWeight="bold"
                    boxShadow="0 2px 4px rgba(0,0,0,0.2)"
                    mt={5}
                    w="100%"
                    _hover={{ bg: "#1976d2" }}
                    _active={{ bg: "#1565c0" }}
                    onClick={addSongDrawer.onOpen}
                  >
                    Add New Song
                  </Button>
                )}

                <Button 
                  bg="white"
                  color="black"
                  border="2px solid #000"
                  borderRadius="999px"
                  px="24px"
                  py="12px"
                  fontSize="15px"
                  fontWeight="bold"
                  boxShadow="0 2px 4px rgba(0,0,0,0.2)"
                  mt={3} 
                  w="100%" 
                  _hover={{ bg: "#f5f5f5" }}
                  _active={{ bg: "#e0e0e0" }}
                  onClick={() => navigate('/songbank')}
                >
                  Go to Song Bank
                </Button>
              </Box>
            </VStack>
            </GridItem>
          </Grid>

          {/* Create Service Drawer */}
          <Drawer isOpen={createDrawer.isOpen} placement="right" onClose={createDrawer.onClose} size="lg">
            <DrawerOverlay />
            <DrawerContent sx={mobileTextSx}>
              <DrawerCloseButton display={{ base: 'none', md: 'inline-flex' }} />
              <DrawerHeader>
                <HStack justify="space-between" align="center">
                  <Text m={0} fontWeight="800" fontSize={{ base: 'xl', md: 'lg' }}>
                    {selectedDate && dayServices.length > 0
                      ? `${new Date(selectedDate).toLocaleDateString('en-US', {
                          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                        })}`
                      : 'Schedule New Service'}
                  </Text>
                  <IconButton
                    aria-label="Close drawer"
                    icon={<CloseIcon boxSize="4" />}
                    variant="solid"
                    colorScheme="gray"
                    size="md"
                    borderRadius="md"
                    display={{ base: 'inline-flex', md: 'none' }}
                    onClick={createDrawer.onClose}
                    h="auto"
                  />
                </HStack>
              </DrawerHeader>
              <DrawerBody>
                {selectedDate && !isAddingServiceMode && (
                  <Box mb={4}>
                    {loadingDayServices ? (
                      <HStack>
                        <Spinner size="sm" />
                        <Text>Loading services for this date...</Text>
                      </HStack>
                    ) : dayServices.length > 0 ? (
                      dayServices.length === 1 ? (
                        <Accordion
                          allowToggle
                          index={singleExpanded ? [0] : []}
                          borderTop="1px"
                          borderColor={cardBorderColor}
                        >
                          {dayServices.map((svc, idx) => (
                            <AccordionItem
                              key={svc.id}
                              border="none"
                              borderRadius="lg"
                              overflow="hidden"
                              mt={3}
                              mb={3}
                              bg={useColorModeValue('gray.50', 'gray.700')}
                              boxShadow="sm"
                              ref={idx === 0 ? firstServiceRef : undefined}
                            >
                              <h2>
                                <AccordionButton bg="transparent" borderBottom="1px" borderColor={cardBorderColor} px={4} py={3}>
                                  <Box as="span" flex='1' textAlign='left'>
                                    {(() => {
                                      const timePart = getServiceTimeDisplay(svc.service_time).toLowerCase().replace(' ', '')
                                      
                                      const formattedDate = selectedDate ? formatServiceDate(svc.service_time) : ''
                                      
                                      const volunteerInitials = (() => {
                                        const volunteers = serviceIdToVolunteers[svc.id] || []
                                        return volunteers.slice(0, 3).map(v => {
                                          const firstName = v.profiles?.first_name || ''
                                          const lastName = v.profiles?.last_name || ''
                                          return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
                                        }).join(' ')
                                      })()
                                      
                                      return (
                                        <HStack spacing={3} align="center" justify="space-between" w="100%">
                                          <HStack spacing={3} align="center">
                                            <Text fontSize="sm" fontWeight="500" color="gray.600">
                                              {formattedDate}
                                            </Text>
                                            <Badge bg="black" color="white" px={2} py={1} borderRadius="4px" fontSize="xs" fontWeight="600">
                                              {svc.title}
                                            </Badge>
                                            <Text fontSize="sm" fontWeight="500" color="gray.600">
                                              {timePart}
                                            </Text>
                                          </HStack>
                                          {volunteerInitials && (
                                            <Text fontSize="xs" fontWeight="500" color="gray.500">
                                              {volunteerInitials}
                                            </Text>
                                          )}
                                        </HStack>
                                      )
                                    })()}
                                  </Box>
                                  <AccordionIcon />
                                </AccordionButton>
                              </h2>
                              <AccordionPanel pb={5}>
                                <VStack align="stretch" spacing={4}>
                                  <Box>
                                    <VStack align="stretch" spacing={1}>
                                      {svc.description && (
                                        <Text color={mutedTextColor} whiteSpace="pre-wrap" fontSize="md">{svc.description}</Text>
                                      )}
                                    </VStack>
                                  </Box>

                                  <Box>
                                    <Text fontWeight="700" mb={2} fontSize="lg">Songs</Text>
                                    {(serviceIdToSongs[svc.id] || []).length === 0 ? (
                                      <Text color={mutedTextColor}>No songs added yet</Text>
                                    ) : (
                                      <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={(event) => handleReorderServiceSongs(svc.id, event)}
                                      >
                                        <SortableContext
                                          items={(serviceIdToSongs[svc.id] || []).map(row => row.id)}
                                          strategy={verticalListSortingStrategy}
                                        >
                                          <VStack spacing={2} align="stretch">
                                            {(serviceIdToSongs[svc.id] || []).map(songRow => (
                                              <SortableServiceSongItem
                                                key={songRow.id}
                                                serviceSong={songRow}
                                                canManage={canManagePrimary}
                                                onRemove={(id) => handleRemoveServiceSong(id, svc.id)}
                                              />
                                            ))}
                                          </VStack>
                                        </SortableContext>
                                      </DndContext>
                                    )}
                                    {canManagePrimary && (
                                      <Box mt={3}>
                                        {!showAddSongFormByService[svc.id] && (
                                          <Button
                                            bg="#2196f3"
                                            color="white"
                                            borderRadius="999px"
                                            px="24px"
                                            py="12px"
                                            w="100%"
                                            fontWeight="600"
                                            _hover={{ bg: "#1976d2" }}
                                            onClick={() => setShowAddSongFormByService(prev => ({ ...prev, [svc.id]: true }))}
                                            animation={`${addSongPulse} 2.5s ease-out infinite`}
                                          >
                                            Add song
                                          </Button>
                                        )}
                                        {showAddSongFormByService[svc.id] && (
                                          <VStack spacing={3} align="stretch">
                                            {serviceErrorByService[svc.id] && (
                                              <Alert status="error" borderRadius="md" mb={0}>
                                                <AlertIcon />
                                                {serviceErrorByService[svc.id]}
                                              </Alert>
                                            )}
                                            <Box>
                                              <Input
                                                type="text"
                                                placeholder="Type to search songs..."
                                                size="md"
                                                value={songSearchByService[svc.id] || ''}
                                                onChange={(e) => {
                                                  const value = e.target.value
                                                  setSongSearchByService(prev => ({ ...prev, [svc.id]: value }))
                                                  setShowSongSuggestionsByService(prev => ({ ...prev, [svc.id]: value.trim().length > 0 }))
                                                  setInlineCreateSongOpenByService(prev => ({ ...prev, [svc.id]: false }))
                                                  setSelectedSongByService(prev => ({ ...prev, [svc.id]: '' }))
                                                }}
                                              />
                                              {showSongSuggestionsByService[svc.id] && !inlineCreateSongOpenByService[svc.id] && (
                                                <Box mt={2} border="1px" borderColor={cardBorderColor} borderRadius="md" overflow="hidden">
                                                  {(() => {
                                                    const q = (songSearchByService[svc.id] || '').trim().toLowerCase()
                                                    const matches = q
                                                      ? availableSongs.filter(s => `${s.title} ${s.artist}`.toLowerCase().includes(q)).slice(0, 6)
                                                      : []
                                                    if (!matches.length) {
                                                      return (
                                                        <Button variant="ghost" w="100%" justifyContent="flex-start" onClick={() => setInlineCreateSongOpenByService(prev => ({ ...prev, [svc.id]: true }))}>
                                                          Add new song
                                                        </Button>
                                                      )
                                                    }
                                                    return (
                                                      <VStack align="stretch" spacing={0}>
                                                        {matches.map(s => (
                                                          <Button
                                                            key={s.id}
                                                            variant="ghost"
                                                            justifyContent="flex-start"
                                                            onClick={async () => {
                                                              setSelectedSongByService(prev => ({ ...prev, [svc.id]: s.id }))
                                                              setShowSongSuggestionsByService(prev => ({ ...prev, [svc.id]: false }))
                                                              await handleAddSongToService(svc.id, s.id)
                                                              setSongSearchByService(prev => ({ ...prev, [svc.id]: '' }))
                                                              setSelectedSongByService(prev => ({ ...prev, [svc.id]: '' }))
                                                              setSongNotesByService(prev => ({ ...prev, [svc.id]: '' }))
                                                              setShowAddSongFormByService(prev => ({ ...prev, [svc.id]: false }))
                                                            }}
                                                          >
                                                            {s.title} - {s.artist}
                                                          </Button>
                                                        ))}
                                                        <Button variant="ghost" justifyContent="flex-start" onClick={() => setInlineCreateSongOpenByService(prev => ({ ...prev, [svc.id]: true }))}>
                                                          Add new song
                                                        </Button>
                                                      </VStack>
                                                    )
                                                  })()}
                                                </Box>
                                              )}
                                            </Box>

                                            {inlineCreateSongOpenByService[svc.id] && (
                                              <VStack spacing={3} align="stretch">
                                                <Input
                                                  type="text"
                                                  placeholder="Artist"
                                                  size="md"
                                                  value={inlineCreateArtistByService[svc.id] || ''}
                                                  onChange={(e) => setInlineCreateArtistByService(prev => ({ ...prev, [svc.id]: e.target.value }))}
                                                />
                                                <Textarea
                                                  placeholder="Description"
                                                  size="md"
                                                  value={inlineCreateDescriptionByService[svc.id] || ''}
                                                  onChange={(e) => setInlineCreateDescriptionByService(prev => ({ ...prev, [svc.id]: e.target.value }))}
                                                />
                                                <HStack justify="flex-end">
                                                  <Button variant="outline" onClick={() => setInlineCreateSongOpenByService(prev => ({ ...prev, [svc.id]: false }))}>Cancel</Button>
                                                  <Button
                                                    colorScheme="blue"
                                                    isLoading={!!inlineCreatingSongByService[svc.id]}
                                                    onClick={async () => {
                                                      if (!organization) return
                                                      const title = (songSearchByService[svc.id] || '').trim()
                                                      const artist = (inlineCreateArtistByService[svc.id] || '').trim()
                                                      const description = (inlineCreateDescriptionByService[svc.id] || '').trim()
                                                      if (!title || !artist) {
                                                        setServiceErrorByService(prev => ({ ...prev, [svc.id]: 'Title and Artist are required.' }))
                                                        return
                                                      }
                                                      try {
                                                        setInlineCreatingSongByService(prev => ({ ...prev, [svc.id]: true }))
                                                        setServiceErrorByService(prev => ({ ...prev, [svc.id]: '' }))
                                                        const { data: created, error } = await supabase
                                                          .from('songs')
                                                          .insert({
                                                            organization_id: organization.organization_id,
                                                            title,
                                                            artist,
                                                            lyrics: description || null,
                                                            created_by: user?.id || null
                                                          })
                                                          .select()
                                                          .single()
                                                        if (error) {
                                                          setServiceErrorByService(prev => ({ ...prev, [svc.id]: 'Failed to create song. Please try again.' }))
                                                          return
                                                        }
                                                        setInlineCreateSongOpenByService(prev => ({ ...prev, [svc.id]: false }))
                                                        setInlineCreateArtistByService(prev => ({ ...prev, [svc.id]: '' }))
                                                        setInlineCreateDescriptionByService(prev => ({ ...prev, [svc.id]: '' }))
                                                        await loadAvailableSongs()
                                                        if (created) {
                                                          setSelectedSongByService(prev => ({ ...prev, [svc.id]: created.id }))
                                                          setSongSearchByService(prev => ({ ...prev, [svc.id]: `${created.title} - ${created.artist}` }))
                                                        }
                                                        setShowSongSuggestionsByService(prev => ({ ...prev, [svc.id]: false }))
                                                      } finally {
                                                        setInlineCreatingSongByService(prev => ({ ...prev, [svc.id]: false }))
                                                      }
                                                    }}
                                                  >
                                                    Create song
                                                  </Button>
                                                </HStack>
                                              </VStack>
                                            )}

                                            <Input
                                              type="text"
                                              placeholder="Notes (optional)"
                                              size="md"
                                              value={songNotesByService[svc.id] || ''}
                                              onChange={(e) => setSongNotesByService(prev => ({ ...prev, [svc.id]: e.target.value }))}
                                            />
                                          </VStack>
                                        )}
                                      </Box>
                                    )}
                                  </Box>

                                  <Box>
                                    <Text fontWeight="800" mb={3} mt={2} fontSize="lg">Musicians</Text>
                                    {(serviceIdToVolunteers[svc.id] || []).length === 0 ? (
                                      <Text color={mutedTextColor} mb={3}>No musicians yet</Text>
                                    ) : (
                                      <VStack spacing={3} align="stretch" mb={3}>
                                        {(serviceIdToVolunteers[svc.id] || []).map(volunteer => (
                                          <Box
                                            key={volunteer.id}
                                            bg="#f9f9f9"
                                            borderRadius="20px"
                                            p={4}
                                          >
                                            <VStack align="stretch" spacing={3}>
                                              <HStack spacing={3} align="center" justify="space-between">
                                                <HStack spacing={3} align="center" flex="1">
                                                  <Text fontWeight="600" fontSize="md" color="black" m={0}>
                                                    {volunteer.profiles.first_name} {volunteer.profiles.last_name}
                                                  </Text>
                                                  <HStack spacing={2} flexWrap="wrap">
                                                    {(volunteerToInstrumentIds[volunteer.id] || []).map(instId => {
                                                      const inst = instruments.find(i => i.id === instId)
                                                      if (!inst) return null
                                                      return (
                                                        <Box key={instId} as="span">
                                                          <Badge
                                                            bg="black"
                                                            color="white"
                                                            borderRadius="full"
                                                            px={3}
                                                            py={1}
                                                            fontSize="xs"
                                                            fontWeight="600"
                                                            display="inline-flex"
                                                            alignItems="center"
                                                            role="group"
                                                          >
                                                            {inst.name}
                                                            <Box
                                                              ml={2}
                                                              display="none"
                                                              alignItems="center"
                                                              justifyContent="center"
                                                              _groupHover={{ display: 'inline-flex' }}
                                                            >
                                                              <CloseButton
                                                                size="xs"
                                                                aria-label={`Unassign ${inst.name}`}
                                                                onClick={() => handleRemoveInstrument(volunteer.id, instId)}
                                                                variant="ghost"
                                                                color="whiteAlpha.800"
                                                                _hover={{ color: 'white' }}
                                                              />
                                                            </Box>
                                                          </Badge>
                                                        </Box>
                                                      )
                                                    }).filter(Boolean)}
                                                  </HStack>
                                                </HStack>
                                                
                                                {canManagePrimary && (
                                                  <Tooltip label="Remove volunteer from service">
                                                    <IconButton
                                                      aria-label="Remove volunteer from service"
                                                      icon={removingVolunteerById[volunteer.id] ? <Spinner size="xs" /> : <CloseIcon boxSize="3" />}
                                                      variant="ghost"
                                                      colorScheme="red"
                                                      size="sm"
                                                      borderRadius="full"
                                                      _hover={{ bg: "red.100" }}
                                                      onClick={() => handleRemoveVolunteer(volunteer.id, svc.id)}
                                                      isDisabled={!!removingVolunteerById[volunteer.id]}
                                                    />
                                                  </Tooltip>
                                                )}
                                              </HStack>
                                              <Select
                                                placeholder={loadingInstruments ? 'Loading instruments...' : 'Assign role'}
                                                size="md"
                                                bg="white"
                                                borderRadius="10px"
                                                border="1px solid #e0e0e0"
                                                value={selectedInstrumentByVolunteer[volunteer.id] || ''}
                                                onChange={async (e) => {
                                                  const val = e.target.value
                                                  setSelectedInstrumentByVolunteer(prev => ({ ...prev, [volunteer.id]: val }))
                                                  await handleAssignInstrument(volunteer.id, val)
                                                  setSelectedInstrumentByVolunteer(prev => ({ ...prev, [volunteer.id]: '' }))
                                                }}
                                                isDisabled={loadingInstruments || !!savingAssignmentByVolunteer[volunteer.id]}
                                              >
                                                {(() => {
                                                  const assigned = new Set<string>(Object.values(volunteerToInstrumentIds).flat())
                                                  return instruments
                                                    .filter(inst => !assigned.has(inst.id))
                                                    .map(inst => (
                                                      <option key={inst.id} value={inst.id}>{inst.name}</option>
                                                    ))
                                                })()}
                                              </Select>
                                            </VStack>
                                          </Box>
                                        ))}
                                      </VStack>
                                    )}
                                    
                                    {canManagePrimary && (
                                      <Box mt={3} mb={3}>
                                        {!showAddVolunteerByService[svc.id] && (
                                          <Button
                                            bg="white"
                                            color="black"
                                            border="2px solid #000"
                                            borderRadius="999px"
                                            px="24px"
                                            py="12px"
                                            w="100%"
                                            fontWeight="600"
                                            _hover={{ bg: "gray.50" }}
                                            onClick={() => setShowAddVolunteerByService(prev => ({ ...prev, [svc.id]: true }))}
                                            animation={`${addSongPulse} 2.5s ease-out infinite`}
                                          >
                                            Add volunteer
                                          </Button>
                                        )}
                                        {showAddVolunteerByService[svc.id] && (
                                          <VStack spacing={3} align="stretch">
                                            <Box>
                                              <Input
                                                type="text"
                                                placeholder="Type to search users..."
                                                size="md"
                                                value={volunteerSearchByService[svc.id] || ''}
                                                onChange={(e) => {
                                                  const value = e.target.value
                                                  setVolunteerSearchByService(prev => ({ ...prev, [svc.id]: value }))
                                                  setVolunteerSuggestionsVisible(prev => ({ ...prev, [svc.id]: value.trim().length > 0 }))
                                                }}
                                              />
                                              {volunteerSuggestionsVisible[svc.id] && (
                                                <Box mt={2} border="1px" borderColor={cardBorderColor} borderRadius="md" overflow="hidden">
                                                  {(() => {
                                                    const searchQuery = (volunteerSearchByService[svc.id] || '').trim().toLowerCase()
                                                    const currentVolunteerUserIds = new Set((serviceIdToVolunteers[svc.id] || []).map(v => v.user_id))
                                                    const filteredUsers = availableUsers
                                                      .filter(user => !currentVolunteerUserIds.has(user.id))
                                                      .filter(user => {
                                                        if (!searchQuery) return true
                                                        const fullName = `${user.first_name} ${user.last_name}`.toLowerCase()
                                                        const email = user.email.toLowerCase()
                                                        return fullName.includes(searchQuery) || email.includes(searchQuery)
                                                      })
                                                      .slice(0, 6)
                                                    
                                                    if (loadingUsers) {
                                                      return (
                                                        <Button variant="ghost" w="100%" justifyContent="center" isLoading>
                                                          Loading users...
                                                        </Button>
                                                      )
                                                    }
                                                    
                                                    if (!filteredUsers.length) {
                                                      return (
                                                        <Button variant="ghost" w="100%" justifyContent="flex-start" isDisabled>
                                                          No available users found
                                                        </Button>
                                                      )
                                                    }
                                                    
                                                    return (
                                                      <VStack align="stretch" spacing={0}>
                                                        {filteredUsers.map(user => (
                                                          <Button
                                                            key={user.id}
                                                            variant="ghost"
                                                            justifyContent="flex-start"
                                                            onClick={async () => {
                                                              await handleAddVolunteer(svc.id, user.id)
                                                              setVolunteerSearchByService(prev => ({ ...prev, [svc.id]: '' }))
                                                              setVolunteerSuggestionsVisible(prev => ({ ...prev, [svc.id]: false }))
                                                              setShowAddVolunteerByService(prev => ({ ...prev, [svc.id]: false }))
                                                            }}
                                                            isLoading={addingVolunteerByService[svc.id]}
                                                            isDisabled={addingVolunteerByService[svc.id]}
                                                          >
                                                            {user.first_name} {user.last_name} ({user.email})
                                                          </Button>
                                                        ))}
                                                      </VStack>
                                                    )
                                                  })()}
                                                </Box>
                                              )}
                                            </Box>
                                          </VStack>
                                        )}
                                      </Box>
                                    )}
                                    
                                    <Button mt={6} size="md" w="100%" colorScheme="gray" onClick={() => navigate(`/service/${svc.id}`)}>
                                      Open Full Page
                                    </Button>
                                  </Box>

                                  {/* Moved Add Song into Songs section above */}
                                </VStack>
                              </AccordionPanel>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      ) : (
                        <Accordion
                          allowMultiple
                          index={accordionIndex}
                          onChange={(idx) => {
                            if (Array.isArray(idx)) setAccordionIndex(idx as number[])
                          }}
                          borderTop="1px"
                          borderColor={cardBorderColor}
                        >
                          {dayServices.map((svc, idx) => (
                            <AccordionItem
                              key={svc.id}
                              border="none"
                              borderRadius="lg"
                              overflow="hidden"
                              mt={3}
                              mb={3}
                              bg={useColorModeValue('gray.50', 'gray.700')}
                              boxShadow="sm"
                              ref={idx === 0 ? firstServiceRef : undefined}
                            >
                              <h2>
                                <AccordionButton bg="transparent" borderBottom="1px" borderColor={cardBorderColor} px={4} py={3}>
                                  <Box as="span" flex='1' textAlign='left'>
                                    {(() => {
                                      const timePart = getServiceTimeDisplay(svc.service_time).toLowerCase().replace(' ', '')
                                      
                                      const formattedDate = selectedDate ? formatServiceDate(svc.service_time) : ''
                                      
                                      const volunteerInitials = (() => {
                                        const volunteers = serviceIdToVolunteers[svc.id] || []
                                        return volunteers.slice(0, 3).map(v => {
                                          const firstName = v.profiles?.first_name || ''
                                          const lastName = v.profiles?.last_name || ''
                                          return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
                                        }).join(' ')
                                      })()
                                      
                                      return (
                                        <HStack spacing={3} align="center" justify="space-between" w="100%">
                                          <HStack spacing={3} align="center">
                                            <Text fontSize="sm" fontWeight="500" color="gray.600">
                                              {formattedDate}
                                            </Text>
                                            <Badge bg="black" color="white" px={2} py={1} borderRadius="4px" fontSize="xs" fontWeight="600">
                                              {svc.title}
                                            </Badge>
                                            <Text fontSize="sm" fontWeight="500" color="gray.600">
                                              {timePart}
                                            </Text>
                                          </HStack>
                                          {volunteerInitials && (
                                            <Text fontSize="xs" fontWeight="500" color="gray.500">
                                              {volunteerInitials}
                                            </Text>
                                          )}
                                        </HStack>
                                      )
                                    })()}
                                  </Box>
                                  <AccordionIcon />
                                </AccordionButton>
                              </h2>
                              <AccordionPanel pb={5}>
                                <VStack align="stretch" spacing={4}>
                                  <Box>
                                    <VStack align="stretch" spacing={1}>
                                      {svc.description && (
                                        <Text color={mutedTextColor} whiteSpace="pre-wrap" fontSize="md">{svc.description}</Text>
                                      )}
                                    </VStack>
                                  </Box>

                                  <Box>
                                    <Text fontWeight="800" mb={2} fontSize="lg">Songs</Text>
                                    {(serviceIdToSongs[svc.id] || []).length === 0 ? (
                                      <Text color={mutedTextColor}>No songs added yet</Text>
                                    ) : (
                                      <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={(event) => handleReorderServiceSongs(svc.id, event)}
                                      >
                                        <SortableContext
                                          items={(serviceIdToSongs[svc.id] || []).map(row => row.id)}
                                          strategy={verticalListSortingStrategy}
                                        >
                                          <VStack spacing={2} align="stretch">
                                            {(serviceIdToSongs[svc.id] || []).map(songRow => (
                                              <SortableServiceSongItem
                                                key={songRow.id}
                                                serviceSong={songRow}
                                                canManage={canManagePrimary}
                                                onRemove={(id) => handleRemoveServiceSong(id, svc.id)}
                                              />
                                            ))}
                                          </VStack>
                                        </SortableContext>
                                      </DndContext>
                                    )}

                                    {canManagePrimary && (
                                      <Box mt={3}>
                                        {!showAddSongFormByService[svc.id] && (
                                          <Button
                                            bg="#2196f3"
                                            color="white"
                                            borderRadius="999px"
                                            px="24px"
                                            py="12px"
                                            w="100%"
                                            fontWeight="600"
                                            _hover={{ bg: "#1976d2" }}
                                            onClick={() => setShowAddSongFormByService(prev => ({ ...prev, [svc.id]: true }))}
                                            animation={`${addSongPulse} 2.5s ease-out infinite`}
                                          >
                                            Add song
                                          </Button>
                                        )}
                                        {showAddSongFormByService[svc.id] && (
                                          <VStack spacing={3} align="stretch">
                                            {serviceErrorByService[svc.id] && (
                                              <Alert status="error" borderRadius="md" mb={0}>
                                                <AlertIcon />
                                                {serviceErrorByService[svc.id]}
                                              </Alert>
                                            )}
                                            <Box>
                                              <Input
                                                type="text"
                                                placeholder="Type to search songs..."
                                                size="md"
                                                value={songSearchByService[svc.id] || ''}
                                                onChange={(e) => {
                                                  const value = e.target.value
                                                  setSongSearchByService(prev => ({ ...prev, [svc.id]: value }))
                                                  setShowSongSuggestionsByService(prev => ({ ...prev, [svc.id]: value.trim().length > 0 }))
                                                  setInlineCreateSongOpenByService(prev => ({ ...prev, [svc.id]: false }))
                                                  setSelectedSongByService(prev => ({ ...prev, [svc.id]: '' }))
                                                }}
                                              />
                                              {showSongSuggestionsByService[svc.id] && !inlineCreateSongOpenByService[svc.id] && (
                                                <Box mt={2} border="1px" borderColor={cardBorderColor} borderRadius="md" overflow="hidden">
                                                  {(() => {
                                                    const q = (songSearchByService[svc.id] || '').trim().toLowerCase()
                                                    const matches = q
                                                      ? availableSongs.filter(s => `${s.title} ${s.artist}`.toLowerCase().includes(q)).slice(0, 6)
                                                      : []
                                                    if (!matches.length) {
                                                      return (
                                                        <Button variant="ghost" w="100%" justifyContent="flex-start" onClick={() => setInlineCreateSongOpenByService(prev => ({ ...prev, [svc.id]: true }))}>
                                                          Add new song
                                                        </Button>
                                                      )
                                                    }
                                                    return (
                                                      <VStack align="stretch" spacing={0}>
                                                        {matches.map(s => (
                                                          <Button
                                                            key={s.id}
                                                            variant="ghost"
                                                            justifyContent="flex-start"
                                                            onClick={async () => {
                                                              setSelectedSongByService(prev => ({ ...prev, [svc.id]: s.id }))
                                                              setShowSongSuggestionsByService(prev => ({ ...prev, [svc.id]: false }))
                                                              await handleAddSongToService(svc.id, s.id)
                                                              setSongSearchByService(prev => ({ ...prev, [svc.id]: '' }))
                                                              setSelectedSongByService(prev => ({ ...prev, [svc.id]: '' }))
                                                              setSongNotesByService(prev => ({ ...prev, [svc.id]: '' }))
                                                              setShowAddSongFormByService(prev => ({ ...prev, [svc.id]: false }))
                                                            }}
                                                          >
                                                            {s.title} - {s.artist}
                                                          </Button>
                                                        ))}
                                                        <Button variant="ghost" justifyContent="flex-start" onClick={() => setInlineCreateSongOpenByService(prev => ({ ...prev, [svc.id]: true }))}>
                                                          Add new song
                                                        </Button>
                                                      </VStack>
                                                    )
                                                  })()}
                                                </Box>
                                              )}
                                            </Box>

                                            {inlineCreateSongOpenByService[svc.id] && (
                                              <VStack spacing={3} align="stretch">
                                                <Input
                                                  type="text"
                                                  placeholder="Artist"
                                                  size="md"
                                                  value={inlineCreateArtistByService[svc.id] || ''}
                                                  onChange={(e) => setInlineCreateArtistByService(prev => ({ ...prev, [svc.id]: e.target.value }))}
                                                />
                                                <Textarea
                                                  placeholder="Description"
                                                  size="md"
                                                  value={inlineCreateDescriptionByService[svc.id] || ''}
                                                  onChange={(e) => setInlineCreateDescriptionByService(prev => ({ ...prev, [svc.id]: e.target.value }))}
                                                />
                                                <HStack justify="flex-end">
                                                  <Button variant="outline" onClick={() => setInlineCreateSongOpenByService(prev => ({ ...prev, [svc.id]: false }))}>Cancel</Button>
                                                  <Button
                                                    colorScheme="blue"
                                                    isLoading={!!inlineCreatingSongByService[svc.id]}
                                                    onClick={async () => {
                                                      if (!organization) return
                                                      const title = (songSearchByService[svc.id] || '').trim()
                                                      const artist = (inlineCreateArtistByService[svc.id] || '').trim()
                                                      const description = (inlineCreateDescriptionByService[svc.id] || '').trim()
                                                      if (!title || !artist) {
                                                        setServiceErrorByService(prev => ({ ...prev, [svc.id]: 'Title and Artist are required.' }))
                                                        return
                                                      }
                                                      try {
                                                        setInlineCreatingSongByService(prev => ({ ...prev, [svc.id]: true }))
                                                        setServiceErrorByService(prev => ({ ...prev, [svc.id]: '' }))
                                                        const { data: created, error } = await supabase
                                                          .from('songs')
                                                          .insert({
                                                            organization_id: organization.organization_id,
                                                            title,
                                                            artist,
                                                            lyrics: description || null,
                                                            created_by: user?.id || null
                                                          })
                                                          .select()
                                                          .single()
                                                        if (error) {
                                                          setServiceErrorByService(prev => ({ ...prev, [svc.id]: 'Failed to create song. Please try again.' }))
                                                          return
                                                        }
                                                        setInlineCreateSongOpenByService(prev => ({ ...prev, [svc.id]: false }))
                                                        setInlineCreateArtistByService(prev => ({ ...prev, [svc.id]: '' }))
                                                        setInlineCreateDescriptionByService(prev => ({ ...prev, [svc.id]: '' }))
                                                        await loadAvailableSongs()
                                                        if (created) {
                                                          setSelectedSongByService(prev => ({ ...prev, [svc.id]: created.id }))
                                                          setSongSearchByService(prev => ({ ...prev, [svc.id]: `${created.title} - ${created.artist}` }))
                                                        }
                                                        setShowSongSuggestionsByService(prev => ({ ...prev, [svc.id]: false }))
                                                      } finally {
                                                        setInlineCreatingSongByService(prev => ({ ...prev, [svc.id]: false }))
                                                      }
                                                    }}
                                                  >
                                                    Create song
                                                  </Button>
                                                </HStack>
                                              </VStack>
                                            )}

                                            <Input
                                              type="text"
                                              placeholder="Notes (optional)"
                                              size="md"
                                              value={songNotesByService[svc.id] || ''}
                                              onChange={(e) => setSongNotesByService(prev => ({ ...prev, [svc.id]: e.target.value }))}
                                            />
                                          </VStack>
                                        )}
                                      </Box>
                                    )}
                                  </Box>

                                  <Box>
                                    <Text fontWeight="800" mb={2} fontSize="lg">Volunteers</Text>
                                    {(serviceIdToVolunteers[svc.id] || []).length === 0 ? (
                                      <Text color={mutedTextColor} mb={3}>No volunteers yet</Text>
                                    ) : (
                                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3} alignItems="stretch" mb={3}>
                                        {(serviceIdToVolunteers[svc.id] || []).map(volunteer => (
                                          <Box
                                            key={volunteer.id}
                                            border="1px"
                                            borderColor={cardBorderColor}
                                            borderRadius="lg"
                                            p={3}
                                            h="100%"
                                          >
                                            <VStack align="stretch" spacing={1} h="100%">
                                              <HStack spacing={2} align="center" justify="space-between">
                                                <HStack spacing={2} align="center" flex="1">
                                                  <Text fontWeight="600" fontSize="sm" m={0}>
                                                    {volunteer.profiles.first_name} {volunteer.profiles.last_name}
                                                  </Text>
                                                  <HStack spacing={1} flexWrap="wrap">
                                                    {(volunteerToInstrumentIds[volunteer.id] || []).map(instId => {
                                                      const inst = instruments.find(i => i.id === instId)
                                                      if (!inst) return null
                                                      return (
                                                        <Box key={instId} as="span">
                                                          <Badge
                                                            colorScheme="blue"
                                                            variant="solid"
                                                            borderRadius="md"
                                                            fontSize="0.7rem"
                                                            display="inline-flex"
                                                            alignItems="center"
                                                            pl={2}
                                                            pr={2}
                                                            py={0.5}
                                                            gap={0}
                                                            role="group"
                                                          >
                                                            {inst.name}
                                                            <Box
                                                              h="14px"
                                                              ml={0}
                                                              display="none"
                                                              alignItems="center"
                                                              justifyContent="center"
                                                              _groupHover={{ display: 'inline-flex', ml: 1 }}
                                                            >
                                                              <CloseButton
                                                                size="xs"
                                                                aria-label={`Unassign ${inst.name}`}
                                                                onClick={() => handleRemoveInstrument(volunteer.id, instId)}
                                                                variant="ghost"
                                                                color="whiteAlpha.800"
                                                                _hover={{ color: 'white' }}
                                                              />
                                                            </Box>
                                                          </Badge>
                                                        </Box>
                                                      )
                                                    }).filter(Boolean)}
                                                  </HStack>
                                                </HStack>
                                                
                                                {canManagePrimary && (
                                                  <Tooltip label="Remove volunteer from service">
                                                    <IconButton
                                                      aria-label="Remove volunteer from service"
                                                      icon={removingVolunteerById[volunteer.id] ? <Spinner size="xs" /> : <CloseIcon boxSize="3" />}
                                                      variant="ghost"
                                                      colorScheme="red"
                                                      size="sm"
                                                      opacity={0.6}
                                                      _hover={{ opacity: 1, bg: useColorModeValue('red.100', 'red.800') }}
                                                      onClick={() => handleRemoveVolunteer(volunteer.id, svc.id)}
                                                      isDisabled={!!removingVolunteerById[volunteer.id]}
                                                    />
                                                  </Tooltip>
                                                )}
                                              </HStack>
                                              <HStack spacing={2} align="center" mt={2}>
                                                <Select
                                                  placeholder={loadingInstruments ? 'Loading instruments...' : 'Assign instrument'}
                                                  size="sm"
                                                  value={selectedInstrumentByVolunteer[volunteer.id] || ''}
                                                  onChange={async (e) => {
                                                    const val = e.target.value
                                                    setSelectedInstrumentByVolunteer(prev => ({ ...prev, [volunteer.id]: val }))
                                                    await handleAssignInstrument(volunteer.id, val)
                                                    setSelectedInstrumentByVolunteer(prev => ({ ...prev, [volunteer.id]: '' }))
                                                  }}
                                                  isDisabled={loadingInstruments || !!savingAssignmentByVolunteer[volunteer.id]}
                                                  maxW={{ base: '100%', md: '320px' }}
                                                >
                                                  {instruments
                                                    .filter(inst => !(volunteerToInstrumentIds[volunteer.id] || []).includes(inst.id))
                                                    .map(inst => (
                                                      <option key={inst.id} value={inst.id}>{inst.name}</option>
                                                    ))}
                                                </Select>
                                              </HStack>
                                            </VStack>
                                          </Box>
                                        ))}
                                      </SimpleGrid>
                                    )}
                                    
                                    {canManagePrimary && (
                                      <Box mt={3} mb={3}>
                                        {!showAddVolunteerByService[svc.id] && (
                                          <Button
                                            bg="white"
                                            color="black"
                                            border="2px solid #000"
                                            borderRadius="999px"
                                            px="24px"
                                            py="12px"
                                            w="100%"
                                            fontWeight="600"
                                            _hover={{ bg: "gray.50" }}
                                            onClick={() => setShowAddVolunteerByService(prev => ({ ...prev, [svc.id]: true }))}
                                            animation={`${addSongPulse} 2.5s ease-out infinite`}
                                          >
                                            Add volunteer
                                          </Button>
                                        )}
                                        {showAddVolunteerByService[svc.id] && (
                                          <VStack spacing={3} align="stretch">
                                            <Box>
                                              <Input
                                                type="text"
                                                placeholder="Type to search users..."
                                                size="md"
                                                value={volunteerSearchByService[svc.id] || ''}
                                                onChange={(e) => {
                                                  const value = e.target.value
                                                  setVolunteerSearchByService(prev => ({ ...prev, [svc.id]: value }))
                                                  setVolunteerSuggestionsVisible(prev => ({ ...prev, [svc.id]: value.trim().length > 0 }))
                                                }}
                                              />
                                              {volunteerSuggestionsVisible[svc.id] && (
                                                <Box mt={2} border="1px" borderColor={cardBorderColor} borderRadius="md" overflow="hidden">
                                                  {(() => {
                                                    const searchQuery = (volunteerSearchByService[svc.id] || '').trim().toLowerCase()
                                                    const currentVolunteerUserIds = new Set((serviceIdToVolunteers[svc.id] || []).map(v => v.user_id))
                                                    const filteredUsers = availableUsers
                                                      .filter(user => !currentVolunteerUserIds.has(user.id))
                                                      .filter(user => {
                                                        if (!searchQuery) return true
                                                        const fullName = `${user.first_name} ${user.last_name}`.toLowerCase()
                                                        const email = user.email.toLowerCase()
                                                        return fullName.includes(searchQuery) || email.includes(searchQuery)
                                                      })
                                                      .slice(0, 6)
                                                    
                                                    if (loadingUsers) {
                                                      return (
                                                        <Button variant="ghost" w="100%" justifyContent="center" isLoading>
                                                          Loading users...
                                                        </Button>
                                                      )
                                                    }
                                                    
                                                    if (!filteredUsers.length) {
                                                      return (
                                                        <Button variant="ghost" w="100%" justifyContent="flex-start" isDisabled>
                                                          No available users found
                                                        </Button>
                                                      )
                                                    }
                                                    
                                                    return (
                                                      <VStack align="stretch" spacing={0}>
                                                        {filteredUsers.map(user => (
                                                          <Button
                                                            key={user.id}
                                                            variant="ghost"
                                                            justifyContent="flex-start"
                                                            onClick={async () => {
                                                              await handleAddVolunteer(svc.id, user.id)
                                                              setVolunteerSearchByService(prev => ({ ...prev, [svc.id]: '' }))
                                                              setVolunteerSuggestionsVisible(prev => ({ ...prev, [svc.id]: false }))
                                                              setShowAddVolunteerByService(prev => ({ ...prev, [svc.id]: false }))
                                                            }}
                                                            isLoading={addingVolunteerByService[svc.id]}
                                                            isDisabled={addingVolunteerByService[svc.id]}
                                                          >
                                                            {user.first_name} {user.last_name} ({user.email})
                                                          </Button>
                                                        ))}
                                                      </VStack>
                                                    )
                                                  })()}
                                                </Box>
                                              )}
                                            </Box>
                                          </VStack>
                                        )}
                                      </Box>
                                    )}
                                    
                                    <Button mt={6} size="md" w="100%" colorScheme="gray" onClick={() => navigate(`/service/${svc.id}`)}>
                                      Open Full Page
                                    </Button>
                                  </Box>

                                  {/* Moved Add Song into Songs section above */}
                                </VStack>
                              </AccordionPanel>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      )
                    ) : (
                      <Text color={mutedTextColor}>No services scheduled for this date.</Text>
                    )}
                  </Box>
                )}

                {formError && (
                  <Alert status="error" borderRadius="md" mb={4}>
                    <AlertIcon />
                    {formError}
                  </Alert>
                )}
                {(isAddingServiceMode || !selectedDate || dayServices.length === 0) && (
                  <form onSubmit={handleCreateServiceSubmit}>
                    <VStack spacing={5} align="stretch">
                      <FormControl isRequired>
                        <FormLabel fontSize="sm">Service Title *</FormLabel>
                        <Input
                          type="text"
                          value={formTitle}
                          onChange={(e) => setFormTitle(e.target.value)}
                          placeholder="e.g., Sunday Morning Service"
                          size="md"
                        />
                      </FormControl>

                      <FormControl isRequired>
                        <FormLabel fontSize="sm">Service Date & Time *</FormLabel>
                        <Input
                          type="datetime-local"
                          value={formDateTime}
                          onChange={(e) => setFormDateTime(e.target.value)}
                          size="md"
                        />
                      </FormControl>

                      <FormControl>
                        <FormLabel fontSize="sm">Description</FormLabel>
                        <Textarea
                          value={formDescription}
                          onChange={(e) => setFormDescription(e.target.value)}
                          placeholder="Optional description or notes..."
                          rows={4}
                          resize="vertical"
                          minH="80px"
                        />
                      </FormControl>
                    </VStack>
                  </form>
                )}
              </DrawerBody>
              {(isAddingServiceMode || !selectedDate || dayServices.length === 0) ? (
                <DrawerFooter>
                  <HStack w="100%" justify="flex-end">
                    <Button variant="outline" colorScheme="gray" onClick={createDrawer.onClose}>
                      Cancel
                    </Button>
                    <Button
                      colorScheme="blue"
                      onClick={handleCreateServiceSubmit}
                      isLoading={creating}
                      loadingText="Scheduling..."
                    >
                      Schedule Service
                    </Button>
                  </HStack>
                </DrawerFooter>
              ) : (
                <DrawerFooter>
                  <HStack w="100%" justify="space-between">
                    {canManagePrimary && (
                      <Button display={{ base: 'none', md: 'inline-flex' }} variant="outline" onClick={() => setIsAddingServiceMode(true)}>
                        Add Service
                      </Button>
                    )}
                    <Button display={{ base: 'none', md: 'inline-flex' }} colorScheme="blue" onClick={createDrawer.onClose}>
                      Close
                    </Button>
                  </HStack>
                </DrawerFooter>
              )}
            </DrawerContent>
          </Drawer>

          {/* Add Song Drawer */}
          <Drawer isOpen={addSongDrawer.isOpen} placement="right" onClose={addSongDrawer.onClose} size="lg">
            <DrawerOverlay />
            <DrawerContent sx={mobileTextSx}>
              <DrawerCloseButton />
              <DrawerHeader>
                <HStack justify="space-between" align="center">
                  <Text m={0} fontWeight="800" fontSize={{ base: 'xl', md: 'lg' }}>Add New Song</Text>
                  <IconButton
                    aria-label="Close drawer"
                    icon={<CloseIcon boxSize="4" />}
                    variant="solid"
                    colorScheme="gray"
                    size="md"
                    borderRadius="md"
                    display={{ base: 'inline-flex', md: 'none' }}
                    onClick={addSongDrawer.onClose}
                    h="auto"
                  />
                </HStack>
              </DrawerHeader>
              <DrawerBody>
                {songError && (
                  <Alert status="error" borderRadius="md" mb={4}>
                    <AlertIcon />
                    {songError}
                  </Alert>
                )}
                <VStack spacing={5} align="stretch">
                  <FormControl isRequired>
                    <FormLabel fontSize="sm">Title *</FormLabel>
                    <Input value={songTitle} onChange={(e) => setSongTitle(e.target.value)} placeholder="Song title" size="md" />
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel fontSize="sm">Artist *</FormLabel>
                    <Input value={songArtist} onChange={(e) => setSongArtist(e.target.value)} placeholder="Artist name" size="md" />
                  </FormControl>

                  <FormControl>
                    <FormLabel fontSize="sm">YouTube URL</FormLabel>
                    <Input type="url" value={songYouTubeUrl} onChange={(e) => setSongYouTubeUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." size="md" />
                  </FormControl>

                  <FormControl>
                    <FormLabel fontSize="sm">Spotify URL</FormLabel>
                    <Input type="url" value={songSpotifyUrl} onChange={(e) => setSongSpotifyUrl(e.target.value)} placeholder="https://open.spotify.com/track/..." size="md" />
                  </FormControl>

                  <HStack spacing={4} align="stretch">
                    <FormControl>
                      <FormLabel fontSize="sm">Key</FormLabel>
                      <Input value={songKey} onChange={(e) => setSongKey(e.target.value)} placeholder="C, G, D, etc." size="md" />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">BPM</FormLabel>
                      <Input type="number" value={songBpm} onChange={(e) => setSongBpm(e.target.value)} placeholder="120" size="md" />
                    </FormControl>
                  </HStack>

                  <FormControl>
                    <FormLabel fontSize="sm">CCLI Number</FormLabel>
                    <Input value={songCcli} onChange={(e) => setSongCcli(e.target.value)} placeholder="CCLI-123456" size="md" />
                  </FormControl>

                  <FormControl>
                    <FormLabel fontSize="sm">Tags</FormLabel>
                    <Input value={songTags} onChange={(e) => setSongTags(e.target.value)} placeholder="worship, contemporary, gospel (comma separated)" size="md" />
                  </FormControl>

                  <FormControl>
                    <FormLabel fontSize="sm">Lyrics</FormLabel>
                    <Textarea value={songLyrics} onChange={(e) => setSongLyrics(e.target.value)} placeholder="Enter song lyrics..." size="md" rows={4} />
                  </FormControl>
                </VStack>
              </DrawerBody>
              <DrawerFooter>
                <HStack w="100%" justify="flex-end">
                  <Button variant="outline" colorScheme="gray" onClick={addSongDrawer.onClose}>
                    Cancel
                  </Button>
                  <Button colorScheme="blue" onClick={async () => {
                    if (!organization) { setSongError('Organization not found.'); return }
                    if (!canManagePrimary) { setSongError('You do not have permission to create songs. Only admins and owners can create songs.'); return }
                    if (!songTitle.trim() || !songArtist.trim()) { setSongError('Title and Artist are required.'); return }
                    try {
                      setIsAddingSong(true)
                      setSongError('')
                      const tagsArray = songTags
                        .split(',')
                        .map(tag => tag.trim())
                        .filter(tag => tag.length > 0)
                      const { error } = await supabase
                        .from('songs')
                        .insert({
                          organization_id: organization.organization_id,
                          title: songTitle.trim(),
                          artist: songArtist.trim(),
                          youtube_url: songYouTubeUrl || null,
                          spotify_url: songSpotifyUrl || null,
                          key: songKey || null,
                          bpm: songBpm ? parseInt(songBpm) : null,
                          ccli_number: songCcli || null,
                          tags: tagsArray,
                          lyrics: songLyrics || null,
                          created_by: user?.id || null
                        })
                      if (error) { setSongError('Failed to add song. Please try again.'); return }
                      setSongTitle('')
                      setSongArtist('')
                      setSongYouTubeUrl('')
                      setSongSpotifyUrl('')
                      setSongKey('')
                      setSongBpm('')
                      setSongCcli('')
                      setSongTags('')
                      setSongLyrics('')
                      addSongDrawer.onClose()
                      await loadRecentSongs()
                    } catch (err) {
                      setSongError('Failed to add song. Please try again later.')
                    } finally {
                      setIsAddingSong(false)
                    }
                  }} isLoading={isAddingSong} loadingText="Adding...">
                    Add Song
                  </Button>
                </HStack>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </VStack>
      </Box>
    </Box>
  )
} 

interface CalendarProps {
  year: number
  month: number // 0-11
  scheduledDates: string[]
  userVolunteerDates: string[]
  onDateClick?: (isoDate: string) => void
}

function CalendarGrid({ year, month, scheduledDates, userVolunteerDates, onDateClick }: CalendarProps) {
  const { t } = useTranslation()

  const firstOfMonth = new Date(year, month, 1)
  const startWeekday = firstOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const headerColor = useColorModeValue('gray.600', 'gray.300')
  const cellTextColor = useColorModeValue('gray.700', 'gray.200')
  const cellBorderColor = useColorModeValue('gray.200', 'gray.600')
  const eventBg = useColorModeValue('blue.50', 'rgba(66, 153, 225, 0.16)')

  const dayNames = [
    t('dashboard.calendar.weekdays.sun'),
    t('dashboard.calendar.weekdays.mon'),
    t('dashboard.calendar.weekdays.tue'),
    t('dashboard.calendar.weekdays.wed'),
    t('dashboard.calendar.weekdays.thu'),
    t('dashboard.calendar.weekdays.fri'),
    t('dashboard.calendar.weekdays.sat')
  ]

  const prefixEmptyCells: (number | null)[] = Array.from({ length: startWeekday }, () => null)
  const monthDays: (number | null)[] = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const cells: (number | null)[] = [...prefixEmptyCells, ...monthDays]

  const scheduledSet = new Set(scheduledDates)
  const volunteerSet = new Set(userVolunteerDates)

  function toISO(y: number, mZeroIndexed: number, d: number) {
    const mm = String(mZeroIndexed + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    return `${y}-${mm}-${dd}`
  }

  const pulse = keyframes`
    0% { transform: scale(0.8); opacity: 0.9 }
    50% { transform: scale(1.6); opacity: 0.4 }
    100% { transform: scale(0.8); opacity: 0.9 }
  `

  const ringPulse = keyframes`
    0% { box-shadow: 0 0 0 0 rgba(66, 153, 225, 0.6) }
    70% { box-shadow: 0 0 0 10px rgba(66, 153, 225, 0) }
    100% { box-shadow: 0 0 0 0 rgba(66, 153, 225, 0) }
  `

  return (
    <VStack align="stretch" spacing={3}>
      <SimpleGrid columns={7} spacing={1}>
        {dayNames.map(name => (
          <Box key={name} textAlign="center" fontWeight="600" color={headerColor} py={2}>
            {name}
          </Box>
        ))}
      </SimpleGrid>

      <SimpleGrid columns={7} spacing={1}>
        {cells.map((day, idx) => {
          if (day === null) return <Box key={`empty-${idx}`} h="70px" />

          const iso = toISO(year, month, day)
          const hasEvent = scheduledSet.has(iso)
          const hasVolunteered = volunteerSet.has(iso)
          
          // Check if this date is today
          const today = new Date()
          const isToday = iso === today.toISOString().split('T')[0]
          
          // Check if this date is in the past
          const cellDate = new Date(year, month, day)
          const isPast = cellDate < today && !isToday

          return (
            <Box
              key={iso}
              h="70px"
              border={isToday ? "3px solid" : "1px"}
              borderColor={isToday ? "#2196f3" : cellBorderColor}
              borderRadius="md"
              p={2}
              bg={hasEvent ? eventBg : 'transparent'}
              position="relative"
              onClick={() => onDateClick && onDateClick(iso)}
              cursor="pointer"
              _hover={{ borderColor: isToday ? "#2196f3" : 'blue.300' }}
              opacity={isPast ? 0.4 : 1}
            >
              <Text 
                fontSize="sm" 
                color={isPast ? useColorModeValue('gray.400', 'gray.600') : cellTextColor} 
                fontWeight="500" 
                m={0}
              >
                {day}
              </Text>

              {hasVolunteered && (
                <Box position="absolute" top="6px" right="6px">
                  <Box
                    w="12px"
                    h="12px"
                    borderRadius="full"
                    bg="green.400"
                    {...(!isPast ? {
                      animation: `${pulse} 1.2s ease-in-out infinite, ${ringPulse} 1.2s ease-out infinite`
                    } : {})}
                  />
                </Box>
              )}
            </Box>
          )
        })}
      </SimpleGrid>
    </VStack>
  )
} 