import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCurrentUser, getUserPrimaryOrganization } from '../lib/auth'
import { DashboardHeader } from '../components'
import { 
  Box, 
  VStack, 
  HStack, 
  Heading, 
  Text, 
  Button, 
  Spinner, 
  useColorModeValue,
  Container,
  FormControl,
  FormLabel,
  Input,
  Select,
  Alert,
  AlertIcon,
  Flex,
  Center,
  Grid,
  Badge,
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

// Sortable Song Item Component
function SortableSongItem({ 
  serviceSong, 
  onRemove,
  isRemoving
}: { 
  serviceSong: ServiceSong
  onRemove: (id: string) => void 
  isRemoving: boolean
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
  const textMutedColor = useColorModeValue('gray.500', 'gray.400')

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
      cursor="grab"
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
        cursor="grab"
        position="relative"
        _active={{ cursor: 'grabbing' }}
        {...listeners}
      >
        {serviceSong.position}
        <Text
          position="absolute"
          bottom="-6px"
          left="50%"
          transform="translateX(-50%)"
          fontSize="xs"
          color={textMutedColor}
          opacity={0.6}
        >
          ⋮⋮
        </Text>
      </Box>

      {/* Song Info */}
      <Box flex="1" minW="0" cursor="grab" {...listeners}>
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
        <Tooltip label="Remove song from service">
          <IconButton
            aria-label="Remove song from service"
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
      </Box>
    </Box>
  )
}

export function ServiceDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
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
  const [showAddSongForm, setShowAddSongForm] = useState(false)
  const [selectedSongId, setSelectedSongId] = useState('')
  const [songNotes, setSongNotes] = useState('')
  const [addingSong, setAddingSong] = useState(false)
  const [removingSong, setRemovingSong] = useState<string | null>(null)
  const [volunteers, setVolunteers] = useState<Volunteer[]>([])
  const [loadingVolunteers, setLoadingVolunteers] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<string>('')

  // Color mode values
  const bgColor = useColorModeValue('gray.50', 'gray.900')
  const cardBg = useColorModeValue('white', 'gray.800')
  const cardBorderColor = useColorModeValue('gray.200', 'gray.600')
  const textColor = useColorModeValue('gray.800', 'white')
  const textSecondaryColor = useColorModeValue('gray.600', 'gray.300')
  const textMutedColor = useColorModeValue('gray.500', 'gray.400')

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
          setError('Service not found or you do not have access to it.')
        } else {
          setError('Failed to load service details.')
        }
        return
      }

      setService(data)
    } catch (error) {
      console.error('Error loading service:', error)
      setError('Failed to load service details.')
    } finally {
      setLoading(false)
    }
  }, [id, organization])

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
      setLoadingVolunteers(true)
      console.log('Loading volunteers for service ID:', service.id)
      
      // First get the volunteer records
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

      // Then get the profile information for each volunteer
      const userIds = volunteerRecords.map(v => v.user_id)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', userIds)

      if (profilesError) {
        console.error('Error loading profiles:', profilesError)
        return
      }

      // Combine the data
      const volunteersWithProfiles = volunteerRecords.map(volunteer => {
        const profile = profiles?.find(p => p.id === volunteer.user_id)
        return {
          ...volunteer,
          profiles: profile || { first_name: 'Unknown', last_name: 'User', email: 'N/A' }
        }
      })

      console.log('Volunteers data:', volunteersWithProfiles)
      setVolunteers(volunteersWithProfiles)
    } catch (error) {
      console.error('Error loading volunteers:', error)
    } finally {
      setLoadingVolunteers(false)
    }
  }, [service])

  const handleAddSong = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!service || !selectedSongId) {
      setError('Please select a song to add.')
      return
    }

    try {
      setAddingSong(true)
      setError('')

      // Get the next position number
      const nextPosition = serviceSongs.length + 1

      const { error } = await supabase
        .from('service_songs')
        .insert({
          service_id: service.id,
          song_id: selectedSongId,
          position: nextPosition,
          notes: songNotes.trim() || null
        })
        .select()
        .single()

      if (error) {
        console.error('Error adding song to service:', error)
        setError('Failed to add song to service. Please try again.')
        return
      }

      setSuccess('Song added to service successfully!')
      setSelectedSongId('')
      setSongNotes('')
      setShowAddSongForm(false)
      
      await loadServiceSongs()
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error adding song to service:', error)
      setError('Failed to add song to service. Please try again.')
    } finally {
      setAddingSong(false)
    }
  }

  const handleRemoveSong = async (serviceSongId: string) => {
    if (!confirm('Are you sure you want to remove this song from the service?')) return

    try {
      setRemovingSong(serviceSongId)
      setError('')
      setSuccess('')
      
      const { error } = await supabase
        .from('service_songs')
        .delete()
        .eq('id', serviceSongId)

      if (error) {
        console.error('Error removing song from service:', error)
        setError('Failed to remove song from service. Please try again.')
        return
      }

      setSuccess('Song removed from service successfully!')
      await loadServiceSongs()
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error removing song from service:', error)
      setError('Failed to remove song from service. Please try again.')
    } finally {
      setRemovingSong(null)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = serviceSongs.findIndex(song => song.id === active.id)
      const newIndex = serviceSongs.findIndex(song => song.id === over?.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        // Store original order for potential rollback
        const originalSongs = [...serviceSongs]
        
        // Update local state immediately for smooth UX with new positions
        const newSongs = arrayMove(serviceSongs, oldIndex, newIndex).map((song, index) => ({
          ...song,
          position: index + 1
        }))
        setServiceSongs(newSongs)

        // Update positions in Supabase using temporary positions to avoid conflicts
        try {
          // First, set all positions to temporary negative values to avoid conflicts
          for (let i = 0; i < newSongs.length; i++) {
            const song = newSongs[i]
            const tempPosition = -(i + 1) // Use negative values as temporary positions
            
            const { error } = await supabase
              .from('service_songs')
              .update({ position: tempPosition })
              .eq('id', song.id)

            if (error) {
              console.error('Error setting temporary position:', error)
              setError('Failed to save new song order.')
              // Revert to original order immediately
              setServiceSongs(originalSongs)
              return
            }
          }

          // Then, set the final positions
          for (let i = 0; i < newSongs.length; i++) {
            const song = newSongs[i]
            const finalPosition = i + 1
            
            const { error } = await supabase
              .from('service_songs')
              .update({ position: finalPosition })
              .eq('id', song.id)

            if (error) {
              console.error('Error setting final position:', error)
              setError('Failed to save new song order.')
              // Revert to original order immediately
              setServiceSongs(originalSongs)
              return
            }
          }

          setSuccess('Song order updated successfully!')
          setTimeout(() => setSuccess(''), 3000)
        } catch (error) {
          console.error('Error updating song positions:', error)
          setError('Failed to save new song order.')
          // Revert to original order immediately
          setServiceSongs(originalSongs)
        }
      }
    }
  }

  useEffect(() => {
    if (service) {
      loadServiceSongs()
      loadAvailableSongs()
      loadVolunteers()
    }
  }, [service, loadServiceSongs, loadAvailableSongs, loadVolunteers])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

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
        <Center h="100vh">
          <VStack spacing={4}>
            <Spinner size="xl" color="blue.500" />
            <Text color={textColor}>Loading service details...</Text>
          </VStack>
        </Center>
      </Box>
    )
  }

  if (error) {
    return (
      <Box minH="100vh" bg={bgColor}>
        <DashboardHeader user={user} organization={organization} />

        <Box as="main" py={8}>
          <Container maxW="1200px" px={6}>
            <Box textAlign="center" py={12}>
              <Heading as="h2" size="lg" color="red.500" mb={4}>
                Error
              </Heading>
              <Text color={textMutedColor} mb={6}>
                {error}
              </Text>
              <Button
                colorScheme="blue"
                onClick={() => navigate('/schedule')}
                size="md"
              >
                Back to Services
              </Button>
            </Box>
          </Container>
        </Box>
      </Box>
    )
  }

  if (!service) {
    return (
      <Box minH="100vh" bg={bgColor}>
        <Center h="100vh">
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
    )
  }

  return (
    <Box minH="100vh" bg={bgColor}>
      <DashboardHeader user={user} organization={organization} />

      <Box as="main" py={8}>
        <Container maxW="1200px" px={6}>
          {/* Header Section */}
          <Flex 
            justify="space-between" 
            align="flex-start" 
            mb={8}
            direction={{ base: 'column', md: 'row' }}
            gap={{ base: 4, md: 0 }}
          >
            <Box flex="1">
              <Heading as="h2" size="xl" color={textColor} mb={2}>
                Service Details
              </Heading>
              <Text color={textSecondaryColor} fontSize="lg">
                View and manage your worship service
              </Text>
            </Box>
            
            <HStack spacing={3}>
              <Button
                colorScheme="blue"
                onClick={() => navigate(`/service/${service.id}/edit`)}
                size="md"
              >
                Edit Service
              </Button>
              <Button
                variant="outline"
                colorScheme="gray"
                onClick={() => navigate('/schedule')}
                size="md"
              >
                Back to Services
              </Button>
            </HStack>
          </Flex>

          {/* Messages */}
          {error && (
            <Alert status="error" borderRadius="md" mb={6}>
              <AlertIcon />
              {error}
            </Alert>
          )}

          {success && (
            <Alert status="success" borderRadius="md" mb={6}>
              <AlertIcon />
              {success}
            </Alert>
          )}

          <VStack spacing={6} align="stretch">
            {/* Service Info Section */}
            <Box
              bg={cardBg}
              borderRadius="lg"
              boxShadow="sm"
              border="1px"
              borderColor={cardBorderColor}
              p={6}
            >
              <Flex 
                justify="space-between" 
                align="center" 
                mb={6}
                direction={{ base: 'column', sm: 'row' }}
                gap={{ base: 3, sm: 0 }}
              >
                <Heading as="h3" size="lg" color={textColor}>
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
                  <Text fontSize="xs" fontWeight="500" color={textMutedColor} textTransform="uppercase" letterSpacing="0.05em" mb={1}>
                    Service Date
                  </Text>
                  <Text fontSize="md" fontWeight="500" color={textColor}>
                    {formatDate(service.service_date)}
                  </Text>
                </Box>

                {service.service_time && (
                  <Box>
                    <Text fontSize="xs" fontWeight="500" color={textMutedColor} textTransform="uppercase" letterSpacing="0.05em" mb={1}>
                      Service Time
                    </Text>
                    <Text fontSize="md" fontWeight="500" color={textColor}>
                      {service.service_time}
                    </Text>
                  </Box>
                )}

                <Box>
                  <Text fontSize="xs" fontWeight="500" color={textMutedColor} textTransform="uppercase" letterSpacing="0.05em" mb={1}>
                    Created
                  </Text>
                  <Text fontSize="md" fontWeight="500" color={textColor}>
                    {formatDate(service.created_at)}
                  </Text>
                </Box>

                <Box>
                  <Text fontSize="xs" fontWeight="500" color={textMutedColor} textTransform="uppercase" letterSpacing="0.05em" mb={1}>
                    Last Updated
                  </Text>
                  <Text fontSize="md" fontWeight="500" color={textColor}>
                    {formatDate(service.updated_at)}
                  </Text>
                </Box>
              </Grid>

              {service.description && (
                <Box borderTop="1px" borderColor={cardBorderColor} pt={5}>
                  <Text fontSize="xs" fontWeight="500" color={textMutedColor} textTransform="uppercase" letterSpacing="0.05em" mb={2}>
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
            >
              <Flex 
                justify="space-between" 
                align="center" 
                mb={5}
                direction={{ base: 'column', sm: 'row' }}
                gap={{ base: 3, sm: 0 }}
              >
                <Heading as="h3" size="md" color={textColor}>
                  Service Songs
                </Heading>
                <Button 
                  colorScheme="blue"
                  size="sm"
                  onClick={() => setShowAddSongForm(!showAddSongForm)}
                >
                  {showAddSongForm ? 'Cancel' : 'Add Songs'}
                </Button>
              </Flex>

              {showAddSongForm && (
                <Box
                  bg={useColorModeValue('gray.50', 'gray.700')}
                  border="1px"
                  borderColor={cardBorderColor}
                  borderRadius="lg"
                  p={5}
                  mb={5}
                >
                  <Heading as="h4" size="sm" color={textColor} mb={4}>
                    Add Song to Service
                  </Heading>
                  <form onSubmit={handleAddSong}>
                    <VStack spacing={4} align="stretch">
                      <FormControl isRequired>
                        <FormLabel fontSize="sm" fontWeight="500" color={textColor}>
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
                        <FormLabel fontSize="sm" fontWeight="500" color={textColor}>
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
                      
                      <HStack spacing={3} pt={2}>
                        <Button 
                          type="submit" 
                          colorScheme="blue"
                          isLoading={addingSong}
                          loadingText="Adding Song..."
                          disabled={!selectedSongId}
                          size="md"
                        >
                          Add Song
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline"
                          colorScheme="gray"
                          onClick={() => setShowAddSongForm(false)}
                          size="md"
                        >
                          Cancel
                        </Button>
                      </HStack>
                    </VStack>
                  </form>
                </Box>
              )}
              
              {serviceSongs.length === 0 ? (
                <Box textAlign="center" py={10}>
                  <Text fontSize="lg" fontWeight="500" color={textMutedColor} mb={2}>
                    No songs added to this service yet
                  </Text>
                  <Text color={textMutedColor}>
                    Add songs from your songbank to create a setlist
                  </Text>
                </Box>
              ) : (
                <Box>
                  <Text fontSize="xs" color={textMutedColor} fontStyle="italic" mb={3}>
                    Drag to reorder songs
                  </Text>
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
              <Heading as="h3" size="md" color={textColor} mb={5}>
                Volunteers
              </Heading>
              
              {loadingVolunteers ? (
                <Center py={8}>
                  <VStack spacing={3}>
                    <Spinner size="lg" />
                    <Text color={textMutedColor}>Loading volunteers...</Text>
                  </VStack>
                </Center>
              ) : volunteers.length === 0 ? (
                <Box textAlign="center" py={10}>
                  <Text fontSize="lg" fontWeight="500" color={textMutedColor} mb={2}>
                    No volunteers yet
                  </Text>
                  <Text color={textMutedColor}>
                    Share the volunteer link to get people to sign up for this service
                  </Text>
                </Box>
              ) : (
                <VStack spacing={3} align="stretch">
                  {volunteers.map((volunteer) => (
                    <Box
                      key={volunteer.id}
                      bg={useColorModeValue('gray.50', 'gray.700')}
                      border="1px"
                      borderColor={cardBorderColor}
                      borderRadius="lg"
                      p={4}
                    >
                      <HStack justify="space-between" align="center">
                        <VStack align="start" spacing={1}>
                          <Text fontWeight="600" color={textColor}>
                            {volunteer.profiles.first_name} {volunteer.profiles.last_name}
                          </Text>
                          <Text fontSize="sm" color={textSecondaryColor}>
                            {volunteer.profiles.email}
                          </Text>
                        </VStack>
                        <Text fontSize="xs" color={textMutedColor}>
                          Joined {new Date(volunteer.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </Text>
                      </HStack>
                    </Box>
                  ))}
                </VStack>
              )}
            </Box>

            {/* Service Notes Section */}
            <Box
              bg={cardBg}
              borderRadius="lg"
              boxShadow="sm"
              border="1px"
              borderColor={cardBorderColor}
              p={6}
            >
              <Flex 
                justify="space-between" 
                align="center" 
                mb={5}
                direction={{ base: 'column', sm: 'row' }}
                gap={{ base: 3, sm: 0 }}
              >
                <Heading as="h3" size="md" color={textColor}>
                  Service Notes
                </Heading>
                <Button 
                  variant="outline"
                  colorScheme="gray"
                  size="sm"
                >
                  Add Notes
                </Button>
              </Flex>
              
              <Box textAlign="center" py={10}>
                <Text fontSize="lg" fontWeight="500" color={textMutedColor} mb={2}>
                  No notes added yet
                </Text>
                <Text color={textMutedColor}>
                  Add notes for the worship team, announcements, or special instructions
                </Text>
              </Box>
            </Box>
          </VStack>
        </Container>
      </Box>
    </Box>
  )
} 