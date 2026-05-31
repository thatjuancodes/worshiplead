import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { getCurrentUser } from '../lib/auth'
import { getUserPrimaryOrganization } from '../lib/auth'
import { useOrganizationAccess } from '../hooks/useOrganizationAccess'
import {
  Box,
  Button,
  Text,
  Heading,
  VStack,
  HStack,
  Grid,
  SimpleGrid,
  useColorModeValue,
  useToast,
  Skeleton,
  Input,
  FormControl,
  FormLabel,
  Textarea,
  Select,
  Badge,
  Flex,
  useDisclosure,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  InputGroup,
  InputLeftElement,
} from '@chakra-ui/react'
import { SearchIcon } from '@chakra-ui/icons'
import { DashboardHeader } from '../components'
import type { User } from '@supabase/supabase-js'
import { EmptyState } from '../components'

interface Song {
  id: string
  title: string
  artist: string
  youtube_url?: string
  spotify_url?: string
  key?: string
  bpm?: number
  ccli_number?: string
  tags: string[]
  lyrics?: string
  created_at: string
}

interface SongUsageStats {
  usageCount: number
  lastUsed: string | null
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

export function Songbank() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()
  const { canManagePrimary } = useOrganizationAccess()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [songs, setSongs] = useState<Song[]>([])
  const [songUsageById, setSongUsageById] = useState<Record<string, SongUsageStats>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'popular' | 'recent' | 'title'>('popular')
  const { isOpen: isAddDrawerOpen, onOpen: onAddDrawerOpen, onClose: onAddDrawerClose } = useDisclosure()
  const { isOpen: isEditDrawerOpen, onOpen: onEditDrawerOpen, onClose: onEditDrawerClose } = useDisclosure()
  const [editingSong, setEditingSong] = useState<Song | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [deleteSong, setDeleteSong] = useState<Song | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [songServiceUsage, setSongServiceUsage] = useState<{ draft: number; published: number; total: number }>({ draft: 0, published: 0, total: 0 })
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    youtube_url: '',
    spotify_url: '',
    key: '',
    bpm: '',
    ccli_number: '',
    tags: '',
    lyrics: ''
  })

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
      await loadSongs(userOrg.organization_id)
      setLoading(false)
    } catch (error) {
      console.error('Error checking user and organization:', error)
      navigate('/login')
    }
  }, [navigate])

  useEffect(() => {
    checkUserAndOrganization()
  }, [checkUserAndOrganization])

  const loadSongs = async (organizationId: string) => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('organization_id', organizationId)
        .order('title', { ascending: true })

      if (error) {
        console.error('Error loading songs:', error)
        return
      }

      const loadedSongs = data || []
      setSongs(loadedSongs)
      await loadSongUsageStats(organizationId, loadedSongs)
    } catch (error) {
      console.error('Error loading songs:', error)
    }
  }

  async function loadSongUsageStats(organizationId: string, loadedSongs: Song[]) {
    try {
      if (loadedSongs.length === 0) {
        setSongUsageById({})
        return
      }

      const { data: servicesData, error: servicesError } = await supabase
        .from('worship_services')
        .select('id, service_time')
        .eq('organization_id', organizationId)

      if (servicesError) {
        console.error('Error loading services for song usage:', servicesError)
        setSongUsageById({})
        return
      }

      const serviceIds = (servicesData || []).map((service) => service.id)
      if (serviceIds.length === 0) {
        setSongUsageById({})
        return
      }

      const serviceIdToDate = new Map<string, string>()
      ;(servicesData || []).forEach((service) => {
        serviceIdToDate.set(service.id, service.service_time)
      })

      const { data: serviceSongsData, error: serviceSongsError } = await supabase
        .from('service_songs')
        .select('song_id, service_id')
        .in('service_id', serviceIds)

      if (serviceSongsError) {
        console.error('Error loading song usage:', serviceSongsError)
        setSongUsageById({})
        return
      }

      const nextUsageById: Record<string, SongUsageStats> = {}

      loadedSongs.forEach((song) => {
        nextUsageById[song.id] = { usageCount: 0, lastUsed: null }
      })

      ;(serviceSongsData || []).forEach((row) => {
        const songId = row.song_id
        const serviceDate = serviceIdToDate.get(row.service_id) || null
        const previous = nextUsageById[songId] || { usageCount: 0, lastUsed: null }
        nextUsageById[songId] = {
          usageCount: previous.usageCount + 1,
          lastUsed: previous.lastUsed && serviceDate
            ? (previous.lastUsed > serviceDate ? previous.lastUsed : serviceDate)
            : (previous.lastUsed || serviceDate)
        }
      })

      setSongUsageById(nextUsageById)
    } catch (error) {
      console.error('Error loading song usage stats:', error)
      setSongUsageById({})
    }
  }

  const handleAddSong = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization) return

    if (!canManagePrimary) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to create songs. Only admins and owners can create songs.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    try {
      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)

      const { error } = await supabase
        .from('songs')
        .insert({
          organization_id: organization.organization_id,
          title: formData.title,
          artist: formData.artist,
          youtube_url: formData.youtube_url || null,
          spotify_url: formData.spotify_url || null,
          key: formData.key || null,
          bpm: formData.bpm ? parseInt(formData.bpm) : null,
          ccli_number: formData.ccli_number || null,
          tags: tagsArray,
          lyrics: formData.lyrics || null,
          created_by: user?.id
        })

      if (error) {
        console.error('Error adding song:', error)
        toast({
          title: 'Error',
          description: 'Failed to add song',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
        return
      }

      // Reset form and reload songs
      setFormData({
        title: '',
        artist: '',
        youtube_url: '',
        spotify_url: '',
        key: '',
        bpm: '',
        ccli_number: '',
        tags: '',
        lyrics: ''
      })
      onAddDrawerClose()
      await loadSongs(organization.organization_id)
      toast({
        title: 'Success',
        description: 'Song added successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch (error) {
      console.error('Error adding song:', error)
      toast({
        title: 'Error',
        description: 'Failed to add song',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  const checkSongServiceUsage = async (songId: string) => {
    try {
      // First get all service IDs that use this song
      const { data: serviceSongs, error: serviceSongsError } = await supabase
        .from('service_songs')
        .select('service_id')
        .eq('song_id', songId)

      if (serviceSongsError) {
        console.error('Error checking song service usage:', serviceSongsError)
        return { draft: 0, published: 0, total: 0 }
      }

      if (!serviceSongs || serviceSongs.length === 0) {
        return { draft: 0, published: 0, total: 0 }
      }

      // Get the service details for these service IDs
      const serviceIds = serviceSongs.map(ss => ss.service_id)
      const { data: services, error: servicesError } = await supabase
        .from('worship_services')
        .select('id, status')
        .in('id', serviceIds)

      if (servicesError) {
        console.error('Error loading service details:', servicesError)
        return { draft: 0, published: 0, total: 0 }
      }

      const draftCount = services?.filter(service => service.status === 'draft').length || 0
      const publishedCount = services?.filter(service => service.status === 'published').length || 0
      const totalCount = services?.length || 0

      return { draft: draftCount, published: publishedCount, total: totalCount }
    } catch (error) {
      console.error('Error checking song service usage:', error)
      return { draft: 0, published: 0, total: 0 }
    }
  }

  const openDeleteModal = async (song: Song) => {
    setDeleteSong(song)
    setDeleteConfirmation('')
    const usage = await checkSongServiceUsage(song.id)
    setSongServiceUsage(usage)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteSong = async () => {
    if (!deleteSong || deleteConfirmation !== deleteSong.title) {
      toast({
        title: 'Error',
        description: 'Please type the exact song title to confirm deletion',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    if (!canManagePrimary) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to delete songs. Only admins and owners can delete songs.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    try {
      const { error } = await supabase
        .from('songs')
        .delete()
        .eq('id', deleteSong.id)

      if (error) {
        console.error('Error deleting song:', error)
        toast({
          title: 'Error',
          description: 'Failed to delete song',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
        return
      }

      await loadSongs(organization!.organization_id)
      setIsDeleteModalOpen(false)
      setDeleteSong(null)
      setDeleteConfirmation('')
      toast({
        title: 'Success',
        description: 'Song deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch (error) {
      console.error('Error deleting song:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete song',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  const handleEditSong = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization || !editingSong) return

    if (!canManagePrimary) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to edit songs. Only admins and owners can edit songs.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    try {
      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)

      const { error } = await supabase
        .from('songs')
        .update({
          title: formData.title,
          artist: formData.artist,
          youtube_url: formData.youtube_url || null,
          spotify_url: formData.spotify_url || null,
          key: formData.key || null,
          bpm: formData.bpm ? parseInt(formData.bpm) : null,
          ccli_number: formData.ccli_number || null,
          tags: tagsArray,
          lyrics: formData.lyrics || null
        })
        .eq('id', editingSong.id)

      if (error) {
        console.error('Error updating song:', error)
        toast({
          title: 'Error',
          description: 'Failed to update song',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
        return
      }

      // Reset form and reload songs
      setFormData({
        title: '',
        artist: '',
        youtube_url: '',
        spotify_url: '',
        key: '',
        bpm: '',
        ccli_number: '',
        tags: '',
        lyrics: ''
      })
      onEditDrawerClose()
      setEditingSong(null)
      await loadSongs(organization.organization_id)
      toast({
        title: 'Success',
        description: 'Song updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch (error) {
      console.error('Error updating song:', error)
      toast({
        title: 'Error',
        description: 'Failed to update song',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  const openEditForm = (song: Song) => {
    setEditingSong(song)
    setFormData({
      title: song.title,
      artist: song.artist,
      youtube_url: song.youtube_url || '',
      spotify_url: song.spotify_url || '',
      key: song.key || '',
      bpm: song.bpm?.toString() || '',
      ccli_number: song.ccli_number || '',
      tags: song.tags.join(', '),
      lyrics: song.lyrics || ''
    })
    onEditDrawerOpen()
  }

  const toggleFavorite = (songId: string) => {
    setFavorites((previous) => {
      const next = new Set(previous)
      if (next.has(songId)) next.delete(songId)
      else next.add(songId)
      return next
    })
  }

  const getSongUsage = (songId: string) => songUsageById[songId] || { usageCount: 0, lastUsed: null }

  const timeAgo = (dateString: string | null) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffDays <= 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const filteredSongs = songs.filter(song => {
    const matchesSearch = song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         song.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (song.key || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTag = !selectedTag || (
      selectedTag === 'favorites'
        ? favorites.has(song.id)
        : song.tags.includes(selectedTag)
    )
    
    return matchesSearch && matchesTag
  })

  const uniqueTags = [...new Set(songs.flatMap(song => song.tags))]
  const sortedSongs = [...filteredSongs].sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title)
    if (sortBy === 'recent') {
      const aTime = getSongUsage(a.id).lastUsed ? new Date(getSongUsage(a.id).lastUsed!).getTime() : 0
      const bTime = getSongUsage(b.id).lastUsed ? new Date(getSongUsage(b.id).lastUsed!).getTime() : 0
      return bTime - aTime
    }

    const aUsage = getSongUsage(a.id).usageCount
    const bUsage = getSongUsage(b.id).usageCount
    if (bUsage !== aUsage) return bUsage - aUsage

    const aTime = getSongUsage(a.id).lastUsed ? new Date(getSongUsage(a.id).lastUsed!).getTime() : 0
    const bTime = getSongUsage(b.id).lastUsed ? new Date(getSongUsage(b.id).lastUsed!).getTime() : 0
    return bTime - aTime
  })
  const favoriteSongs = songs.filter((song) => favorites.has(song.id))
  const recentlyUsedSongs = [...songs]
    .filter((song) => getSongUsage(song.id).lastUsed)
    .sort((a, b) => {
      const aTime = new Date(getSongUsage(a.id).lastUsed || 0).getTime()
      const bTime = new Date(getSongUsage(b.id).lastUsed || 0).getTime()
      return bTime - aTime
    })
    .slice(0, 3)
  const popularSongs = [...songs]
    .sort((a, b) => getSongUsage(b.id).usageCount - getSongUsage(a.id).usageCount)
    .slice(0, 6)

  const renderSongCard = (song: Song) => {
    const usage = getSongUsage(song.id)
    const isFavorite = favorites.has(song.id)

    return (
      <Box
        key={song.id}
        bg={cardBg}
        border="1px"
        borderColor={cardBorderColor}
        borderRadius="xl"
        className="card-shadow card-hover group"
        p={4}
      >
        <VStack align="stretch" spacing={3}>
          <HStack align="start" justify="space-between" spacing={2}>
            <Box flex="1" minW={0}>
              <HStack spacing={2}>
                <Heading as="h3" color={titleColor} fontSize="sm" fontWeight="600" noOfLines={1} size="sm">
                  {song.title}
                </Heading>
                {isFavorite ? <Text color="red.500" fontSize="xs">♥</Text> : null}
              </HStack>
              <Text color={subtitleColor} fontSize="xs" mt={0.5} noOfLines={1}>
                {song.artist}
              </Text>
            </Box>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted opacity-0 transition hover:bg-gray-100 group-hover:opacity-100"
              onClick={(event) => {
                event.stopPropagation()
                toggleFavorite(song.id)
              }}
              type="button"
            >
              <Text color={isFavorite ? 'red.500' : mutedTextColor} fontSize="sm">♥</Text>
            </button>
          </HStack>

          <HStack spacing={2}>
            {song.key ? (
              <Badge colorScheme="gray" variant="subtle" fontSize="xs">
                {song.key}
              </Badge>
            ) : null}
            {song.bpm ? (
              <Badge colorScheme="gray" variant="subtle" fontSize="xs">
                {song.bpm} BPM
              </Badge>
            ) : null}
          </HStack>

          <HStack justify="space-between" borderTop="1px" borderColor={cardBorderColor} pt={3} spacing={3}>
            <HStack spacing={3}>
              <Text color={mutedTextColor} fontSize="xs">
                {usage.usageCount} uses
              </Text>
              <Text color={mutedTextColor} fontSize="xs">
                {timeAgo(usage.lastUsed)}
              </Text>
            </HStack>
            <HStack spacing={1} flexWrap="wrap" justify="flex-end">
              {song.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} colorScheme="blue" fontSize="10px" variant="subtle">
                  {tag}
                </Badge>
              ))}
            </HStack>
          </HStack>

          {(song.youtube_url || song.spotify_url || canManagePrimary) ? (
            <HStack justify="space-between" pt={1}>
              <HStack spacing={2}>
                {song.youtube_url ? (
                  <Button as="a" href={song.youtube_url} target="_blank" rel="noopener noreferrer" size="xs" colorScheme="red" variant="outline">
                    YouTube
                  </Button>
                ) : null}
                {song.spotify_url ? (
                  <Button as="a" href={song.spotify_url} target="_blank" rel="noopener noreferrer" size="xs" colorScheme="green" variant="outline">
                    Spotify
                  </Button>
                ) : null}
              </HStack>
              {canManagePrimary ? (
                <HStack spacing={2}>
                  <Button size="xs" variant="outline" onClick={() => openEditForm(song)}>
                    Edit
                  </Button>
                  <Button size="xs" colorScheme="red" variant="outline" onClick={() => openDeleteModal(song)}>
                    Delete
                  </Button>
                </HStack>
              ) : null}
            </HStack>
          ) : null}
        </VStack>
      </Box>
    )
  }

  // Color mode values
  const bgColor = useColorModeValue('gray.50', 'gray.900')
  const cardBg = useColorModeValue('white', 'gray.800')
  const cardBorderColor = useColorModeValue('gray.200', 'gray.600')
  const titleColor = useColorModeValue('gray.800', 'white')
  const subtitleColor = useColorModeValue('gray.600', 'gray.300')
  const mutedTextColor = useColorModeValue('gray.500', 'gray.400')
  const textColor = useColorModeValue('gray.700', 'gray.200')

  if (loading) {
    return (
      <Box className="sl-dashboard-page" minH="100vh" bg={bgColor}>
        <DashboardHeader user={user} organization={organization} />

        <Box as="main" maxW="1200px" mx="auto" px={{ base: 6, md: 8 }} pt={{ base: 2, md: 3 }} pb={{ base: 6, md: 8 }}>
          <div className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
                  Song Library
                </h1>
                <p className="mt-1 text-sm text-text-muted">
                  Browse and manage your worship catalog
                </p>
              </div>
              <Skeleton h="36px" w="112px" borderRadius="12px" />
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Skeleton h="40px" w={{ base: '100%', sm: '320px' }} borderRadius="12px" />
              <div className="flex items-center gap-2">
                <Skeleton h="36px" w="96px" borderRadius="10px" />
                <Skeleton h="36px" w="136px" borderRadius="10px" />
                <Skeleton h="36px" w="80px" borderRadius="10px" />
              </div>
            </div>

            <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={3}>
              {Array.from({ length: 6 }).map((_, index) => (
                <Box
                  key={index}
                  bg={cardBg}
                  border="1px"
                  borderColor={cardBorderColor}
                  borderRadius="xl"
                  className="card-shadow"
                  p={4}
                >
                  <VStack align="stretch" spacing={3}>
                    <HStack justify="space-between" align="start">
                      <Box flex="1">
                        <Skeleton h="16px" w="70%" mb={2} />
                        <Skeleton h="12px" w="45%" />
                      </Box>
                      <Skeleton h="28px" w="28px" borderRadius="8px" />
                    </HStack>
                    <HStack spacing={2}>
                      <Skeleton h="20px" w="44px" borderRadius="999px" />
                      <Skeleton h="20px" w="64px" borderRadius="999px" />
                    </HStack>
                    <HStack justify="space-between" pt={3}>
                      <Skeleton h="12px" w="56px" />
                      <Skeleton h="12px" w="72px" />
                    </HStack>
                    <HStack justify="space-between" pt={1}>
                      <HStack spacing={2}>
                        <Skeleton h="24px" w="68px" borderRadius="8px" />
                        <Skeleton h="24px" w="64px" borderRadius="8px" />
                      </HStack>
                      <HStack spacing={2}>
                        <Skeleton h="24px" w="44px" borderRadius="8px" />
                        <Skeleton h="24px" w="54px" borderRadius="8px" />
                      </HStack>
                    </HStack>
                  </VStack>
                </Box>
              ))}
            </SimpleGrid>
          </div>
        </Box>
      </Box>
    )
  }

  return (
    <Box className="sl-dashboard-page" minH="100vh" bg={bgColor}>
      <DashboardHeader user={user} organization={organization} />

      <Box as="main" maxW="1200px" mx="auto" px={{ base: 6, md: 8 }} pt={{ base: 2, md: 3 }} pb={{ base: 6, md: 8 }}>
        <VStack align="stretch" spacing={4}>
        {/* Add Song Drawer */}
        <Drawer
          isOpen={isAddDrawerOpen}
          placement="right"
          onClose={onAddDrawerClose}
          size={{ base: 'full', md: 'md', lg: 'lg' }}
        >
          <DrawerOverlay />
          <DrawerContent>
            <DrawerCloseButton />
            <DrawerHeader borderBottomWidth="1px" bg={cardBg}>
              <Heading as="h3" size="lg" color={titleColor} fontWeight="600">
                {t('songbank.addNewSong')}
              </Heading>
            </DrawerHeader>
            
            <DrawerBody bg={bgColor} p={6}>
              <Box as="form" onSubmit={handleAddSong}>
                <VStack spacing={6} align="stretch">
                  <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4}>
                    <FormControl isRequired>
                      <FormLabel fontWeight="600" color={textColor} fontSize="sm">{t('songbank.title')}</FormLabel>
                      <Input
                        value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                        placeholder={t('songbank.placeholders.songTitle')}
                        size="md"
                      />
                    </FormControl>
                    
                    <FormControl isRequired>
                      <FormLabel fontWeight="600" color={textColor} fontSize="sm">{t('songbank.artist')}</FormLabel>
                      <Input
                        value={formData.artist}
                        onChange={(e) => setFormData({...formData, artist: e.target.value})}
                        placeholder={t('songbank.placeholders.artistName')}
                        size="md"
                      />
                    </FormControl>
                  </Grid>

                  <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4}>
                    <FormControl>
                      <FormLabel fontWeight="600" color={textColor} fontSize="sm">YouTube URL</FormLabel>
                      <Input
                        type="url"
                        value={formData.youtube_url}
                        onChange={(e) => setFormData({...formData, youtube_url: e.target.value})}
                        placeholder="https://youtube.com/watch?v=..."
                        size="md"
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel fontWeight="600" color={textColor} fontSize="sm">Spotify URL</FormLabel>
                      <Input
                        type="url"
                        value={formData.spotify_url}
                        onChange={(e) => setFormData({...formData, spotify_url: e.target.value})}
                        placeholder="https://open.spotify.com/track/..."
                        size="md"
                      />
                    </FormControl>
                  </Grid>

                  <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={4}>
                    <FormControl>
                      <FormLabel fontWeight="600" color={textColor} fontSize="sm">Key</FormLabel>
                      <Input
                        value={formData.key}
                        onChange={(e) => setFormData({...formData, key: e.target.value})}
                        placeholder="C, G, D, etc."
                        size="md"
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel fontWeight="600" color={textColor} fontSize="sm">BPM</FormLabel>
                      <Input
                        type="number"
                        value={formData.bpm}
                        onChange={(e) => setFormData({...formData, bpm: e.target.value})}
                        placeholder="120"
                        size="md"
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel fontWeight="600" color={textColor} fontSize="sm">CCLI Number</FormLabel>
                      <Input
                        value={formData.ccli_number}
                        onChange={(e) => setFormData({...formData, ccli_number: e.target.value})}
                        placeholder="CCLI-123456"
                        size="md"
                      />
                    </FormControl>
                  </Grid>

                  <FormControl>
                    <FormLabel fontWeight="600" color={textColor} fontSize="sm">Tags</FormLabel>
                    <Input
                      value={formData.tags}
                      onChange={(e) => setFormData({...formData, tags: e.target.value})}
                      placeholder="worship, contemporary, gospel (comma separated)"
                      size="md"
                    />
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel fontWeight="600" color={textColor} fontSize="sm">Lyrics</FormLabel>
                    <Textarea
                      value={formData.lyrics}
                      onChange={(e) => setFormData({...formData, lyrics: e.target.value})}
                      placeholder="Enter song lyrics..."
                      size="md"
                      rows={4}
                    />
                  </FormControl>

                  <Flex gap={4} justify="flex-end" pt={4}>
                    <Button
                      variant="outline"
                      onClick={onAddDrawerClose}
                      size="md"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="btn-primary-size"
                      type="submit"
                      colorScheme="green"
                      isLoading={loading}
                    >
                      Add Song
                    </Button>
                  </Flex>
                </VStack>
              </Box>
            </DrawerBody>
          </DrawerContent>
        </Drawer>

        {/* Edit Song Drawer */}
        <Drawer
          isOpen={isEditDrawerOpen}
          placement="right"
          onClose={onEditDrawerClose}
          size={{ base: 'full', md: 'md', lg: 'lg' }}
        >
          <DrawerOverlay />
          <DrawerContent>
            <DrawerCloseButton />
            <DrawerHeader borderBottomWidth="1px" bg={cardBg}>
              <Heading as="h3" size="lg" color={titleColor} fontWeight="600">
                Edit Song
              </Heading>
            </DrawerHeader>
            
            <DrawerBody bg={bgColor} p={6}>
              <Box as="form" onSubmit={handleEditSong}>
                <VStack spacing={6} align="stretch">
                  <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4}>
                    <FormControl isRequired>
                      <FormLabel fontWeight="600" color={textColor} fontSize="sm">Title</FormLabel>
                      <Input
                        value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                        placeholder="Song title"
                        size="md"
                      />
                    </FormControl>
                    
                    <FormControl isRequired>
                      <FormLabel fontWeight="600" color={textColor} fontSize="sm">Artist</FormLabel>
                      <Input
                        value={formData.artist}
                        onChange={(e) => setFormData({...formData, artist: e.target.value})}
                        placeholder="Artist name"
                        size="md"
                      />
                    </FormControl>
                  </Grid>

                  <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4}>
                    <FormControl>
                      <FormLabel fontWeight="600" color={textColor} fontSize="sm">YouTube URL</FormLabel>
                      <Input
                        type="url"
                        value={formData.youtube_url}
                        onChange={(e) => setFormData({...formData, youtube_url: e.target.value})}
                        placeholder="https://youtube.com/watch?v=..."
                        size="md"
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel fontWeight="600" color={textColor} fontSize="sm">Spotify URL</FormLabel>
                      <Input
                        type="url"
                        value={formData.spotify_url}
                        onChange={(e) => setFormData({...formData, spotify_url: e.target.value})}
                        placeholder="https://open.spotify.com/track/..."
                        size="md"
                      />
                    </FormControl>
                  </Grid>

                  <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={4}>
                    <FormControl>
                      <FormLabel fontWeight="600" color={textColor} fontSize="sm">Key</FormLabel>
                      <Input
                        value={formData.key}
                        onChange={(e) => setFormData({...formData, key: e.target.value})}
                        placeholder="C, G, D, etc."
                        size="md"
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel fontWeight="600" color={textColor} fontSize="sm">BPM</FormLabel>
                      <Input
                        type="number"
                        value={formData.bpm}
                        onChange={(e) => setFormData({...formData, bpm: e.target.value})}
                        placeholder="120"
                        size="md"
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel fontWeight="600" color={textColor} fontSize="sm">CCLI Number</FormLabel>
                      <Input
                        value={formData.ccli_number}
                        onChange={(e) => setFormData({...formData, ccli_number: e.target.value})}
                        placeholder="CCLI-123456"
                        size="md"
                      />
                    </FormControl>
                  </Grid>

                  <FormControl>
                    <FormLabel fontWeight="600" color={textColor} fontSize="sm">Tags</FormLabel>
                    <Input
                      value={formData.tags}
                      onChange={(e) => setFormData({...formData, tags: e.target.value})}
                      placeholder="worship, contemporary, gospel (comma separated)"
                      size="md"
                    />
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel fontWeight="600" color={textColor} fontSize="sm">Lyrics</FormLabel>
                    <Textarea
                      value={formData.lyrics}
                      onChange={(e) => setFormData({...formData, lyrics: e.target.value})}
                      placeholder="Enter song lyrics..."
                      size="md"
                      rows={4}
                    />
                  </FormControl>

                  <Flex gap={4} justify="flex-end" pt={4}>
                    <Button
                      variant="outline"
                      onClick={() => {
                        onEditDrawerClose()
                        setEditingSong(null)
                      }}
                      size="md"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="btn-primary-size"
                      type="submit"
                      colorScheme="blue"
                      isLoading={loading}
                    >
                      Update Song
                    </Button>
                  </Flex>
                </VStack>
              </Box>
            </DrawerBody>
          </DrawerContent>
        </Drawer>

        {/* Delete Confirmation Modal */}
        <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader color="red.600">Delete Song</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack spacing={4} align="stretch">
                <Text>
                  Are you sure you want to delete <strong>"{deleteSong?.title}"</strong> by <strong>{deleteSong?.artist}</strong>?
                </Text>
                
                {songServiceUsage.total > 0 && (
                  <Box
                    bg="orange.50"
                    border="1px"
                    borderColor="orange.200"
                    borderRadius="md"
                    p={4}
                  >
                    <Text fontWeight="600" color="orange.800" mb={2}>
                      ⚠️ This song is currently being used in services:
                    </Text>
                    <VStack spacing={1} align="start">
                      {songServiceUsage.draft > 0 && (
                        <Text color="orange.700">
                          • {songServiceUsage.draft} draft service{songServiceUsage.draft > 1 ? 's' : ''}
                        </Text>
                      )}
                      {songServiceUsage.published > 0 && (
                        <Text color="orange.700">
                          • {songServiceUsage.published} published service{songServiceUsage.published > 1 ? 's' : ''}
                        </Text>
                      )}
                    </VStack>
                  </Box>
                )}

                <FormControl>
                  <FormLabel>Type the song title to confirm deletion:</FormLabel>
                  <Input
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder={deleteSong?.title}
                    isDisabled={songServiceUsage.total > 0}
                  />
                </FormControl>
              </VStack>
            </ModalBody>

            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={() => setIsDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={handleDeleteSong}
                isDisabled={
                  deleteConfirmation !== deleteSong?.title || 
                  songServiceUsage.total > 0
                }
                title={
                  songServiceUsage.total > 0 
                    ? `Assigned to ${songServiceUsage.total} service${songServiceUsage.total > 1 ? 's' : ''} - Cannot delete`
                    : undefined
                }
              >
                Delete Song
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <div className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
                Song Library
              </h1>
              <p className="mt-1 text-sm text-text-muted">
                Browse and manage your worship catalog
              </p>
            </div>
            {canManagePrimary ? (
              <Button className="btn-primary" onClick={onAddDrawerOpen} size="sm" type="button">
                <span aria-hidden="true">＋</span>
                <span className="hidden sm:inline">{t('songbank.addSong')}</span>
                <span className="sm:hidden">Add</span>
              </Button>
            ) : null}
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Box flex="1" w="100%" maxW={{ base: 'full', sm: '320px' }}>
              <InputGroup>
                <InputLeftElement color="gray.400" pointerEvents="none">
                  <SearchIcon />
                </InputLeftElement>
                <Input
                  className="input-field"
                  placeholder="Search songs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  w="full"
                  pl="40px"
                  isDisabled={loading}
                />
              </InputGroup>
            </Box>
            <div className="flex items-center gap-2">
              <button className="btn-secondary" onClick={() => setShowFilters((value) => !value)} type="button">
                <span>Filters</span>
                <span aria-hidden="true" className={`transition-transform ${showFilters ? 'rotate-180' : ''}`}>⌄</span>
              </button>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'popular' | 'recent' | 'title')}
                size="sm"
                maxW="160px"
                bg="white"
              >
                <option value="popular">Most Popular</option>
                <option value="recent">Recently Used</option>
                <option value="title">A-Z</option>
              </Select>
              <div className="flex items-center rounded-lg bg-gray-100 p-1">
                <button
                  className={`rounded-md p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-white text-text-primary shadow-sm' : 'text-text-muted'}`}
                  onClick={() => setViewMode('grid')}
                  title="Grid view"
                  type="button"
                >
                  <Box as="svg" w="4" h="4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </Box>
                </button>
                <button
                  className={`rounded-md p-1.5 transition-colors ${viewMode === 'table' ? 'bg-white text-text-primary shadow-sm' : 'text-text-muted'}`}
                  onClick={() => setViewMode('table')}
                  title="Table view"
                  type="button"
                >
                  <Box as="svg" w="4" h="4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3h18v18H3zM21 9H3M21 15H3M9 3v18"></path>
                  </Box>
                </button>
              </div>
            </div>
          </div>

          {showFilters ? (
            <div className="sl-chip-row">
              <button
                className={`sl-chip ${selectedTag === '' ? 'sl-chip-active' : ''}`}
                onClick={() => setSelectedTag('')}
                type="button"
              >
                All Tags
              </button>
              {uniqueTags.map((tag) => (
                <button
                  className={`sl-chip ${selectedTag === tag ? 'sl-chip-active' : ''}`}
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  type="button"
                >
                  {tag}
                </button>
              ))}
              {favorites.size > 0 ? (
                <button
                  className={`sl-chip ${selectedTag === 'favorites' ? 'sl-chip-active' : ''}`}
                  onClick={() => setSelectedTag('favorites')}
                  type="button"
                >
                  Favorites
                </button>
              ) : null}
            </div>
          ) : null}

          {sortedSongs.length === 0 ? (
            <EmptyState
              description={songs.length === 0 ? 'Add your first song to start building the library.' : 'Try adjusting your search or filters.'}
              icon={<span className="text-2xl">🎵</span>}
              title={songs.length === 0 ? 'No songs yet' : 'No songs found'}
              action={
                searchTerm || selectedTag ? (
                  <Button
                    className="btn-primary"
                    onClick={() => {
                      setSearchTerm('')
                      setSelectedTag('')
                    }}
                    size="sm"
                    type="button"
                  >
                    Clear Filters
                  </Button>
                ) : undefined
              }
            />
          ) : viewMode === 'grid' ? (
            sortBy === 'popular' && searchTerm === '' && selectedTag === '' ? (
              <div className="space-y-6">
                {favoriteSongs.length > 0 ? (
                  <div>
                    <div className="mb-4 flex items-center gap-2">
                      <span className="text-danger-500">♥</span>
                      <h2 className="section-title">Favorites</h2>
                      <span className="text-sm text-text-muted">({favoriteSongs.length})</span>
                    </div>
                    <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={3}>
                      {favoriteSongs.map(renderSongCard)}
                    </SimpleGrid>
                  </div>
                ) : null}

                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <span className="text-primary-600">◷</span>
                    <h2 className="section-title">Recently Used</h2>
                  </div>
                  <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={3}>
                    {recentlyUsedSongs.map(renderSongCard)}
                  </SimpleGrid>
                </div>

                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <span className="text-success-600">↗</span>
                    <h2 className="section-title">Most Used</h2>
                  </div>
                  <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={3}>
                    {popularSongs.map(renderSongCard)}
                  </SimpleGrid>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="section-title">
                    {searchTerm ? `Results for "${searchTerm}"` : 'All Songs'}
                    <span className="ml-2 text-sm text-text-muted">({sortedSongs.length})</span>
                  </h2>
                  {searchTerm || selectedTag ? (
                    <button
                      className="text-sm font-medium text-primary-600 hover:text-primary-700"
                      onClick={() => {
                        setSearchTerm('')
                        setSelectedTag('')
                      }}
                      type="button"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
                <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={3}>
                  {sortedSongs.map(renderSongCard)}
                </SimpleGrid>
              </div>
            )
          ) : (
            <div className="sl-compact-table">
              <div className="hidden grid-cols-[1fr_80px_80px_120px_100px_80px_48px] gap-3 border-b border-border bg-gray-50/50 px-4 py-2.5 sm:grid">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Song</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Key</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">BPM</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Tags</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Uses</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Last</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-center text-text-muted">Fav</span>
              </div>
              <div className="divide-y divide-border">
                {sortedSongs.map((song) => {
                  const usage = getSongUsage(song.id)
                  const isFavorite = favorites.has(song.id)

                  return (
                    <div
                      key={song.id}
                      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-medium text-text-primary">{song.title}</h3>
                          {isFavorite ? <Text color="red.500" fontSize="xs">♥</Text> : null}
                        </div>
                        <p className="mt-0.5 text-xs text-text-muted">{song.artist}</p>
                        <div className="mt-1 flex items-center gap-2 flex-wrap sm:hidden">
                          {song.key ? <Badge colorScheme="gray" variant="subtle" fontSize="10px">{song.key}</Badge> : null}
                          {song.bpm ? <Badge colorScheme="gray" variant="subtle" fontSize="10px">{song.bpm} BPM</Badge> : null}
                          <span className="text-xs text-text-muted">{usage.usageCount} uses</span>
                        </div>
                      </div>
                      <div className="hidden w-[80px] flex-shrink-0 sm:flex">
                        <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-text-muted">
                          {song.key || '-'}
                        </span>
                      </div>
                      <div className="hidden w-[80px] flex-shrink-0 sm:flex">
                        <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-text-muted">
                          {song.bpm || '-'}
                        </span>
                      </div>
                      <div className="hidden w-[120px] flex-shrink-0 flex-wrap items-center gap-1 sm:flex">
                        {song.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} colorScheme="blue" fontSize="10px" variant="subtle">
                            {tag}
                          </Badge>
                        ))}
                        {song.tags.length > 2 ? <span className="text-[10px] text-text-muted">+{song.tags.length - 2}</span> : null}
                      </div>
                      <div className="hidden w-[100px] flex-shrink-0 text-xs font-medium text-text-muted sm:block">
                        {usage.usageCount}
                      </div>
                      <div className="hidden w-[80px] flex-shrink-0 text-xs text-text-muted sm:block">
                        {timeAgo(usage.lastUsed)}
                      </div>
                      <div className="flex w-[48px] flex-shrink-0 items-center justify-center">
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100"
                          onClick={() => toggleFavorite(song.id)}
                          type="button"
                        >
                          <Text color={isFavorite ? 'red.500' : mutedTextColor} fontSize="sm">♥</Text>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        </VStack>
      </Box>
    </Box>
  )
} 
