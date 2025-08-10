import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCurrentUser, getUserPrimaryOrganization } from '../lib/auth'
import { DashboardHeader, DeleteServiceModal } from '../components'
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
  Textarea,
  Alert,
  AlertIcon,
  Badge,
  Flex,
  Center,
  Grid,
} from '@chakra-ui/react'
import type { User } from '@supabase/supabase-js'

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

// Song interface moved to where it's actually used

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

export function ScheduleService() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [services, setServices] = useState<WorshipService[]>([])
  const [creating, setCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  
  // Form state
  const [title, setTitle] = useState('')
  const [serviceDate, setServiceDate] = useState('')
  const [serviceTime, setServiceTime] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [serviceToDelete, setServiceToDelete] = useState<WorshipService | null>(null)
  const [deleting, setDeleting] = useState(false)

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
      setLoading(false)
    } catch (error) {
      console.error('Error checking user and organization:', error)
      navigate('/login')
    }
  }, [navigate])

  // Load services
  const loadServices = useCallback(async () => {
    if (!organization) return

    try {
      const { data, error } = await supabase
        .from('worship_services')
        .select('*')
        .eq('organization_id', organization.organization_id)
        .order('service_date', { ascending: true })
        .order('service_time', { ascending: true })

      if (error) {
        console.error('Error loading services:', error)
        return
      }

      // Sort services to show nearest upcoming service first
      const now = new Date()
      const sortedServices = (data || []).sort((a, b) => {
        const dateA = new Date(a.service_date + (a.service_time ? `T${a.service_time}` : 'T00:00'))
        const dateB = new Date(b.service_date + (b.service_time ? `T${b.service_time}` : 'T00:00'))
        
        // If both services are in the past, show most recent first
        if (dateA < now && dateB < now) {
          return dateB.getTime() - dateA.getTime()
        }
        
        // If both services are in the future, show nearest first
        if (dateA >= now && dateB >= now) {
          return dateA.getTime() - dateB.getTime()
        }
        
        // If one is past and one is future, show future first
        if (dateA >= now && dateB < now) return -1
        if (dateA < now && dateB >= now) return 1
        
        return 0
      })

      setServices(sortedServices)
    } catch (error) {
      console.error('Error loading services:', error)
    }
  }, [organization])

  useEffect(() => {
    checkUserAndOrganization()
  }, [checkUserAndOrganization])

  useEffect(() => {
    if (organization) {
      loadServices()
    }
  }, [organization, loadServices])

  // Create new service
  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!organization || !user) {
      setError('You must be logged in to create a service.')
      return
    }

    if (!title.trim() || !serviceDate) {
      setError('Please fill in all required fields.')
      return
    }

    try {
      setCreating(true)
      setError('')

      const { error } = await supabase
        .from('worship_services')
        .insert({
          organization_id: organization.organization_id,
          title: title.trim(),
          service_date: serviceDate,
          service_time: serviceTime || null,
          description: description.trim() || null,
          status: 'draft',
          created_by: user.id
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating service:', error)
        setError('Failed to create service. Please try again.')
        return
      }

      setSuccess('Service created successfully!')
      setTitle('')
      setServiceDate('')
      setServiceTime('')
      setDescription('')
      setShowCreateForm(false)
      
      await loadServices()
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error creating service:', error)
      setError('Failed to create service. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatServiceTitle = (dateString: string, title: string) => {
    const date = new Date(dateString)
    const month = date.toLocaleDateString('en-US', { month: 'short' })
    const day = date.getDate()
    return `${month} ${day} - ${title}`
  }

  const getStatusBadge = (status: string) => {
    const statusColorScheme = {
      draft: 'yellow',
      published: 'green',
      completed: 'blue'
    }
    return statusColorScheme[status as keyof typeof statusColorScheme] || 'yellow'
  }

  const handleDeleteService = (service: WorshipService) => {
    setServiceToDelete(service)
    setDeleteModalOpen(true)
  }

  const confirmDeleteService = async () => {
    if (!serviceToDelete || !organization) return

    setDeleting(true)
    setError('')

    try {
      // Delete service songs first (cascade delete)
      const { error: songsError } = await supabase
        .from('service_songs')
        .delete()
        .eq('service_id', serviceToDelete.id)

      if (songsError) {
        console.error('Error deleting service songs:', songsError)
        throw new Error('Failed to delete service songs')
      }

      // Delete the service
      const { error: serviceError } = await supabase
        .from('worship_services')
        .delete()
        .eq('id', serviceToDelete.id)
        .eq('organization_id', organization.organization_id)

      if (serviceError) {
        console.error('Error deleting service:', serviceError)
        throw new Error('Failed to delete service')
      }

      // Remove from local state
      setServices(prev => prev.filter(s => s.id !== serviceToDelete.id))
      setSuccess(`Service "${serviceToDelete.title}" has been deleted successfully`)
      
      // Close modal and reset state
      setDeleteModalOpen(false)
      setServiceToDelete(null)
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error deleting service:', error)
      setError(error instanceof Error ? error.message : 'Failed to delete service')
    } finally {
      setDeleting(false)
    }
  }

  const closeDeleteModal = () => {
    setDeleteModalOpen(false)
    setServiceToDelete(null)
  }

  if (loading) {
    return (
      <Box minH="100vh" bg={bgColor}>
        <Center h="100vh">
          <VStack spacing={4}>
            <Spinner size="xl" color="blue.500" />
            <Text color={textColor}>Loading services...</Text>
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
            mb={5}
            direction={{ base: 'column', md: 'row' }}
            gap={{ base: 5, md: 0 }}
            flexWrap="wrap"
          >
            <Box flex="1" minW="300px">
              <Heading as="h2" size="lg" color={textColor} mb={2} mt={8}>
                Schedule Service
              </Heading>
              <Text color={textSecondaryColor} fontSize="lg">
                Create and manage worship services for your organization
              </Text>
            </Box>
            
            <HStack spacing={3} flexShrink={0} flexWrap="wrap">
              <Button
                colorScheme="blue"
                onClick={() => setShowCreateForm(!showCreateForm)}
                size="md"
              >
                {showCreateForm ? 'Cancel' : 'Create New Service'}
              </Button>
              <Button
                variant="outline"
                colorScheme="gray"
                onClick={() => navigate('/dashboard')}
                size="md"
              >
                Back to Dashboard
              </Button>
            </HStack>
          </Flex>

          {/* Messages */}
          {error && (
            <Alert status="error" borderRadius="md" mb={5}>
              <AlertIcon />
              {error}
            </Alert>
          )}

          {success && (
            <Alert status="success" borderRadius="md" mb={5}>
              <AlertIcon />
              {success}
            </Alert>
          )}

          {/* Create Form */}
          {showCreateForm && (
            <Box
              bg={cardBg}
              borderRadius="lg"
              boxShadow="sm"
              border="1px"
              borderColor={cardBorderColor}
              p={6}
              mb={6}
            >
              <Heading as="h3" size="md" color={textColor} mb={5}>
                Create New Service
              </Heading>
              
              <form onSubmit={handleCreateService}>
                <VStack spacing={5} align="stretch">
                  <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={5}>
                    <FormControl isRequired>
                      <FormLabel fontSize="sm" fontWeight="500" color={textColor}>
                        Service Title *
                      </FormLabel>
                      <Input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Sunday Morning Service"
                        size="md"
                      />
                    </FormControl>
                    
                    <FormControl isRequired>
                      <FormLabel fontSize="sm" fontWeight="500" color={textColor}>
                        Service Date *
                      </FormLabel>
                      <Input
                        type="date"
                        value={serviceDate}
                        onChange={(e) => setServiceDate(e.target.value)}
                        size="md"
                      />
                    </FormControl>
                  </Grid>
                  
                  <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={5}>
                    <FormControl>
                      <FormLabel fontSize="sm" fontWeight="500" color={textColor}>
                        Service Time
                      </FormLabel>
                      <Input
                        type="time"
                        value={serviceTime}
                        onChange={(e) => setServiceTime(e.target.value)}
                        size="md"
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel fontSize="sm" fontWeight="500" color={textColor}>
                        Description
                      </FormLabel>
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Optional description or notes..."
                        rows={3}
                        resize="vertical"
                        minH="80px"
                      />
                    </FormControl>
                  </Grid>

                  <HStack spacing={3} pt={2}>
                    <Button
                      type="submit"
                      colorScheme="blue"
                      isLoading={creating}
                      loadingText="Creating Service..."
                      disabled={!title.trim() || !serviceDate}
                      size="md"
                    >
                      Create Service
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      colorScheme="gray"
                      onClick={() => setShowCreateForm(false)}
                      size="md"
                    >
                      Cancel
                    </Button>
                  </HStack>
                </VStack>
              </form>
            </Box>
          )}

          {/* Services List */}
          <Box
            bg={cardBg}
            borderRadius="lg"
            boxShadow="sm"
            border="1px"
            borderColor={cardBorderColor}
            p={6}
          >
            <Heading as="h3" size="md" color={textColor} mb={5}>
              Worship Services ({services.length})
            </Heading>
            
            {services.length === 0 ? (
              <Box textAlign="center" py={10}>
                <Text fontSize="lg" fontWeight="500" color={textMutedColor} mb={2}>
                  No services found
                </Text>
                <Text color={textMutedColor}>
                  Create your first worship service to get started.
                </Text>
              </Box>
            ) : (
              <VStack spacing={5} align="stretch">
                {services.map(service => (
                  <Box
                    key={service.id}
                    bg={cardBg}
                    borderRadius="lg"
                    border="1px"
                    borderColor={cardBorderColor}
                    boxShadow="sm"
                    p={6}
                    transition="all 0.2s ease"
                    _hover={{
                      bg: useColorModeValue('gray.50', 'gray.700'),
                      borderColor: useColorModeValue('gray.300', 'gray.500'),
                      boxShadow: 'md'
                    }}
                  >
                    <Box>
                      {/* Service Header */}
                      <Flex 
                        align="center" 
                        gap={3} 
                        mb={3}
                        direction={{ base: 'column', sm: 'row' }}
                        alignSelf={{ base: 'flex-start', sm: 'center' }}
                      >
                        <Heading as="h4" size="md" color={textColor} fontWeight="600">
                          {formatServiceTitle(service.service_date, service.title)}
                        </Heading>
                        <Badge
                          colorScheme={getStatusBadge(service.status)}
                          variant="subtle"
                          textTransform="capitalize"
                          fontSize="xs"
                          px={2}
                          py={1}
                        >
                          {service.status}
                        </Badge>
                      </Flex>
                      
                      {/* Service Details */}
                      <VStack spacing={2} align="stretch">
                        <Text fontWeight="500" color={textColor} fontSize="sm">
                          {formatDate(service.service_date)}
                        </Text>
                        
                        {service.service_time && (
                          <Text color={textMutedColor} fontSize="sm">
                            {service.service_time}
                          </Text>
                        )}
                        
                        {service.description && (
                          <Text color={textSecondaryColor} fontSize="sm" lineHeight="1.5">
                            {service.description}
                          </Text>
                        )}
                        
                        {/* Service Actions */}
                        <HStack spacing={3} mt={4} flexWrap="wrap">
                          <Button
                            colorScheme="blue"
                            size="sm"
                            onClick={() => navigate(`/service/${service.id}`)}
                          >
                            View Details
                          </Button>
                          <Button
                            variant="outline"
                            colorScheme="gray"
                            size="sm"
                            onClick={() => navigate(`/service/${service.id}/edit`)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            colorScheme="red"
                            size="sm"
                            onClick={() => handleDeleteService(service)}
                          >
                            Delete
                          </Button>
                        </HStack>
                      </VStack>
                    </Box>
                  </Box>
                ))}
              </VStack>
            )}
          </Box>
        </Container>
      </Box>

      <DeleteServiceModal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDeleteService}
        serviceTitle={serviceToDelete?.title || ''}
        isLoading={deleting}
      />
    </Box>
  )
} 