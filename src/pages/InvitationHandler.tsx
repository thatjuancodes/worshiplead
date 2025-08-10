import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCurrentUser } from '../lib/auth'
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  Container,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useToast
} from '@chakra-ui/react'

export function InvitationHandler() {
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    console.log('InvitationHandler: Component mounted')
    console.log('InvitationHandler: Current URL:', window.location.href)
    
    // Add a longer delay to ensure Supabase auth is fully ready
    // This helps with the 1-minute timeout issue
    setTimeout(() => {
      handleInvitation()
    }, 2000)
  }, [])

  const handleInvitation = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('InvitationHandler: Starting invitation processing...')

      // Get the current user (should be authenticated after Supabase's invitation flow)
      const user = await getCurrentUser()
      console.log('InvitationHandler: getCurrentUser result:', user)

      if (!user) {
        console.log('InvitationHandler: No user found, checking for session...')
        
        // Try to get the current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        console.log('InvitationHandler: Session check:', { session, sessionError })

        if (session?.user) {
          console.log('InvitationHandler: Found user in session:', session.user)
          // Use the user from session
          const sessionUser = session.user
          console.log('InvitationHandler: Processing invitation for session user:', sessionUser.id)
          console.log('InvitationHandler: Session user metadata:', sessionUser.user_metadata)

          // Extract invitation data from user metadata
          const { invite_id, organization_id } = sessionUser.user_metadata

          if (!invite_id || !organization_id) {
            console.log('InvitationHandler: Missing invitation data in session user metadata')
            setError('Invalid invitation data. Please contact your administrator.')
            setLoading(false)
            return
          }

          // Continue with the invitation processing using sessionUser
          await processInvitation(sessionUser, invite_id, organization_id)
        } else {
          console.log('InvitationHandler: No session found either')
          setError('No authenticated user found. This might be due to a timeout. Please wait a moment and try clicking the invitation link again, or contact your administrator.')
          setLoading(false)
          return
        }
      } else {
        console.log('InvitationHandler: Processing invitation for user:', user.id)
        console.log('InvitationHandler: User metadata:', user.user_metadata)

        // Extract invitation data from user metadata
        const { invite_id, organization_id } = user.user_metadata

        if (!invite_id || !organization_id) {
          console.log('InvitationHandler: Missing invitation data in user metadata')
          setError('Invalid invitation data. This might be due to a timeout. Please wait a moment and try clicking the invitation link again, or contact your administrator.')
          setLoading(false)
          return
        }

        // Continue with the invitation processing using user
        await processInvitation(user, invite_id, organization_id)
      }

    } catch (error) {
      console.error('Error in invitation handler:', error)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

    const processInvitation = async (user: any, invite_id: string, organization_id: string) => {
    try {
      console.log('InvitationHandler: Processing invitation with data:', { invite_id, organization_id })

      // Verify the invitation exists and is valid
      const { data: invitation, error: inviteError } = await supabase
        .from('organization_invites')
        .select('*')
        .eq('id', invite_id)
        .eq('organization_id', organization_id)
        .eq('status', 'pending')
        .single()

      if (inviteError || !invitation) {
        console.error('Invitation verification error:', inviteError)
        setError('Invalid or expired invitation. Please request a new one.')
        setLoading(false)
        return
      }

      // Check if invitation has expired
      const now = new Date()
      const expiresAt = new Date(invitation.expires_at)
      if (now > expiresAt) {
        setError('This invitation has expired. Please request a new one.')
        setLoading(false)
        return
      }

      // Check if user is already a member
      const { data: existingMembership, error: checkError } = await supabase
        .from('organization_memberships')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (checkError) {
        console.error('Error checking existing membership:', checkError)
      }

      if (existingMembership) {
        console.log('User is already a member of this organization')
        setSuccess('You are already a member of this organization!')
        setTimeout(() => navigate('/dashboard'), 2000)
        return
      }

      // Add user to organization
      console.log('Adding user to organization:', { organizationId: organization_id, userId: user.id })
      
      const { error: membershipError } = await supabase
        .from('organization_memberships')
        .insert({
          organization_id: organization_id,
          user_id: user.id,
          role: 'member',
          status: 'active',
          invited_by: invitation.invited_by,
          accepted_at: new Date().toISOString()
        })

      if (membershipError) {
        console.error('Error creating membership:', membershipError)
        setError('Failed to add you to the organization. Please contact your administrator.')
        setLoading(false)
        return
      }

      // Update invitation status
      const { error: updateError } = await supabase
        .from('organization_invites')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', invite_id)

      if (updateError) {
        console.error('Error updating invitation:', updateError)
        // Don't fail the whole process for this
      }

      console.log('Successfully added user to organization')
      setSuccess('Welcome! You have been successfully added to the organization.')
      
      // Redirect to dashboard after a short delay
      setTimeout(() => navigate('/dashboard'), 2000)

    } catch (error) {
      console.error('Error in invitation handler:', error)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Box minH="100vh" bg="gray.50" display="flex" alignItems="center" justifyContent="center">
        <Container maxW="container.sm">
          <VStack spacing={8} textAlign="center">
            <Spinner size="xl" color="blue.500" thickness="4px" />
            <VStack spacing={4}>
              <Heading as="h2" size="lg" color="gray.700">
                Processing your invitation...
              </Heading>
              <Text color="gray.600" fontSize="lg">
                Please wait while we add you to the organization. This may take a moment to ensure everything is properly set up.
              </Text>
            </VStack>
          </VStack>
        </Container>
      </Box>
    )
  }

  return (
    <Box minH="100vh" bg="gray.50" display="flex" alignItems="center" justifyContent="center">
      <Container maxW="container.sm">
        {error ? (
          <Box bg="white" p={8} borderRadius="lg" shadow="md" textAlign="center">
            <VStack spacing={6}>
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                <Box>
                  <AlertTitle>Invitation Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Box>
              </Alert>
              <Button
                colorScheme="blue"
                size="lg"
                onClick={() => navigate('/dashboard')}
              >
                Go to Dashboard
              </Button>
            </VStack>
          </Box>
        ) : success ? (
          <Box bg="white" p={8} borderRadius="lg" shadow="md" textAlign="center">
            <VStack spacing={4}>
              <Heading as="h2" size="xl" color="green.600">
                Welcome!
              </Heading>
              <Text color="gray.700" fontSize="lg">
                {success}
              </Text>
              <Text color="gray.600">
                Redirecting you to the dashboard...
              </Text>
            </VStack>
          </Box>
        ) : null}
      </Container>
    </Box>
  )
} 