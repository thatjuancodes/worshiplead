import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signIn } from '../lib/auth'
import { 
  Box, 
  VStack, 
  Heading, 
  Text, 
  Button, 
  FormControl, 
  FormLabel, 
  Input, 
  useColorModeValue
} from '@chakra-ui/react'

export function LoginPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const cardBg = useColorModeValue('white', 'gray.800')
  const cardBorder = useColorModeValue('gray.200', 'gray.600')
  const titleColor = useColorModeValue('gray.800', 'white')
  const textColor = useColorModeValue('gray.600', 'gray.300')

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
                Welcome Back
              </Heading>
              <Text color={textColor}>
                Sign in to your Worship Lead account
              </Text>
            </Box>

            <Box as="form" onSubmit={handleSubmit} mb={6}>
              {error && (
                <Text color="red.500" fontSize="sm" mb={4}>
                  {error}
                </Text>
              )}

              <VStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel htmlFor="email">Email</FormLabel>
                  <Input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Enter your email"
                    size="lg"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel htmlFor="password">Password</FormLabel>
                  <Input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Enter your password"
                    size="lg"
                  />
                </FormControl>

                <Button
                  type="submit"
                  colorScheme="blue"
                  size="lg"
                  w="full"
                  isLoading={loading}
                  loadingText="Signing in..."
                >
                  Sign In
                </Button>
              </VStack>
            </Box>

            <Box textAlign="center">
              <Text color={textColor} fontSize="sm">
                Don't have an account?{' '}
                <Box
                  as={Link}
                  to="/signup"
                  color="blue.500"
                  _hover={{ color: 'blue.600' }}
                  textDecoration="underline"
                >
                  Sign up
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
          &copy; {new Date().getFullYear()} Worship Lead. All rights reserved.
        </Text>
      </Box>
    </>
  )
} 