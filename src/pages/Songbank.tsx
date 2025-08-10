import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCurrentUser } from '../lib/auth'
import { getUserPrimaryOrganization } from '../lib/auth'
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
  IconButton,
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
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
} from '@chakra-ui/react'
import { DashboardHeader } from '../components'
import type { User } from '@supabase/supabase-js'

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
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [songs, setSongs] = useState<Song[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedKey, setSelectedKey] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const { isOpen: isAddDrawerOpen, onOpen: onAddDrawerOpen, onClose: onAddDrawerClose } = useDisclosure()
  const { isOpen: isEditDrawerOpen, onOpen: onEditDrawerOpen, onClose: onEditDrawerClose } = useDisclosure()
  const [editingSong, setEditingSong] = useState<Song | null>(null)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table')
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

      setSongs(data || [])
    } catch (error) {
      console.error('Error loading songs:', error)
    }
  }

  const handleAddSong = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization) return

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

  const filteredSongs = songs.filter(song => {
    const matchesSearch = song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         song.artist.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesKey = !selectedKey || song.key === selectedKey
    const matchesTag = !selectedTag || song.tags.includes(selectedTag)
    
    return matchesSearch && matchesKey && matchesTag
  })

  const uniqueKeys = [...new Set(songs.map(song => song.key).filter(Boolean))]
  const uniqueTags = [...new Set(songs.flatMap(song => song.tags))]

  // Color mode values
  const bgColor = useColorModeValue('gray.50', 'gray.900')
  const cardBg = useColorModeValue('white', 'gray.800')
  const cardBorderColor = useColorModeValue('gray.200', 'gray.600')
  const cardHoverShadow = useColorModeValue(
    '0 4px 6px rgba(0, 0, 0, 0.1)',
    '0 4px 6px rgba(0, 0, 0, 0.3)'
  )
  const titleColor = useColorModeValue('gray.800', 'white')
  const subtitleColor = useColorModeValue('gray.600', 'gray.300')
  const textColor = useColorModeValue('gray.700', 'gray.200')
  const mutedTextColor = useColorModeValue('gray.500', 'gray.400')
  const tableHeaderBg = useColorModeValue('gray.50', 'gray.700')
  const tableHoverBg = useColorModeValue('gray.50', 'gray.700')

  if (loading) {
    return (
      <Box minH="100vh" bg={bgColor}>
        <DashboardHeader user={user} organization={organization} />

        <Box as="main" maxW="1200px" mx="auto" p={{ base: 6, md: 8 }}>
          {/* Back Button */}
          <Box mb={4}>
            <Button
              variant="ghost"
              colorScheme="gray"
              onClick={() => navigate('/dashboard')}
              leftIcon={<Text>←</Text>}
              size="sm"
            >
              Back to Dashboard
            </Button>
          </Box>

          {/* Header Section */}
          <Box
            bg={cardBg}
            p={4}
            borderRadius="lg"
            boxShadow="sm"
            border="1px"
            borderColor={cardBorderColor}
            mb={3}
          >
            <Flex
              direction={{ base: 'column', md: 'row' }}
              justify="space-between"
              align={{ base: 'stretch', md: 'center' }}
              gap={4}
            >
              <Heading as="h2" size="lg" color={titleColor} m={0} fontWeight="600">
                🎵 Songbank
              </Heading>
              <Button
                colorScheme="green"
                onClick={onAddDrawerOpen}
                size="md"
                isDisabled={true}
              >
                + Add Song
              </Button>
            </Flex>
          </Box>

          {/* Search, Filters, and View Toggle - Always Visible */}
          <Box
            bg={cardBg}
            p={4}
            borderRadius="lg"
            boxShadow="sm"
            border="1px"
            borderColor={cardBorderColor}
            mb={4}
          >
            <Flex
              direction={{ base: 'column', lg: 'row' }}
              gap={4}
              align={{ base: 'stretch', lg: 'center' }}
              w="full"
              flexWrap="wrap"
              justify="space-between"
            >
              {/* Search */}
              <Box flex="6" minW="200px">
                <Input
                  placeholder="Loading songs..."
                  value=""
                  size="md"
                  w="full"
                  isDisabled={true}
                />
              </Box>

              {/* Key Filter */}
              <Box flex="3" minW="120px" maxW="200px">
                <Select
                  value=""
                  size="md"
                  minW="100px"
                  w="full"
                  isDisabled={true}
                >
                  <option value="">Loading...</option>
                </Select>
              </Box>

              {/* Tag Filter */}
              <Box flex="3" minW="120px" maxW="200px">
                <Select
                  value=""
                  size="md"
                  minW="100px"
                  w="full"
                  isDisabled={true}
                >
                  <option value="">Loading...</option>
                </Select>
              </Box>

              {/* View Toggle */}
              <Box flex="0 0 auto" minW="80px">
                <HStack spacing={1} bg="gray.100" p="1" borderRadius="md">
                  <IconButton
                    aria-label="Card View"
                    icon={<Box as="svg" w="4" h="4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7"></rect>
                      <rect x="14" y="3" width="7" height="7"></rect>
                      <rect x="14" y="14" width="7" height="7"></rect>
                      <rect x="3" y="14" width="7" height="7"></rect>
                    </Box>}
                    size="sm"
                    variant="ghost"
                    colorScheme="gray"
                    isDisabled={true}
                  />
                  <IconButton
                    aria-label="Table View"
                    icon={<Box as="svg" w="4" h="4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 3h18v18H3zM21 9H3M21 15H3M9 3v18"></path>
                    </Box>}
                    size="sm"
                    variant="ghost"
                    colorScheme="gray"
                    isDisabled={true}
                  />
                </HStack>
              </Box>
            </Flex>
          </Box>

          {/* Songs Table Skeleton - Only the data content */}
          <Box
            bg={cardBg}
            borderRadius="lg"
            boxShadow="sm"
            border="1px"
            borderColor={cardBorderColor}
            overflow="hidden"
          >
            <Box overflowX="auto">
              <Table variant="simple" minW="800px">
                <Thead>
                  <Tr>
                    <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="200px" maxW="250px">Title</Th>
                    <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="150px">Artist</Th>
                    <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="80px">Key</Th>
                    <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="80px">BPM</Th>
                    <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="120px">Tags</Th>
                    <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="120px">Links</Th>
                    <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="120px">Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {[1, 2, 3, 4, 5].map((index) => (
                    <Tr key={index}>
                      <Td minW="200px" maxW="250px">
                        <Skeleton height="16px" width="80%" />
                      </Td>
                      <Td minW="150px">
                        <Skeleton height="16px" width="70%" />
                      </Td>
                      <Td minW="80px">
                        <Skeleton height="16px" width="40px" />
                      </Td>
                      <Td minW="80px">
                        <Skeleton height="16px" width="30px" />
                      </Td>
                      <Td minW="120px">
                        <HStack spacing={1}>
                          <Skeleton height="16px" width="50px" />
                          <Skeleton height="16px" width="60px" />
                        </HStack>
                      </Td>
                      <Td minW="120px">
                        <HStack spacing={2}>
                          <Skeleton height="24px" width="24px" />
                          <Skeleton height="24px" width="24px" />
                        </HStack>
                      </Td>
                      <Td minW="120px">
                        <HStack spacing={2}>
                          <Skeleton height="24px" width="40px" />
                          <Skeleton height="24px" width="50px" />
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </Box>
        </Box>
      </Box>
    )
  }

  return (
    <Box minH="100vh" bg={bgColor}>
      <DashboardHeader user={user} organization={organization} />

      <Box as="main" maxW="1200px" mx="auto" p={{ base: 6, md: 8 }}>
        {/* Back Button - Top Left */}
        <Box mb={4}>
          <Button
            variant="ghost"
            colorScheme="gray"
            onClick={() => navigate('/dashboard')}
            leftIcon={<Text>←</Text>}
            size="sm"
          >
            Back to Dashboard
          </Button>
        </Box>

        {/* Compact Header Section */}
        <Box
          bg={cardBg}
          p={4}
          borderRadius="lg"
          boxShadow="sm"
          border="1px"
          borderColor={cardBorderColor}
          mb={3}
        >
          <Flex
            direction={{ base: 'column', md: 'row' }}
            justify="space-between"
            align={{ base: 'stretch', md: 'center' }}
            gap={4}
          >
            {/* Title - Compact */}
            <Box>
              <Heading as="h2" size="lg" color={titleColor} m={0} fontWeight="600">
                🎵 Songbank
              </Heading>
            </Box>

            {/* Add Song Button - Green */}
            <Button
              colorScheme="green"
              onClick={onAddDrawerOpen}
              size="md"
              position="relative"
              overflow="hidden"
              _before={{
                content: '""',
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                animation: 'shimmer 4.5s infinite',
              }}
                              sx={{
                  '@keyframes shimmer': {
                    '0%': { left: '-100%' },
                    '33.33%': { left: '100%' },
                    '100%': { left: '100%' },
                  },
                }}
            >
              + Add Song
            </Button>
          </Flex>
        </Box>

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
                Add New Song
              </Heading>
            </DrawerHeader>
            
            <DrawerBody bg={bgColor} p={6}>
              <Box as="form" onSubmit={handleAddSong}>
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
                      onClick={onAddDrawerClose}
                      size="md"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      colorScheme="green"
                      size="md"
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
                      type="submit"
                      colorScheme="blue"
                      size="md"
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

        {/* Search, Filters, and View Toggle - All in One Line */}
        <Box
          bg={cardBg}
          p={4}
          borderRadius="lg"
          boxShadow="sm"
          border="1px"
          borderColor={cardBorderColor}
          mb={2}
        >
          <Flex
            direction={{ base: 'column', lg: 'row' }}
            gap={4}
            align={{ base: 'stretch', lg: 'center' }}
            w="full"
            flexWrap="wrap"
            justify="space-between"
          >
            {/* Search */}
            <Box flex="6" minW="200px">
              <Input
                placeholder={loading ? "Loading songs..." : "Search songs..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="md"
                w="full"
                isDisabled={loading}
              />
            </Box>

            {/* Key Filter */}
            <Box flex="3" minW="120px" maxW="200px">
              <Select
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                size="md"
                minW="100px"
                w="full"
                isDisabled={loading}
              >
                <option value="">{loading ? 'Loading...' : 'All Keys'}</option>
                {!loading && uniqueKeys.map(key => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </Select>
            </Box>

            {/* Tag Filter */}
            <Box flex="3" minW="120px" maxW="200px">
              <Select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                size="md"
                minW="100px"
                w="full"
                isDisabled={loading}
              >
                <option value="">{loading ? 'Loading...' : 'All Tags'}</option>
                {!loading && uniqueTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </Select>
            </Box>

            {/* View Toggle */}
            <Box flex="0 0 auto" minW="80px">
              <HStack spacing={1} bg="gray.100" p="1" borderRadius="md">
                <IconButton
                  aria-label="Card View"
                  icon={<Box as="svg" w="4" h="4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </Box>}
                  size="sm"
                  variant={viewMode === 'cards' ? 'solid' : 'ghost'}
                  colorScheme={viewMode === 'cards' ? 'blue' : 'gray'}
                  onClick={() => setViewMode('cards')}
                />
                <IconButton
                  aria-label="Table View"
                  icon={<Box as="svg" w="4" h="4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3h18v18H3zM21 9H3M21 15H3M9 3v18"></path>
                  </Box>}
                  size="sm"
                  variant={viewMode === 'table' ? 'solid' : 'ghost'}
                  colorScheme={viewMode === 'table' ? 'blue' : 'gray'}
                  onClick={() => setViewMode('table')}
                />
              </HStack>
            </Box>
          </Flex>
        </Box>

        {/* Songs List */}
        {filteredSongs.length === 0 ? (
          <Box
            bg={cardBg}
            p={12}
            borderRadius="lg"
            boxShadow="sm"
            border="1px"
            borderColor={cardBorderColor}
            textAlign="center"
          >
            <Text color={mutedTextColor} fontSize="md">
              No songs found. {songs.length === 0 ? 'Add your first song to get started!' : 'Try adjusting your search or filters.'}
            </Text>
          </Box>
        ) : viewMode === 'cards' ? (
          // Card View
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
            {filteredSongs.map(song => (
              <Box
                key={song.id}
                bg={cardBg}
                p={3}
                borderRadius="lg"
                boxShadow="sm"
                border="1px"
                borderColor={cardBorderColor}
                transition="all 0.2s ease"
                _hover={{
                  transform: 'translateY(-1px)',
                  boxShadow: cardHoverShadow
                }}
              >
                <VStack spacing={2} align="stretch">
                  <Box>
                    <Heading as="h3" size="md" color={titleColor} mb={1} fontWeight="600">
                      {song.title}
                    </Heading>
                    <Text color={subtitleColor} fontSize="md" mb={2}>
                      {song.artist}
                    </Text>
                    
                    {(song.key || song.bpm || song.ccli_number) && (
                      <HStack spacing={2} mb={2} flexWrap="wrap">
                        {song.key && (
                          <Badge colorScheme="gray" variant="subtle" fontSize="xs">
                            Key: {song.key}
                          </Badge>
                        )}
                        {song.bpm && (
                          <Badge colorScheme="gray" variant="subtle" fontSize="xs">
                            BPM: {song.bpm}
                          </Badge>
                        )}
                        {song.ccli_number && (
                          <Badge colorScheme="gray" variant="subtle" fontSize="xs">
                            CCLI: {song.ccli_number}
                          </Badge>
                        )}
                      </HStack>
                    )}

                    {song.tags.length > 0 && (
                      <HStack spacing={2} mb={2} flexWrap="wrap">
                        {song.tags.map(tag => (
                          <Badge key={tag} colorScheme="blue" fontSize="xs">
                            {tag}
                          </Badge>
                        ))}
                      </HStack>
                    )}

                    {(song.youtube_url || song.spotify_url) && (
                      <HStack spacing={2} mb={3}>
                        {song.youtube_url && (
                          <Button
                            as="a"
                            href={song.youtube_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            size="sm"
                            colorScheme="red"
                            leftIcon={<Text>🎬</Text>}
                          />
                        )}
                        {song.spotify_url && (
                          <Button
                            as="a"
                            href={song.spotify_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            size="sm"
                            colorScheme="green"
                            leftIcon={<Text>🎵</Text>}
                          />
                        )}
                      </HStack>
                    )}
                  </Box>

                  <HStack spacing={1} justify="flex-end">
                    <Button
                      size="xs"
                      variant="outline"
                      colorScheme="gray"
                      onClick={() => openEditForm(song)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="xs"
                      colorScheme="red"
                                              onClick={() => openDeleteModal(song)}
                    >
                      Delete
                    </Button>
                  </HStack>
                </VStack>
              </Box>
            ))}
          </SimpleGrid>
        ) : (
          // Table View
          <Box
            bg={cardBg}
            borderRadius="lg"
            boxShadow="sm"
            border="1px"
            borderColor={cardBorderColor}
            overflow="hidden"
          >
            {/* Mobile Responsive Table Container */}
            <Box
              overflowX="auto"
              css={{
                '&::-webkit-scrollbar': {
                  height: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  background: 'transparent',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: useColorModeValue('gray.300', 'gray.600'),
                  borderRadius: '4px',
                },
                '&::-webkit-scrollbar-thumb:hover': {
                  background: useColorModeValue('gray.400', 'gray.500'),
                },
              }}
            >
              <Table variant="simple" minW="800px">
                <Thead>
                  <Tr>
                    <Th 
                      bg={tableHeaderBg} 
                      color={textColor} 
                      fontSize="sm" 
                      fontWeight="600"
                      position="sticky"
                      left="0"
                      zIndex="1"
                      minW="200px"
                      maxW="250px"
                    >
                      Title
                    </Th>
                    <Th 
                      bg={tableHeaderBg} 
                      color={textColor} 
                      fontSize="sm" 
                      fontWeight="600"
                      minW="150px"
                    >
                      Artist
                    </Th>
                    <Th 
                      bg={tableHeaderBg} 
                      color={textColor} 
                      fontSize="sm" 
                      fontWeight="600"
                      minW="80px"
                    >
                      Key
                    </Th>
                    <Th 
                      bg={tableHeaderBg} 
                      color={textColor} 
                      fontSize="sm" 
                      fontWeight="600"
                      minW="80px"
                    >
                      BPM
                    </Th>
                    <Th 
                      bg={tableHeaderBg} 
                      color={textColor} 
                      fontSize="sm" 
                      fontWeight="600"
                      minW="120px"
                    >
                      Tags
                    </Th>
                    <Th 
                      bg={tableHeaderBg} 
                      color={textColor} 
                      fontSize="sm" 
                      fontWeight="600"
                      minW="120px"
                    >
                      Links
                    </Th>
                    <Th 
                      bg={tableHeaderBg} 
                      color={textColor} 
                      fontSize="sm" 
                      fontWeight="600"
                      minW="120px"
                    >
                      Actions
                    </Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredSongs.map(song => (
                    <Tr key={song.id} _hover={{ bg: tableHoverBg }}>
                      <Td 
                        fontWeight="500" 
                        color={titleColor}
                        position="sticky"
                        left="0"
                        bg={cardBg}
                        zIndex="1"
                        minW="200px"
                        maxW="250px"
                        borderRight="1px"
                        borderColor={cardBorderColor}
                      >
                        {song.title}
                      </Td>
                      <Td minW="150px">{song.artist}</Td>
                      <Td minW="80px">{song.key || '-'}</Td>
                      <Td minW="80px">{song.bpm || '-'}</Td>
                      <Td minW="120px">
                        {song.tags.length > 0 ? (
                          <HStack spacing={1} flexWrap="wrap">
                            {song.tags.map(tag => (
                              <Badge key={tag} colorScheme="blue" fontSize="xs" size="sm">
                                {tag}
                              </Badge>
                            ))}
                          </HStack>
                        ) : '-'}
                      </Td>
                      <Td minW="120px">
                        {(song.youtube_url || song.spotify_url) && (
                          <HStack spacing={2}>
                            {song.youtube_url && (
                              <Button
                                as="a"
                                href={song.youtube_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                size="xs"
                                colorScheme="red"
                                leftIcon={<Text fontSize="xs">🎬</Text>}
                              />
                            )}
                            {song.spotify_url && (
                              <Button
                                as="a"
                                href={song.spotify_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                size="xs"
                                colorScheme="green"
                                leftIcon={<Text fontSize="xs">🎵</Text>}
                              />
                            )}
                          </HStack>
                        )}
                      </Td>
                      <Td minW="120px">
                        <HStack spacing={2}>
                          <Button
                            size="xs"
                            variant="outline"
                            colorScheme="gray"
                            onClick={() => openEditForm(song)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="xs"
                            colorScheme="red"
                            onClick={() => openDeleteModal(song)}
                          >
                            Delete
                          </Button>
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  )
} 