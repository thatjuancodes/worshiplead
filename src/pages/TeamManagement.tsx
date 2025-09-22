import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getCurrentUser, getUserPrimaryOrganization } from '../lib/auth'
import { DashboardHeader } from '../components'
import { supabase } from '../lib/supabase'
import { useOrganizationAccess } from '../hooks/useOrganizationAccess'
import { 
  Box, 
  VStack, 
  HStack, 
  Heading, 
  Text, 
  Button, 
  useColorModeValue,
  Skeleton,
  SkeletonText,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
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
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Badge,
  Flex,
  Select,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Alert,
  AlertIcon,
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

interface OrganizationJoinRequest {
  id: string
  organization_id: string
  user_id: string
  approved: boolean
  created_at: string
  profiles: {
    first_name: string
    last_name: string
    email: string
  } | null
}

interface Instrument {
  id: string
  organization_id: string
  name: string
  description: string | null
  created_at: string
  updated_at?: string
}

export function TeamManagement() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()
  const { canManagePrimary } = useOrganizationAccess()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [invites, setInvites] = useState<OrganizationInvite[]>([])
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)

  // Instruments state
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [instrumentForm, setInstrumentForm] = useState({ name: '', description: '' })
  const [editingInstrumentId, setEditingInstrumentId] = useState<string | null>(null)
  const [isSavingInstrument, setIsSavingInstrument] = useState(false)

  // Join requests state
  const [joinRequests, setJoinRequests] = useState<OrganizationJoinRequest[]>([])

  // Role management state
  const [roleChangingMemberId, setRoleChangingMemberId] = useState<string | null>(null)

  // Remove member state
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMember | null>(null)
  const [removeConfirmationEmail, setRemoveConfirmationEmail] = useState('')
  const [isRemovingMember, setIsRemovingMember] = useState(false)

  // Drawer states
  const { isOpen: isInviteDrawerOpen, onOpen: onInviteDrawerOpen, onClose: onInviteDrawerClose } = useDisclosure()
  const { isOpen: isRoleDrawerOpen, onOpen: onRoleDrawerOpen, onClose: onRoleDrawerClose } = useDisclosure()
  const { isOpen: isRemoveMemberModalOpen, onOpen: onRemoveMemberModalOpen, onClose: onRemoveMemberModalClose } = useDisclosure()

  // Color mode values
  const bgColor = useColorModeValue('gray.50', 'gray.900')
  const cardBg = useColorModeValue('white', 'gray.800')
  const cardBorderColor = useColorModeValue('gray.200', 'gray.600')
  const titleColor = useColorModeValue('gray.800', 'white')
  const textColor = useColorModeValue('gray.700', 'gray.200')
  const mutedTextColor = useColorModeValue('gray.500', 'gray.400')
  const tableHeaderBg = useColorModeValue('gray.50', 'gray.700')
  const tableHoverBg = useColorModeValue('gray.50', 'gray.700')
  const isOwner = organization?.role === 'owner'

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
      await Promise.all([
        loadInvites(userOrg.organization_id),
        loadMembers(userOrg.organization_id),
        loadJoinRequests(userOrg.organization_id),
        loadInstruments(userOrg.organization_id)
      ])
      setLoading(false)
    } catch (error) {
      console.error('Error checking user and organization:', error)
      navigate('/login')
    }
  }, [navigate])

  const loadInvites = useCallback(async (organizationId?: string) => {
    const orgId = organizationId || organization?.organization_id
    if (!orgId) return

    try {
      const { data, error } = await supabase
        .from('organization_invites')
        .select('*')
        .eq('organization_id', orgId)
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

  const loadMembers = useCallback(async (organizationId?: string) => {
    const orgId = organizationId || organization?.organization_id
    if (!orgId) return

    try {
      console.log('Loading members for organization:', orgId)
      
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
        .eq('organization_id', orgId)
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

  const loadJoinRequests = useCallback(async (organizationId?: string) => {
    const orgId = organizationId || organization?.organization_id
    if (!orgId) return

    try {

      // Get join requests for this organization that are not approved
      const { data: requests, error: requestsError } = await supabase
        .from('organization_join_requests')
        .select(`
          id,
          organization_id,
          user_id,
          approved,
          created_at
        `)
        .eq('organization_id', orgId)
        .eq('approved', false)
        .order('created_at', { ascending: true })

      if (requestsError) {
        console.error('Error loading join requests:', requestsError)
        return
      }

      if (!requests || requests.length === 0) {
        setJoinRequests([])
        return
      }

      // Get profiles for all user IDs
      const userIds = requests.map(r => r.user_id)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', userIds)

      if (profilesError) {
        console.error('Error loading profiles for join requests:', profilesError)
        return
      }

      // Combine the data
      const requestsWithProfiles = requests.map(request => {
        const profile = profiles?.find(p => p.id === request.user_id)
        return {
          ...request,
          profiles: profile || null
        }
      })

      setJoinRequests(requestsWithProfiles)
    } catch (error) {
      console.error('Error loading join requests:', error)
    }
  }, [organization])

  useEffect(() => {
    checkUserAndOrganization()
  }, [checkUserAndOrganization])

  const loadInstruments = useCallback(async (organizationId?: string) => {
    const orgId = organizationId || organization?.organization_id
    if (!orgId) return

    try {
      const { data, error } = await supabase
        .from('instruments')
        .select('*')
        .eq('organization_id', orgId)
        .order('name', { ascending: true })

      if (error) {
        console.error('Error loading instruments:', error)
        return
      }

      setInstruments(data || [])
    } catch (error) {
      console.error('Error loading instruments:', error)
    }
  }, [organization])

  async function handleChangeMemberRole(member: OrganizationMember, newRole: 'owner' | 'admin' | 'member') {
    if (!organization || !user) return

    if (!isOwner) {
      toast({
        title: 'Access Denied',
        description: 'Only owners can change member roles',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    if (user.id === member.user_id) {
      toast({
        title: 'Error',
        description: 'You cannot change your own role',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    if (member.role === newRole) return

    if (member.role === 'owner' && newRole !== 'owner') {
      const ownerCount = members.filter(m => m.role === 'owner').length
      if (ownerCount <= 1) {
        toast({
          title: 'Error',
          description: 'At least one owner is required',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
        return
      }
    }

    try {
      setRoleChangingMemberId(member.id)
      const { error } = await supabase
        .from('organization_memberships')
        .update({ role: newRole })
        .eq('id', member.id)
        .eq('organization_id', organization.organization_id)

      if (error) {
        console.error('Error updating member role:', error)
        toast({
          title: 'Error',
          description: 'Failed to update role',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
        return
      }

      toast({
        title: 'Success',
        description: 'Role updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
      await loadMembers()
    } catch (e) {
      console.error('Error changing role:', e)
      toast({
        title: 'Error',
        description: 'Failed to change role',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setRoleChangingMemberId(null)
    }
  }

  const handleRemoveMember = async (member: OrganizationMember) => {
    if (!organization || !user) return

    // Check permissions - only owners can remove members
    if (!isOwner) {
      toast({
        title: 'Access Denied',
        description: 'Only organization owners can remove members',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    // Can't remove yourself
    if (user.id === member.user_id) {
      toast({
        title: 'Error',
        description: 'You cannot remove yourself from the organization',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    // Can't remove the last owner
    if (member.role === 'owner') {
      const ownerCount = members.filter(m => m.role === 'owner').length
      if (ownerCount <= 1) {
        toast({
          title: 'Error',
          description: 'Cannot remove the last owner. At least one owner is required.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
        return
      }
    }

    setMemberToRemove(member)
    setRemoveConfirmationEmail('')
    onRemoveMemberModalOpen()
  }

  const confirmRemoveMember = async () => {
    if (!memberToRemove || !organization) return

    // Validate email confirmation
    if (removeConfirmationEmail.trim().toLowerCase() !== memberToRemove.profiles?.email?.toLowerCase()) {
      toast({
        title: 'Email Mismatch',
        description: 'The email address does not match. Please type the exact email address.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    setIsRemovingMember(true)

    try {
      const { error } = await supabase
        .from('organization_memberships')
        .delete()
        .eq('id', memberToRemove.id)
        .eq('organization_id', organization.organization_id)

      if (error) {
        console.error('Error removing member:', error)
        toast({
          title: 'Error',
          description: 'Failed to remove member. Please try again.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
        return
      }

      toast({
        title: 'Success',
        description: `${memberToRemove.profiles?.first_name} ${memberToRemove.profiles?.last_name} has been removed from the organization.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      })

      // Close modal and reset state
      onRemoveMemberModalClose()
      setMemberToRemove(null)
      setRemoveConfirmationEmail('')
      
      // Reload members
      await loadMembers()
    } catch (error) {
      console.error('Error removing member:', error)
      toast({
        title: 'Error',
        description: 'Failed to remove member. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setIsRemovingMember(false)
    }
  }

  const handleApproveJoinRequest = async (requestId: string, userId: string) => {
    if (!organization) return
    if (!confirm('Are you sure you want to approve this join request?')) return

    try {
      // Start a transaction by updating the join request first
      const { error: updateError } = await supabase
        .from('organization_join_requests')
        .update({
          approved: true
        })
        .eq('id', requestId)
        .eq('organization_id', organization.organization_id)

      if (updateError) {
        console.error('Error updating join request:', updateError)
        toast({
          title: 'Error',
          description: 'Failed to approve join request',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
        return
      }

      // Create organization membership
      const { error: membershipError } = await supabase
        .from('organization_memberships')
        .insert({
          organization_id: organization.organization_id,
          user_id: userId,
          role: 'member',
          status: 'active',
          joined_at: new Date().toISOString()
        })

      if (membershipError) {
        console.error('Error creating membership:', membershipError)
        toast({
          title: 'Error',
          description: 'Failed to create membership',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
        return
      }

      toast({
        title: 'Success',
        description: 'Join request approved successfully!',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
      
      // Reload data
      await Promise.all([
        loadJoinRequests(),
        loadMembers()
      ])
    } catch (error) {
      console.error('Error approving join request:', error)
      toast({
        title: 'Error',
        description: 'Failed to approve join request',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  useEffect(() => {
    if (organization) loadInstruments()
  }, [organization, loadInstruments])

  async function handleSaveInstrument(e: React.FormEvent) {
    e.preventDefault()
    if (!organization) return
    
    if (!canManagePrimary) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to manage roles. Only admins and owners can manage roles.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }
    
    if (!instrumentForm.name.trim()) {
      toast({
        title: 'Error',
        description: 'Role name is required',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    setIsSavingInstrument(true)

    try {
      if (editingInstrumentId) {
        const { error } = await supabase
          .from('instruments')
          .update({
            name: instrumentForm.name.trim(),
            description: instrumentForm.description.trim() || null,
          })
          .eq('id', editingInstrumentId)
          .eq('organization_id', organization.organization_id)

        if (error) {
          console.error('Error updating instrument:', error)
          toast({
            title: 'Error',
            description: 'Failed to update role',
            status: 'error',
            duration: 3000,
            isClosable: true,
          })
          return
        }

        toast({
          title: 'Success',
          description: 'Role updated successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        })
      } else {
        const { error } = await supabase
          .from('instruments')
          .insert({
            organization_id: organization.organization_id,
            name: instrumentForm.name.trim(),
            description: instrumentForm.description.trim() || null,
          })

        if (error) {
          console.error('Error creating instrument:', error)
          toast({
            title: 'Error',
            description: 'Failed to create role',
            status: 'error',
            duration: 3000,
            isClosable: true,
          })
          return
        }

        toast({
          title: 'Success',
          description: 'Role created successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        })
      }

      setInstrumentForm({ name: '', description: '' })
      setEditingInstrumentId(null)
      onRoleDrawerClose()
      await loadInstruments()
    } catch (error) {
      console.error('Error saving instrument:', error)
      toast({
        title: 'Error',
        description: 'Failed to save role',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setIsSavingInstrument(false)
    }
  }

  async function handleEditInstrument(instrument: Instrument) {
    setEditingInstrumentId(instrument.id)
    setInstrumentForm({ name: instrument.name, description: instrument.description || '' })
    onRoleDrawerOpen()
  }

  async function handleDeleteInstrument(instrumentId: string) {
    if (!organization) return
    if (!confirm('Delete this role?')) return

    if (!canManagePrimary) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to delete roles. Only admins and owners can delete roles.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    try {
      const { error } = await supabase
        .from('instruments')
        .delete()
        .eq('id', instrumentId)
        .eq('organization_id', organization.organization_id)

      if (error) {
        console.error('Error deleting instrument:', error)
        toast({
          title: 'Error',
          description: 'Failed to delete role',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
        return
      }

      toast({
        title: 'Success',
        description: 'Role deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
      await loadInstruments()
    } catch (error) {
      console.error('Error deleting instrument:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete role',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization || !inviteEmail.trim()) return

    if (!canManagePrimary) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to invite users. Only admins and owners can invite users.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    setInviting(true)

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
        toast({
          title: 'Error',
          description: 'An invitation has already been sent to this email address.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
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
        toast({
          title: 'Error',
          description: 'Failed to create invitation record. Please try again.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
        return
      }

      // Create invitation link for manual sharing
      const inviteUrl = `${window.location.origin}/onboarding`
      const organizationName = organization?.organizations ? 
        (Array.isArray(organization.organizations) ? 
          organization.organizations[0]?.name : 
          (organization.organizations as { name: string; slug: string }).name) || 'Your Organization' : 
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
      toast({
        title: 'Success',
        description: `Invitation created successfully! Copy and share this link: ${inviteUrl}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      })
      onInviteDrawerClose()
      await loadInvites()
      await loadMembers()
    } catch (error) {
      console.error('Error inviting user:', error)
      toast({
        title: 'Error',
        description: 'Failed to send invitation. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setInviting(false)
    }
  }

  const handleCancelInvite = async (inviteId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return

    if (!canManagePrimary) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to cancel invitations. Only admins and owners can cancel invitations.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }

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
      toast({
        title: 'Success',
        description: 'Invitation link copied to clipboard!',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch (error) {
      console.error('Error copying invite link:', error)
      toast({
        title: 'Error',
        description: 'Failed to copy invitation link',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
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
            <Box>
              <Heading as="h2" size="lg" color={titleColor} m={0} fontWeight="600">
                👥 {t('teamManagement.title')}
              </Heading>
            </Box>

            {canManagePrimary && (
              <Button
                colorScheme="blue"
                onClick={onInviteDrawerOpen}
                size="md"
                isDisabled={loading}
              >
                + Invite Member
              </Button>
            )}
          </Flex>
        </Box>

        {/* Permission Info Alert */}
        {!canManagePrimary && (
          <Box
            bg={useColorModeValue('blue.50', 'blue.900')}
            p={4}
            borderRadius="lg"
            border="1px"
            borderColor={useColorModeValue('blue.200', 'blue.700')}
            mb={4}
          >
            <Text color={useColorModeValue('blue.800', 'blue.200')} fontSize="sm" fontWeight="500">
              📖 {t('teamManagement.readOnlyAccess')}
            </Text>
          </Box>
        )}

        {/* Tabs */}
        <Tabs>
          <TabList>
            <Tab>Team Members ({members.length})</Tab>
            <Tab>Roles ({instruments.length})</Tab>
            <Tab>Invitations ({invites.length + joinRequests.length})</Tab>
          </TabList>

          <TabPanels>
            {/* Team Members Tab */}
            <TabPanel px={0}>
              {loading ? (
                <Box
                  bg={cardBg}
                  borderRadius="lg"
                  boxShadow="sm"
                  border="1px"
                  borderColor={cardBorderColor}
                  overflow="hidden"
                >
                  <Box overflowX="auto">
                    <Table variant="simple" minW="600px">
                      <Thead>
                        <Tr>
                          <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="200px">Name</Th>
                          <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="200px">Email</Th>
                          <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="100px">Role</Th>
                          <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="120px">Joined</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {[...Array(5)].map((_, index) => (
                          <Tr key={index}>
                            <Td minW="200px">
                              <Skeleton height="20px" />
                            </Td>
                            <Td minW="200px">
                              <Skeleton height="20px" />
                            </Td>
                            <Td minW="100px">
                              <Skeleton height="20px" borderRadius="md" />
                            </Td>
                            <Td minW="120px">
                              <Skeleton height="20px" />
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                </Box>
              ) : members.length === 0 ? (
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
                    No team members found
                  </Text>
                </Box>
              ) : (
                <Box
                  bg={cardBg}
                  borderRadius="lg"
                  boxShadow="sm"
                  border="1px"
                  borderColor={cardBorderColor}
                  overflow="hidden"
                >
                  <Box overflowX="auto">
                    <Table variant="simple" minW="700px">
                      <Thead>
                        <Tr>
                          <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="200px">Name</Th>
                          <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="200px">Email</Th>
                          <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="100px">Role</Th>
                          <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="120px">Joined</Th>
                          <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="100px">Actions</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {members.map(member => (
                          <Tr key={member.id} _hover={{ bg: tableHoverBg }}>
                            <Td fontWeight="500" color={titleColor} minW="200px">
                              {member.profiles?.first_name || 'Unknown'} {member.profiles?.last_name || 'User'}
                            </Td>
                            <Td minW="200px">
                              {member.profiles?.email || 'No email'}
                            </Td>
                            <Td minW="100px">
                              {isOwner && user && user.id !== member.user_id ? (
                                <HStack spacing={2}>
                                  <Select
                                    size="sm"
                                    value={member.role}
                                    onChange={e => handleChangeMemberRole(member, e.target.value as 'owner' | 'admin' | 'member')}
                                    isDisabled={roleChangingMemberId === member.id}
                                    minW="120px"
                                  >
                                    <option value="owner">Owner</option>
                                    <option value="admin">Admin</option>
                                    <option value="member">Member</option>
                                  </Select>
                                  {roleChangingMemberId === member.id && <Skeleton height="20px" width="20px" />}
                                </HStack>
                              ) : (
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
                              )}
                            </Td>
                            <Td minW="120px">
                              {new Date(member.joined_at).toLocaleDateString()}
                            </Td>
                            <Td minW="100px">
                              {isOwner && user && user.id !== member.user_id && (
                                <Button
                                  size="xs"
                                  colorScheme="red"
                                  variant="outline"
                                  onClick={() => handleRemoveMember(member)}
                                >
                                  Remove
                                </Button>
                              )}
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                </Box>
              )}
            </TabPanel>

            {/* Roles Tab */}
            <TabPanel px={0}>
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
                  direction={{ base: 'column', md: 'row' }}
                  justify="space-between"
                  align={{ base: 'stretch', md: 'center' }}
                  gap={4}
                >
                  <Heading as="h3" size="md" color={titleColor} m={0}>
                    Manage Roles
                  </Heading>

                  {canManagePrimary && (
                    <Button
                      colorScheme="green"
                      onClick={onRoleDrawerOpen}
                      size="md"
                    >
                      + Add Role
                    </Button>
                  )}
                </Flex>
              </Box>

              {loading ? (
                <Box
                  bg={cardBg}
                  borderRadius="lg"
                  boxShadow="sm"
                  border="1px"
                  borderColor={cardBorderColor}
                  overflow="hidden"
                >
                  <Box overflowX="auto">
                    <Table variant="simple" minW="500px">
                      <Thead>
                        <Tr>
                          <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="150px">Name</Th>
                          <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="200px">Description</Th>
                          <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="100px">Actions</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {[...Array(3)].map((_, index) => (
                          <Tr key={index}>
                            <Td minW="150px">
                              <Skeleton height="20px" />
                            </Td>
                            <Td minW="200px">
                              <SkeletonText noOfLines={1} />
                            </Td>
                            <Td minW="100px">
                              <HStack spacing={2}>
                                <Skeleton height="24px" width="40px" borderRadius="md" />
                                <Skeleton height="24px" width="50px" borderRadius="md" />
                              </HStack>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                </Box>
              ) : instruments.length === 0 ? (
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
                    No roles added yet
                  </Text>
                </Box>
              ) : (
                <Box
                  bg={cardBg}
                  borderRadius="lg"
                  boxShadow="sm"
                  border="1px"
                  borderColor={cardBorderColor}
                  overflow="hidden"
                >
                  <Box overflowX="auto">
                    <Table variant="simple" minW="500px">
                      <Thead>
                        <Tr>
                          <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="150px">Name</Th>
                          <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="200px">Description</Th>
                          <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="100px">Actions</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {instruments.map(instrument => (
                          <Tr key={instrument.id} _hover={{ bg: tableHoverBg }}>
                            <Td fontWeight="500" color={titleColor} minW="150px">
                              {instrument.name}
                            </Td>
                            <Td minW="200px">
                              <Text noOfLines={2} fontSize="sm">
                                {instrument.description || '-'}
                              </Text>
                            </Td>
                            <Td minW="100px">
                              <HStack spacing={2}>
                                {canManagePrimary && (
                                  <>
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      colorScheme="gray"
                                      onClick={() => handleEditInstrument(instrument)}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      size="xs"
                                      colorScheme="red"
                                      onClick={() => handleDeleteInstrument(instrument.id)}
                                    >
                                      Delete
                                    </Button>
                                  </>
                                )}
                              </HStack>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                </Box>
              )}
            </TabPanel>

            {/* Invitations Tab */}
            <TabPanel px={0}>
              <VStack spacing={6} align="stretch">
                {/* Pending Invitations */}
                <Box>
                  <Heading as="h3" size="md" color={titleColor} mb={4}>
                    Pending Invitations ({invites.length})
                  </Heading>
                  
                  {loading ? (
                    <Box
                      bg={cardBg}
                      borderRadius="lg"
                      boxShadow="sm"
                      border="1px"
                      borderColor={cardBorderColor}
                      overflow="hidden"
                    >
                      <Box overflowX="auto">
                        <Table variant="simple" minW="600px">
                          <Thead>
                            <Tr>
                              <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="200px">Email</Th>
                              <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="100px">Status</Th>
                              <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="120px">Sent</Th>
                              <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="150px">Actions</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {[...Array(3)].map((_, index) => (
                              <Tr key={index}>
                                <Td minW="200px">
                                  <Skeleton height="20px" />
                                </Td>
                                <Td minW="100px">
                                  <Skeleton height="20px" borderRadius="md" />
                                </Td>
                                <Td minW="120px">
                                  <Skeleton height="20px" />
                                </Td>
                                <Td minW="150px">
                                  <HStack spacing={2}>
                                    <Skeleton height="24px" width="70px" borderRadius="md" />
                                    <Skeleton height="24px" width="50px" borderRadius="md" />
                                  </HStack>
                                </Td>
                              </Tr>
                            ))}
                          </Tbody>
                        </Table>
                      </Box>
                    </Box>
                  ) : invites.length === 0 ? (
                    <Box
                      bg={cardBg}
                      p={8}
                      borderRadius="lg"
                      boxShadow="sm"
                      border="1px"
                      borderColor={cardBorderColor}
                      textAlign="center"
                    >
                      <Text color={mutedTextColor} fontSize="md">
                        No pending invitations
                      </Text>
                    </Box>
                  ) : (
                    <Box
                      bg={cardBg}
                      borderRadius="lg"
                      boxShadow="sm"
                      border="1px"
                      borderColor={cardBorderColor}
                      overflow="hidden"
                    >
                      <Box overflowX="auto">
                        <Table variant="simple" minW="600px">
                          <Thead>
                            <Tr>
                              <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="200px">Email</Th>
                              <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="100px">Status</Th>
                              <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="120px">Sent</Th>
                              <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="150px">Actions</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {invites.map(invite => (
                              <Tr key={invite.id} _hover={{ bg: tableHoverBg }}>
                                <Td fontWeight="500" color={titleColor} minW="200px">
                                  {invite.email}
                                </Td>
                                <Td minW="100px">
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
                                </Td>
                                <Td minW="120px">
                                  {new Date(invite.created_at).toLocaleDateString()}
                                </Td>
                                <Td minW="150px">
                                  <HStack spacing={2}>
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      colorScheme="gray"
                                      onClick={() => handleCopyInviteLink(invite.id)}
                                    >
                                      Copy Link
                                    </Button>
                                    {canManagePrimary && (
                                      <Button
                                        size="xs"
                                        colorScheme="red"
                                        onClick={() => handleCancelInvite(invite.id)}
                                      >
                                        Cancel
                                      </Button>
                                    )}
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

                {/* Join Requests */}
                <Box>
                  <Heading as="h3" size="md" color={titleColor} mb={4}>
                    Join Requests ({joinRequests.length})
                  </Heading>
                  
                  {loading ? (
                    <Box
                      bg={cardBg}
                      borderRadius="lg"
                      boxShadow="sm"
                      border="1px"
                      borderColor={cardBorderColor}
                      overflow="hidden"
                    >
                      <Box overflowX="auto">
                        <Table variant="simple" minW="600px">
                          <Thead>
                            <Tr>
                              <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="200px">Name</Th>
                              <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="200px">Email</Th>
                              <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="120px">Requested</Th>
                              <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="100px">Actions</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {[...Array(2)].map((_, index) => (
                              <Tr key={index}>
                                <Td minW="200px">
                                  <Skeleton height="20px" />
                                </Td>
                                <Td minW="200px">
                                  <Skeleton height="20px" />
                                </Td>
                                <Td minW="120px">
                                  <Skeleton height="20px" />
                                </Td>
                                <Td minW="100px">
                                  <Skeleton height="24px" width="60px" borderRadius="md" />
                                </Td>
                              </Tr>
                            ))}
                          </Tbody>
                        </Table>
                      </Box>
                    </Box>
                  ) : joinRequests.length === 0 ? (
                    <Box
                      bg={cardBg}
                      p={8}
                      borderRadius="lg"
                      boxShadow="sm"
                      border="1px"
                      borderColor={cardBorderColor}
                      textAlign="center"
                    >
                      <Text color={mutedTextColor} fontSize="md">
                        No pending join requests
                      </Text>
                    </Box>
                  ) : (
                    <Box
                      bg={cardBg}
                      borderRadius="lg"
                      boxShadow="sm"
                      border="1px"
                      borderColor={cardBorderColor}
                      overflow="hidden"
                    >
                      <Box overflowX="auto">
                        <Table variant="simple" minW="600px">
                          <Thead>
                            <Tr>
                              <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="200px">Name</Th>
                              <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="200px">Email</Th>
                              <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="120px">Requested</Th>
                              <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="100px">Actions</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {joinRequests.map(request => (
                              <Tr key={request.id} _hover={{ bg: tableHoverBg }}>
                                <Td fontWeight="500" color={titleColor} minW="200px">
                                  {request.profiles?.first_name || 'Unknown'} {request.profiles?.last_name || 'User'}
                                </Td>
                                <Td minW="200px">
                                  {request.profiles?.email || 'No email'}
                                </Td>
                                <Td minW="120px">
                                  {new Date(request.created_at).toLocaleDateString()}
                                </Td>
                                <Td minW="100px">
                                  <Button
                                    size="xs"
                                    colorScheme="green"
                                    onClick={() => handleApproveJoinRequest(request.id, request.user_id)}
                                  >
                                    Approve
                                  </Button>
                                </Td>
                              </Tr>
                            ))}
                          </Tbody>
                        </Table>
                      </Box>
                    </Box>
                  )}
                </Box>
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Box>

      {/* Invite Member Drawer */}
      <Drawer
        isOpen={isInviteDrawerOpen}
        placement="right"
        onClose={onInviteDrawerClose}
        size={{ base: 'full', md: 'md' }}
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px" bg={cardBg}>
            <Heading as="h3" size="lg" color={titleColor} fontWeight="600">
              Invite New Member
            </Heading>
          </DrawerHeader>
          
          <DrawerBody bg={bgColor} p={6}>
            <Box as="form" onSubmit={handleInviteUser}>
              <VStack spacing={6} align="stretch">
                <Text color={textColor} fontSize="sm">
                  Send an invitation to join your organization
                </Text>
                
                <FormControl isRequired>
                  <FormLabel fontWeight="600" color={textColor} fontSize="sm">Email Address</FormLabel>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Enter email address"
                    size="md"
                  />
                </FormControl>

                <Flex gap={4} justify="flex-end" pt={4}>
                  <Button
                    variant="outline"
                    onClick={onInviteDrawerClose}
                    size="md"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    colorScheme="blue"
                    size="md"
                    isLoading={inviting}
                    loadingText="Sending..."
                    isDisabled={!inviteEmail.trim()}
                  >
                    Send Invitation
                  </Button>
                </Flex>
              </VStack>
            </Box>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Add Role Drawer */}
      <Drawer
        isOpen={isRoleDrawerOpen}
        placement="right"
        onClose={onRoleDrawerClose}
        size={{ base: 'full', md: 'md' }}
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px" bg={cardBg}>
            <Heading as="h3" size="lg" color={titleColor} fontWeight="600">
              {editingInstrumentId ? 'Edit Role' : 'Add New Role'}
            </Heading>
          </DrawerHeader>
          
          <DrawerBody bg={bgColor} p={6}>
            <Box as="form" onSubmit={handleSaveInstrument}>
              <VStack spacing={6} align="stretch">
                <FormControl isRequired>
                  <FormLabel fontWeight="600" color={textColor} fontSize="sm">Role Name</FormLabel>
                  <Input
                    value={instrumentForm.name}
                    onChange={(e) => setInstrumentForm(v => ({ ...v, name: e.target.value }))}
                    placeholder="e.g. Acoustic Guitar, Piano, Vocals"
                    size="md"
                  />
                </FormControl>
                
                <FormControl>
                  <FormLabel fontWeight="600" color={textColor} fontSize="sm">Description (optional)</FormLabel>
                  <Textarea
                    value={instrumentForm.description}
                    onChange={(e) => setInstrumentForm(v => ({ ...v, description: e.target.value }))}
                    placeholder="Add any details or notes about this role..."
                    size="md"
                    rows={4}
                  />
                </FormControl>

                <Flex gap={4} justify="flex-end" pt={4}>
                  <Button
                    variant="outline"
                    onClick={() => {
                      onRoleDrawerClose()
                      setEditingInstrumentId(null)
                      setInstrumentForm({ name: '', description: '' })
                    }}
                    size="md"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    colorScheme="green"
                    size="md"
                    isLoading={isSavingInstrument}
                    loadingText={editingInstrumentId ? 'Saving...' : 'Adding...'}
                    isDisabled={!instrumentForm.name.trim()}
                  >
                    {editingInstrumentId ? 'Save Changes' : 'Add Role'}
                  </Button>
                </Flex>
              </VStack>
            </Box>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Remove Member Confirmation Modal */}
      <Modal 
        isOpen={isRemoveMemberModalOpen} 
        onClose={() => {
          onRemoveMemberModalClose()
          setMemberToRemove(null)
          setRemoveConfirmationEmail('')
        }}
        size="md"
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <Text color={titleColor} fontWeight="600">
              Remove Team Member
            </Text>
          </ModalHeader>
          <ModalCloseButton />
          
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Alert status="warning">
                <AlertIcon />
                <Box>
                  <Text fontWeight="bold">This action cannot be undone!</Text>
                  <Text fontSize="sm">
                    You are about to remove{' '}
                    <Text as="span" fontWeight="bold">
                      {memberToRemove?.profiles?.first_name} {memberToRemove?.profiles?.last_name}
                    </Text>{' '}
                    from your organization.
                  </Text>
                </Box>
              </Alert>

              <FormControl isRequired>
                <FormLabel fontWeight="600" color={textColor} fontSize="sm">
                  To confirm, type the member's email address:
                </FormLabel>
                <Text fontSize="sm" color={mutedTextColor} mb={2}>
                  {memberToRemove?.profiles?.email}
                </Text>
                <Input
                  value={removeConfirmationEmail}
                  onChange={(e) => setRemoveConfirmationEmail(e.target.value)}
                  placeholder="Type the email address to confirm"
                  size="md"
                  autoFocus
                />
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <HStack spacing={3}>
              <Button
                variant="outline"
                onClick={() => {
                  onRemoveMemberModalClose()
                  setMemberToRemove(null)
                  setRemoveConfirmationEmail('')
                }}
                size="md"
              >
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={confirmRemoveMember}
                isLoading={isRemovingMember}
                loadingText="Removing..."
                isDisabled={
                  !removeConfirmationEmail.trim() || 
                  removeConfirmationEmail.trim().toLowerCase() !== memberToRemove?.profiles?.email?.toLowerCase()
                }
                size="md"
              >
                Remove Member
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
} 