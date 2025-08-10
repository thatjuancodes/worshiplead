import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createOrganizationAndMembership, joinOrganizationViaInvite, checkSlugAvailability } from '../lib/auth'
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
  FormErrorMessage,
  Container,
  Card,
  CardBody,
  CardHeader,
  SimpleGrid,
  useToast,
  Spinner,
  Flex,
  Divider
} from '@chakra-ui/react'

export function OrganizationSetup() {
  const navigate = useNavigate()
  const toast = useToast()
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Organization creation form state
  const [orgForm, setOrgForm] = useState({
    name: '',
    slug: ''
  })

  // Join organization form state
  const [joinForm, setJoinForm] = useState({
    organizationSlug: ''
  })

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

      await joinOrganizationViaInvite(user.id, joinForm.organizationSlug)
      
      // Success! Redirect to dashboard
      navigate('/dashboard', { 
        state: { message: 'Successfully joined organization!' }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join organization')
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

              <Divider />
              
              <Box textAlign="center">
                <Text color="gray.600" mb={3}>
                  Not ready to set up an organization?
                </Text>
                <Button
                  variant="ghost"
                  color="blue.600"
                  onClick={() => navigate('/dashboard')}
                >
                  Skip for now
                </Button>
              </Box>
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
          {mode === 'join' && (
            <Card>
              <CardHeader>
                <VStack spacing={2} align="stretch">
                  <Heading size="lg">Join Organization</Heading>
                  <Text color="gray.600">
                    Enter the organization slug from your invite
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
                          onChange={(e) => setJoinForm(prev => ({ ...prev, organizationSlug: e.target.value }))}
                          placeholder="organization-slug"
                          size="lg"
                        />
                      </HStack>
                      <Text fontSize="sm" color="gray.500" mt={1}>
                        Enter the organization slug from your invitation email
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
                        loadingText="Joining..."
                      >
                        Join Organization
                      </Button>
                    </HStack>
                  </VStack>
                </form>
              </CardBody>
            </Card>
          )}
        </VStack>
      </Container>
    </Box>
  )
} 