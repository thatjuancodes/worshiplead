import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCurrentUser } from '../lib/auth'
import { getUserPrimaryOrganization } from '../lib/auth'
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  Grid,
  SimpleGrid,
  useColorModeValue,
  useToast,
  Spinner,
  Input,
  FormControl,
  FormLabel,
  Textarea,
  Select,
  Badge,
  Flex,
  Center,
  IconButton,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td
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
  const [showAddForm, setShowAddForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingSong, setEditingSong] = useState<Song | null>(null)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table')
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
      setShowAddForm(false)
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

  const handleDeleteSong = async (songId: string) => {
    if (!confirm('Are you sure you want to delete this song?')) return

    try {
      const { error } = await supabase
        .from('songs')
        .delete()
        .eq('id', songId)

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
      setShowEditForm(false)
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
    setShowEditForm(true)
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
              Loading your songbank...
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
        {/* Header Section */}
        <Box
          bg={cardBg}
          p={6}
          borderRadius="lg"
          boxShadow="sm"
          border="1px"
          borderColor={cardBorderColor}
          mb={8}
        >
          <Flex
            direction={{ base: 'column', lg: 'row' }}
            justify="space-between"
            align={{ base: 'stretch', lg: 'flex-start' }}
            gap={6}
          >
            {/* Title */}
            <Box flex="1" minW="300px">
              <VStack spacing={2} align="start">
                <Heading as="h2" size="xl" color={titleColor} m={0} fontWeight="600">
                  🎵 Songbank
                </Heading>
                <Text color={subtitleColor} fontSize="md" m={0}>
                  Manage your organization's worship song library
                </Text>
              </VStack>
            </Box>

            {/* Actions */}
            <VStack spacing={4} align="stretch" minW="auto">
              <Button
                variant="outline"
                colorScheme="gray"
                onClick={() => navigate('/dashboard')}
                leftIcon={<Text>←</Text>}
              >
                Back to Dashboard
              </Button>

              {/* View Toggle */}
              <HStack spacing={1} bg="gray.100" p={1} borderRadius="md">
                <IconButton
                  aria-label="Card View"
                  icon={<Box as="svg" w="5" h="5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                  icon={<Box as="svg" w="5" h="5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3h18v18H3zM21 9H3M21 15H3M9 3v18"></path>
                  </Box>}
                  size="sm"
                  variant={viewMode === 'table' ? 'solid' : 'ghost'}
                  colorScheme={viewMode === 'table' ? 'blue' : 'gray'}
                  onClick={() => setViewMode('table')}
                />
              </HStack>

              <Button
                colorScheme="blue"
                onClick={() => setShowAddForm(!showAddForm)}
                size="md"
              >
                {showAddForm ? 'Cancel' : '+ Add Song'}
              </Button>
            </VStack>
          </Flex>
        </Box>

        {/* Add Song Form */}
        {showAddForm && (
          <Box
            bg={cardBg}
            p={6}
            borderRadius="lg"
            boxShadow="sm"
            border="1px"
            borderColor={cardBorderColor}
            mb={8}
          >
            <Heading as="h3" size="lg" color={titleColor} mb={6} fontWeight="600">
              Add New Song
            </Heading>
            
            <Box as="form" onSubmit={handleAddSong}>
              <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4} mb={4}>
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

              <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4} mb={4}>
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

              <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={4} mb={4}>
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
                    placeholder="123456"
                    size="md"
                  />
                </FormControl>
              </Grid>

              <FormControl mb={4}>
                <FormLabel fontWeight="600" color={textColor} fontSize="sm">Tags</FormLabel>
                <Input
                  value={formData.tags}
                  onChange={(e) => setFormData({...formData, tags: e.target.value})}
                  placeholder="praise, reflection, communion (comma-separated)"
                  size="md"
                />
              </FormControl>

              <FormControl mb={6}>
                <FormLabel fontWeight="600" color={textColor} fontSize="sm">Lyrics</FormLabel>
                <Textarea
                  value={formData.lyrics}
                  onChange={(e) => setFormData({...formData, lyrics: e.target.value})}
                  placeholder="Enter song lyrics (markdown supported)"
                  rows={6}
                  resize="vertical"
                />
              </FormControl>

              <HStack spacing={4}>
                <Button type="submit" colorScheme="blue" size="md">
                  Add Song
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  colorScheme="gray"
                  onClick={() => setShowAddForm(false)}
                  size="md"
                >
                  Cancel
                </Button>
              </HStack>
            </Box>
          </Box>
        )}

        {/* Edit Song Form */}
        {showEditForm && (
          <Box
            bg={cardBg}
            p={6}
            borderRadius="lg"
            boxShadow="sm"
            border="1px"
            borderColor={cardBorderColor}
            mb={8}
          >
            <Heading as="h3" size="lg" color={titleColor} mb={6} fontWeight="600">
              Edit Song
            </Heading>
            
            <Box as="form" onSubmit={handleEditSong}>
              <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4} mb={4}>
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

              <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4} mb={4}>
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

              <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={4} mb={4}>
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
                    placeholder="123456"
                    size="md"
                  />
                </FormControl>
              </Grid>

              <FormControl mb={4}>
                <FormLabel fontWeight="600" color={textColor} fontSize="sm">Tags</FormLabel>
                <Input
                  value={formData.tags}
                  onChange={(e) => setFormData({...formData, tags: e.target.value})}
                  placeholder="praise, reflection, communion (comma-separated)"
                  size="md"
                />
              </FormControl>

              <FormControl mb={6}>
                <FormLabel fontWeight="600" color={textColor} fontSize="sm">Lyrics</FormLabel>
                <Textarea
                  value={formData.lyrics}
                  onChange={(e) => setFormData({...formData, lyrics: e.target.value})}
                  placeholder="Enter song lyrics (markdown supported)"
                  rows={6}
                  resize="vertical"
                />
              </FormControl>

              <HStack spacing={4}>
                <Button type="submit" colorScheme="blue" size="md">
                  Update Song
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  colorScheme="gray"
                  onClick={() => {
                    setShowEditForm(false)
                    setEditingSong(null)
                  }}
                  size="md"
                >
                  Cancel
                </Button>
              </HStack>
            </Box>
          </Box>
        )}

        {/* Filters */}
        <Box
          bg={cardBg}
          p={6}
          borderRadius="lg"
          boxShadow="sm"
          border="1px"
          borderColor={cardBorderColor}
          mb={8}
        >
          <Flex
            direction={{ base: 'column', lg: 'row' }}
            gap={4}
            align={{ base: 'stretch', lg: 'center' }}
          >
            <Box flex="1" minW="300px">
              <Input
                placeholder="Search songs by title or artist..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="md"
              />
            </Box>

            <HStack spacing={4} flexWrap="wrap">
              <Select
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                size="md"
                minW="120px"
              >
                <option value="">All Keys</option>
                {uniqueKeys.map(key => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </Select>

              <Select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                size="md"
                minW="120px"
              >
                <option value="">All Tags</option>
                {uniqueTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </Select>
            </HStack>
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
                p={5}
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
                <VStack spacing={3} align="stretch">
                  <Box>
                    <Heading as="h3" size="md" color={titleColor} mb={1} fontWeight="600">
                      {song.title}
                    </Heading>
                    <Text color={subtitleColor} fontSize="md" mb={3}>
                      {song.artist}
                    </Text>
                    
                    {(song.key || song.bpm || song.ccli_number) && (
                      <HStack spacing={2} mb={3} flexWrap="wrap">
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
                      <HStack spacing={2} mb={3} flexWrap="wrap">
                        {song.tags.map(tag => (
                          <Badge key={tag} colorScheme="blue" fontSize="xs">
                            {tag}
                          </Badge>
                        ))}
                      </HStack>
                    )}

                    {(song.youtube_url || song.spotify_url) && (
                      <HStack spacing={2} mb={4}>
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

                  <HStack spacing={2} justify="flex-end">
                    <Button
                      size="sm"
                      variant="outline"
                      colorScheme="gray"
                      onClick={() => openEditForm(song)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      colorScheme="red"
                      onClick={() => handleDeleteSong(song.id)}
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
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600">Title</Th>
                  <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600">Artist</Th>
                  <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600">Key</Th>
                  <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600">BPM</Th>
                  <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600">Tags</Th>
                  <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600">Links</Th>
                  <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredSongs.map(song => (
                  <Tr key={song.id} _hover={{ bg: tableHoverBg }}>
                    <Td fontWeight="500" color={titleColor}>
                      {song.title}
                    </Td>
                    <Td>{song.artist}</Td>
                    <Td>{song.key || '-'}</Td>
                    <Td>{song.bpm || '-'}</Td>
                    <Td>
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
                    <Td>
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
                    <Td>
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
                          onClick={() => handleDeleteSong(song.id)}
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
        )}
      </Box>
    </Box>
  )
} 