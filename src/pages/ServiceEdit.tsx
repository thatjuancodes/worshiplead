import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { getCurrentUser, getUserPrimaryOrganization } from '../lib/auth'
import { DashboardHeader } from '../components'
import { useOrganizationAccess } from '../hooks/useOrganizationAccess'
import { formatForDateTimeInput } from '../utils/dateTime'
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
  Select,
  Alert,
  AlertIcon,
  Flex,
  Center,
  Grid
} from '@chakra-ui/react'
import type { User } from '@supabase/supabase-js'

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

export function ServiceEdit() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { canManagePrimary } = useOrganizationAccess()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [service, setService] = useState<WorshipService | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    service_time: '',
    description: '',
    status: 'draft' as 'draft' | 'published' | 'completed'
  })

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
    if (!id) return

    try {
      const { data, error } = await supabase
        .from('worship_services')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        console.error('Error loading service:', error)
        setError('Failed to load service details.')
        return
      }

      if (!data) {
        setError('Service not found.')
        return
      }

      setService(data)
      
      // Set form data
      setFormData({
        title: data.title || '',
        service_time: data.service_time ? formatForDateTimeInput(data.service_time) : '',
        description: data.description || '',
        status: data.status || 'draft'
      })
    } catch (error) {
      console.error('Error loading service:', error)
      setError('Failed to load service details.')
    }
  }, [id])

  useEffect(() => {
    const initialize = async () => {
      await checkUserAndOrganization()
      await loadService()
      setLoading(false)
    }
    initialize()
  }, [checkUserAndOrganization, loadService])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!service) return

    if (!canManagePrimary) {
      setError('You do not have permission to edit services. Only admins and owners can edit services.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error } = await supabase
        .from('worship_services')
        .update({
          title: formData.title,
          service_time: new Date(formData.service_time).toISOString(),
          description: formData.description || null,
          status: formData.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', service.id)

      if (error) {
        console.error('Error updating service:', error)
        setError('Failed to update service.')
        return
      }

      setSuccess('Service updated successfully!')
      setTimeout(() => {
        navigate(`/service/${service.id}`)
      }, 1500)
    } catch (error) {
      console.error('Error updating service:', error)
      setError('Failed to update service.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    navigate(`/service/${id}`)
  }

  if (loading) {
    return (
      <Box minH="100vh" bg={bgColor}>
        <Center h="100vh">
          <VStack spacing={4}>
            <Spinner size="xl" color="blue.500" />
            <Text color={textColor}>{t('serviceEdit.loadingServiceDetails')}</Text>
          </VStack>
        </Center>
      </Box>
    )
  }

  // Check permissions after loading
  if (!canManagePrimary) {
    return (
      <Box minH="100vh" bg={bgColor}>
        <DashboardHeader user={user} organization={organization} />

        <Box as="main" py={8}>
          <Container maxW="800px" px={6}>
            <Box textAlign="center" py={12}>
              <Heading as="h2" size="lg" color="red.500" mb={4}>
                Access Denied
              </Heading>
              <Text color={textMutedColor} mb={6}>
                You do not have permission to edit services. Only admins and owners can edit services.
              </Text>
              <Button
                colorScheme="blue"
                onClick={() => navigate(`/service/${id}`)}
                size="md"
              >
                Back to Service
              </Button>
            </Box>
          </Container>
        </Box>
      </Box>
    )
  }

  if (error && !service) {
    return (
      <Box minH="100vh" bg={bgColor}>
        <DashboardHeader user={user} organization={organization} />

        <Box as="main" py={8}>
          <Container maxW="800px" px={6}>
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
        <Container maxW="800px" px={6}>
          {/* Header Section */}
          <Flex 
            justify="space-between" 
            align="flex-start" 
            mb={8}
            direction={{ base: 'column', md: 'row' }}
            gap={{ base: 4, md: 0 }}
          >
            <Box flex="1">
              <Heading as="h2" size="lg" color={textColor} mb={2} mt={8}>
                {t('serviceEdit.title')}
              </Heading>
              <Text color={textSecondaryColor} fontSize="lg">
                {t('serviceEdit.description')}
              </Text>
            </Box>
            
            <HStack spacing={3}>
              <Button
                variant="outline"
                colorScheme="gray"
                onClick={handleCancel}
                size="md"
              >
                Cancel
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

          {/* Form */}
          <Box
            bg={cardBg}
            borderRadius="lg"
            boxShadow="sm"
            border="1px"
            borderColor={cardBorderColor}
            overflow="hidden"
          >
            <Box p={8}>
              <form onSubmit={handleSubmit}>
                <VStack spacing={6} align="stretch">
                  {/* Service Title */}
                  <FormControl isRequired>
                    <FormLabel fontSize="sm" fontWeight="500" color={textColor}>
                      Service Title *
                    </FormLabel>
                    <Input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      placeholder="e.g., Sunday Morning Service"
                      size="md"
                    />
                  </FormControl>

                  {/* Service Date and Time */}
                  <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={6}>
                    <FormControl isRequired>
                      <FormLabel fontSize="sm" fontWeight="500" color={textColor}>
                        Service Date & Time *
                      </FormLabel>
                      <Input
                        type="datetime-local"
                        name="service_time"
                        value={formData.service_time}
                        onChange={handleInputChange}
                        size="md"
                      />
                    </FormControl>
                  </Grid>

                  {/* Status */}
                  <FormControl>
                    <FormLabel fontSize="sm" fontWeight="500" color={textColor}>
                      Status
                    </FormLabel>
                    <Select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      size="md"
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="completed">Completed</option>
                    </Select>
                  </FormControl>

                  {/* Description */}
                  <FormControl>
                    <FormLabel fontSize="sm" fontWeight="500" color={textColor}>
                      Description
                    </FormLabel>
                    <Textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={4}
                      placeholder="Add any additional details about this service..."
                      resize="vertical"
                      minH="100px"
                      size="md"
                    />
                  </FormControl>

                  {/* Form Actions */}
                  <Box
                    pt={6}
                    mt={8}
                    borderTop="1px"
                    borderColor={cardBorderColor}
                  >
                    <Flex 
                      justify="flex-end" 
                      gap={3}
                      direction={{ base: 'column-reverse', md: 'row' }}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        colorScheme="gray"
                        onClick={handleCancel}
                        disabled={saving}
                        size="md"
                        w={{ base: 'full', md: 'auto' }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        colorScheme="blue"
                        isLoading={saving}
                        loadingText="Saving..."
                        disabled={saving}
                        size="md"
                        w={{ base: 'full', md: 'auto' }}
                      >
                        Save Changes
                      </Button>
                    </Flex>
                  </Box>
                </VStack>
              </form>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  )
} 