import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { 
  Box, 
  VStack, 
  HStack, 
  Heading, 
  Text, 
  FormControl, 
  FormLabel, 
  Input, 
  Button, 
  Alert, 
  AlertIcon,
  Spinner,
  useColorModeValue,
  Center,
  FormHelperText
} from '@chakra-ui/react'
import { createUserAccount } from '../lib/auth'
import { supabase } from '../lib/supabase'

export function SignupPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [invitation, setInvitation] = useState<{
    id: string
    organization_id: string
    email: string
    invited_by: string
    expires_at: string
    organizations?: { name: string; slug: string }
  } | null>(null)
  const [invitationLoading, setInvitationLoading] = useState(true)

  // Check for invitation token on component mount
  useEffect(() => {
    const inviteToken = searchParams.get('invite')
    if (inviteToken) {
      checkInvitation(inviteToken)
    } else {
      setInvitationLoading(false)
    }
  }, [searchParams])

  const checkInvitation = async (token: string) => {
    try {
      const { data, error } = await supabase
        .from('organization_invites')
        .select(`
          *,
          organizations (
            name,
            slug
          )
        `)
        .eq('id', token)
        .eq('status', 'pending')

      if (error) {
        console.error('Database error checking invitation:', error)
        setError('Invalid or expired invitation link')
        setInvitationLoading(false)
        return
      }

      // Check if we got any results
      if (!data || data.length === 0) {
        setError('Invalid or expired invitation link')
        setInvitationLoading(false)
        return
      }

      const invitation = data[0] // Get the first (and should be only) invitation

      // Check if invitation has expired
      const now = new Date()
      const expiresAt = new Date(invitation.expires_at)
      if (now > expiresAt) {
        setError('This invitation has expired. Please request a new one.')
        setInvitationLoading(false)
        return
      }

      setInvitation(invitation)
      setFormData(prev => ({ ...prev, email: invitation.email }))
      setInvitationLoading(false)
    } catch (error) {
      console.error('Error checking invitation:', error)
      setError('Invalid or expired invitation link')
      setInvitationLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    if (error) setError(null)
  }

  // joinOrganizationFromInvitation function removed as it's no longer used

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // Basic validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long')
      setIsLoading(false)
      return
    }

    try {
      // For invited users, we'll handle the signup differently
      let user, session
      
      if (invitation) {
        // For invited users, create account and immediately confirm email via Edge Function
        const { user: newUser, session: newSession } = await createUserAccount({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName
        }, true) // Skip email confirmation for invited users
        
        user = newUser
        session = newSession
        
        console.log('Invited user signup result:', { user, session, invitation })
        
        if (user) {
          // User account created and email already confirmed via createUserAccount
          // Now we need to add them to the organization
          try {
            console.log('Adding user to organization via invite:', invitation.id)
            
            // Add user to organization membership
            const { error: membershipError } = await supabase
              .from('organization_memberships')
              .insert({
                organization_id: invitation.organization_id,
                user_id: user.id,
                role: 'member',
                status: 'active',
                invited_by: invitation.invited_by,
                accepted_at: new Date().toISOString()
              })

            if (membershipError) {
              console.error('Error creating membership:', membershipError)
              setError('Account created successfully, but there was an issue adding you to the organization. Please contact your administrator.')
              setIsLoading(false)
              return
            }

            // Update invitation status
            const { error: inviteUpdateError } = await supabase
              .from('organization_invites')
              .update({
                status: 'accepted',
                accepted_at: new Date().toISOString()
              })
              .eq('id', invitation.id)

            if (inviteUpdateError) {
              console.error('Error updating invite status:', inviteUpdateError)
              // Don't fail the whole process for this
            }

            console.log('Successfully added user to organization')
            navigate('/dashboard')
            return
          } catch (inviteError) {
            console.error('Error in invitation flow:', inviteError)
            setError('Account created successfully, but there was an issue with the invitation. Please contact your administrator.')
            setIsLoading(false)
            return
          }
        }
      } else {
        // Regular signup
        const { user: newUser, session: newSession } = await createUserAccount({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName
        })
        
        user = newUser
        session = newSession
        
        console.log('Regular signup result:', { user, session })
      }

      if (user) {
        // Regular signup - check if we have a session
        if (session) {
          navigate('/dashboard')
        } else {
          // Email confirmation required for regular signup
          setError('Please check your email to confirm your account before signing in.')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const bgGradient = useColorModeValue(
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #4c51bf 0%, #553c9a 100%)'
  )
  const cardBg = useColorModeValue('white', 'gray.800')
  const cardShadow = useColorModeValue(
    '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
  )
  const titleColor = useColorModeValue('gray.800', 'white')
  const subtitleColor = useColorModeValue('gray.600', 'gray.300')
  const borderColor = useColorModeValue('gray.200', 'gray.600')
  const linkColor = useColorModeValue('blue.500', 'blue.300')
  const linkHoverColor = useColorModeValue('blue.600', 'blue.200')
  const copyrightColor = useColorModeValue('rgba(255, 255, 255, 0.7)', 'rgba(255, 255, 255, 0.5)')
  const disabledBg = useColorModeValue('gray.50', 'gray.700')
  const disabledColor = useColorModeValue('gray.500', 'gray.400')

  if (invitationLoading) {
    return (
      <Box
        minH="100vh"
        bgGradient={bgGradient}
        p={{ base: 4, md: 8 }}
        position="relative"
      >
        {/* Top Logo */}
        <Box
          position="absolute"
          top={{ base: 4, md: 8 }}
          left={{ base: 4, md: 8 }}
          zIndex={10}
        >
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Heading
              as="h1"
              size={{ base: 'md', md: 'lg' }}
              fontWeight="700"
              color="white"
              m={0}
              _hover={{ color: 'rgba(255, 255, 255, 0.8)' }}
              transition="color 0.2s ease"
            >
              Worship Lead
            </Heading>
          </Link>
        </Box>

        {/* Loading Container */}
        <Center minH="100vh">
          <Box
            bg={cardBg}
            borderRadius="xl"
            boxShadow={cardShadow}
            p={{ base: 8, md: 10 }}
            w="100%"
            maxW="450px"
            mx="auto"
            textAlign="center"
            py={12}
          >
            <VStack spacing={4}>
              <Spinner
                thickness="4px"
                speed="0.65s"
                emptyColor="gray.200"
                color="blue.500"
                size="xl"
              />
              <Text color={subtitleColor}>Verifying invitation...</Text>
            </VStack>
          </Box>
        </Center>
      </Box>
    )
  }

  return (
    <Box
      minH="100vh"
      bgGradient={bgGradient}
      p={{ base: 4, md: 8 }}
      position="relative"
    >
      {/* Top Logo */}
      <Box
        position="absolute"
        top={{ base: 4, md: 8 }}
        left={{ base: 4, md: 8 }}
        zIndex={10}
      >
        <Link to="/" style={{ textDecoration: 'none' }}>
          <Heading
            as="h1"
            size={{ base: 'md', md: 'lg' }}
            fontWeight="700"
            color="white"
            m={0}
            _hover={{ color: 'rgba(255, 255, 255, 0.8)' }}
            transition="color 0.2s ease"
          >
            Worship Lead
          </Heading>
        </Link>
      </Box>

      {/* Signup Container */}
      <Center minH="100vh">
        <Box
          bg={cardBg}
          borderRadius="xl"
          boxShadow={cardShadow}
          p={{ base: 8, md: 10 }}
          w="100%"
          maxW="450px"
          mx="auto"
        >
          {/* Signup Header */}
          <VStack spacing={3} mb={8} textAlign="center">
            <Heading
              as="h2"
              size={'xl'}
              fontWeight="600"
              color={titleColor}
            >
              Create your account
            </Heading>
            {invitation ? (
              <Text
                fontSize={{ base: 'md', md: 'lg' }}
                color={subtitleColor}
              >
                You've been invited to join <strong>{invitation.organizations?.name}</strong>
              </Text>
            ) : (
              <Text
                fontSize={{ base: 'md', md: 'lg' }}
                color={subtitleColor}
              >
                Join Worship Lead and start organizing your worship team
              </Text>
            )}
          </VStack>

          {/* Signup Form */}
          <Box as="form" onSubmit={handleSubmit} mb={6}>
            {error && (
              <Alert status="error" mb={4} borderRadius="md">
                <AlertIcon />
                {error}
              </Alert>
            )}

            <VStack spacing={6}>
              {/* Name Row */}
              <HStack spacing={4} w="100%" align="start">
                <FormControl isRequired>
                  <FormLabel color={titleColor} fontSize="sm" fontWeight="500">
                    First Name
                  </FormLabel>
                  <Input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="Enter your first name"
                    size="lg"
                    _focus={{
                      borderColor: 'blue.500',
                      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
                    }}
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel color={titleColor} fontSize="sm" fontWeight="500">
                    Last Name
                  </FormLabel>
                  <Input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    placeholder="Enter your last name"
                    size="lg"
                    _focus={{
                      borderColor: 'blue.500',
                      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
                    }}
                  />
                </FormControl>
              </HStack>

              {/* Email */}
              <FormControl isRequired>
                <FormLabel color={titleColor} fontSize="sm" fontWeight="500">
                  Email
                </FormLabel>
                <Input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  size="lg"
                  disabled={!!invitation}
                  bg={invitation ? disabledBg : undefined}
                  color={invitation ? disabledColor : undefined}
                  _focus={{
                    borderColor: 'blue.500',
                    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
                  }}
                />
                {invitation && (
                  <FormHelperText color={subtitleColor} fontSize="xs">
                    Email is pre-filled from your invitation
                  </FormHelperText>
                )}
              </FormControl>

              {/* Password */}
              <FormControl isRequired>
                <FormLabel color={titleColor} fontSize="sm" fontWeight="500">
                  Password
                </FormLabel>
                <Input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Create a password"
                  size="lg"
                  _focus={{
                    borderColor: 'blue.500',
                    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
                  }}
                />
              </FormControl>

              {/* Confirm Password */}
              <FormControl isRequired>
                <FormLabel color={titleColor} fontSize="sm" fontWeight="500">
                  Confirm Password
                </FormLabel>
                <Input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm your password"
                  size="lg"
                  _focus={{
                    borderColor: 'blue.500',
                    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
                  }}
                />
              </FormControl>

              {/* Submit Button */}
              <Button
                type="submit"
                colorScheme="blue"
                size="lg"
                w="100%"
                isLoading={isLoading}
                loadingText="Creating account..."
                fontWeight="500"
                fontSize="md"
                py={3}
              >
                Create account
              </Button>
            </VStack>
          </Box>

          {/* Signup Footer */}
          <Box
            textAlign="center"
            pt={6}
            borderTop="1px"
            borderColor={borderColor}
          >
            <Text color={subtitleColor} fontSize="sm">
              Already have an account?{' '}
              <Box
                as={Link}
                to="/login"
                color={linkColor}
                fontWeight="500"
                _hover={{
                  color: linkHoverColor,
                  textDecoration: 'underline'
                }}
                transition="color 0.2s ease"
              >
                Sign in
              </Box>
            </Text>
          </Box>
        </Box>
      </Center>

      {/* Copyright */}
      <Box
        position="absolute"
        bottom={4}
        left="50%"
        transform="translateX(-50%)"
        textAlign="center"
      >
        <Text color={copyrightColor} fontSize="sm" m={0}>
          &copy; {new Date().getFullYear()} Worship Lead. All rights reserved.
        </Text>
      </Box>
    </Box>
  )
} 