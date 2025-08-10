import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Box, 
  Container, 
  VStack, 
  Heading, 
  Text, 
  FormControl, 
  FormLabel, 
  Input, 
  Button, 
  Alert, 
  AlertIcon,
  useColorModeValue,
  Center
} from '@chakra-ui/react'
import { signIn } from '../lib/auth'

export function LoginPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    if (error) setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { user, session } = await signIn({
        email: formData.email,
        password: formData.password
      })

      if (user && session) {
        // Redirect to dashboard after successful login
        navigate('/dashboard')
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

      {/* Login Container */}
      <Center minH="100vh">
        <Box
          bg={cardBg}
          borderRadius="xl"
          boxShadow={cardShadow}
          p={{ base: 8, md: 10 }}
          w="100%"
          maxW="400px"
          mx="auto"
        >
          {/* Login Header */}
          <VStack spacing={6} mb={8} textAlign="center">
            <Heading
              as="h2"
              size={'xl'}
              fontWeight="600"
              color={titleColor}
            >
              Welcome back
            </Heading>
            <Text
              fontSize={{ base: 'md', md: 'lg' }}
              color={subtitleColor}
            >
              Sign in to your account
            </Text>
          </VStack>

          {/* Login Form */}
          <Box as="form" onSubmit={handleSubmit} mb={6}>
            {error && (
              <Alert status="error" mb={4} borderRadius="md">
                <AlertIcon />
                {error}
              </Alert>
            )}

            <VStack spacing={6}>
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
                  _focus={{
                    borderColor: 'blue.500',
                    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
                  }}
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel color={titleColor} fontSize="sm" fontWeight="500">
                  Password
                </FormLabel>
                <Input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  size="lg"
                  _focus={{
                    borderColor: 'blue.500',
                    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
                  }}
                />
              </FormControl>

              <Button
                type="submit"
                colorScheme="blue"
                size="lg"
                w="100%"
                isLoading={isLoading}
                loadingText="Signing in..."
                fontWeight="500"
                fontSize="md"
                py={3}
              >
                Sign in
              </Button>
            </VStack>
          </Box>

          {/* Login Footer */}
          <Box
            textAlign="center"
            pt={6}
            borderTop="1px"
            borderColor={borderColor}
          >
            <Text color={subtitleColor} fontSize="sm">
              Don't have an account?{' '}
              <Box
                as={Link}
                to="/signup"
                color={linkColor}
                fontWeight="500"
                _hover={{
                  color: linkHoverColor,
                  textDecoration: 'underline'
                }}
                transition="color 0.2s ease"
              >
                Sign up for free
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