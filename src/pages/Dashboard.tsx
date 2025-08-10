import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Center
} from '@chakra-ui/react'
import { getCurrentUser, getUserPrimaryOrganization } from '../lib/auth'
import { DashboardHeader } from '../components'
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

export function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<OrganizationData | null>(null)

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
        navigate('/organization-setup') // Redirect if no organization
        return
      }
      setOrganization(userOrg)
      setLoading(false)
    } catch (error) {
      console.error('Error checking user and organization:', error)
      navigate('/login')
    }
  }, [navigate])

  useEffect(() => {
    checkUserAndOrganization()
  }, [checkUserAndOrganization])

  const bgColor = useColorModeValue('gray.50', 'gray.900')
  const cardBg = useColorModeValue('white', 'gray.800')
  const cardBorderColor = useColorModeValue('gray.200', 'gray.600')
  const cardHoverBorderColor = useColorModeValue('blue.500', 'blue.400')
  const cardHoverShadow = useColorModeValue(
    '0 4px 12px rgba(59, 130, 246, 0.1)',
    '0 4px 12px rgba(59, 130, 246, 0.2)'
  )
  const titleColor = useColorModeValue('gray.800', 'white')
  const subtitleColor = useColorModeValue('gray.600', 'gray.300')
  const textColor = useColorModeValue('gray.700', 'gray.200')
  const mutedTextColor = useColorModeValue('gray.500', 'gray.400')
  const activityBg = useColorModeValue('gray.50', 'gray.700')
  const activityIconBg = useColorModeValue('white', 'gray.600')
  const activityIconBorder = useColorModeValue('gray.200', 'gray.500')

  if (loading) {
    return (
      <Box
        minH="100vh"
        bg={bgColor}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Center>
          <VStack spacing={4}>
            <Spinner
              thickness="4px"
              speed="0.65s"
              emptyColor="gray.200"
              color="blue.500"
              size="xl"
            />
            <Text color={subtitleColor} fontSize="md" m={0}>
              Loading your dashboard...
            </Text>
          </VStack>
        </Center>
      </Box>
    )
  }

  return (
    <Box minH="100vh" bg={bgColor}>
      <DashboardHeader user={user} organization={organization} />

      <Box as="main" maxW="1200px" mx="auto" p={{ base: 6, md: 8 }}>
        {/* Welcome Section */}
        <VStack spacing={2} mb={8} mt={8} textAlign="center">
          <Heading
            as="h2"
            size={'xl'}
            color={titleColor}
            m={0}
            fontWeight="600"
          >
            Welcome to Worship Lead
          </Heading>
          <Text color={subtitleColor} fontSize="md" m={0}>
            You're logged into your organization
          </Text>
        </VStack>

        {/* Dashboard Content */}
        <VStack spacing={8}>
          {/* Quick Actions Section */}
          <Box
            bg={cardBg}
            borderRadius="xl"
            p={{ base: 5, md: 6 }}
            boxShadow="sm"
            w="100%"
          >
            <Heading
              as="h3"
              size="lg"
              color={titleColor}
              mb={5}
              fontWeight="600"
            >
              Quick Actions
            </Heading>

            <SimpleGrid
              columns={{ base: 1, md: 3 }}
              spacing={5}
              minChildWidth="200px"
            >
              {/* Schedule Service Card */}
              <Box
                border="1px"
                borderColor={cardBorderColor}
                borderRadius="lg"
                p={5}
                textAlign="center"
                transition="all 0.3s ease"
                _hover={{
                  borderColor: cardHoverBorderColor,
                  boxShadow: cardHoverShadow
                }}
              >
                <Heading
                  as="h4"
                  size="md"
                  color={titleColor}
                  mb={2}
                  fontWeight="600"
                >
                  Schedule Service
                </Heading>
                <Text color={textColor} fontSize="sm" mb={4}>
                  Plan your next worship service
                </Text>
                <Button
                  colorScheme="blue"
                  size="md"
                  onClick={() => navigate('/schedule')}
                  w="100%"
                >
                  Manage Schedule
                </Button>
              </Box>

              {/* Manage Team Card */}
              <Box
                border="1px"
                borderColor={cardBorderColor}
                borderRadius="lg"
                p={5}
                textAlign="center"
                transition="all 0.3s ease"
                _hover={{
                  borderColor: cardHoverBorderColor,
                  boxShadow: cardHoverShadow
                }}
              >
                <Heading
                  as="h4"
                  size="md"
                  color={titleColor}
                  mb={2}
                  fontWeight="600"
                >
                  Manage Team
                </Heading>
                <Text color={textColor} fontSize="sm" mb={4}>
                  Add or manage team members
                </Text>
                <Button
                  variant="outline"
                  colorScheme="gray"
                  size="md"
                  onClick={() => navigate('/team')}
                  w="100%"
                >
                  View Team
                </Button>
              </Box>

              {/* Song Library Card */}
              <Box
                border="1px"
                borderColor={cardBorderColor}
                borderRadius="lg"
                p={5}
                textAlign="center"
                transition="all 0.3s ease"
                _hover={{
                  borderColor: cardHoverBorderColor,
                  boxShadow: cardHoverShadow
                }}
              >
                <Heading
                  as="h4"
                  size="md"
                  color={titleColor}
                  mb={2}
                  fontWeight="600"
                >
                  Song Library
                </Heading>
                <Text color={textColor} fontSize="sm" mb={4}>
                  Manage your song collection
                </Text>
                <Button
                  variant="outline"
                  colorScheme="gray"
                  size="md"
                  onClick={() => navigate('/songbank')}
                  w="100%"
                >
                  Manage Songs
                </Button>
              </Box>
            </SimpleGrid>
          </Box>

          {/* Recent Activity Section */}
          <Box
            bg={cardBg}
            borderRadius="xl"
            p={{ base: 5, md: 6 }}
            boxShadow="sm"
            w="100%"
          >
            <Heading
              as="h3"
              size="lg"
              color={titleColor}
              mb={5}
              fontWeight="600"
            >
              Recent Activity
            </Heading>

            <VStack spacing={4} align="stretch">
              <HStack
                spacing={4}
                p={4}
                border="1px"
                borderColor={cardBorderColor}
                borderRadius="lg"
                bg={activityBg}
                align="center"
              >
                <Box
                  fontSize="xl"
                  w="40px"
                  h="40px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  bg={activityIconBg}
                  borderRadius="lg"
                  border="1px"
                  borderColor={activityIconBorder}
                >
                  📅
                </Box>
                <Box flex="1">
                  <Text color={textColor} fontWeight="500" mb={1}>
                    No recent activity
                  </Text>
                  <Text color={mutedTextColor} fontSize="xs">
                    Your activity will appear here
                  </Text>
                </Box>
              </HStack>
            </VStack>
          </Box>
        </VStack>
      </Box>
    </Box>
  )
} 