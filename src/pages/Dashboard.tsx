import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
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
  useToast
} from '@chakra-ui/react'
import { CloseButton } from '@chakra-ui/react'
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons'
import { keyframes } from '@emotion/react'
import { supabase } from '../lib/supabase'
import { getUserPrimaryOrganization, ensureUserProfileAndMembership } from '../lib/auth'
import { DashboardHeader } from '../components'
import { useOrganizationAccess } from '../hooks/useOrganizationAccess'
import { useAuth } from '../contexts'

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
  service_date: string
  service_time?: string
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
  const [formDate, setFormDate] = useState('')
  const [formTime, setFormTime] = useState('')
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
  const [selectedSongByService, setSelectedSongByService] = useState<Record<string, string>>({})
  const [songNotesByService, setSongNotesByService] = useState<Record<string, string>>({})
  const [addingSongByService, setAddingSongByService] = useState<Record<string, boolean>>({})
  const [serviceErrorByService, setServiceErrorByService] = useState<Record<string, string>>({})
  const [serviceIdToVolunteers, setServiceIdToVolunteers] = useState<Record<string, Volunteer[]>>({})

  // Instruments and assignments
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loadingInstruments, setLoadingInstruments] = useState(false)
  const [volunteerToInstrumentIds, setVolunteerToInstrumentIds] = useState<Record<string, string[]>>({})
  const [selectedInstrumentByVolunteer, setSelectedInstrumentByVolunteer] = useState<Record<string, string>>({})
  const [savingAssignmentByVolunteer, setSavingAssignmentByVolunteer] = useState<Record<string, boolean>>({})

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
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
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

    if (!formTitle.trim() || !formDate) {
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
          service_date: formDate,
          service_time: formTime || null,
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
      setFormTime('')
      setFormDescription('')

      if (selectedDate) {
        setIsAddingServiceMode(false)
        await loadServices()
        await loadServicesForDate(selectedDate)
      } else {
        setFormDate('')
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
        .select('id, title, service_date, service_time, description, status, created_at, updated_at')
        .eq('organization_id', organization.organization_id)
        .eq('service_date', isoDate)

      if (error) {
        console.error('Error loading day services:', error)
        setDayServices([])
        return
      }

      const sorted = (data || []).sort((a: any, b: any) => {
        const ta = a.service_time ? a.service_time : '99:99'
        const tb = b.service_time ? b.service_time : '99:99'
        return ta.localeCompare(tb)
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

      // Combine the data and create the mapping
      const mapping: Record<string, Volunteer[]> = {}
      volunteerRecords.forEach((volunteer) => {
        const profile = profiles?.find(p => p.id === volunteer.user_id)
        const volunteerWithProfile = {
          ...volunteer,
          profiles: profile || { first_name: 'Unknown', last_name: 'User', email: 'N/A' }
        }
        
        const svcId = volunteer.worship_service_id
        if (!mapping[svcId]) mapping[svcId] = []
        mapping[svcId].push(volunteerWithProfile as Volunteer)
      })
      
      console.log('Volunteers mapping:', mapping)
      setServiceIdToVolunteers(mapping)

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

  useEffect(() => {
    if (createDrawer.isOpen) loadAvailableSongs()
  }, [createDrawer.isOpen, loadAvailableSongs])

  const loadRecentSongs = useCallback(async () => {
    if (!organization) return
    if (recentSongsLoaded) return
    try {
      setLoadingRecentSongs(true)
      setRecentSongsError('')

      // 1) Fetch all services for org (id -> service_date)
      const { data: servicesData, error: servicesErr } = await supabase
        .from('worship_services')
        .select('id, service_date')
        .eq('organization_id', organization.organization_id)

      if (servicesErr) {
        setRecentSongsError('Failed to load services for songs usage')
        setRecentSongs([])
        return
      }

      const serviceIdToDate = new Map<string, string>()
      const serviceIds: string[] = []
      ;(servicesData || []).forEach((s: any) => {
        serviceIdToDate.set(s.id as string, s.service_date as string)
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
        .select('id, service_date')
        .in('id', serviceIds)
        .eq('organization_id', organization.organization_id)

      if (servicesError) {
        console.error('Error loading service dates:', servicesError)
        setUserVolunteerDates([])
        return
      }

      // Extract the service dates
      const dates = (services || [])
        .map(service => service.service_date)
        .filter(date => date) as string[]

      setUserVolunteerDates(dates)

      // Ensure volunteer and instrument data is loaded for these upcoming services
      if (serviceIds.length) await loadVolunteersForServices(serviceIds)

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

  

  async function handleAddSongToService(serviceId: string) {
    if (!serviceId) return
    
    if (!canManagePrimary) {
      setServiceErrorByService(prev => ({ ...prev, [serviceId]: 'You do not have permission to add songs. Only admins and owners can add songs to services.' }))
      return
    }
    
    const selectedSongId = selectedSongByService[serviceId]
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
        .select('id, service_date')
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
              {authLoading ? 'Authenticating...' : 'Loading your dashboard...'}
            </Text>
          </VStack>
        </Center>
      </Box>
    )
  }

  return (
    <Box minH="100vh" bg={bgColor}>
      <DashboardHeader user={user} organization={organization} />

      <Box as="main" maxW="1200px" mx="auto" p={{ base: 6, md: 8 }}>
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
                    Upcoming
                  </Heading>
                  
                  {userVolunteerDates.length === 0 ? (
                    <Text color={mutedTextColor} textAlign="center" py={4}>
                      You haven't volunteered for any services yet
                    </Text>
                  ) : (
                    <VStack spacing={3} align="stretch">
                      {userVolunteerDates
                        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
                        .slice(0, 5) // Show only next 5 volunteer services
                        .map((date) => {
                          // Find the service for this date
                          const service = services.find(s => s.service_date === date)
                          if (!service) return null
                          
                          return (
                            <Box
                              key={service.id}
                              bg={useColorModeValue('green.50', 'green.900')}
                              borderRadius="lg"
                              border="1px"
                              borderColor="green.200"
                              p={4}
                              cursor="pointer"
                              _hover={{ 
                                borderColor: 'green.400',
                                transform: 'translateY(-1px)',
                                boxShadow: 'md'
                              }}
                              transition="all 0.2s"
                              onClick={() => {
                                setFormDate(service.service_date)
                                setSelectedDate(service.service_date)
                                loadServicesForDate(service.service_date)
                                setIsAddingServiceMode(false)
                                createDrawer.onOpen()
                              }}
                            >
                              <HStack justify="space-between" align="center">
                                <Box flex="1">
                                  <Text fontWeight="600" color={textColor} fontSize="md" mb={1}>
                                    {service.title}
                                  </Text>
                                  <HStack spacing={4} fontSize="sm" flexWrap="wrap" align="center">
                                    <Text color={mutedTextColor}>
                                      {new Date(service.service_date).toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                      })}
                                    </Text>
                                    {service.service_time && (
                                      <Text color={mutedTextColor}>
                                        {service.service_time}
                                      </Text>
                                      )}
                                    {(() => {
                                      const volunteers = serviceIdToVolunteers[service.id] || []
                                      const mine = volunteers.find(v => v.user_id === user?.id)
                                      if (!mine) return null
                                      const assignedIds = volunteerToInstrumentIds[mine.id] || []
                                      if (!assignedIds.length) return null
                                      const names = assignedIds
                                        .map(id => instruments.find(i => i.id === id)?.name)
                                        .filter((n): n is string => Boolean(n))
                                      if (!names.length) return null
                                      return (
                                        <HStack spacing={2}>
                                          {names.map(name => (
                                            <Badge key={`${mine.id}-${name}`} colorScheme="blue" variant="subtle">
                                              {name}
                                            </Badge>
                                          ))}
                                        </HStack>
                                      )
                                    })()}
                                  </HStack>
                                </Box>
                                
                                <Box
                                  w="8px"
                                  h="8px"
                                  borderRadius="full"
                                  bg="green.400"
                                  flexShrink={0}
                                />
                              </HStack>
                            </Box>
                          )
                        })
                        .filter(Boolean) // Remove any null entries
                    }
                    </VStack>
                  )}
                </Box>

                {/* Service Calendar Section */}
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
                    mb={3}
                    fontWeight="600"
                  >
                    Service Calendar
                  </Heading>

                <HStack justify="center" mb={4}>
                  <IconButton
                    aria-label="Previous month"
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
                    aria-label="Next month"
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
                    scheduledDates={[...new Set(services.map(s => s.service_date))]}
                    userVolunteerDates={userVolunteerDates}
                    onDateClick={(iso) => {
                      setFormDate(iso)
                      setSelectedDate(iso)
                      loadServicesForDate(iso)
                      setIsAddingServiceMode(false)
                      createDrawer.onOpen()
                    }}
                  />
                )}

                {canManagePrimary && (
                  <Button
                    colorScheme="blue"
                    size="md"
                    mt={4}
                    w="100%"
                    onClick={() => {
                      setSelectedDate('')
                      setDayServices([])
                      setFormDate('')
                      setIsAddingServiceMode(true)
                      createDrawer.onOpen()
                    }}
                  >
                    Add New Service
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
                  Volunteer Link
                </Heading>
                
                <Text color={subtitleColor} fontSize="sm" mb={4}>
                  Share this link with potential volunteers to let them sign up for services
                </Text>

                <VStack spacing={3} align="stretch">
                  <Button
                    size="md"
                    colorScheme="green"
                    variant="outline"
                    onClick={copyVolunteerLink}
                    isLoading={loadingVolunteerLink || copyingLink}
                    loadingText={loadingVolunteerLink ? "Loading..." : "Copying..."}
                    isDisabled={loadingVolunteerLink}
                    w="100%"
                  >
                    {loadingVolunteerLink 
                      ? "Loading..." 
                      : volunteerLink 
                        ? "Copy volunteer link" 
                        : "Create volunteer link"
                    }
                  </Button>

                  {volunteerLink && (
                    <Button
                      size="md"
                      colorScheme="blue"
                      variant="outline"
                      onClick={() => navigate(`/volunteer/${volunteerLink}`)}
                      w="100%"
                    >
                      Visit Volunteer Page
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
              >
                <Heading
                    as="h3"
                    size="lg"
                    color={titleColor}
                    mb={5}
                    fontWeight="600"
                  >
                    Songs
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
                    <Text color={mutedTextColor}>No song usage yet</Text>
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
                    mt={5}
                    w="100%"
                    colorScheme="blue"
                    position="relative"
                    overflow="hidden"
                    _before={{
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: '-100%',
                      width: '100%',
                      height: '100%',
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                      animation: 'shimmer 4s infinite'
                    }}
                    sx={{
                      '@keyframes shimmer': {
                        '0%': { left: '-100%' },
                        '50%': { left: '100%' },
                        '100%': { left: '100%' }
                      }
                    }}
                    onClick={addSongDrawer.onOpen}
                  >
                    Add song
                  </Button>
                )}

                <Button mt={3} w="100%" variant="outline" colorScheme="blue" onClick={() => navigate('/songbank')}>
                  Manage songs
                </Button>
              </Box>
            </VStack>
            </GridItem>
          </Grid>

          {/* Create Service Drawer */}
          <Drawer isOpen={createDrawer.isOpen} placement="right" onClose={createDrawer.onClose} size="lg">
            <DrawerOverlay />
            <DrawerContent>
              <DrawerCloseButton />
              <DrawerHeader>
                {selectedDate && dayServices.length > 0
                  ? `${new Date(selectedDate).toLocaleDateString('en-US', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                    })} - Services`
                  : 'Schedule New Service'}
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
                              borderColor={cardBorderColor}
                              mb={3}
                              ref={idx === 0 ? firstServiceRef : undefined}
                            >
                              <h2>
                                <AccordionButton>
                                  <Box as="span" flex='1' textAlign='left'>
                                    <Text m={0} fontWeight="600" fontSize="lg">
                                      {(svc.service_time ? svc.service_time : 'All day') + ' - ' + svc.title}
                  </Text>
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
                                      <HStack>
                                        <Badge colorScheme={svc.status === 'published' ? 'green' : svc.status === 'completed' ? 'blue' : 'yellow'}>
                                          {svc.status}
                                        </Badge>
                                        <Button size="sm" variant="outline" onClick={() => navigate(`/service/${svc.id}`)}>
                                          Open Full Page
                                        </Button>
                                      </HStack>
                                    </VStack>
                                  </Box>

                                  <Box>
                                    <Text fontWeight="700" mb={2} fontSize="md">Songs</Text>
                                    {(serviceIdToSongs[svc.id] || []).length === 0 ? (
                                      <Text color={mutedTextColor}>No songs added yet</Text>
                                    ) : (
                                      <VStack spacing={2} align="stretch">
                                        {(serviceIdToSongs[svc.id] || []).map(songRow => (
                                          <Box
                                            key={songRow.id}
                                            border="1px"
                                            borderColor={cardBorderColor}
                                            borderRadius="lg"
                                            p={4}
                                          >
                                            <Text fontWeight="600" fontSize="md">{songRow.songs.title} - {songRow.songs.artist}</Text>
                                            {songRow.notes && (
                                              <Text color={mutedTextColor} fontSize="sm">{songRow.notes}</Text>
                                            )}
                                          </Box>
                                        ))}
                                      </VStack>
                                    )}
                                  </Box>

                                  <Box>
                                    <Text fontWeight="700" mb={2} fontSize="md">Volunteers</Text>
                                    {(serviceIdToVolunteers[svc.id] || []).length === 0 ? (
                                      <Text color={mutedTextColor}>No volunteers yet</Text>
                                    ) : (
                                      <VStack spacing={2} align="stretch">
                                        {(serviceIdToVolunteers[svc.id] || []).map(volunteer => (
                                          <Box
                                            key={volunteer.id}
                                            border="1px"
                                            borderColor={cardBorderColor}
                                            borderRadius="lg"
                                            p={3}
                                          >
                                            <VStack align="stretch" spacing={1}>
                                              <HStack spacing={2} align="center">
                                                <Text fontWeight="600" fontSize="sm" m={0}>
                                                  {volunteer.profiles.first_name} {volunteer.profiles.last_name}
                                                </Text>
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
                                              <Text color={mutedTextColor} fontSize="xs" m={0}>
                                                {volunteer.profiles.email}
                                              </Text>
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
                                                  {(() => {
                                                    const assigned = new Set<string>(Object.values(volunteerToInstrumentIds).flat())
                                                    return instruments
                                                      .filter(inst => !assigned.has(inst.id))
                                                      .map(inst => (
                                                        <option key={inst.id} value={inst.id}>{inst.name}</option>
                                                      ))
                                                  })()}
                                                </Select>
                                              </HStack>
                                            </VStack>
                                          </Box>
                                        ))}
                                      </VStack>
                                    )}
                                  </Box>

                                  {canManagePrimary && (
                                    <Box>
                                      <Text fontWeight="700" mb={2} fontSize="md">Add Song</Text>
                                      {serviceErrorByService[svc.id] && (
                                        <Alert status="error" borderRadius="md" mb={3}>
                                          <AlertIcon />
                                          {serviceErrorByService[svc.id]}
                                        </Alert>
                                      )}
                                      <VStack spacing={3} align="stretch">
                                        <Select
                                          placeholder="Choose a song..."
                                          value={selectedSongByService[svc.id] || ''}
                                          onChange={(e) => setSelectedSongByService(prev => ({ ...prev, [svc.id]: e.target.value }))}
                                          size="md"
                                        >
                                          {availableSongs.map(song => (
                                            <option key={song.id} value={song.id}>
                                              {song.title} - {song.artist}
                                            </option>
                                          ))}
                                        </Select>
                                        <Input
                                          type="text"
                                          placeholder="Notes (optional)"
                                          size="md"
                                          value={songNotesByService[svc.id] || ''}
                                          onChange={(e) => setSongNotesByService(prev => ({ ...prev, [svc.id]: e.target.value }))}
                                        />
                                        <Button
                                          size="md"
                                          colorScheme="blue"
                                          onClick={() => handleAddSongToService(svc.id)}
                                          isLoading={!!addingSongByService[svc.id]}
                                          loadingText="Adding..."
                                          isDisabled={!availableSongs.length}
                                        >
                                          Add Song
                                        </Button>
                                      </VStack>
                                    </Box>
                                  )}
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
                              borderColor={cardBorderColor}
                              mb={3}
                              ref={idx === 0 ? firstServiceRef : undefined}
                            >
                              <h2>
                                <AccordionButton>
                                  <Box as="span" flex='1' textAlign='left'>
                                    <Text m={0} fontWeight="600" fontSize="lg">
                                      {(svc.service_time ? svc.service_time : 'All day') + ' - ' + svc.title}
                  </Text>
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
                                      <HStack>
                                        <Badge colorScheme={svc.status === 'published' ? 'green' : svc.status === 'completed' ? 'blue' : 'yellow'}>
                                          {svc.status}
                                        </Badge>
                                        <Button size="sm" variant="outline" onClick={() => navigate(`/service/${svc.id}`)}>
                                          Open Full Page
                                        </Button>
              </HStack>
            </VStack>
          </Box>

                                  <Box>
                                    <Text fontWeight="700" mb={2} fontSize="md">Songs</Text>
                                    {(serviceIdToSongs[svc.id] || []).length === 0 ? (
                                      <Text color={mutedTextColor}>No songs added yet</Text>
                                    ) : (
                                      <VStack spacing={2} align="stretch">
                                        {(serviceIdToSongs[svc.id] || []).map(songRow => (
                                          <Box
                                            key={songRow.id}
                                            border="1px"
                                            borderColor={cardBorderColor}
                                            borderRadius="lg"
                                            p={4}
                                          >
                                            <Text fontWeight="600" fontSize="md">{songRow.songs.title} - {songRow.songs.artist}</Text>
                                            {songRow.notes && (
                                              <Text color={mutedTextColor} fontSize="sm">{songRow.notes}</Text>
                                            )}
                                          </Box>
                                        ))}
                                      </VStack>
                                    )}
                                  </Box>

                                  <Box>
                                    <Text fontWeight="700" mb={2} fontSize="md">Volunteers</Text>
                                    {(serviceIdToVolunteers[svc.id] || []).length === 0 ? (
                                      <Text color={mutedTextColor}>No volunteers yet</Text>
                                    ) : (
                                      <VStack spacing={2} align="stretch">
                                        {(serviceIdToVolunteers[svc.id] || []).map(volunteer => (
                                          <Box
                                            key={volunteer.id}
                                            border="1px"
                                            borderColor={cardBorderColor}
                                            borderRadius="lg"
                                            p={3}
                                          >
                                            <VStack align="stretch" spacing={1}>
                                              <HStack spacing={2} align="center">
                                                <Text fontWeight="600" fontSize="sm" m={0}>
                                                  {volunteer.profiles.first_name} {volunteer.profiles.last_name}
                                                </Text>
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
                                              <Text color={mutedTextColor} fontSize="xs" m={0}>
                                                {volunteer.profiles.email}
                                              </Text>
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
                                      </VStack>
                                    )}
                                  </Box>

                                  {canManagePrimary && (
                                    <Box>
                                      <Text fontWeight="700" mb={2} fontSize="md">Add Song</Text>
                                      {serviceErrorByService[svc.id] && (
                                        <Alert status="error" borderRadius="md" mb={3}>
                                          <AlertIcon />
                                          {serviceErrorByService[svc.id]}
                                        </Alert>
                                      )}
                                      <VStack spacing={3} align="stretch">
                                        <Select
                                          placeholder="Choose a song..."
                                          value={selectedSongByService[svc.id] || ''}
                                          onChange={(e) => setSelectedSongByService(prev => ({ ...prev, [svc.id]: e.target.value }))}
                                          size="md"
                                        >
                                          {availableSongs.map(song => (
                                            <option key={song.id} value={song.id}>
                                              {song.title} - {song.artist}
                                            </option>
                                          ))}
                                        </Select>
                                        <Input
                                          type="text"
                                          placeholder="Notes (optional)"
                                          size="md"
                                          value={songNotesByService[svc.id] || ''}
                                          onChange={(e) => setSongNotesByService(prev => ({ ...prev, [svc.id]: e.target.value }))}
                                        />
                                        <Button
                                          size="md"
                                          colorScheme="blue"
                                          onClick={() => handleAddSongToService(svc.id)}
                                          isLoading={!!addingSongByService[svc.id]}
                                          loadingText="Adding..."
                                          isDisabled={!availableSongs.length}
                                        >
                                          Add Song
                                        </Button>
                                      </VStack>
                                    </Box>
                                  )}
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
                        <FormLabel fontSize="sm">Service Date *</FormLabel>
                        <Input
                          type="date"
                          value={formDate}
                          onChange={(e) => setFormDate(e.target.value)}
                          size="md"
                        />
                      </FormControl>

                      <FormControl>
                        <FormLabel fontSize="sm">Service Time</FormLabel>
                        <Input
                          type="time"
                          value={formTime}
                          onChange={(e) => setFormTime(e.target.value)}
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
                      <Button variant="outline" onClick={() => setIsAddingServiceMode(true)}>
                        Add Service
                      </Button>
                    )}
                    <Button colorScheme="blue" onClick={createDrawer.onClose}>
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
            <DrawerContent>
              <DrawerCloseButton />
              <DrawerHeader>Add New Song</DrawerHeader>
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

  const firstOfMonth = new Date(year, month, 1)
  const startWeekday = firstOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const headerColor = useColorModeValue('gray.600', 'gray.300')
  const cellTextColor = useColorModeValue('gray.700', 'gray.200')
  const cellBorderColor = useColorModeValue('gray.200', 'gray.600')
  const eventBg = useColorModeValue('blue.50', 'rgba(66, 153, 225, 0.16)')

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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

          return (
            <Box
              key={iso}
              h="70px"
              border="1px"
              borderColor={cellBorderColor}
              borderRadius="md"
              p={2}
              bg={hasEvent ? eventBg : 'transparent'}
              position="relative"
              onClick={() => onDateClick && onDateClick(iso)}
              cursor="pointer"
              _hover={{ borderColor: 'blue.300' }}
            >
              <Text fontSize="sm" color={cellTextColor} fontWeight="500" m={0}>
                {day}
              </Text>

              {hasVolunteered && (
                <Box position="absolute" top="6px" right="6px">
                  <Box
                    w="12px"
                    h="12px"
                    borderRadius="full"
                    bg="green.400"
                    animation={`${pulse} 1.2s ease-in-out infinite, ${ringPulse} 1.2s ease-out infinite`}
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