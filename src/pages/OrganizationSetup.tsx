import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createOrganizationAndMembership, checkSlugAvailability, getUserPrimaryOrganization } from '../lib/auth'
import type { OrganizationData } from '../lib/auth'
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  FormControl,
  FormLabel,
  Input,
  Container,
  Card,
  CardBody,
  CardHeader,
  SimpleGrid,
  Divider
} from '@chakra-ui/react'

export function OrganizationSetup() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joinRequestSubmitted, setJoinRequestSubmitted] = useState(false)

  // Organization creation form state
  const [orgForm, setOrgForm] = useState({
    name: '',
    slug: ''
  })

  // Join organization form state
  const [joinForm, setJoinForm] = useState({
    organizationSlug: ''
  })

  // State for existing join request
  const [existingRequest, setExistingRequest] = useState<{
    organizationName: string
    organizationSlug: string
  } | null>(null)

  // Check if user already has an organization when component mounts
  useEffect(() => {
    const checkExistingOrganization = async () => {
      try {
        const { data: { user } } = await import('../lib/supabase').then(m => m.supabase.auth.getUser())
        if (!user) return

        const userOrg = await getUserPrimaryOrganization(user.id)
        if (userOrg) {
          // User already has an organization, redirect to dashboard
          navigate('/dashboard', { 
            state: { message: 'Welcome back! Redirected to your dashboard.' }
          })
        }
      } catch (error) {
        console.error('Error checking existing organization:', error)
      }
    }

    checkExistingOrganization()
  }, [navigate])

  // Handle organization slug change
  const handleOrganizationSlugChange = (slug: string) => {
    setJoinForm(prev => ({ ...prev, organizationSlug: slug }))
    // Clear existing request state when slug changes
    if (existingRequest) {
      setExistingRequest(null)
    }
    if (joinRequestSubmitted) {
      setJoinRequestSubmitted(false)
    }
  }

  // Handle organization creation
  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Check slug availability
      const isAvailable = await checkSlugAvailability(orgForm.slug)
      if (!isAvailable) {
        setError('Organization slug already exists. Please choose a different name.')
        return
      }

      const orgData: OrganizationData = {
        name: orgForm.name,
        slug: orgForm.slug
      }

      // Get current user ID
      const { data: { user } } = await import('../lib/supabase').then(m => m.supabase.auth.getUser())
      
      if (!user) {
        setError('User not authenticated')
        return
      }

      await createOrganizationAndMembership(user.id, orgData)
      
      // Success! Redirect to dashboard
      navigate('/dashboard', { 
        state: { message: 'Organization created successfully!' }
      })
    } catch (err) {
      console.error('Organization creation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to create organization')
    } finally {
      setLoading(false)
    }
  }

  // Handle joining organization
  const handleJoinOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Get current user ID
      const { data: { user } } = await import('../lib/supabase').then(m => m.supabase.auth.getUser())
      
      if (!user) {
        setError('User not authenticated')
        return
      }

      // Check for existing join request first
      const existingRequest = await checkExistingJoinRequest(joinForm.organizationSlug)
      if (existingRequest) {
        setExistingRequest(existingRequest)
        setLoading(false)
        return
      }

      // Get supabase client
      const { supabase } = await import('../lib/supabase')
      
      // First, get the organization ID from the slug
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('slug', joinForm.organizationSlug)
        .single()

      if (orgError || !orgData) {
        setError('Organization not found. Please check the slug and try again.')
        return
      }

      // Create organization join request
      const { error: joinRequestError } = await supabase
        .from('organization_join_requests')
        .insert({
          organization_id: orgData.id,
          user_id: user.id
        })

      if (joinRequestError) {
        console.error('Join request error:', joinRequestError)
        setError('Failed to submit join request. Please try again.')
        return
      }

      // Success! Show waiting message
      setJoinRequestSubmitted(true)
      // Don't set existingRequest here since this is a new request
    } catch (err) {
      console.error('Join organization error:', err)
      setError(err instanceof Error ? err.message : 'Failed to submit join request')
    } finally {
      setLoading(false)
    }
  }

  // Generate slug from organization name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const handleOrgNameChange = (name: string) => {
    setOrgForm(prev => ({
      ...prev,
      name,
      slug: generateSlug(name)
    }))
  }

  // Check for existing join request
  const checkExistingJoinRequest = async (organizationSlug: string) => {
    try {
      const { supabase } = await import('../lib/supabase')
      
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      // Get organization details
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .eq('slug', organizationSlug)
        .single()

      if (orgError || !orgData) return null

      // Check for existing join request
      const { data: existingRequestData, error: requestError } = await supabase
        .from('organization_join_requests')
        .select('*')
        .eq('organization_id', orgData.id)
        .eq('user_id', user.id)
        .single()

      if (requestError && requestError.code !== 'PGRST116') {
        console.error('Error checking existing request:', requestError)
        return null
      }

      if (existingRequestData) {
        return {
          organizationName: orgData.name,
          organizationSlug: orgData.slug
        }
      }

      return null
    } catch (error) {
      console.error('Error checking existing join request:', error)
      return null
    }
  }

  return (
    <Box minH="100vh" bg="gray.50" py={8}>
      <Container maxW="container.md">
        <VStack spacing={8} align="stretch">
          {/* Header */}
          <Box textAlign="center">
            <Heading as="h1" size="xl" color="blue.600" mb={2}>
              Worship Lead
            </Heading>
            <Heading as="h2" size="lg" mb={2}>
              Set Up Your Organization
            </Heading>
            <Text color="gray.600" fontSize="lg">
              Choose how you'd like to get started with Worship Lead
            </Text>
          </Box>

          {/* Error Display */}
          {error && (
            <Box
              bg="red.50"
              border="1px"
              borderColor="red.200"
              borderRadius="md"
              p={4}
              color="red.700"
            >
              {error}
            </Box>
          )}

          {/* Mode Selection */}
          {mode === 'select' && (
            <VStack spacing={6}>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} w="full">
                <Card
                  cursor="pointer"
                  onClick={() => setMode('create')}
                  _hover={{ shadow: 'lg', transform: 'translateY(-2px)' }}
                  transition="all 0.2s"
                >
                  <CardHeader>
                    <Heading size="md" color="blue.600">
                      Create New Organization
                    </Heading>
                  </CardHeader>
                  <CardBody>
                    <Text color="gray.600" mb={4}>
                      Start a new church or ministry organization
                    </Text>
                    <Button colorScheme="blue" w="full">
                      Create New
                    </Button>
                  </CardBody>
                </Card>

                <Card
                  cursor="pointer"
                  onClick={() => setMode('join')}
                  _hover={{ shadow: 'lg', transform: 'translateY(-2px)' }}
                  transition="all 0.2s"
                >
                  <CardHeader>
                    <Heading size="md" color="blue.600">
                      Join Existing Organization
                    </Heading>
                  </CardHeader>
                  <CardBody>
                    <Text color="gray.600" mb={4}>
                      Join an organization you've been invited to
                    </Text>
                    <Button colorScheme="blue" variant="outline" w="full">
                      Join Existing
                    </Button>
                  </CardBody>
                </Card>
              </SimpleGrid>


            </VStack>
          )}

          {/* Create Organization */}
          {mode === 'create' && (
            <Card>
              <CardHeader>
                <VStack spacing={2} align="stretch">
                  <Heading size="lg">Create Your Organization</Heading>
                  <Text color="gray.600">
                    Set up your church or ministry organization
                  </Text>
                </VStack>
              </CardHeader>
              <CardBody>
                <form onSubmit={handleCreateOrganization}>
                  <VStack spacing={6} align="stretch">
                    <FormControl isRequired>
                      <FormLabel htmlFor="orgName">Organization Name</FormLabel>
                      <Input
                        id="orgName"
                        value={orgForm.name}
                        onChange={(e) => handleOrgNameChange(e.target.value)}
                        placeholder="e.g., Grace Community Church"
                        size="lg"
                      />
                    </FormControl>

                    <FormControl isRequired>
                      <FormLabel htmlFor="orgSlug">Organization URL</FormLabel>
                      <HStack>
                        <Text color="gray.500" fontSize="lg">
                          worshiplead.com/
                        </Text>
                        <Input
                          id="orgSlug"
                          value={orgForm.slug}
                          onChange={(e) => setOrgForm(prev => ({ ...prev, slug: e.target.value }))}
                          placeholder="grace-community"
                          size="lg"
                        />
                      </HStack>
                      <Text fontSize="sm" color="gray.500" mt={1}>
                        This will be your unique organization URL
                      </Text>
                    </FormControl>

                    <HStack spacing={4} justify="flex-end">
                      <Button
                        variant="outline"
                        onClick={() => setMode('select')}
                        size="lg"
                      >
                        ← Back
                      </Button>
                      <Button
                        type="submit"
                        colorScheme="blue"
                        size="lg"
                        isLoading={loading}
                        loadingText="Creating..."
                      >
                        Create Organization
                      </Button>
                    </HStack>
                  </VStack>
                </form>
              </CardBody>
            </Card>
          )}

          {/* Join Organization */}
          {mode === 'join' && !joinRequestSubmitted && !existingRequest && (
            <Card>
              <CardHeader>
                <VStack spacing={2} align="stretch">
                  <Heading size="lg">Join Organization</Heading>
                  <Text color="gray.600">
                    Enter the organization slug to request to join
                  </Text>
                </VStack>
              </CardHeader>
              <CardBody>
                <form onSubmit={handleJoinOrganization}>
                  <VStack spacing={6} align="stretch">
                    <FormControl isRequired>
                      <FormLabel htmlFor="joinSlug">Organization Slug</FormLabel>
                      <HStack>
                        <Text color="gray.500" fontSize="lg">
                          worshiplead.com/
                        </Text>
                        <Input
                          id="joinSlug"
                          value={joinForm.organizationSlug}
                          onChange={(e) => handleOrganizationSlugChange(e.target.value)}
                          placeholder="organization-slug"
                          size="lg"
                        />
                      </HStack>
                      <Text fontSize="sm" color="gray.500" mt={1}>
                        Enter the organization slug you'd like to join
                      </Text>
                    </FormControl>

                    <HStack spacing={4} justify="flex-end">
                      <Button
                        variant="outline"
                        onClick={() => setMode('select')}
                        size="lg"
                      >
                        ← Back
                      </Button>
                      <Button
                        type="submit"
                        colorScheme="blue"
                        size="lg"
                        isLoading={loading}
                        loadingText="Submitting..."
                      >
                        Submit Join Request
                      </Button>
                    </HStack>
                  </VStack>
                </form>
              </CardBody>
            </Card>
          )}

          {/* Existing Join Request */}
          {mode === 'join' && existingRequest && (
            <Card>
              <CardBody>
                <VStack spacing={6} align="center" textAlign="center" py={8}>
                  <Box
                    as="div"
                    boxSize="40px"
                    borderRadius="full"
                    bg="blue.500"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    color="white"
                    fontSize="xl"
                  >
                    ⏳
                  </Box>
                  <Heading size="lg" color="blue.600">
                    Join Request Already Submitted
                  </Heading>
                  <Text fontSize="lg" color="gray.600">
                    You already have a pending request to join <strong>{existingRequest.organizationName}</strong>
                  </Text>
                  <Text fontSize="md" color="gray.500">
                    Waiting for Organization Admin to accept your request to join...
                  </Text>
                  <Text fontSize="sm" color="gray.400">
                    Organization: {existingRequest.organizationSlug}
                  </Text>
                  <HStack spacing={4}>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setExistingRequest(null)
                        setJoinForm(prev => ({ ...prev, organizationSlug: '' }))
                      }}
                    >
                      Try Different Organization
                    </Button>
                    <Button
                      colorScheme="blue"
                      onClick={() => {
                        setExistingRequest(null)
                        setMode('select')
                      }}
                    >
                      Back to Selection
                    </Button>
                  </HStack>
                </VStack>
              </CardBody>
            </Card>
          )}

          {/* Join Request Submitted */}
          {mode === 'join' && joinRequestSubmitted && (
            <Card>
              <CardBody>
                <VStack spacing={6} align="center" textAlign="center" py={8}>
                  <Box
                    as="div"
                    boxSize="40px"
                    borderRadius="full"
                    bg="blue.500"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    color="white"
                    fontSize="xl"
                  >
                    ✓
                  </Box>
                  <Heading size="lg" color="blue.600">
                    Join Request Submitted!
                  </Heading>
                  <Text fontSize="lg" color="gray.600">
                    Waiting for Organization Admin to accept your request to join <strong>{existingRequest?.organizationName || 'the organization'}...</strong>
                  </Text>
                  <Text fontSize="md" color="gray.500">
                    You will receive an email notification when your request is approved.
                  </Text>
                  <Button
                    colorScheme="blue"
                    onClick={() => {
                      setJoinRequestSubmitted(false)
                      setMode('select')
                    }}
                  >
                    Back to Selection
                  </Button>
                </VStack>
              </CardBody>
            </Card>
          )}


        </VStack>
      </Container>
    </Box>
  )
} 