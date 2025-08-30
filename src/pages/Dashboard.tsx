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
  Grid,
  GridItem, 
  useColorModeValue,
  Center
} from '@chakra-ui/react'
import { keyframes } from '@emotion/react'
import { supabase } from '../lib/supabase'
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

interface WorshipService {
  id: string
  organization_id: string
  title: string
  service_date: string
  service_time?: string
  description?: string
  status: 'draft' | 'published' | 'completed'
  created_at: string
  updated_at: string
}

export function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [services, setServices] = useState<WorshipService[]>([])

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

  const loadServices = useCallback(async () => {
    if (!organization) return

    try {
      const { data, error } = await supabase
        .from('worship_services')
        .select('id, service_date')
        .eq('organization_id', organization.organization_id)

      if (error) {
        console.error('Error loading services:', error)
        return
      }

      setServices((data || []) as unknown as WorshipService[])
    } catch (err) {
      console.error('Unexpected error loading services:', err)
    }
  }, [organization])

  useEffect(() => {
    if (organization) loadServices()
  }, [organization, loadServices])

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

          {/* Calendar and Recent Activity Row */}
          <Grid templateColumns={{ base: '1fr', md: 'repeat(12, 1fr)' }} gap={6} w="100%">
            {/* Service Calendar Section (8/12) */}
            <GridItem colSpan={{ base: 12, md: 8 }}>
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
                  Service Calendar
                </Heading>

                <CalendarGrid scheduledDates={[...new Set(services.map(s => s.service_date))]} />

                <Button colorScheme="blue" size="md" mt={4} w="100%">
                  Add New Service
                </Button>
              </Box>
            </GridItem>

            {/* Recent Activity Section (4/12) */}
            <GridItem colSpan={{ base: 12, md: 4 }}>
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
            </GridItem>
          </Grid>
        </VStack>
      </Box>
    </Box>
  )
} 

interface CalendarProps {
  scheduledDates: string[]
}

function CalendarGrid({ scheduledDates }: CalendarProps) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  const firstOfMonth = new Date(year, month, 1)
  const startWeekday = firstOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const headerColor = useColorModeValue('gray.600', 'gray.300')
  const cellTextColor = useColorModeValue('gray.700', 'gray.200')
  const cellBorderColor = useColorModeValue('gray.200', 'gray.600')
  const eventBg = useColorModeValue('blue.50', 'rgba(66, 153, 225, 0.16)')

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const prefixEmptyCells: (number | null)[] = Array.from({ length: startWeekday }, () => null)
  const monthDays: (number | null)[] = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const cells: (number | null)[] = [...prefixEmptyCells, ...monthDays]

  const scheduledSet = new Set(scheduledDates)

  function toISO(y: number, mZeroIndexed: number, d: number) {
    const mm = String(mZeroIndexed + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    return `${y}-${mm}-${dd}`
  }

  const pulse = keyframes`
    0% { transform: scale(0.8); opacity: 0.9 }
    50% { transform: scale(1.6); opacity: 0.4 }
    100% { transform: scale(0.8); opacity: 0.9 }
  `

  const ringPulse = keyframes`
    0% { box-shadow: 0 0 0 0 rgba(66, 153, 225, 0.6) }
    70% { box-shadow: 0 0 0 10px rgba(66, 153, 225, 0) }
    100% { box-shadow: 0 0 0 0 rgba(66, 153, 225, 0) }
  `

  return (
    <VStack align="stretch" spacing={3}>
      <SimpleGrid columns={7} spacing={1}>
        {dayNames.map(name => (
          <Box key={name} textAlign="center" fontWeight="600" color={headerColor} py={2}>
            {name}
          </Box>
        ))}
      </SimpleGrid>

      <SimpleGrid columns={7} spacing={1}>
        {cells.map((day, idx) => {
          if (day === null) return <Box key={`empty-${idx}`} h="70px" />

          const iso = toISO(year, month, day)
          const hasEvent = scheduledSet.has(iso)

          return (
            <Box
              key={iso}
              h="70px"
              border="1px"
              borderColor={cellBorderColor}
              borderRadius="md"
              p={2}
              bg={hasEvent ? eventBg : 'transparent'}
              position="relative"
            >
              <Text fontSize="sm" color={cellTextColor} fontWeight="500" m={0}>
                {day}
              </Text>

              {hasEvent && (
                <Box position="absolute" top="6px" right="6px">
                  <Box
                    w="12px"
                    h="12px"
                    borderRadius="full"
                    bg="blue.400"
                    animation={`${pulse} 1.2s ease-in-out infinite, ${ringPulse} 1.2s ease-out infinite`}
                  />
                </Box>
              )}
            </Box>
          )
        })}
      </SimpleGrid>
    </VStack>
  )
}