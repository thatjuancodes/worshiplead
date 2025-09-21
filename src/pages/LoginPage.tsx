import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { signIn, signInWithGoogle, ensureUserProfileAndMembership } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { 
  Box, 
  VStack, 
  Heading, 
  Text, 
  Button, 
  FormControl, 
  FormLabel, 
  Input, 
  useColorModeValue,
  Divider
} from '@chakra-ui/react'

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  const cardBg = useColorModeValue('white', 'gray.800')
  const cardBorder = useColorModeValue('gray.200', 'gray.600')
  const titleColor = useColorModeValue('gray.800', 'white')
  const textColor = useColorModeValue('gray.600', 'gray.300')

  // Handle OAuth redirects and profile creation
  useEffect(() => {
    const handleOAuthRedirect = async () => {
      try {
        // Check if we're returning from OAuth
        const urlParams = new URLSearchParams(window.location.search)
        const hasOAuthParams = urlParams.has('code') || urlParams.has('access_token') || urlParams.has('error')
        
        if (hasOAuthParams) {
          // Wait for Supabase to process the OAuth callback
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          // Check for the current session
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            console.log('LoginPage: OAuth user detected, ensuring profile exists')
            
            try {
              // Create basic profile (without organization membership since we don't know which org yet)
              await ensureUserProfileAndMembership(session.user)
              console.log('LoginPage: User profile ensured, redirecting to dashboard')
              
              // Clear OAuth parameters and redirect to dashboard
              window.history.replaceState({}, document.title, window.location.pathname)
              navigate('/dashboard')
            } catch (error) {
              console.error('LoginPage: Error ensuring user profile:', error)
              // Still redirect to dashboard, profile creation will be handled there
              navigate('/dashboard')
            }
          }
        }
      } catch (error) {
        console.error('LoginPage: Error handling OAuth redirect:', error)
      }
    }
    
    handleOAuthRedirect()
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { user, session } = await signIn({
        email: formData.email,
        password: formData.password
      })

      if (user && session) {
        navigate('/dashboard')
      }
    } catch (error: any) {
      setError(error.message || 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setError('')

    try {
      await signInWithGoogle()
      // The redirect will happen automatically via Supabase OAuth
      // Profile creation will be handled in the useEffect above
    } catch (error: any) {
      setError(error.message || 'Failed to sign in with Google')
      setGoogleLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <>
      {/* Login Container */}
      <Box
        minH="100vh"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Box
          bg={cardBg}
          border="1px"
          borderColor={cardBorder}
          borderRadius="lg"
          p={8}
          w="full"
          maxW="400px"
          shadow="lg"
        >
          <VStack spacing={6} align="stretch">
            <Box textAlign="center">
              <Heading as="h1" size="xl" color={titleColor} mb={2}>
                {t('loginPage.title')}
              </Heading>
              <Text color={textColor}>
                {t('loginPage.subtitle')}
              </Text>
            </Box>

            {error && (
              <Text color="red.500" fontSize="sm" textAlign="center">
                {error}
              </Text>
            )}

            <Button
              onClick={handleGoogleSignIn}
              isLoading={googleLoading}
              loadingText="Signing in..."
              size="lg"
              w="full"
              variant="outline"
              leftIcon={
                <Box as="svg" viewBox="0 0 24 24" w={5} h={5}>
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </Box>
              }
            >
              {t('loginPage.continueWithGoogle')}
            </Button>

            <Box position="relative">
              <Divider />
              <Box
                position="absolute"
                top="50%"
                left="50%"
                transform="translate(-50%, -50%)"
                bg={cardBg}
                px={3}
              >
                <Text fontSize="sm" color={textColor}>
                  {t('loginPage.or')}
                </Text>
              </Box>
            </Box>

            <Box as="form" onSubmit={handleSubmit} mb={6}>
              <VStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel htmlFor="email">{t('loginPage.email')}</FormLabel>
                  <Input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder={t('loginPage.placeholders.email')}
                    size="lg"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel htmlFor="password">{t('loginPage.password')}</FormLabel>
                  <Input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder={t('loginPage.placeholders.password')}
                    size="lg"
                  />
                </FormControl>

                <Button
                  type="submit"
                  colorScheme="blue"
                  size="lg"
                  w="full"
                  isLoading={loading}
                  loadingText={t('loginPage.signingIn')}
                >
                  {t('loginPage.signIn')}
                </Button>
              </VStack>
            </Box>

            <Box textAlign="center">
              <Text color={textColor} fontSize="sm">
                {t('loginPage.noAccount')}{' '}
                <Box
                  as={Link}
                  to="/signup"
                  color="blue.500"
                  _hover={{ color: 'blue.600' }}
                  textDecoration="underline"
                >
                  {t('loginPage.signUp')}
                </Box>
              </Text>
            </Box>
          </VStack>
        </Box>
      </Box>

      {/* Copyright */}
      <Box
        position="fixed"
        bottom={4}
        left="50%"
        transform="translateX(-50%)"
        textAlign="center"
      >
        <Text color={textColor} fontSize="sm">
          &copy; {new Date().getFullYear()} Spirit Lead. {t('loginPage.copyright')}
        </Text>
      </Box>
    </>
  )
} 