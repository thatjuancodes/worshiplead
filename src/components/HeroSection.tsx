import { Link } from 'react-router-dom'
import { 
  Box, 
  Container, 
  Heading, 
  Text, 
  Button, 
  VStack,
  useColorModeValue
} from '@chakra-ui/react'

export function HeroSection() {
  const textColor = useColorModeValue('gray.600', 'gray.300')
  const linkColor = useColorModeValue('blue.500', 'blue.300')
  const linkHoverColor = useColorModeValue('blue.600', 'blue.200')

  return (
    <Box
      as="section"
      py={20}
      px={6}
      textAlign="center"
      bg={useColorModeValue('gray.50', 'gray.900')}
    >
      <Container maxW="4xl">
        <VStack spacing={8}>
          <Heading
            as="h2"
            size="2xl"
            color={useColorModeValue('gray.800', 'white')}
            fontWeight="bold"
            lineHeight="1.2"
          >
            Plan. Schedule. Worship.
          </Heading>

          <Text
            fontSize="xl"
            color={textColor}
            maxW="3xl"
            lineHeight="1.6"
          >
            Worship Lead helps churches organize worship teams with ease.
            Schedule volunteers, plan setlists, and manage your song library — all in one simple, powerful tool.
          </Text>

          <Box>
            <Button
              as={Link}
              to="/signup"
              colorScheme="blue"
              size="lg"
              px={8}
              py={4}
              fontSize="lg"
              fontWeight="semibold"
            >
              Try for free
            </Button>
          </Box>

          <Text color={textColor}>
            Already have an account?{' '}
            <Box
              as={Link}
              to="/login"
              color={linkColor}
              _hover={{ color: linkHoverColor }}
              textDecoration="underline"
              transition="color 0.2s ease"
            >
              Login
            </Box>
          </Text>
        </VStack>
      </Container>
    </Box>
  )
} 