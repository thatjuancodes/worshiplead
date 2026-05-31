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
  Tooltip,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  InputGroup,
  InputLeftElement
} from '@chakra-ui/react'
import { CloseButton } from '@chakra-ui/react'
import { AddIcon, ArrowForwardIcon, AtSignIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, CloseIcon, EditIcon, SearchIcon, CheckIcon, TimeIcon } from '@chakra-ui/icons'
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
import { formatServiceDate, getServiceTimeDisplay, getServiceDateISO } from '../utils/dateTime'

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

const dashboardAvatarColors = ['#2563EB', '#7C3AED', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444']

function getNameInitials(firstName?: string, lastName?: string, email?: string) {
  const initials = `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.trim()
  if (initials) return initials.toUpperCase()
  return (email || 'U').slice(0, 2).toUpperCase()
}

function getAvatarColor(seed: string) {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = seed.charCodeAt(index) + ((hash << 5) - hash)
  }
  return dashboardAvatarColors[Math.abs(hash) % dashboardAvatarColors.length]
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

  // Drawer mode state
  const [drawerMode, setDrawerMode] = useState<'day' | 'single'>('day')
  const [selectedSingleService, setSelectedSingleService] = useState<WorshipService | null>(null)
  
  // Scroll indicator state
  const [showScrollIndicator, setShowScrollIndicator] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  
  // Description editing state
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [editingDescription, setEditingDescription] = useState('')
  const [savingDescription, setSavingDescription] = useState(false)

  // Song selection modal state
  const songSelectionModal = useDisclosure()
  const [selectedServiceForSong, setSelectedServiceForSong] = useState<string | null>(null)
  const [songSearchQuery, setSongSearchQuery] = useState<string>('')

  // Volunteer selection modal state
  const volunteerSelectionModal = useDisclosure()
  const [selectedServiceForVolunteer, setSelectedServiceForVolunteer] = useState<string | null>(null)
  const [volunteerSearchQuery, setVolunteerSearchQuery] = useState<string>('')

  // Instrument selection modal state
  const instrumentSelectionModal = useDisclosure()
  const [selectedVolunteerForInstruments, setSelectedVolunteerForInstruments] = useState<string | null>(null)
  const [pendingInstrumentChanges, setPendingInstrumentChanges] = useState<{[volunteerId: string]: {add: string[], remove: string[]}}>({})
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

  const [servicesLoaded, setServicesLoaded] = useState(false)
  const [recentSongsLoaded, setRecentSongsLoaded] = useState(false)
  const [userVolunteerDatesLoaded, setUserVolunteerDatesLoaded] = useState(false)
  const [instrumentsLoaded, setInstrumentsLoaded] = useState(false)
  const [openingVolunteerPage, setOpeningVolunteerPage] = useState(false)
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
    if (displayMonth === null || displayYear === null) return
    if (displayMonth === 0) {
      setDisplayMonth(11)
      setDisplayYear(displayYear - 1)
      return
    }
    setDisplayMonth(displayMonth - 1)
  }

  function handleNextMonth() {
    if (displayMonth === null || displayYear === null) return
    if (displayMonth === 11) {
      setDisplayMonth(0)
      setDisplayYear(displayYear + 1)
      return
    }
    setDisplayMonth(displayMonth + 1)
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

  const handleSongSelection = async (songId: string) => {
    if (!selectedServiceForSong) return
    
    // Close modal immediately
    songSelectionModal.onClose()
    const serviceId = selectedServiceForSong
    setSelectedServiceForSong(null)
    setSongSearchQuery('')
    
    // Add song to service using the existing function
    await handleAddSongToService(serviceId, songId)
  }

  const openSongSelectionModal = (serviceId: string) => {
    setSelectedServiceForSong(serviceId)
    setSongSearchQuery('')
    songSelectionModal.onOpen()
  }

  const handleVolunteerSelection = async (userId: string) => {
    if (!selectedServiceForVolunteer) return
    
    try {
      await handleAddVolunteer(selectedServiceForVolunteer, userId)
      volunteerSelectionModal.onClose()
      setVolunteerSearchQuery('')
    } catch (error) {
      console.error('Error adding volunteer:', error)
    }
  }

  const openVolunteerSelectionModal = (serviceId: string) => {
    setSelectedServiceForVolunteer(serviceId)
    setVolunteerSearchQuery('')
    if (!usersLoaded) {
      loadAvailableUsers()
    }
    volunteerSelectionModal.onOpen()
  }

  const openInstrumentSelectionModal = (volunteerId: string) => {
    setSelectedVolunteerForInstruments(volunteerId)
    if (!instrumentsLoaded) {
      loadOrganizationInstruments()
    }
    instrumentSelectionModal.onOpen()
  }


  const handleInstrumentToggle = (instrumentId: string) => {
    if (!selectedVolunteerForInstruments) return
    
    const volunteerId = selectedVolunteerForInstruments
    const currentInstruments = volunteerToInstrumentIds[volunteerId] || []
    const isCurrentlySelected = currentInstruments.includes(instrumentId)
    
    // Update UI immediately for responsive feedback
    setVolunteerToInstrumentIds(prev => {
      const updated = { ...prev }
      if (isCurrentlySelected) {
        // Remove from current instruments
        updated[volunteerId] = currentInstruments.filter(id => id !== instrumentId)
      } else {
        // Add to current instruments
        updated[volunteerId] = [...currentInstruments, instrumentId]
      }
      return updated
    })

    // Track pending changes for debounced processing
    setPendingInstrumentChanges(prev => {
      const current = prev[volunteerId] || { add: [], remove: [] }
      const updated = { ...prev }
      
      if (isCurrentlySelected) {
        // Remove from add list if it was there, otherwise add to remove list
        if (current.add.includes(instrumentId)) {
          updated[volunteerId] = {
            ...current,
            add: current.add.filter(id => id !== instrumentId)
          }
        } else {
          updated[volunteerId] = {
            ...current,
            remove: [...current.remove.filter(id => id !== instrumentId), instrumentId]
          }
        }
      } else {
        // Remove from remove list if it was there, otherwise add to add list
        if (current.remove.includes(instrumentId)) {
          updated[volunteerId] = {
            ...current,
            remove: current.remove.filter(id => id !== instrumentId)
          }
        } else {
          updated[volunteerId] = {
            ...current,
            add: [...current.add.filter(id => id !== instrumentId), instrumentId]
          }
        }
      }
      
      return updated
    })

    // Trigger debounced update
    debouncedInstrumentUpdate(volunteerId)
  }

  // Scroll indicator functions
  const checkScrollIndicator = useCallback(() => {
    const element = scrollRef.current
    if (!element) return
    
    const hasScroll = element.scrollHeight > element.clientHeight
    const isAtBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 10
    
    // Show indicator if there's scrollable content and user is not at bottom
    setShowScrollIndicator(hasScroll && !isAtBottom)
  }, [])

  const handleScroll = useCallback(() => {
    checkScrollIndicator()
  }, [checkScrollIndicator])

  // Check scroll indicator when drawer opens or content changes
  useEffect(() => {
    if (createDrawer.isOpen) {
      const timer = setTimeout(checkScrollIndicator, 100) // Small delay for content to render
      return () => clearTimeout(timer)
    }
  }, [createDrawer.isOpen, services, selectedSingleService, checkScrollIndicator])

  const getSingleServiceStatusColorScheme = (status: WorshipService['status']) => {
    if (status === 'published') return 'green'
    if (status === 'completed') return 'blue'
    return 'yellow'
  }

  function renderSingleServiceContent(service: WorshipService) {
    const serviceSongs = serviceIdToSongs[service.id] || []
    const serviceVolunteers = serviceIdToVolunteers[service.id] || []

    return (
      <VStack align="stretch" spacing={6}>
        <Box>
          <HStack align="center" gap={2} mb={1} flexWrap="wrap">
            <Text color={titleColor} fontSize="xl" fontWeight="700" m={0}>
              {service.title}
            </Text>
            <Badge
              colorScheme={getSingleServiceStatusColorScheme(service.status)}
              textTransform="capitalize"
              variant="subtle"
            >
              {service.status}
            </Badge>
          </HStack>
          <HStack color={mutedTextColor} fontSize="sm" spacing={3} flexWrap="wrap">
            <HStack spacing={1}>
              <CalendarIcon boxSize={4} />
              <Text m={0}>
                {new Date(service.service_time).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </HStack>
            <HStack spacing={1}>
              <TimeIcon boxSize={4} />
              <Text m={0}>{getServiceTimeDisplay(service.service_time)}</Text>
            </HStack>
          </HStack>
        </Box>

        {(service.description || canManagePrimary) ? (
          <Box
            bg={useColorModeValue('gray.50', 'gray.700')}
            border="1px"
            borderColor={cardBorderColor}
            borderRadius="xl"
            p={4}
          >
            <HStack justify="space-between" align="center" mb={service.description || isEditingDescription ? 3 : 0}>
              <Text color={titleColor} fontSize="sm" fontWeight="600" m={0}>
                Description
              </Text>
              {canManagePrimary ? (
                <Button
                  size="xs"
                  variant="ghost"
                  colorScheme="blue"
                  leftIcon={<EditIcon boxSize={3} />}
                  onClick={() => handleEditDescription(service)}
                >
                  {isEditingDescription ? 'Editing' : 'Edit'}
                </Button>
              ) : null}
            </HStack>

            {isEditingDescription ? (
              <VStack align="stretch" spacing={3}>
                <Textarea
                  value={editingDescription}
                  onChange={(e) => setEditingDescription(e.target.value)}
                  placeholder="Add service notes or preparation details..."
                  rows={5}
                  resize="vertical"
                />
                <HStack spacing={2}>
                  <Button
                    size="sm"
                    colorScheme="blue"
                    onClick={handleSaveDescription}
                    isLoading={savingDescription}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancelEditDescription}>
                    Cancel
                  </Button>
                </HStack>
              </VStack>
            ) : service.description ? (
              <Box
                color={textColor}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(service.description) }}
                sx={{
                  '& p': { margin: '0.5rem 0' },
                  '& li': { color: textColor },
                  '& strong': { fontWeight: '600' },
                  '& em': { fontStyle: 'italic' },
                }}
              />
            ) : (
              <Text color={mutedTextColor} fontSize="sm" fontStyle="italic" m={0}>
                No description available.
              </Text>
            )}
          </Box>
        ) : null}

        {renderSongsTab(service, serviceSongs)}
        {renderVolunteersTab(service, serviceVolunteers)}

        <Button
          className="btn-primary"
          onClick={() => {
            createDrawer.onClose()
            navigate(`/service/${service.id}`)
          }}
          size="sm"
          w="100%"
        >
          Open Full Page
        </Button>
      </VStack>
    )
  }

  function renderSongsTab(service: WorshipService, serviceSongs: ServiceSong[]) {
    return (
      <Box>
        <HStack justify="space-between" align="center" mb={3}>
          <HStack spacing={2}>
            <Text color={titleColor} fontSize="sm" fontWeight="600">Setlist</Text>
            <Text color={mutedTextColor} fontSize="xs">({serviceSongs.length} songs)</Text>
          </HStack>
          {canManagePrimary ? (
            <Button
              size="xs"
              variant="outline"
              colorScheme="blue"
              onClick={() => openSongSelectionModal(service.id)}
            >
              Add Song
            </Button>
          ) : null}
        </HStack>

        {serviceSongs.length === 0 ? (
          <Text color={mutedTextColor} fontSize="sm">No songs added yet.</Text>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => handleReorderServiceSongs(service.id, event)}
          >
            <SortableContext
              items={serviceSongs.map((row) => row.id)}
              strategy={verticalListSortingStrategy}
            >
              <VStack spacing={2} align="stretch">
                {serviceSongs.map((serviceSong) => (
                  <SortableServiceSongItem
                    key={serviceSong.id}
                    serviceSong={serviceSong}
                    canManage={canManagePrimary}
                    onRemove={() => handleRemoveServiceSong(serviceSong.id, service.id)}
                  />
                ))}
              </VStack>
            </SortableContext>
          </DndContext>
        )}
      </Box>
    )
  }

  function renderVolunteersTab(service: WorshipService, serviceVolunteers: Volunteer[]) {
    return (
      <Box>
        <HStack justify="space-between" align="center" mb={3}>
          <HStack spacing={2}>
            <Text color={titleColor} fontSize="sm" fontWeight="600">Volunteers</Text>
            <Text color={mutedTextColor} fontSize="xs">({serviceVolunteers.length})</Text>
          </HStack>
          {canManagePrimary ? (
            <Button
              size="xs"
              variant="outline"
              colorScheme="blue"
              onClick={() => openVolunteerSelectionModal(service.id)}
            >
              Add Volunteer
            </Button>
          ) : null}
        </HStack>

        {serviceVolunteers.length === 0 ? (
          <Text color={mutedTextColor} fontSize="sm">No volunteers assigned yet.</Text>
        ) : (
          <VStack spacing={2} align="stretch">
            {serviceVolunteers.map((volunteer) => (
              <Box
                key={volunteer.id}
                bg={useColorModeValue('gray.50', 'gray.700')}
                borderRadius="lg"
                p={3}
                display="flex"
                alignItems="center"
                gap={3}
                cursor="pointer"
                _hover={{ bg: useColorModeValue('gray.100', 'gray.600') }}
                onClick={() => openInstrumentSelectionModal(volunteer.id)}
                transition="background-color 0.2s"
              >
                <Box
                  bg="blue.100"
                  color="blue.700"
                  borderRadius="full"
                  w="28px"
                  h="28px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  fontSize="xs"
                  fontWeight="700"
                  flexShrink={0}
                >
                  {getNameInitials(volunteer.profiles?.first_name, volunteer.profiles?.last_name, volunteer.profiles?.email)}
                </Box>
                <Box flex="1" minW={0}>
                  <Text color={textColor} fontWeight="600" fontSize="sm" m={0} noOfLines={1}>
                    {`${volunteer.profiles?.first_name || ''} ${volunteer.profiles?.last_name || ''}`.trim() || volunteer.profiles?.email}
                  </Text>
                  <Text color={mutedTextColor} fontSize="xs" m={0} noOfLines={1}>
                    {(volunteerToInstrumentIds[volunteer.id] || [])
                      .map(instId => instruments.find(i => i.id === instId)?.name)
                      .filter(Boolean)
                      .join(', ') || 'No instruments assigned'}
                  </Text>
                </Box>
                {canManagePrimary ? (
                  <Button
                    size="xs"
                    variant="ghost"
                    colorScheme="red"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveVolunteer(volunteer.id, service.id)
                    }}
                    isLoading={removingVolunteerById[volunteer.id]}
                  >
                    Remove
                  </Button>
                ) : null}
              </Box>
            ))}
          </VStack>
        )}
      </Box>
    )
  }

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
        bg={useColorModeValue('gray.50', 'gray.700')}
        borderRadius="lg"
        p={3}
        display="flex"
        alignItems="center"
        gap={3}
        transition="all 0.2s ease"
        _hover={{ bg: useColorModeValue('gray.100', 'gray.600') }}
        cursor={canManage ? 'grab' : 'default'}
        userSelect="none"
        {...attributes}
      >
        <Box
          bg={useColorModeValue('gray.200', 'gray.600')}
          color={mutedTextColor}
          borderRadius="md"
          w={6}
          h={6}
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontWeight="600"
          fontSize="xs"
          flexShrink={0}
          position="relative"
          {...(canManage ? listeners : {})}
        >
          {serviceSong.position}
        </Box>

        <Box flex="1" minW="0" cursor={canManage ? 'grab' : 'default'} {...(canManage ? listeners : {})}>
          <Text fontWeight="600" color={textColor} fontSize="sm" mb={0} noOfLines={1}>
            {serviceSong.songs.title}
          </Text>
          <Text color={mutedTextColor} fontSize="xs" mb={0} noOfLines={1}>
            {serviceSong.songs.artist}
            {serviceSong.songs.key || serviceSong.songs.bpm ? ` · ${serviceSong.songs.key || '-'}${serviceSong.songs.bpm ? ` · ${serviceSong.songs.bpm} BPM` : ''}` : ''}
          </Text>
          {serviceSong.notes && (
            <Text color={mutedTextColor} fontSize="xs" fontStyle="italic" noOfLines={2} mt={1}>
              {serviceSong.notes}
            </Text>
          )}
        </Box>

        {canManage && (
          <HStack spacing={2}>
            <Tooltip label="Remove song from service">
              <IconButton
                aria-label="Remove song from service"
                icon={removingServiceSongId === serviceSong.id ? <Spinner size="xs" /> : <CloseIcon boxSize="3" />}
                variant="ghost"
                colorScheme="red"
                size="sm"
                borderRadius="lg"
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

  async function handleCreateServiceSubmit(e?: React.FormEvent | React.MouseEvent) {
    e?.preventDefault()

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
          status: 'published',
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

  function resetAddSongForm() {
    setSongTitle('')
    setSongArtist('')
    setSongYouTubeUrl('')
    setSongSpotifyUrl('')
    setSongKey('')
    setSongBpm('')
    setSongCcli('')
    setSongTags('')
    setSongLyrics('')
  }

  async function handleCreateSongSubmit(e?: React.FormEvent | React.MouseEvent) {
    e?.preventDefault()

    if (!organization) {
      setSongError('Organization not found.')
      return
    }

    if (!canManagePrimary) {
      setSongError('You do not have permission to create songs. Only admins and owners can create songs.')
      return
    }

    if (!songTitle.trim() || !songArtist.trim()) {
      setSongError('Title and Artist are required.')
      return
    }

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

      if (error) {
        setSongError('Failed to add song. Please try again.')
        return
      }

      resetAddSongForm()
      addSongDrawer.onClose()
      await loadRecentSongs()
    } catch (err) {
      setSongError('Failed to add song. Please try again later.')
    } finally {
      setIsAddingSong(false)
    }
  }

  function renderCreateServiceContent() {
    const scheduledDateLabel = formDateTime
      ? new Date(formDateTime).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : selectedDate
        ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
        : null

    return (
      <Box as="form" onSubmit={handleCreateServiceSubmit}>
        <VStack align="stretch" spacing={6}>
          {formError ? (
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              {formError}
            </Alert>
          ) : null}

          <Box>
            <HStack align="center" gap={2} mb={1} flexWrap="wrap">
              <Text color={titleColor} fontSize="xl" fontWeight="700" m={0}>
                {formTitle.trim() || 'New Service'}
              </Text>
              <Badge colorScheme="green" variant="subtle">
                published
              </Badge>
            </HStack>
            <Text color={mutedTextColor} fontSize="sm" m={0}>
              {scheduledDateLabel ? `Schedule and publish this service for ${scheduledDateLabel}.` : 'Create a new published service for your team.'}
            </Text>
          </Box>

          <Box
            bg={useColorModeValue('gray.50', 'gray.700')}
            border="1px"
            borderColor={cardBorderColor}
            borderRadius="xl"
            p={4}
          >
            <VStack align="stretch" spacing={4}>
              <FormControl isRequired>
                <FormLabel fontSize="sm" fontWeight="600" m={0}>
                  Service Title
                </FormLabel>
                <Input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Sunday Morning Service"
                  size="md"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel fontSize="sm" fontWeight="600" m={0}>
                  Service Date & Time
                </FormLabel>
                <Input
                  type="datetime-local"
                  value={formDateTime}
                  onChange={(e) => setFormDateTime(e.target.value)}
                  size="md"
                />
              </FormControl>
            </VStack>
          </Box>

          <Box
            bg={useColorModeValue('gray.50', 'gray.700')}
            border="1px"
            borderColor={cardBorderColor}
            borderRadius="xl"
            p={4}
          >
            <VStack align="stretch" spacing={3}>
              <Text color={titleColor} fontSize="sm" fontWeight="600" m={0}>
                Description
              </Text>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Add service notes or preparation details..."
                rows={5}
                resize="vertical"
              />
            </VStack>
          </Box>

          <VStack align="stretch" spacing={2}>
            <Button
              className="btn-primary"
              isLoading={creating}
              loadingText="Scheduling..."
              onClick={handleCreateServiceSubmit}
              size="sm"
              type="submit"
              w="100%"
            >
              Schedule Service
            </Button>
            <Button
              onClick={createDrawer.onClose}
              size="sm"
              variant="ghost"
              w="100%"
            >
              Cancel
            </Button>
          </VStack>
        </VStack>
      </Box>
    )
  }

  function renderCreateSongContent() {
    const hasMetadata = Boolean(songKey.trim() || songBpm.trim() || songCcli.trim() || songTags.trim())

    return (
      <Box as="form" onSubmit={handleCreateSongSubmit}>
        <VStack align="stretch" spacing={6}>
          {songError ? (
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              {songError}
            </Alert>
          ) : null}

          <Box>
            <Text color={titleColor} fontSize="xl" fontWeight="700" m={0}>
              {songTitle.trim() || 'New Song'}
            </Text>
            <Text color={mutedTextColor} fontSize="sm" mt={1}>
              Build out your library using the same song details shown throughout the dashboard.
            </Text>
          </Box>

          <Box
            bg={useColorModeValue('gray.50', 'gray.700')}
            border="1px"
            borderColor={cardBorderColor}
            borderRadius="xl"
            p={4}
          >
            <VStack align="stretch" spacing={4}>
              <FormControl isRequired>
                <FormLabel fontSize="sm" fontWeight="600" m={0}>
                  Title
                </FormLabel>
                <Input value={songTitle} onChange={(e) => setSongTitle(e.target.value)} placeholder="Song title" size="md" />
              </FormControl>

              <FormControl isRequired>
                <FormLabel fontSize="sm" fontWeight="600" m={0}>
                  Artist
                </FormLabel>
                <Input value={songArtist} onChange={(e) => setSongArtist(e.target.value)} placeholder="Artist name" size="md" />
              </FormControl>
            </VStack>
          </Box>

          <Box
            bg={useColorModeValue('gray.50', 'gray.700')}
            border="1px"
            borderColor={cardBorderColor}
            borderRadius="xl"
            p={4}
          >
            <VStack align="stretch" spacing={4}>
              <Text color={titleColor} fontSize="sm" fontWeight="600" m={0}>
                Links
              </Text>
              <FormControl>
                <FormLabel fontSize="sm" fontWeight="600" m={0}>
                  YouTube URL
                </FormLabel>
                <Input type="url" value={songYouTubeUrl} onChange={(e) => setSongYouTubeUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." size="md" />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="600" m={0}>
                  Spotify URL
                </FormLabel>
                <Input type="url" value={songSpotifyUrl} onChange={(e) => setSongSpotifyUrl(e.target.value)} placeholder="https://open.spotify.com/track/..." size="md" />
              </FormControl>
            </VStack>
          </Box>

          <Box
            bg={useColorModeValue('gray.50', 'gray.700')}
            border="1px"
            borderColor={cardBorderColor}
            borderRadius="xl"
            p={4}
          >
            <VStack align="stretch" spacing={4}>
              <HStack justify="space-between" align="center">
                <Text color={titleColor} fontSize="sm" fontWeight="600" m={0}>
                  Metadata
                </Text>
                {hasMetadata ? (
                  <Badge colorScheme="blue" variant="subtle">
                    Optional details added
                  </Badge>
                ) : null}
              </HStack>

              <HStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel fontSize="sm" fontWeight="600" m={0}>
                    Key
                  </FormLabel>
                  <Input value={songKey} onChange={(e) => setSongKey(e.target.value)} placeholder="C, G, D, etc." size="md" />
                </FormControl>

                <FormControl>
                  <FormLabel fontSize="sm" fontWeight="600" m={0}>
                    BPM
                  </FormLabel>
                  <Input type="number" value={songBpm} onChange={(e) => setSongBpm(e.target.value)} placeholder="120" size="md" />
                </FormControl>
              </HStack>

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="600" m={0}>
                  CCLI Number
                </FormLabel>
                <Input value={songCcli} onChange={(e) => setSongCcli(e.target.value)} placeholder="CCLI-123456" size="md" />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="600" m={0}>
                  Tags
                </FormLabel>
                <Input value={songTags} onChange={(e) => setSongTags(e.target.value)} placeholder="worship, contemporary, gospel" size="md" />
              </FormControl>
            </VStack>
          </Box>

          <Box
            bg={useColorModeValue('gray.50', 'gray.700')}
            border="1px"
            borderColor={cardBorderColor}
            borderRadius="xl"
            p={4}
          >
            <VStack align="stretch" spacing={3}>
              <Text color={titleColor} fontSize="sm" fontWeight="600" m={0}>
                Lyrics
              </Text>
              <Textarea value={songLyrics} onChange={(e) => setSongLyrics(e.target.value)} placeholder="Enter song lyrics..." size="md" rows={5} />
            </VStack>
          </Box>

          <VStack align="stretch" spacing={2}>
            <Button
              className="btn-primary"
              isLoading={isAddingSong}
              loadingText="Adding..."
              onClick={handleCreateSongSubmit}
              size="sm"
              type="submit"
              w="100%"
            >
              Add Song
            </Button>
            <Button onClick={addSongDrawer.onClose} size="sm" variant="ghost" w="100%">
              Cancel
            </Button>
          </VStack>
        </VStack>
      </Box>
    )
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

  const processPendingInstrumentChanges = useCallback(async (volunteerId: string) => {
    const changes = pendingInstrumentChanges[volunteerId]
    if (!changes) return

    try {
      // Process removals first
      for (const instrumentId of changes.remove) {
        await handleRemoveInstrument(volunteerId, instrumentId)
      }

      // Then process additions
      for (const instrumentId of changes.add) {
        await handleAssignInstrument(volunteerId, instrumentId)
      }

      // Clear pending changes for this volunteer
      setPendingInstrumentChanges(prev => {
        const updated = { ...prev }
        delete updated[volunteerId]
        return updated
      })
    } catch (error) {
      console.error('Error processing pending instrument changes:', error)
    }
  }, [pendingInstrumentChanges, handleRemoveInstrument, handleAssignInstrument])

  const debouncedInstrumentUpdate = useCallback((volunteerId: string) => {
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    // Set new timeout for 2 seconds
    debounceTimeoutRef.current = setTimeout(() => {
      processPendingInstrumentChanges(volunteerId)
    }, 2000)
  }, [processPendingInstrumentChanges])

  const handleEditDescription = (service: WorshipService) => {
    console.log('Editing description for service:', service.id, 'Current description:', service.description)
    setEditingDescription(service.description || '')
    setIsEditingDescription(true)
  }

  const handleSaveDescription = async () => {
    if (!selectedSingleService || !organization) return
    
    console.log('Saving description:', editingDescription, 'for service:', selectedSingleService.id)
    
    try {
      setSavingDescription(true)
      
      const { error } = await supabase
        .from('worship_services')
        .update({ description: editingDescription })
        .eq('id', selectedSingleService.id)
      
      if (error) {
        console.error('Error updating service description:', error)
        toast({
          title: 'Error',
          description: 'Failed to update service description',
          status: 'error',
          duration: 3000,
          isClosable: true
        })
        return
      }
      
      // Update the local state for selected service
      setSelectedSingleService(prev => prev ? { ...prev, description: editingDescription } : null)
      
      // Also update the services array to maintain consistency
      setServices(prev => prev.map(service => 
        service.id === selectedSingleService.id 
          ? { ...service, description: editingDescription }
          : service
      ))
      
      setIsEditingDescription(false)
      
      toast({
        title: 'Success',
        description: 'Service description updated',
        status: 'success',
        duration: 3000,
        isClosable: true
      })
    } catch (error) {
      console.error('Error updating service description:', error)
    } finally {
      setSavingDescription(false)
    }
  }

  const handleCancelEditDescription = () => {
    setIsEditingDescription(false)
    setEditingDescription('')
  }

  // Simple markdown renderer for basic formatting
  const renderMarkdown = (text: string) => {
    if (!text) return ''
    
    return text
      // Headers
      .replace(/^### (.*$)/gim, '<h3 style="font-size: 1.125rem; font-weight: 600; margin: 0.5rem 0;">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 style="font-size: 1.25rem; font-weight: 600; margin: 0.5rem 0;">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 style="font-size: 1.5rem; font-weight: 700; margin: 0.5rem 0;">$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      // Line breaks
      .replace(/\n/g, '<br>')
      // Lists (basic)
      .replace(/^\* (.*$)/gim, '<li style="margin-left: 1rem;">$1</li>')
      .replace(/^- (.*$)/gim, '<li style="margin-left: 1rem;">$1</li>')
  }

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
        .select('id, service_time, title, status, description, created_at, updated_at')
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
    loadUserVolunteerDates()
    loadOrganizationInstruments()
  }, [organization])

  // Load volunteers for upcoming services when services are loaded
  useEffect(() => {
    if (!organization || services.length === 0) return
    
    // Get upcoming services (same logic as in the render)
    const now = new Date() // Use current time, not just date
    
    const upcomingServices = services
      .filter(service => {
        const serviceDateTime = new Date(service.service_time)
        return serviceDateTime > now // Use current time for comparison
      })
      .slice(0, 8) // Show next 8 upcoming services
    
    if (upcomingServices.length > 0) {
      const serviceIds = upcomingServices.map(service => service.id)
      loadVolunteersForServices(serviceIds)
    }
  }, [organization, services, loadVolunteersForServices])

  // Load data for single service when selected
  useEffect(() => {
    if (drawerMode === 'single' && selectedSingleService && organization) {
      // Load songs for this service
      loadSongsForServices([selectedSingleService.id])
      // Load volunteers for this service
      loadVolunteersForServices([selectedSingleService.id])
    }
  }, [drawerMode, selectedSingleService, organization, loadSongsForServices, loadVolunteersForServices])

  // Debug: Log selected service data
  useEffect(() => {
    if (selectedSingleService) {
      console.log('Selected service:', selectedSingleService)
      console.log('Service description:', selectedSingleService.description)
    }
  }, [selectedSingleService])

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  // Chevron pulse animation for scroll indicator
  const chevronPulse = keyframes`
    0%, 100% {
      transform: translateY(0);
      opacity: 0.6;
    }
    50% {
      transform: translateY(4px);
      opacity: 1;
    }
  `

  const bgColor = useColorModeValue('gray.50', 'gray.900')
  const cardBg = useColorModeValue('white', 'gray.800')
  const cardBorderColor = useColorModeValue('gray.200', 'gray.600')
  // Removed quick actions; hover styles unused
  const titleColor = useColorModeValue('gray.800', 'white')
  const subtitleColor = useColorModeValue('gray.600', 'gray.300')
  const textColor = useColorModeValue('gray.700', 'gray.200')
  const mutedTextColor = useColorModeValue('gray.500', 'gray.400')
  const addSongPulse = keyframes`
    0% { box-shadow: 0 0 0 0 rgba(49, 130, 206, 0.45) }
    70% { box-shadow: 0 0 0 10px rgba(49, 130, 206, 0) }
    100% { box-shadow: 0 0 0 0 rgba(49, 130, 206, 0) }
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

  const todayDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })
  const upcomingDashboardServices = services
    .filter((service) => new Date(service.service_time) > new Date())
    .sort((a, b) => new Date(a.service_time).getTime() - new Date(b.service_time).getTime())
    .slice(0, 4)
  const popularSongs = recentSongs.slice(0, 5)
  const currentMonthLabel = displayMonth === null || displayYear === null
    ? ''
    : `${monthNames[displayMonth]} ${displayYear}`

  function openCreateServiceDrawer() {
    setDrawerMode('day')
    setSelectedSingleService(null)
    setSelectedDate('')
    setDayServices([])
    setFormDateTime('')
    setIsAddingServiceMode(true)
    createDrawer.onOpen()
  }

  function jumpToCurrentMonth() {
    const now = new Date()
    setDisplayMonth(now.getMonth())
    setDisplayYear(now.getFullYear())
  }

  const openVolunteerPage = useCallback(async () => {
    if (!organization) return

    try {
      setOpeningVolunteerPage(true)

      const { data: existingLinks, error: loadError } = await supabase
        .from('organization_volunteer_links')
        .select('public_url')
        .eq('organization_id', organization.organization_id)
        .order('created_at', { ascending: true })
        .limit(1)

      if (loadError) {
        throw loadError
      }

      let publicUrl = existingLinks?.[0]?.public_url

      if (!publicUrl) {
        const orgMeta = Array.isArray(organization.organizations)
          ? organization.organizations[0]
          : organization.organizations
        const baseSlug = orgMeta?.slug || 'organization'
        const generatedUrl = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`

        const { data: createdLink, error: createError } = await supabase
          .from('organization_volunteer_links')
          .insert({
            organization_id: organization.organization_id,
            public_url: generatedUrl
          })
          .select('public_url')
          .single()

        if (createError) {
          throw createError
        }

        publicUrl = createdLink.public_url
      }

      const volunteerUrl = `${window.location.origin}/volunteer/${publicUrl}`

      try {
        await navigator.clipboard.writeText(volunteerUrl)

        toast({
          title: t('dashboard.success.copiedVolunteerPageLink'),
          status: 'success',
          duration: 3000,
          isClosable: true,
        })
      } catch (clipboardError) {
        console.error('Error copying volunteer page link:', clipboardError)
        toast({
          title: 'Error',
          description: t('dashboard.errors.failedToCopyLink'),
          status: 'error',
          duration: 4000,
          isClosable: true,
        })
      }

      navigate(`/volunteer/${publicUrl}`)
    } catch (error) {
      console.error('Error opening volunteer page:', error)
      toast({
        title: 'Error',
        description: t('dashboard.errors.failedToLoadVolunteerLink'),
        status: 'error',
        duration: 4000,
        isClosable: true,
      })
    } finally {
      setOpeningVolunteerPage(false)
    }
  }, [navigate, organization, t, toast])

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
    <Box className="sl-dashboard-page" minH="100vh" bg={bgColor} sx={mobileTextSx}>
      <DashboardHeader user={user} organization={organization} />

      <Box
        as="main"
        maxW="1200px"
        mx="auto"
        px={{ base: 6, md: 8 }}
        pt={{ base: 2, md: 3 }}
        pb={{ base: 8, md: 8 }}
        sx={mobileTextSx}
      >
        <VStack spacing={8} align="stretch">
          <HStack justify="space-between" align="center" flexWrap="wrap" spacing={4}>
            <Text color={mutedTextColor} fontSize="xs">{todayDate}</Text>
            <HStack spacing={2} flexWrap="wrap" justify="flex-end">
              <Button
                leftIcon={<AtSignIcon boxSize={3} />}
                onClick={openVolunteerPage}
                size="sm"
                variant="outline"
                isLoading={openingVolunteerPage}
              >
                Volunteer Page
              </Button>
              {canManagePrimary ? (
                <Button className="btn-primary" leftIcon={<AddIcon boxSize={3} />} onClick={openCreateServiceDrawer} size="sm">
                  New Service
                </Button>
              ) : null}
            </HStack>
          </HStack>

          <Grid templateColumns={{ base: '1fr', lg: 'repeat(3, minmax(0, 1fr))' }} gap={6} w="100%">
            <GridItem colSpan={{ base: 1, lg: 2 }}>
              <VStack spacing={6} align="stretch">
                <Box>
                  <HStack align="center" justify="space-between" mb={4}>
                    <Heading as="h2" className="section-title" size="md">Upcoming Services</Heading>
                    <Button
                      rightIcon={<ArrowForwardIcon />}
                      size="sm"
                      variant="ghost"
                      color={useColorModeValue('blue.600', 'blue.300')}
                      onClick={() => navigate('/services')}
                    >
                      View all
                    </Button>
                  </HStack>

                  {upcomingDashboardServices.length === 0 ? (
                    <Box className="sl-empty-state">
                      <Text className="sl-empty-state__title">No upcoming services</Text>
                      <Text className="sl-empty-state__description">Schedule your next gathering to start planning.</Text>
                    </Box>
                  ) : (
                    <VStack spacing={2} align="stretch">
                      {upcomingDashboardServices.map((service) => {
                        const volunteers = serviceIdToVolunteers[service.id] || []
                        return (
                          <Box
                            key={service.id}
                            className="card-shadow card-hover"
                            bg="white"
                            borderRadius="xl"
                            cursor="pointer"
                            p={3}
                            onClick={() => {
                              setDrawerMode('single')
                              setSelectedSingleService(service)
                              setIsAddingServiceMode(false)
                              createDrawer.onOpen()
                            }}
                          >
                            <HStack align="center" gap={3}>
                              <Box flex="1" minW={0}>
                                <Text color={textColor} fontSize="sm" fontWeight="600" noOfLines={1}>
                                  {service.title}
                                </Text>
                                <HStack color={mutedTextColor} fontSize="xs" mt={1} spacing={3}>
                                  <HStack spacing={1}>
                                    <CalendarIcon boxSize={3} />
                                    <Text m={0}>
                                      {new Date(service.service_time).toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric'
                                      })}
                                    </Text>
                                  </HStack>
                                  <HStack spacing={1}>
                                    <TimeIcon boxSize={3} />
                                    <Text m={0}>{getServiceTimeDisplay(service.service_time)}</Text>
                                  </HStack>
                                </HStack>
                              </Box>

                              <HStack spacing={3} flexShrink={0}>
                                <HStack spacing={0}>
                                  {volunteers.slice(0, 5).map((volunteer, index) => {
                                    const fullName = `${volunteer.profiles.first_name || ''} ${volunteer.profiles.last_name || ''}`.trim() || volunteer.profiles.email
                                    const isCurrentUser = user?.id === volunteer.user_id
                                    return (
                                      <Tooltip key={volunteer.id} hasArrow label={fullName} placement="top">
                                        <Box
                                          alignItems="center"
                                          bg={isCurrentUser ? '#2563EB' : getAvatarColor(fullName)}
                                          border="2px solid white"
                                          borderRadius="full"
                                          color="white"
                                          display="flex"
                                          fontSize="10px"
                                          fontWeight="700"
                                          h="28px"
                                          justifyContent="center"
                                          ml={index === 0 ? 0 : '-8px'}
                                          title={fullName}
                                          w="28px"
                                        >
                                          {getNameInitials(volunteer.profiles.first_name, volunteer.profiles.last_name, volunteer.profiles.email)}
                                        </Box>
                                      </Tooltip>
                                    )
                                  })}
                                  {volunteers.length > 5 ? (
                                    <Box
                                      alignItems="center"
                                      bg="gray.100"
                                      border="2px solid white"
                                      borderRadius="full"
                                      color={mutedTextColor}
                                      display="flex"
                                      fontSize="10px"
                                      fontWeight="700"
                                      h="28px"
                                      justifyContent="center"
                                      ml="-8px"
                                      w="28px"
                                    >
                                      +{volunteers.length - 5}
                                    </Box>
                                  ) : null}
                                </HStack>
                                <ChevronRightIcon color="gray.400" boxSize={5} />
                              </HStack>
                            </HStack>
                          </Box>
                        )
                      })}
                    </VStack>
                  )}
                </Box>

                <Box className="sl-surface-card" bg={cardBg} display={{ base: 'none', md: 'block' }}>
                  <HStack align="center" justify="space-between" mb={4}>
                    <Heading as="h2" className="section-title" size="md">{currentMonthLabel}</Heading>
                    <HStack spacing={1}>
                      <IconButton
                        aria-label={t('dashboard.calendar.previousMonth')}
                        icon={<ChevronLeftIcon />}
                        onClick={handlePrevMonth}
                        size="sm"
                        variant="ghost"
                        isDisabled={displayYear === null || displayMonth === null}
                      />
                      <Button onClick={jumpToCurrentMonth} size="sm" variant="ghost">Today</Button>
                      <IconButton
                        aria-label={t('dashboard.calendar.nextMonth')}
                        icon={<ChevronRightIcon />}
                        onClick={handleNextMonth}
                        size="sm"
                        variant="ghost"
                        isDisabled={displayYear === null || displayMonth === null}
                      />
                    </HStack>
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
                        setDrawerMode('day')
                        setSelectedSingleService(null)
                        setFormDateTime(`${iso}T10:00`)
                        setSelectedDate(iso)
                        loadServicesForDate(iso)
                        setIsAddingServiceMode(false)
                        createDrawer.onOpen()
                      }}
                    />
                  )}

                  {canManagePrimary ? (
                    <Button className="btn-primary" leftIcon={<CalendarIcon boxSize={4} />} mt={4} onClick={openCreateServiceDrawer} w="100%">
                      Schedule Service
                    </Button>
                  ) : null}
                </Box>
              </VStack>
            </GridItem>

            <GridItem colSpan={{ base: 1, lg: 1 }}>
              <VStack spacing={6} align="stretch">
                <Box>
                  <HStack align="center" justify="space-between" mb={4}>
                    <Heading as="h2" className="section-title" size="md">Most Played</Heading>
                    <Button
                      rightIcon={<ArrowForwardIcon />}
                      size="sm"
                      variant="ghost"
                      color={useColorModeValue('blue.600', 'blue.300')}
                      onClick={() => navigate('/songbank')}
                    >
                      Library
                    </Button>
                  </HStack>

                  <Box className="sl-compact-table" bg={cardBg}>
                    {recentSongsError ? (
                      <Alert status="error" borderRadius="xl" mb={0}>
                        <AlertIcon />
                        {recentSongsError}
                      </Alert>
                    ) : loadingRecentSongs ? (
                      <Center py={8}>
                        <Spinner />
                      </Center>
                    ) : popularSongs.length === 0 ? (
                      <Box px={5} py={8} textAlign="center">
                        <Text color={mutedTextColor}>No recent song usage yet.</Text>
                      </Box>
                    ) : (
                      <VStack align="stretch" divider={<Box borderTop="1px solid" borderColor={cardBorderColor} />} spacing={0}>
                        {popularSongs.map((song, index) => (
                          <HStack
                            key={song.songId}
                            className="sl-compact-row"
                            align="center"
                            gap={3}
                            justify="space-between"
                            px={{ base: 4, md: 5 }}
                            py={3.5}
                          >
                            <HStack align="center" gap={3} minW={0}>
                              <Box
                                alignItems="center"
                                bg={useColorModeValue('gray.100', 'gray.700')}
                                borderRadius="md"
                                color={mutedTextColor}
                                display="flex"
                                fontSize="xs"
                                fontWeight="700"
                                h="24px"
                                justifyContent="center"
                                w="24px"
                              >
                                {index + 1}
                              </Box>
                              <Box minW={0}>
                                <Text color={textColor} fontSize="sm" fontWeight="500" noOfLines={1}>{song.title}</Text>
                                <Text color={mutedTextColor} fontSize="xs" noOfLines={1}>{song.artist}</Text>
                              </Box>
                            </HStack>
                            <Box flexShrink={0} textAlign="right">
                              <Text color={mutedTextColor} fontSize="xs" m={0}>
                                {song.usageCount}
                              </Text>
                              <Text color={mutedTextColor} fontSize="xs" mt={0.5}>
                                {new Date(song.lastUsedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </Text>
                            </Box>
                          </HStack>
                        ))}
                      </VStack>
                    )}
                  </Box>
                </Box>

                <Box>
                  <Heading as="h2" className="section-title" mb={4} size="md">Quick Actions</Heading>
                  <VStack spacing={2} align="stretch">
                    <Box
                      as="button"
                      bg="white"
                      borderRadius="xl"
                      className="card-shadow card-hover"
                      onClick={openVolunteerPage}
                      px={4}
                      py={3}
                      textAlign="left"
                      type="button"
                      w="100%"
                    >
                      <HStack gap={3}>
                        <Box alignItems="center" bg="purple.50" borderRadius="lg" color="purple.600" display="flex" h="36px" justifyContent="center" w="36px">
                          <AtSignIcon boxSize={4} />
                        </Box>
                        <Box flex="1">
                          <Text color={textColor} fontSize="sm" fontWeight="500">Visit Volunteer Page</Text>
                          <Text color={mutedTextColor} fontSize="xs">Open your public volunteer signup page</Text>
                        </Box>
                        <ChevronRightIcon boxSize={5} color="gray.400" />
                      </HStack>
                    </Box>

                    {canManagePrimary ? (
                      <Box
                        as="button"
                        bg="white"
                        borderRadius="xl"
                        className="card-shadow card-hover"
                        onClick={openCreateServiceDrawer}
                        px={4}
                        py={3}
                        textAlign="left"
                        type="button"
                        w="100%"
                      >
                        <HStack gap={3}>
                          <Box alignItems="center" bg="blue.50" borderRadius="lg" color="blue.600" display="flex" h="36px" justifyContent="center" w="36px">
                            <CalendarIcon boxSize={4} />
                          </Box>
                          <Box flex="1">
                            <Text color={textColor} fontSize="sm" fontWeight="500">Schedule Service</Text>
                            <Text color={mutedTextColor} fontSize="xs">Create a new service plan</Text>
                          </Box>
                          <ChevronRightIcon boxSize={5} color="gray.400" />
                        </HStack>
                      </Box>
                    ) : null}

                    <Box
                      as="button"
                      bg="white"
                      borderRadius="xl"
                      className="card-shadow card-hover"
                      onClick={() => navigate('/team')}
                      px={4}
                      py={3}
                      textAlign="left"
                      type="button"
                      w="100%"
                    >
                      <HStack gap={3}>
                        <Box alignItems="center" bg="green.50" borderRadius="lg" color="green.600" display="flex" h="36px" justifyContent="center" w="36px">
                          <AtSignIcon boxSize={4} />
                        </Box>
                        <Box flex="1">
                          <Text color={textColor} fontSize="sm" fontWeight="500">Invite Volunteer</Text>
                          <Text color={mutedTextColor} fontSize="xs">Add someone to a team</Text>
                        </Box>
                        <ChevronRightIcon boxSize={5} color="gray.400" />
                      </HStack>
                    </Box>

                    <Box
                      as="button"
                      bg="white"
                      borderRadius="xl"
                      className="card-shadow card-hover"
                      onClick={() => {
                        if (canManagePrimary) {
                          addSongDrawer.onOpen()
                          return
                        }
                        navigate('/songbank')
                      }}
                      px={4}
                      py={3}
                      textAlign="left"
                      type="button"
                      w="100%"
                    >
                      <HStack gap={3}>
                        <Box alignItems="center" bg="purple.50" borderRadius="lg" color="purple.600" display="flex" h="36px" justifyContent="center" w="36px">
                          <AddIcon boxSize={3} />
                        </Box>
                        <Box flex="1">
                          <Text color={textColor} fontSize="sm" fontWeight="500">Add Song</Text>
                          <Text color={mutedTextColor} fontSize="xs">Add to your library</Text>
                        </Box>
                        <ChevronRightIcon boxSize={5} color="gray.400" />
                      </HStack>
                    </Box>
                  </VStack>
                </Box>
              </VStack>
            </GridItem>
          </Grid>

          {/* Create Service Drawer */}
          <Drawer isOpen={createDrawer.isOpen} placement="right" onClose={createDrawer.onClose} size="lg">
            <DrawerOverlay />
            <DrawerContent sx={mobileTextSx}>
              <DrawerCloseButton display={{ base: 'none', md: 'inline-flex' }} />
              <DrawerHeader boxShadow="sm" borderBottom="1px" borderColor={useColorModeValue('gray.200', 'gray.600')}>
                <HStack justify="space-between" align="center">
                  {drawerMode === 'single' && selectedSingleService ? (
                    <Text m={0} fontWeight="700" fontSize="lg">
                      Service Details
                    </Text>
                  ) : (
                    <Text m={0} fontWeight="700" fontSize="lg">
                      {selectedDate && dayServices.length > 0 && !isAddingServiceMode
                        ? `${new Date(selectedDate).toLocaleDateString('en-US', {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                          })}`
                        : 'Schedule Service'}
                    </Text>
                  )}
                  <IconButton
                    aria-label="Close drawer"
                    icon={<CloseIcon boxSize="4" />}
                    variant="solid"
                    colorScheme="gray"
                    size="md"
                    borderRadius="full"
                    display={{ base: 'inline-flex', md: 'none' }}
                    onClick={createDrawer.onClose}
                  />
                </HStack>
              </DrawerHeader>
              
              <DrawerBody 
                ref={scrollRef} 
                overflowY="auto" 
                p={0} 
                onScroll={handleScroll}
                position="relative"
              >
                {drawerMode === 'single' && selectedSingleService ? (
                  <Box p={6}>
                    {renderSingleServiceContent(selectedSingleService)}
                  </Box>
                ) : selectedDate && !isAddingServiceMode && (
                  <Box p={6} mb={4}>
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
                                      
                                      return (
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
                                      
                                      return (
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

                {drawerMode !== 'single' && (isAddingServiceMode || !selectedDate || dayServices.length === 0) && (
                  <Box p={6}>
                    {renderCreateServiceContent()}
                  </Box>
                )}
              </DrawerBody>
              
              {/* Scroll Indicator - Mobile Only */}
              {showScrollIndicator && (
                <Box
                  position="absolute"
                  bottom="20px"
                  left="50%"
                  transform="translateX(-50%)"
                  zIndex={10}
                  display={{ base: 'flex', md: 'none' }}
                  alignItems="center"
                  justifyContent="center"
                  bg={useColorModeValue('white', 'gray.800')}
                  borderRadius="full"
                  boxShadow="lg"
                  border="1px"
                  borderColor={useColorModeValue('gray.200', 'gray.600')}
                  p={2}
                >
                  <ChevronDownIcon 
                    color={useColorModeValue('gray.500', 'gray.400')}
                    boxSize="5"
                    animation={`${chevronPulse} 1.5s ease-in-out infinite`}
                  />
                </Box>
              )}
              
              {drawerMode === 'single' ? (
                // Footer hidden for single service mode - X icon serves as close action
                null
              ) : (isAddingServiceMode || !selectedDate || dayServices.length === 0) ? (
                null
              ) : (
                // Footer hidden for day view - X icon serves as close action, "Add Service" can be accessed via + button
                null
              )}
            </DrawerContent>
          </Drawer>

          {/* Add Song Drawer */}
          <Drawer isOpen={addSongDrawer.isOpen} placement="right" onClose={addSongDrawer.onClose} size="lg">
            <DrawerOverlay />
            <DrawerContent sx={mobileTextSx}>
              <DrawerCloseButton display={{ base: 'none', md: 'inline-flex' }} />
              <DrawerHeader boxShadow="sm" borderBottom="1px" borderColor={useColorModeValue('gray.200', 'gray.600')}>
                <HStack justify="space-between" align="center">
                  <Text m={0} fontWeight="700" fontSize="lg">Add Song</Text>
                  <IconButton
                    aria-label="Close drawer"
                    icon={<CloseIcon boxSize="4" />}
                    variant="solid"
                    colorScheme="gray"
                    size="md"
                    borderRadius="full"
                    display={{ base: 'inline-flex', md: 'none' }}
                    onClick={addSongDrawer.onClose}
                  />
                </HStack>
              </DrawerHeader>
              <DrawerBody p={0}>
                <Box p={6}>
                  {renderCreateSongContent()}
                </Box>
              </DrawerBody>
            </DrawerContent>
          </Drawer>

          {/* Song Selection Modal */}
          <Modal isOpen={songSelectionModal.isOpen} onClose={songSelectionModal.onClose} isCentered size="lg">
            <ModalOverlay />
            <ModalContent maxH="600px">
              <ModalHeader>Select a Song</ModalHeader>
              <ModalCloseButton />
              <ModalBody p={0} display="flex" flexDirection="column" minH="0">
                {availableSongs.length === 0 ? (
                  <Center py={8}>
                    <Text color={mutedTextColor}>No songs available</Text>
                  </Center>
                ) : (
                  <>
                    {/* Search Field */}
                    <Box p={4} borderBottom="1px" borderColor={useColorModeValue('gray.200', 'gray.600')} flexShrink={0}>
                      <InputGroup>
                        <InputLeftElement pointerEvents="none">
                          <SearchIcon color={mutedTextColor} />
                        </InputLeftElement>
                        <Input
                          placeholder="Search songs..."
                          value={songSearchQuery}
                          onChange={(e) => setSongSearchQuery(e.target.value)}
                          size="md"
                        />
                      </InputGroup>
                    </Box>

                    {/* Scrollable List */}
                    <Box 
                      flex="1"
                      overflowY="auto"
                      minH="300px"
                      maxH="400px"
                      tabIndex={0}
                      css={{
                        '&': {
                          scrollBehavior: 'smooth',
                          outline: 'none',
                        },
                        '&::-webkit-scrollbar': {
                          width: '8px',
                        },
                        '&::-webkit-scrollbar-track': {
                          background: 'transparent',
                        },
                        '&::-webkit-scrollbar-thumb': {
                          background: '#CBD5E0',
                          borderRadius: '4px',
                        },
                        '&::-webkit-scrollbar-thumb:hover': {
                          background: '#A0AEC0',
                        },
                      }}
                      onWheel={(e) => {
                        // Prevent event from bubbling up to modal
                        e.stopPropagation();
                      }}
                      onMouseEnter={(e) => {
                        // Focus the scroll container when mouse enters
                        e.currentTarget.focus();
                      }}
                    >
                      {(() => {
                        const filteredSongs = availableSongs.filter(song =>
                          song.title.toLowerCase().includes(songSearchQuery.toLowerCase()) ||
                          song.artist.toLowerCase().includes(songSearchQuery.toLowerCase())
                        )

                        if (filteredSongs.length === 0) {
                          return (
                            <Center py={8}>
                              <Text color={mutedTextColor}>No songs match your search</Text>
                            </Center>
                          )
                        }

                        return (
                          <div style={{ minHeight: 'fit-content' }}>
                            {filteredSongs.map((song) => (
                              <Box
                                key={song.id}
                                px={6}
                                py={4}
                                cursor="pointer"
                                _hover={{ bg: useColorModeValue('gray.50', 'gray.700') }}
                                borderBottom="1px"
                                borderColor={useColorModeValue('gray.200', 'gray.600')}
                                onClick={() => handleSongSelection(song.id)}
                                transition="background-color 0.2s"
                              >
                                <VStack align="start" spacing={1}>
                                  <Text fontWeight="600" color={titleColor}>
                                    {song.title}
                                  </Text>
                                  <Text fontSize="sm" color={mutedTextColor}>
                                    {song.artist}
                                  </Text>
        </VStack>
      </Box>
                            ))}
                          </div>
                        )
                      })()}
                    </Box>
                  </>
                )}
              </ModalBody>
            </ModalContent>
          </Modal>

          {/* Volunteer Selection Modal */}
          <Modal isOpen={volunteerSelectionModal.isOpen} onClose={volunteerSelectionModal.onClose} isCentered size="lg">
            <ModalOverlay />
            <ModalContent maxH="600px">
              <ModalHeader>Select a Volunteer</ModalHeader>
              <ModalCloseButton />
              <ModalBody p={0} display="flex" flexDirection="column" minH="0">
                {availableUsers.length === 0 ? (
                  <Center py={8}>
                    <Text color={mutedTextColor}>No volunteers available</Text>
                  </Center>
                ) : (
                  <>
                    {/* Search Field */}
                    <Box p={4} borderBottom="1px" borderColor={useColorModeValue('gray.200', 'gray.600')} flexShrink={0}>
                      <InputGroup>
                        <InputLeftElement pointerEvents="none">
                          <SearchIcon color={mutedTextColor} />
                        </InputLeftElement>
                        <Input
                          placeholder="Search volunteers..."
                          value={volunteerSearchQuery}
                          onChange={(e) => setVolunteerSearchQuery(e.target.value)}
                          size="md"
                        />
                      </InputGroup>
                    </Box>

                    {/* Scrollable List */}
                    <Box 
                      flex="1"
                      overflowY="auto"
                      minH="300px"
                      maxH="400px"
                      tabIndex={0}
                      css={{
                        '&': {
                          scrollBehavior: 'smooth',
                          outline: 'none',
                        },
                        '&::-webkit-scrollbar': {
                          width: '8px',
                        },
                        '&::-webkit-scrollbar-track': {
                          background: 'transparent',
                        },
                        '&::-webkit-scrollbar-thumb': {
                          background: '#CBD5E0',
                          borderRadius: '4px',
                        },
                        '&::-webkit-scrollbar-thumb:hover': {
                          background: '#A0AEC0',
                        },
                      }}
                      onWheel={(e) => {
                        // Prevent event from bubbling up to modal
                        e.stopPropagation();
                      }}
                      onMouseEnter={(e) => {
                        // Focus the scroll container when mouse enters
                        e.currentTarget.focus();
                      }}
                    >
                      {(() => {
                        const currentVolunteerUserIds = selectedServiceForVolunteer 
                          ? new Set((serviceIdToVolunteers[selectedServiceForVolunteer] || []).map(v => v.user_id))
                          : new Set()
                        
                        const filteredUsers = availableUsers
                          .filter(user => !currentVolunteerUserIds.has(user.id))
                          .filter(user => {
                            if (!volunteerSearchQuery.trim()) return true
                            const fullName = `${user.first_name} ${user.last_name}`.toLowerCase()
                            const email = user.email.toLowerCase()
                            const searchQuery = volunteerSearchQuery.toLowerCase()
                            return fullName.includes(searchQuery) || email.includes(searchQuery)
                          })

                        if (filteredUsers.length === 0) {
                          return (
                            <Center py={8}>
                              <Text color={mutedTextColor}>No volunteers match your search</Text>
                            </Center>
                          )
                        }

                        return (
                          <div style={{ minHeight: 'fit-content' }}>
                            {filteredUsers.map((user) => (
                              <Box
                                key={user.id}
                                px={6}
                                py={4}
                                cursor="pointer"
                                _hover={{ bg: useColorModeValue('gray.50', 'gray.700') }}
                                borderBottom="1px"
                                borderColor={useColorModeValue('gray.200', 'gray.600')}
                                onClick={() => handleVolunteerSelection(user.id)}
                                transition="background-color 0.2s"
                              >
                                <VStack align="start" spacing={1}>
                                  <Text fontWeight="600" color={titleColor}>
                                    {user.first_name} {user.last_name}
                                  </Text>
                                  <Text fontSize="sm" color={mutedTextColor}>
                                    {user.email}
                                  </Text>
                                </VStack>
                              </Box>
                            ))}
                          </div>
                        )
                      })()}
                    </Box>
                  </>
                )}
              </ModalBody>
            </ModalContent>
          </Modal>

          {/* Instrument Selection Modal */}
          <Modal 
            isOpen={instrumentSelectionModal.isOpen} 
            onClose={() => {
              // Process any pending changes immediately when closing via X or overlay
              if (selectedVolunteerForInstruments && pendingInstrumentChanges[selectedVolunteerForInstruments]) {
                if (debounceTimeoutRef.current) {
                  clearTimeout(debounceTimeoutRef.current)
                }
                processPendingInstrumentChanges(selectedVolunteerForInstruments)
              }
              instrumentSelectionModal.onClose()
            }} 
            isCentered 
            size="lg"
          >
            <ModalOverlay />
            <ModalContent maxH="600px">
              <ModalHeader>
                Select Instruments
                {selectedVolunteerForInstruments && (
                  <Text fontSize="sm" fontWeight="normal" color={mutedTextColor} mt={1}>
                    {(() => {
                      const volunteer = Object.values(serviceIdToVolunteers).flat()
                        .find(v => v.id === selectedVolunteerForInstruments)
                      return volunteer ? 
                        `${volunteer.profiles?.first_name} ${volunteer.profiles?.last_name}` : 
                        'Volunteer'
                    })()}
                  </Text>
                )}
              </ModalHeader>
              <ModalCloseButton />
              <ModalBody p={0} display="flex" flexDirection="column" minH="0">
                {instruments.length === 0 ? (
                  <Center py={8}>
                    <Text color={mutedTextColor}>No instruments available</Text>
                  </Center>
                ) : (
                  <Box 
                    flex="1"
                    overflowY="auto"
                    minH="300px"
                    maxH="400px"
                    tabIndex={0}
                    css={{
                      '&': {
                        scrollBehavior: 'smooth',
                        outline: 'none',
                      },
                      '&::-webkit-scrollbar': {
                        width: '8px',
                      },
                      '&::-webkit-scrollbar-track': {
                        background: 'transparent',
                      },
                      '&::-webkit-scrollbar-thumb': {
                        background: '#CBD5E0',
                        borderRadius: '4px',
                      },
                      '&::-webkit-scrollbar-thumb:hover': {
                        background: '#A0AEC0',
                      },
                    }}
                    onWheel={(e) => {
                      e.stopPropagation();
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.focus();
                    }}
                  >
                    <div style={{ minHeight: 'fit-content' }}>
                      {instruments.map((instrument) => {
                        const isSelected = selectedVolunteerForInstruments ? 
                          (volunteerToInstrumentIds[selectedVolunteerForInstruments] || []).includes(instrument.id) : 
                          false
                        
                        // Find which service this volunteer belongs to
                        const currentVolunteerService = Object.entries(serviceIdToVolunteers).find(([, volunteers]) =>
                          volunteers.some(v => v.id === selectedVolunteerForInstruments)
                        )
                        
                        // Check if instrument is already assigned to another volunteer in the SAME service
                        const isAssignedToOther = currentVolunteerService ? 
                          currentVolunteerService[1].some(volunteer => 
                            volunteer.id !== selectedVolunteerForInstruments && 
                            (volunteerToInstrumentIds[volunteer.id] || []).includes(instrument.id)
                          ) : false
                        
                        const isDisabled = isAssignedToOther
                        
                        return (
                          <Box
                            key={instrument.id}
                            px={6}
                            py={4}
                            cursor={isDisabled ? "not-allowed" : "pointer"}
                            bg={isSelected ? useColorModeValue('blue.50', 'blue.900') : 'transparent'}
                            _hover={!isDisabled ? { 
                              bg: isSelected ? useColorModeValue('blue.100', 'blue.800') : useColorModeValue('gray.50', 'gray.700') 
                            } : {}}
                            borderBottom="1px"
                            borderColor={useColorModeValue('gray.200', 'gray.600')}
                            onClick={() => !isDisabled && handleInstrumentToggle(instrument.id)}
                            transition="background-color 0.2s"
                            opacity={isDisabled ? 0.5 : 1}
                          >
                            <HStack justify="space-between" align="center">
                              <VStack align="start" spacing={1}>
                                <Text 
                                  fontWeight="600" 
                                  color={isDisabled ? mutedTextColor : titleColor}
                                >
                                  {instrument.name}
                                  {isDisabled && (
                                    <Text as="span" fontSize="xs" ml={2} color={mutedTextColor}>
                                      (Already assigned)
                                    </Text>
                                  )}
                                </Text>
                                {instrument.description && (
                                  <Text 
                                    fontSize="sm" 
                                    color={isDisabled ? mutedTextColor : mutedTextColor}
                                  >
                                    {instrument.description}
                                  </Text>
                                )}
                              </VStack>
                              <Box
                                w="28px"
                                h="28px"
                                borderRadius="full"
                                bg={isSelected ? "green.500" : "transparent"}
                                border={isSelected ? "none" : "2px"}
                                borderColor={isDisabled ? mutedTextColor : useColorModeValue('gray.300', 'gray.600')}
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                                flexShrink={0}
                                transition="all 0.2s"
                              >
                                {isSelected && (
                                  <CheckIcon color="white" w={4} h={4} />
                                )}
                              </Box>
                            </HStack>
                          </Box>
                        )
                      })}
                    </div>
                  </Box>
                )}
              </ModalBody>
              <ModalFooter>
                <HStack spacing={3}>
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      // Process any pending changes immediately when closing
                      if (selectedVolunteerForInstruments && pendingInstrumentChanges[selectedVolunteerForInstruments]) {
                        if (debounceTimeoutRef.current) {
                          clearTimeout(debounceTimeoutRef.current)
                        }
                        processPendingInstrumentChanges(selectedVolunteerForInstruments)
                      }
                      instrumentSelectionModal.onClose()
                    }}
                  >
                    Done
                  </Button>
                </HStack>
              </ModalFooter>
            </ModalContent>
          </Modal>
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
