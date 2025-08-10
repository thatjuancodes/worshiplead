import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser, getUserPrimaryOrganization } from '../lib/auth'
import { DashboardHeader } from '../components'
import { supabase } from '../lib/supabase'
import { 
  Box, 
  VStack, 
  HStack, 
  Heading, 
  Text, 
  Button, 
  Spinner, 
  SimpleGrid, 
  useColorModeValue,
  Container,
  FormControl,
  FormLabel,
  Input,
  Alert,
  AlertIcon,
  Badge,
  Flex,
  Center,
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

interface OrganizationInvite {
  id: string
  organization_id: string
  email: string
  status: 'pending' | 'accepted' | 'expired'
  invited_by: string
  created_at: string
  accepted_at?: string
}

interface OrganizationMember {
  id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  status: 'active' | 'inactive' | 'suspended'
  joined_at: string
  profiles: {
    first_name: string
    last_name: string
    email: string
  } | null
}

export function TeamManagement() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [invites, setInvites] = useState<OrganizationInvite[]>([])
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Color mode values
  const bgColor = useColorModeValue('gray.50', 'gray.900')
  const cardBg = useColorModeValue('white', 'gray.800')
  const cardBorderColor = useColorModeValue('gray.200', 'gray.600')
  const textColor = useColorModeValue('gray.800', 'white')
  const textSecondaryColor = useColorModeValue('gray.600', 'gray.300')
  const textMutedColor = useColorModeValue('gray.500', 'gray.400')
  const titleColor = useColorModeValue('gray.800', 'white')
  const subtitleColor = useColorModeValue('gray.600', 'gray.300')

  const checkUserAndOrganization = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        navigate('/login')
        return
      }
      setUser(currentUser)

      const userOrg = await getUserPrimaryOrganization(currentUser.id)
      console.log('User organization data:', userOrg) // Debug log
      
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

  const loadInvites = useCallback(async () => {
    if (!organization) return

    try {
      const { data, error } = await supabase
        .from('organization_invites')
        .select('*')
        .eq('organization_id', organization.organization_id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading invites:', error)
        return
      }

      setInvites(data || [])
    } catch (error) {
      console.error('Error loading invites:', error)
    }
  }, [organization])

  const loadMembers = useCallback(async () => {
    if (!organization) return

    try {
      console.log('Loading members for organization:', organization.organization_id)
      
      // First, get the memberships
      const { data: memberships, error: membershipsError } = await supabase
        .from('organization_memberships')
        .select(`
          id,
          user_id,
          role,
          status,
          joined_at
        `)
        .eq('organization_id', organization.organization_id)
        .eq('status', 'active')
        .order('joined_at', { ascending: true })

      console.log('Memberships query result:', { memberships, membershipsError })

      if (membershipsError) {
        console.error('Error loading memberships:', membershipsError)
        return
      }

      if (!memberships || memberships.length === 0) {
        setMembers([])
        return
      }

      // Then, get the profiles for all user IDs
      const userIds = memberships.map(m => m.user_id)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', userIds)

      console.log('Profiles query result:', { profiles, profilesError })

      if (profilesError) {
        console.error('Error loading profiles:', profilesError)
        return
      }

      // Combine the data
      const membersWithProfiles = memberships.map(membership => {
        const profile = profiles?.find(p => p.id === membership.user_id)
        return {
          ...membership,
          profiles: profile || null
        }
      })

      console.log('Combined members data:', membersWithProfiles)
      setMembers(membersWithProfiles)
    } catch (error) {
      console.error('Error loading members:', error)
    }
  }, [organization])

  useEffect(() => {
    checkUserAndOrganization()
  }, [checkUserAndOrganization])

  useEffect(() => {
    if (organization) {
      loadInvites()
      loadMembers()
    }
  }, [organization, loadInvites, loadMembers])

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization || !inviteEmail.trim()) return

    setInviting(true)
    setError('')
    setSuccess('')

    try {
      // Check if invitation already exists for this email
      const { data: existingInvites, error: inviteError } = await supabase
        .from('organization_invites')
        .select('id, status')
        .eq('organization_id', organization.organization_id)
        .eq('email', inviteEmail.trim())
        .eq('status', 'pending')

      if (inviteError) {
        console.error('Error checking existing invites:', inviteError)
      } else if (existingInvites && existingInvites.length > 0) {
        setError('An invitation has already been sent to this email address.')
        setInviting(false)
        return
      }

      // Create our custom invite record for tracking FIRST
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      const { data: inviteData, error: dbError } = await supabase
        .from('organization_invites')
        .insert({
          organization_id: organization.organization_id,
          email: inviteEmail.trim(),
          invited_by: user?.id,
          status: 'pending',
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single()

      if (dbError) {
        console.error('Error creating invite record:', dbError)
        setError('Failed to create invitation record. Please try again.')
        return
      }

      // Create invitation link for manual sharing
      const inviteUrl = `${window.location.origin}/onboarding`
      const organizationName = organization?.organizations ? 
        (Array.isArray(organization.organizations) ? 
          organization.organizations[0]?.name : 
          organization.organizations.name) || 'Your Organization' : 
        'Your Organization'
      const invitedByName = user?.user_metadata?.first_name + ' ' + user?.user_metadata?.last_name || 'A team member'

      // Call the Edge Function to send the invitation email
      try {
        await supabase.functions.invoke('clever-worker', {
          body: {
            email: inviteEmail.trim(),
            organizationName,
            invitedBy: invitedByName,
            organizationId: organization.organization_id,
            inviteId: inviteData.id
          }
        })
      } catch (error) {
        console.log('Edge function call failed (expected for now):', error)
      }

      setInviteEmail('')
      setSuccess(`Invitation created successfully! Copy and share this link: ${inviteUrl}`)
      await loadInvites()
      await loadMembers()
    } catch (error) {
      console.error('Error inviting user:', error)
      setError('Failed to send invitation. Please try again.')
    } finally {
      setInviting(false)
    }
  }

  const handleCancelInvite = async (inviteId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return

    try {
      const { error } = await supabase
        .from('organization_invites')
        .delete()
        .eq('id', inviteId)

      if (error) {
        console.error('Error canceling invite:', error)
        return
      }

      await loadInvites()
    } catch (error) {
      console.error('Error canceling invite:', error)
    }
  }

  const handleCopyInviteLink = async (inviteId: string) => {
    try {
      const inviteUrl = `${window.location.origin}/signup?invite=${inviteId}`
      await navigator.clipboard.writeText(inviteUrl)
      setSuccess('Invitation link copied to clipboard!')
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error copying invite link:', error)
      setError('Failed to copy invitation link')
      
      // Clear error message after 3 seconds
      setTimeout(() => setError(''), 3000)
    }
  }

  if (loading) {
    return (
      <Box minH="100vh" bg={bgColor}>
        <Center h="100vh">
          <VStack spacing={4}>
            <Spinner size="xl" color="blue.500" />
            <Text color={textColor}>Loading team management...</Text>
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
            <Box>
              <Heading as="h2" size="lg" color={textColor} mb={2}>
                Team Management
              </Heading>
              <Text color={textSecondaryColor} fontSize="lg">
                Invite team members to collaborate on your worship planning
              </Text>
            </Box>
            
            <Button
              variant="outline"
              colorScheme="gray"
              onClick={() => navigate('/dashboard')}
              size="md"
            >
              Back to Dashboard
            </Button>
          </Flex>

          {/* Content Grid */}
          <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={8}>
            <VStack align="start" spacing={4}>
              <Heading as="h3" size="md" color={titleColor}>
                Invite New Member
              </Heading>
              <Text color={subtitleColor} fontSize="sm">
                Send an invitation to join your organization
              </Text>
              
              <form onSubmit={handleInviteUser}>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
                  <FormControl>
                    <FormLabel fontSize="sm" fontWeight="500" color={textColor}>
                      Email Address
                    </FormLabel>
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="Enter email address"
                      required
                      size="md"
                    />
                  </FormControl>
                  
                  <Button
                    type="submit"
                    colorScheme="blue"
                    isLoading={inviting}
                    loadingText="Sending..."
                    disabled={!inviteEmail.trim()}
                    size="md"
                    h="40px"
                  >
                    Send Invitation
                  </Button>
                </SimpleGrid>
              </form>

              {error && (
                <Alert status="error" borderRadius="md" mt={4}>
                  <AlertIcon />
                  {error}
                </Alert>
              )}

              {success && (
                <Alert status="success" borderRadius="md" mt={4}>
                  <AlertIcon />
                  <Box flex="1">
                    <Text>{success}</Text>
                    {success.includes('Copy and share this link:') && (
                      <Button
                        variant="outline"
                        colorScheme="gray"
                        size="sm"
                        onClick={() => {
                          const url = success.split('Copy and share this link: ')[1]
                          navigator.clipboard.writeText(url)
                          setSuccess('Link copied to clipboard!')
                        }}
                        ml={3}
                        mt={2}
                      >
                        Copy Link
                      </Button>
                    )}
                  </Box>
                </Alert>
              )}

              {/* Pending Invitations */}
              <Box mt={6} pt={6} borderTop="1px" borderColor={cardBorderColor}>
                <Heading as="h4" size="sm" color={textColor} mb={4}>
                  Pending Invitations
                </Heading>
                
                {invites.length === 0 ? (
                  <Box textAlign="center" py={8}>
                    <Text color={textMutedColor}>No pending invitations</Text>
                  </Box>
                ) : (
                  <VStack spacing={3} align="stretch">
                    {invites.map(invite => (
                      <Box
                        key={invite.id}
                        bg={useColorModeValue('gray.50', 'gray.700')}
                        borderRadius="md"
                        border="1px"
                        borderColor={cardBorderColor}
                        p={4}
                      >
                        <Flex justify="space-between" align="center">
                          <Box flex="1">
                            <Text fontWeight="500" color={textColor} fontSize="md" mb={1}>
                              {invite.email}
                            </Text>
                            <HStack spacing={3} fontSize="sm">
                              <Text color={textMutedColor}>
                                Sent {new Date(invite.created_at).toLocaleDateString()}
                              </Text>
                              <Badge
                                colorScheme={
                                  invite.status === 'pending' ? 'yellow' : 
                                  invite.status === 'accepted' ? 'green' : 'red'
                                }
                                variant="subtle"
                                textTransform="capitalize"
                                fontSize="xs"
                                px={2}
                                py={1}
                              >
                                {invite.status}
                              </Badge>
                            </HStack>
                          </Box>
                          
                          <HStack spacing={2}>
                            <Button
                              variant="outline"
                              colorScheme="gray"
                              size="sm"
                              onClick={() => handleCopyInviteLink(invite.id)}
                            >
                              Copy Link
                            </Button>
                            <Button
                              variant="outline"
                              colorScheme="red"
                              size="sm"
                              onClick={() => handleCancelInvite(invite.id)}
                            >
                              Cancel
                            </Button>
                          </HStack>
                        </Flex>
                      </Box>
                    ))}
                  </VStack>
                )}
              </Box>
            </VStack>

            {/* Team Members Section */}
            <Box
              bg={cardBg}
              borderRadius="lg"
              boxShadow="sm"
              border="1px"
              borderColor={cardBorderColor}
              p={6}
            >
              <Heading as="h3" size="md" color={textColor} mb={5}>
                Team Members ({members.length})
              </Heading>
              
              {members.length === 0 ? (
                <Box textAlign="center" py={8}>
                  <Text color={textMutedColor}>No members found</Text>
                  <Text fontSize="xs" color={textMutedColor} mt={2}>
                    Debug: Members data: {JSON.stringify(members, null, 2)}
                  </Text>
                </Box>
              ) : (
                <VStack spacing={3} align="stretch">
                  {members.map(member => (
                    <Box
                      key={member.id}
                      bg={useColorModeValue('gray.50', 'gray.700')}
                      borderRadius="md"
                      border="1px"
                      borderColor={cardBorderColor}
                      p={4}
                    >
                      <Flex justify="space-between" align="center">
                        <Box flex="1">
                          <Text fontWeight="600" color={textColor} fontSize="md" mb={1}>
                            {member.profiles?.first_name || 'Unknown'} {member.profiles?.last_name || 'User'}
                          </Text>
                          <HStack spacing={4} fontSize="sm">
                            <Text color={textMutedColor}>
                              {member.profiles?.email || 'No email'}
                            </Text>
                            <Text color={textMutedColor}>
                              Joined {new Date(member.joined_at).toLocaleDateString()}
                            </Text>
                          </HStack>
                        </Box>
                        
                        <Badge
                          colorScheme={
                            member.role === 'owner' ? 'yellow' : 
                            member.role === 'admin' ? 'blue' : 'gray'
                          }
                          variant="subtle"
                          textTransform="capitalize"
                          fontSize="xs"
                          px={3}
                          py={1}
                        >
                          {member.role}
                        </Badge>
                      </Flex>
                    </Box>
                  ))}
                </VStack>
              )}
            </Box>
          </SimpleGrid>
        </Container>
      </Box>
    </Box>
  )
} 