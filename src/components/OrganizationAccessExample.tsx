import { 
  Box, 
  VStack, 
  HStack, 
  Text, 
  Badge, 
  Button, 
  Alert,
  AlertIcon,
  useColorModeValue
} from '@chakra-ui/react'
import { useOrganizationAccess } from '../hooks/useOrganizationAccess'

export function OrganizationAccessExample() {
  const {
    hasPrimaryAccess,
    primaryOrganizationId,
    primaryRole,
    isPrimaryOwner,
    isPrimaryMember,
    canManagePrimary,
    canManageAny,
    memberships,
    primaryMembership
  } = useOrganizationAccess()

  const bgColor = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.600')

  if (!hasPrimaryAccess) {
    return (
      <Alert status="info">
        <AlertIcon />
        You don't have access to any organizations yet.
      </Alert>
    )
  }

  return (
    <Box p={6} bg={bgColor} borderWidth={1} borderColor={borderColor} borderRadius="lg">
      <VStack spacing={4} align="stretch">
        <Text fontSize="xl" fontWeight="bold">
          Organization Access Example
        </Text>

        {/* Primary Organization Info */}
        <Box p={4} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
          <VStack spacing={2} align="stretch">
            <Text fontWeight="semibold">Primary Organization:</Text>
            <HStack justify="space-between">
              <Text>{primaryMembership?.organizations?.name}</Text>
              <Badge colorScheme={primaryRole === 'owner' ? 'red' : primaryRole === 'admin' ? 'blue' : 'green'}>
                {primaryRole}
              </Badge>
            </HStack>
          </VStack>
        </Box>

        {/* Role-based Actions */}
        <Box p={4} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
          <VStack spacing={3} align="stretch">
            <Text fontWeight="semibold">Available Actions:</Text>
            
            {isPrimaryOwner && (
              <Button colorScheme="red" size="sm">
                Manage Organization Settings
              </Button>
            )}

            {canManagePrimary && (
              <Button colorScheme="blue" size="sm">
                Manage Team Members
              </Button>
            )}

            {isPrimaryMember && (
              <Button colorScheme="green" size="sm">
                View Services
              </Button>
            )}

            {!canManagePrimary && (
              <Text fontSize="sm" color="gray.500">
                You have read-only access to this organization
              </Text>
            )}
          </VStack>
        </Box>

        {/* All Memberships */}
        <Box p={4} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
          <VStack spacing={2} align="stretch">
            <Text fontWeight="semibold">All Organization Memberships:</Text>
            {memberships.map((membership) => (
              <HStack key={membership.id} justify="space-between">
                <Text fontSize="sm">{membership.organizations?.name}</Text>
                <Badge 
                  colorScheme={
                    membership.role === 'owner' ? 'red' : 
                    membership.role === 'admin' ? 'blue' : 'green'
                  }
                  size="sm"
                >
                  {membership.role}
                </Badge>
              </HStack>
            ))}
          </VStack>
        </Box>

        {/* Debug Info */}
        <Box p={4} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
          <VStack spacing={2} align="stretch">
            <Text fontWeight="semibold">Debug Info:</Text>
            <Text fontSize="xs" fontFamily="mono">
              Primary Org ID: {primaryOrganizationId || 'None'}
            </Text>
            <Text fontSize="xs" fontFamily="mono">
              Can Manage Primary: {canManagePrimary ? 'Yes' : 'No'}
            </Text>
            <Text fontSize="xs" fontFamily="mono">
              Can Manage Any: {canManageAny ? 'Yes' : 'No'}
            </Text>
          </VStack>
        </Box>
      </VStack>
    </Box>
  )
}
