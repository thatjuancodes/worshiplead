import { 
  Box, 
  VStack, 
  Heading, 
  Text, 
  Alert,
  AlertIcon,
  useColorModeValue
} from '@chakra-ui/react'
import { useAuth } from '../contexts'
import { OrganizationAccessExample } from '../components'

export function OrganizationAccessDemo() {
  const { user, isLoading, error } = useAuth()
  const bgColor = useColorModeValue('gray.50', 'gray.900')

  if (isLoading) {
    return (
      <Box minH="100vh" bg={bgColor} p={8}>
        <VStack spacing={4}>
          <Heading>Loading...</Heading>
          <Text>Please wait while we load your organization data.</Text>
        </VStack>
      </Box>
    )
  }

  if (error) {
    return (
      <Box minH="100vh" bg={bgColor} p={8}>
        <VStack spacing={4}>
          <Heading>Error</Heading>
          <Alert status="error">
            <AlertIcon />
            {error}
          </Alert>
        </VStack>
      </Box>
    )
  }

  if (!user) {
    return (
      <Box minH="100vh" bg={bgColor} p={8}>
        <VStack spacing={4}>
          <Heading>Not Authenticated</Heading>
          <Alert status="info">
            <AlertIcon />
            Please log in to view your organization access information.
          </Alert>
        </VStack>
      </Box>
    )
  }

  return (
    <Box minH="100vh" bg={bgColor} p={8}>
      <VStack spacing={8} align="stretch">
        <Box textAlign="center">
          <Heading size="lg" mb={4}>
            Organization Access Demo
          </Heading>
          <Text color="gray.600">
            Welcome, {user.email}! This page demonstrates how to use the organization access system.
          </Text>
        </Box>

        <OrganizationAccessExample />
      </VStack>
    </Box>
  )
}
