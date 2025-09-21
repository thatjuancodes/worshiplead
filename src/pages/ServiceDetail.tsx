import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCurrentUser, getUserPrimaryOrganization } from '../lib/auth'
import { DashboardHeader } from '../components'
import { useOrganizationAccess } from '../hooks/useOrganizationAccess'
import { formatServiceDate, getServiceTimeDisplay } from '../utils/dateTime'
import { 
  Box, 
  VStack, 
  HStack, 
  Heading, 
  Text, 
  Button, 
  Spinner, 
  useColorModeValue,
  FormControl,
  FormLabel,
  Input,
  Select,
  Flex,
  Center,
  Grid,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useDisclosure,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  useToast,
  IconButton,
  Tooltip
} from '@chakra-ui/react'
import { CloseIcon } from '@chakra-ui/icons'
import type { User } from '@supabase/supabase-js'
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
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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

interface Instrument {
  id: string
  organization_id: string
  name: string
  description?: string | null
  created_at?: string
  updated_at?: string
}

// Sortable Song Item Component
function SortableSongItem({ 
  serviceSong, 
  onRemove,
  isRemoving,
  canManage
}: { 
  serviceSong: ServiceSong
  onRemove: (id: string) => void 
  isRemoving: boolean
  canManage: boolean
}) {
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
    opacity: isDragging ? 0.5 : 1,
  }

  const cardBg = useColorModeValue('gray.50', 'gray.700')
  const cardBorderColor = useColorModeValue('gray.200', 'gray.600')
  const hoverBg = useColorModeValue('gray.100', 'gray.600')
  const textColor = useColorModeValue('gray.800', 'white')
  const textSecondaryColor = useColorModeValue('gray.600', 'gray.300')

  return (
    <Box 
      ref={setNodeRef} 
      style={style} 
      bg={cardBg}
      border="1px"
      borderColor={cardBorderColor}
      borderRadius="md"
      p={4}
      display="flex"
      alignItems="center"
      gap={4}
      transition="all 0.2s ease"
      _hover={{
        bg: hoverBg,
        borderColor: useColorModeValue('gray.300', 'gray.500'),
        transform: 'translateY(-1px)',
        boxShadow: 'md'
      }}
      cursor={canManage ? "grab" : "default"}
      userSelect="none"
      {...attributes}
    >
      {/* Position Badge */}
      <Box
        bg="blue.500"
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
        cursor={canManage ? "grab" : "default"}
        _active={{ cursor: canManage ? "grabbing" : "default" }}
        {...(canManage ? listeners : {})}
      >
        {serviceSong.position}
      </Box>

      {/* Song Info */}
      <Box flex="1" minW="0" cursor={canManage ? "grab" : "default"} {...(canManage ? listeners : {})}>
        <Text fontWeight="600" color={textColor} fontSize="md" mb={1}>
          {serviceSong.songs.title} - {serviceSong.songs.artist}
        </Text>
        {serviceSong.notes && (
          <Text color={textSecondaryColor} fontSize="sm" fontStyle="italic" mb={1}>
            {serviceSong.notes}
          </Text>
        )}
        {serviceSong.songs.key && (
          <Badge
            colorScheme="gray"
            variant="subtle"
            fontSize="xs"
            px={2}
            py={1}
          >
            Key: {serviceSong.songs.key}
          </Badge>
        )}
      </Box>

      {/* Actions */}
      <Box flexShrink={0}>
        {canManage && (
          <Tooltip label="Remove Song">
            <IconButton
              aria-label="Remove Song"
              icon={isRemoving ? <Spinner size="sm" /> : <CloseIcon />}
              colorScheme="red"
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onRemove(serviceSong.id)
              }}
              isLoading={isRemoving}
              disabled={isRemoving}
            />
          </Tooltip>
        )}
      </Box>
    </Box>
  )
}

export function ServiceDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const toast = useToast()
  const { canManagePrimary } = useOrganizationAccess()
  const [loading, setLoading] = useState(true)
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [service, setService] = useState<WorshipService | null>(null)
  const [serviceSongs, setServiceSongs] = useState<ServiceSong[]>([])
  const [availableSongs, setAvailableSongs] = useState<Song[]>([])
  const [volunteers, setVolunteers] = useState<Volunteer[]>([])
  const [instruments, setInstruments] = useState<Instrument[]>([])
  
  // Add song drawer state
  const { isOpen: isAddSongDrawerOpen, onOpen: onAddSongDrawerOpen, onClose: onAddSongDrawerClose } = useDisclosure()
  const [selectedSongId, setSelectedSongId] = useState('')
  const [songNotes, setSongNotes] = useState('')
  const [addingSong, setAddingSong] = useState(false)
  const [removingSong, setRemovingSong] = useState<string | null>(null)
  
  // Volunteer management
  const [volunteerToInstrumentIds, setVolunteerToInstrumentIds] = useState<Record<string, string[]>>({})

  // Color mode values
  const bgColor = useColorModeValue('gray.50', 'gray.900')
  const cardBg = useColorModeValue('white', 'gray.800')
  const cardBorderColor = useColorModeValue('gray.200', 'gray.600')
  const textColor = useColorModeValue('gray.800', 'white')
  const textSecondaryColor = useColorModeValue('gray.600', 'gray.300')
  const mutedTextColor = useColorModeValue('gray.500', 'gray.400')
  const titleColor = useColorModeValue('gray.800', 'white')

  const checkUserAndOrganization = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        navigate('/login')
        return
      }
      setUser(currentUser)

      const userOrg = await getUserPrimaryOrganization(currentUser.id)
      if (!userOrg) {
        navigate('/organization-setup')
        return
      }
      setOrganization(userOrg)
    } catch (error) {
      console.error('Error checking user and organization:', error)
      navigate('/login')
    }
  }, [navigate])

  const loadService = useCallback(async () => {
    if (!id || !organization) return

    try {
      const { data, error } = await supabase
        .from('worship_services')
        .select('*')
        .eq('id', id)
        .eq('organization_id', organization.organization_id)
        .single()

      if (error) {
        console.error('Error loading service:', error)
        if (error.code === 'PGRST116') {
          toast({
            title: 'Error',
            description: 'Service not found or you do not have access to it.',
            status: 'error',
            duration: 5000,
            isClosable: true,
          })
        } else {
          toast({
            title: 'Error',
            description: 'Failed to load service details.',
            status: 'error',
            duration: 5000,
            isClosable: true,
          })
        }
        return
      }

      setService(data)
    } catch (error) {
      console.error('Error loading service:', error)
      toast({
        title: 'Error',
        description: 'Failed to load service details.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setLoading(false)
    }
  }, [id, organization, toast])

  useEffect(() => {
    checkUserAndOrganization()
  }, [checkUserAndOrganization])

  useEffect(() => {
    if (organization) {
      loadService()
    }
  }, [organization, loadService])

  const loadServiceSongs = useCallback(async () => {
    if (!service) return

    try {
      const { data, error } = await supabase
        .from('service_songs')
        .select(`
          *,
          songs (
            id,
            title,
            artist,
            key,
            bpm,
            ccli_number,
            tags
          )
        `)
        .eq('service_id', service.id)
        .order('position', { ascending: true })

      if (error) {
        console.error('Error loading service songs:', error)
        return
      }

      setServiceSongs(data || [])
    } catch (error) {
      console.error('Error loading service songs:', error)
    }
  }, [service])

  const loadAvailableSongs = useCallback(async () => {
    if (!organization) return

    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('organization_id', organization.organization_id)
        .order('title', { ascending: true })

      if (error) {
        console.error('Error loading available songs:', error)
        return
      }

      setAvailableSongs(data || [])
    } catch (error) {
      console.error('Error loading available songs:', error)
    }
  }, [organization])

  const loadVolunteers = useCallback(async () => {
    if (!service) return

    try {
      const { data: volunteerRecords, error: volunteerError } = await supabase
        .from('worship_service_volunteers')
        .select('*')
        .eq('worship_service_id', service.id)
        .order('created_at', { ascending: true })

      if (volunteerError) {
        console.error('Error loading volunteer records:', volunteerError)
        return
      }

      if (!volunteerRecords || volunteerRecords.length === 0) {
        setVolunteers([])
        return
      }

      const userIds = volunteerRecords.map(v => v.user_id)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', userIds)

      if (profilesError) {
        console.error('Error loading profiles:', profilesError)
        return
      }

      const volunteersWithProfiles = volunteerRecords.map(volunteer => {
        const profile = profiles?.find(p => p.id === volunteer.user_id)
        return {
          ...volunteer,
          profiles: profile || { first_name: 'Unknown', last_name: 'User', email: 'N/A' }
        }
      })

      setVolunteers(volunteersWithProfiles)
      const volunteerIds = volunteerRecords.map(v => v.id as string)
      if (volunteerIds.length) await loadVolunteerInstruments(volunteerIds)
    } catch (error) {
      console.error('Error loading volunteers:', error)
    }
  }, [service])

  const loadOrganizationInstruments = useCallback(async () => {
    if (!organization) return
    try {
      const { data, error } = await supabase
        .from('instruments')
        .select('*')
        .eq('organization_id', organization.organization_id)
        .order('name', { ascending: true })

      if (error) {
        console.error('Error loading instruments:', error)
        return
      }
      setInstruments(data || [])
    } catch (err) {
      console.error('Unexpected error loading instruments:', err)
    }
  }, [organization])

  const loadVolunteerInstruments = useCallback(async (volunteerIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('volunteer_instruments')
        .select('volunteer_id, instrument_id')
        .in('volunteer_id', volunteerIds)

      if (error) {
        console.error('Error loading volunteer instruments:', error)
        return
      }

      const mapping: Record<string, string[]> = {}
      ;(data || []).forEach((row: any) => {
        const vId = row.volunteer_id as string
        const iId = row.instrument_id as string
        if (!mapping[vId]) mapping[vId] = []
        mapping[vId].push(iId)
      })
      setVolunteerToInstrumentIds(mapping)
    } catch (err) {
      console.error('Unexpected error loading volunteer instruments:', err)
    }
  }, [])

  const handleAddSong = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!service || !selectedSongId) {
      toast({
        title: 'Error',
        description: 'Please select a song to add.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    if (!canManagePrimary) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to add songs to services. Only admins and owners can manage service songs.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    try {
      setAddingSong(true)
      const nextPosition = serviceSongs.length + 1

      const { error } = await supabase
        .from('service_songs')
        .insert({
          service_id: service.id,
          song_id: selectedSongId,
          position: nextPosition,
          notes: songNotes.trim() || null
        })

      if (error) {
        console.error('Error adding song to service:', error)
        toast({
          title: 'Error',
          description: 'Failed to add song to service. Please try again.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
        return
      }

      setSelectedSongId('')
      setSongNotes('')
      onAddSongDrawerClose()
      await loadServiceSongs()
      
      toast({
        title: 'Success',
        description: 'Song added to service successfully!',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch (error) {
      console.error('Error adding song to service:', error)
      toast({
        title: 'Error',
        description: 'Failed to add song to service. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setAddingSong(false)
    }
  }

  const handleRemoveSong = async (serviceSongId: string) => {
    if (!canManagePrimary) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to remove songs from services. Only admins and owners can manage service songs.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    if (!confirm('Are you sure you want to remove this song from the service?')) return

    try {
      setRemovingSong(serviceSongId)
      
      const { error } = await supabase
        .from('service_songs')
        .delete()
        .eq('id', serviceSongId)

      if (error) {
        console.error('Error removing song from service:', error)
        toast({
          title: 'Error',
          description: 'Failed to remove song from service. Please try again.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
        return
      }

      await loadServiceSongs()
      toast({
        title: 'Success',
        description: 'Song removed from service successfully!',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch (error) {
      console.error('Error removing song from service:', error)
      toast({
        title: 'Error',
        description: 'Failed to remove song from service. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setRemovingSong(null)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!canManagePrimary) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to reorder songs. Only admins and owners can manage service songs.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = serviceSongs.findIndex(song => song.id === active.id)
      const newIndex = serviceSongs.findIndex(song => song.id === over?.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const originalSongs = [...serviceSongs]
        const newSongs = arrayMove(serviceSongs, oldIndex, newIndex).map((song, index) => ({
          ...song,
          position: index + 1
        }))
        setServiceSongs(newSongs)

        try {
          for (let i = 0; i < newSongs.length; i++) {
            const song = newSongs[i]
            const tempPosition = -(i + 1)
            
            const { error } = await supabase
              .from('service_songs')
              .update({ position: tempPosition })
              .eq('id', song.id)

            if (error) {
              console.error('Error setting temporary position:', error)
              setServiceSongs(originalSongs)
              toast({
                title: 'Error',
                description: 'Failed to save new song order.',
                status: 'error',
                duration: 3000,
                isClosable: true,
              })
              return
            }
          }

          for (let i = 0; i < newSongs.length; i++) {
            const song = newSongs[i]
            const finalPosition = i + 1
            
            const { error } = await supabase
              .from('service_songs')
              .update({ position: finalPosition })
              .eq('id', song.id)

            if (error) {
              console.error('Error setting final position:', error)
              setServiceSongs(originalSongs)
              toast({
                title: 'Error',
                description: 'Failed to save new song order.',
                status: 'error',
                duration: 3000,
                isClosable: true,
              })
              return
            }
          }

          toast({
            title: 'Success',
            description: 'Song order updated successfully!',
            status: 'success',
            duration: 3000,
            isClosable: true,
          })
        } catch (error) {
          console.error('Error updating song positions:', error)
          setServiceSongs(originalSongs)
          toast({
            title: 'Error',
            description: 'Failed to save new song order.',
            status: 'error',
            duration: 3000,
            isClosable: true,
          })
        }
      }
    }
  }

  useEffect(() => {
    if (service) {
      loadServiceSongs()
      loadAvailableSongs()
      loadVolunteers()
      loadOrganizationInstruments()
    }
  }, [service, loadServiceSongs, loadAvailableSongs, loadVolunteers, loadOrganizationInstruments])

  const getStatusBadge = (status: string) => {
    const statusColorScheme = {
      draft: 'yellow',
      published: 'green',
      completed: 'blue'
    }
    return statusColorScheme[status as keyof typeof statusColorScheme] || 'yellow'
  }

  if (loading) {
    return (
      <Box minH="100vh" bg={bgColor}>
        <DashboardHeader user={user} organization={organization} />
        <Box as="main" maxW="1200px" mx="auto" p={{ base: 6, md: 8 }}>
          <Center h="50vh">
            <VStack spacing={4}>
              <Spinner size="xl" color="blue.500" />
              <Text color={textColor}>Loading service details...</Text>
            </VStack>
          </Center>
        </Box>
      </Box>
    )
  }

  if (!service) {
    return (
      <Box minH="100vh" bg={bgColor}>
        <DashboardHeader user={user} organization={organization} />
        <Box as="main" maxW="1200px" mx="auto" p={{ base: 6, md: 8 }}>
          <Center h="50vh">
            <VStack spacing={4}>
              <Text color={textColor}>Service not found</Text>
              <Button
                colorScheme="blue"
                onClick={() => navigate('/schedule')}
                size="md"
              >
                Back to Services
              </Button>
            </VStack>
          </Center>
        </Box>
      </Box>
    )
  }

  return (
    <Box minH="100vh" bg={bgColor}>
      <DashboardHeader user={user} organization={organization} />

      <Box as="main" maxW="1200px" mx="auto" p={{ base: 6, md: 8 }}>
        {/* Back Button */}
        <Box mb={4}>
          <Button
            variant="ghost"
            colorScheme="gray"
            onClick={() => navigate('/schedule')}
            leftIcon={<Text>←</Text>}
            size="sm"
          >
            Back to Services
          </Button>
        </Box>

        {/* Header Section */}
        <Box
          bg={cardBg}
          p={6}
          borderRadius="lg"
          boxShadow="sm"
          border="1px"
          borderColor={cardBorderColor}
          mb={6}
        >
          <Flex 
            justify="space-between" 
            align="center" 
            mb={6}
            direction={{ base: 'column', sm: 'row' }}
            gap={{ base: 3, sm: 0 }}
          >
            <Heading as="h3" size="lg" color={titleColor}>
              {service.title}
            </Heading>
            <Badge
              colorScheme={getStatusBadge(service.status)}
              variant="subtle"
              textTransform="capitalize"
              fontSize="sm"
              px={3}
              py={1}
            >
              {service.status}
            </Badge>
          </Flex>

          <Grid 
            templateColumns={{ base: '1fr', md: 'repeat(auto-fit, minmax(200px, 1fr))' }} 
            gap={5} 
            mb={6}
          >
            <Box>
              <Text fontSize="xs" fontWeight="500" color={mutedTextColor} textTransform="uppercase" letterSpacing="0.05em" mb={1}>
                Service Date
              </Text>
              <Text fontSize="md" fontWeight="500" color={textColor}>
                {formatServiceDate(service.service_time)}
              </Text>
            </Box>

            <Box>
              <Text fontSize="xs" fontWeight="500" color={mutedTextColor} textTransform="uppercase" letterSpacing="0.05em" mb={1}>
                Service Time
              </Text>
              <Text fontSize="md" fontWeight="500" color={textColor}>
                {getServiceTimeDisplay(service.service_time)}
              </Text>
            </Box>

            <Box>
              <Text fontSize="xs" fontWeight="500" color={mutedTextColor} textTransform="uppercase" letterSpacing="0.05em" mb={1}>
                Created
              </Text>
              <Text fontSize="md" fontWeight="500" color={textColor}>
                {new Date(service.created_at).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </Text>
            </Box>
          </Grid>

          {service.description && (
            <Box borderTop="1px" borderColor={cardBorderColor} pt={5}>
              <Text fontSize="xs" fontWeight="500" color={mutedTextColor} textTransform="uppercase" letterSpacing="0.05em" mb={2}>
                Description
              </Text>
              <Text color={textSecondaryColor} lineHeight="1.6">
                {service.description}
              </Text>
            </Box>
          )}
        </Box>

        {/* Service Songs Section */}
        <Box
          bg={cardBg}
          borderRadius="lg"
          boxShadow="sm"
          border="1px"
          borderColor={cardBorderColor}
          p={6}
          mb={6}
        >
          <Flex 
            justify="space-between" 
            align="center" 
            mb={5}
            direction={{ base: 'column', sm: 'row' }}
            gap={{ base: 3, sm: 0 }}
          >
            <Heading as="h3" size="md" color={titleColor}>
              Service Songs ({serviceSongs.length})
            </Heading>
            {canManagePrimary && (
              <Button 
                colorScheme="green"
                size="sm"
                onClick={onAddSongDrawerOpen}
              >
                + Add Songs
              </Button>
            )}
          </Flex>
          
          {serviceSongs.length === 0 ? (
            <Box textAlign="center" py={10}>
              <Text fontSize="lg" fontWeight="500" color={mutedTextColor} mb={2}>
                No songs added to this service yet
              </Text>
              <Text color={mutedTextColor}>
                {canManagePrimary 
                  ? 'Add songs from your songbank to create a setlist'
                  : 'No songs have been added to this service yet.'
                }
              </Text>
            </Box>
          ) : (
            <Box>
              {canManagePrimary && (
                <Text fontSize="xs" color={mutedTextColor} fontStyle="italic" mb={3}>
                  Drag to reorder songs
                </Text>
              )}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={serviceSongs.map(song => song.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <VStack spacing={3} align="stretch">
                    {serviceSongs.map((serviceSong) => (
                      <SortableSongItem
                        key={serviceSong.id}
                        serviceSong={serviceSong}
                        onRemove={handleRemoveSong}
                        isRemoving={removingSong === serviceSong.id}
                        canManage={canManagePrimary}
                      />
                    ))}
                  </VStack>
                </SortableContext>
              </DndContext>
            </Box>
          )}
        </Box>

        {/* Volunteers Section */}
        <Box
          bg={cardBg}
          borderRadius="lg"
          boxShadow="sm"
          border="1px"
          borderColor={cardBorderColor}
          p={6}
        >
          <Heading as="h3" size="md" color={titleColor} mb={5}>
            Volunteers ({volunteers.length})
          </Heading>
          
          {volunteers.length === 0 ? (
            <Box textAlign="center" py={10}>
              <Text fontSize="lg" fontWeight="500" color={mutedTextColor} mb={2}>
                No volunteers yet
              </Text>
              <Text color={mutedTextColor}>
                Share the volunteer link to get people to sign up for this service
              </Text>
            </Box>
          ) : (
            <Box
              overflowX="auto"
            >
              <Table variant="simple" minW="600px">
                <Thead>
                  <Tr>
                    <Th color={textColor} fontSize="sm" fontWeight="600">Name</Th>
                    <Th color={textColor} fontSize="sm" fontWeight="600">Email</Th>
                    <Th color={textColor} fontSize="sm" fontWeight="600">Instruments</Th>
                    <Th color={textColor} fontSize="sm" fontWeight="600">Joined</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {volunteers.map((volunteer) => (
                    <Tr key={volunteer.id}>
                      <Td fontWeight="500" color={titleColor}>
                        {volunteer.profiles.first_name} {volunteer.profiles.last_name}
                      </Td>
                      <Td>{volunteer.profiles.email}</Td>
                      <Td>
                        <HStack spacing={1} flexWrap="wrap">
                          {(volunteerToInstrumentIds[volunteer.id] || []).map(instId => {
                            const inst = instruments.find(i => i.id === instId)
                            if (!inst) return null
                            return (
                              <Badge
                                key={instId}
                                colorScheme="blue"
                                variant="solid"
                                fontSize="xs"
                              >
                                {inst.name}
                              </Badge>
                            )
                          })}
                          {(!volunteerToInstrumentIds[volunteer.id] || volunteerToInstrumentIds[volunteer.id].length === 0) && (
                            <Text fontSize="sm" color={mutedTextColor}>-</Text>
                          )}
                        </HStack>
                      </Td>
                      <Td fontSize="sm" color={mutedTextColor}>
                        {new Date(volunteer.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
        </Box>
      </Box>

      {/* Add Song Drawer */}
      <Drawer
        isOpen={isAddSongDrawerOpen}
        placement="right"
        onClose={onAddSongDrawerClose}
        size={{ base: 'full', md: 'md', lg: 'lg' }}
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px" bg={cardBg}>
            <Heading as="h3" size="lg" color={titleColor} fontWeight="600">
              Add Song to Service
            </Heading>
          </DrawerHeader>
          
          <DrawerBody bg={bgColor} p={6}>
            <Box as="form" onSubmit={handleAddSong}>
              <VStack spacing={6} align="stretch">
                <FormControl isRequired>
                  <FormLabel fontWeight="600" color={textColor} fontSize="sm">
                    Select Song
                  </FormLabel>
                  <Select
                    value={selectedSongId}
                    onChange={(e) => setSelectedSongId(e.target.value)}
                    size="md"
                  >
                    <option value="">Choose a song...</option>
                    {availableSongs.map(song => (
                      <option key={song.id} value={song.id}>
                        {song.title} - {song.artist}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                
                <FormControl>
                  <FormLabel fontWeight="600" color={textColor} fontSize="sm">
                    Notes (optional)
                  </FormLabel>
                  <Input
                    type="text"
                    value={songNotes}
                    onChange={(e) => setSongNotes(e.target.value)}
                    placeholder="e.g., special number, ending song"
                    size="md"
                  />
                </FormControl>

                <Flex gap={4} justify="flex-end" pt={4}>
                  <Button
                    variant="outline"
                    onClick={onAddSongDrawerClose}
                    size="md"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    colorScheme="green"
                    size="md"
                    isLoading={addingSong}
                    loadingText="Adding Song..."
                    disabled={!selectedSongId}
                  >
                    Add Song
                  </Button>
                </Flex>
              </VStack>
            </Box>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Box>
  )
} 