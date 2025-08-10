import { Link } from 'react-router-dom'
import { signOut } from '../lib/auth'
import { useNavigate } from 'react-router-dom'
import { 
  Box, 
  Flex, 
  Heading, 
  Text, 
  Button, 
  useColorModeValue,
  Container
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

interface DashboardHeaderProps {
  user: User | null
  organization: OrganizationData | null
}

// Helper function to get organization name
const getOrganizationName = (organization: OrganizationData | null): string => {
  if (!organization?.organizations) return 'Loading...'
  
  if (Array.isArray(organization.organizations)) {
    return organization.organizations[0]?.name || 'Loading...'
  }
  
  return organization.organizations.name || 'Loading...'
}

export function DashboardHeader({ user, organization }: DashboardHeaderProps) {
  const navigate = useNavigate()

  // Color mode values
  const headerBg = useColorModeValue('white', 'gray.800')
  const headerBorderColor = useColorModeValue('gray.200', 'gray.600')
  const logoColor = useColorModeValue('gray.800', 'white')
  const userNameColor = useColorModeValue('gray.700', 'gray.200')
  const orgNameBg = useColorModeValue('blue.50', 'blue.900')
  const orgNameColor = useColorModeValue('blue.700', 'blue.200')

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <Box
      as="header"
      bg={headerBg}
      borderBottom="1px"
      borderColor={headerBorderColor}
      py={4}
      position="sticky"
      top={0}
      zIndex={10}
    >
      <Container maxW="1200px" px={6}>
        <Flex justify="space-between" align="center">
          {/* Logo */}
          <Box>
            <Link to="/dashboard" style={{ textDecoration: 'none' }}>
              <Heading
                as="h1"
                size="lg"
                color={logoColor}
                fontWeight="700"
                m={0}
                _hover={{ color: 'blue.500' }}
                transition="color 0.2s ease"
              >
                Worship Lead
              </Heading>
            </Link>
          </Box>
          
          {/* User Info */}
          <Flex align="center" gap={4} flexShrink={0}>
            <Text
              fontWeight="500"
              color={userNameColor}
              whiteSpace="nowrap"
              fontSize="sm"
            >
              {user?.user_metadata?.first_name} {user?.user_metadata?.last_name}
            </Text>
            
            <Box
              bg={orgNameBg}
              color={orgNameColor}
              px={3}
              py={1}
              borderRadius="full"
              fontSize="sm"
              fontWeight="500"
              whiteSpace="nowrap"
            >
              {getOrganizationName(organization)}
            </Box>
            
            <Button
              variant="outline"
              colorScheme="gray"
              size="sm"
              onClick={handleSignOut}
              fontSize="sm"
              px={4}
              py={2}
            >
              Sign Out
            </Button>
          </Flex>
        </Flex>
      </Container>
    </Box>
  )
} 