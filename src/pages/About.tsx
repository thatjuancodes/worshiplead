import { Link } from 'react-router-dom'
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Button,
  SimpleGrid,
  Image,
  useColorModeValue
} from '@chakra-ui/react'
import { Header } from '../components'
import logoImage from '../assets/images/logo.png'

export function About() {
  const bgColor = useColorModeValue('gray.50', 'gray.900')
  const cardBg = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')
  const textColor = useColorModeValue('gray.700', 'gray.200')
  const headingColor = useColorModeValue('gray.900', 'white')
  const mutedTextColor = useColorModeValue('gray.600', 'gray.400')

  const teamValues = [
    {
      icon: '🎯',
      title: 'Simplicity First',
      description: 'We believe church management should be intuitive, not complicated.'
    },
    {
      icon: '❤️',
      title: 'Built for Churches',
      description: 'Every feature is designed with real church needs and workflows in mind.'
    },
    {
      icon: '🤝',
      title: 'Community Driven',
      description: 'We listen to feedback and continuously improve based on user needs.'
    },
    {
      icon: '🔒',
      title: 'Trust & Security',
      description: 'Your church data is protected with enterprise-grade security.'
    }
  ]

  return (
    <Box minH="100vh" bg={bgColor}>
      <Header />
      
      <Container maxW="4xl" px={{ base: 4, sm: 6, lg: 8 }} py={20}>
        <VStack spacing={16} align="stretch">
          {/* Header Section */}
          <Box textAlign="center">
            <VStack spacing={6}>
              <Image
                src={logoImage}
                alt="Spirit Lead Logo"
                h="64px"
                w="auto"
                objectFit="contain"
              />
              <Heading
                as="h1"
                fontSize={{ base: '3xl', md: '4xl' }}
                fontWeight="bold"
                color={headingColor}
              >
                About Spirit Lead
              </Heading>
              <Text
                fontSize={{ base: 'lg', md: 'xl' }}
                color={mutedTextColor}
                maxW="2xl"
                lineHeight="1.6"
              >
                Simplifying worship and team management for churches everywhere.
              </Text>
            </VStack>
          </Box>

          {/* Mission Section */}
          <Box
            bg={cardBg}
            borderRadius="xl"
            p={8}
            border="1px"
            borderColor={borderColor}
          >
            <VStack spacing={6} textAlign="center">
              <Heading as="h2" size="lg" color={headingColor}>
                Our Mission
              </Heading>
              <Text color={textColor} fontSize="lg" lineHeight="1.7">
                We exist to help churches focus on what matters most - worship and community. 
                By providing simple, powerful tools for service scheduling, song management, 
                and team coordination, we free up church leaders to invest more time in 
                ministry and less time in administrative tasks.
              </Text>
            </VStack>
          </Box>

          {/* Story Section */}
          <VStack spacing={8} align="stretch">
            <Heading as="h2" size="lg" color={headingColor} textAlign="center">
              Our Story
            </Heading>
            <Box
              bg={cardBg}
              borderRadius="xl"
              p={8}
              border="1px"
              borderColor={borderColor}
            >
              <VStack spacing={6} align="stretch">
                <Text color={textColor} fontSize="md" lineHeight="1.7">
                  Spirit Lead was born from the real challenges faced by worship teams and church 
                  staff. We witnessed firsthand how much time was spent on spreadsheets, email 
                  chains, and last-minute coordination - time that could be better spent on 
                  ministry and community building.
                </Text>
                <Text color={textColor} fontSize="md" lineHeight="1.7">
                  Our team consists of church members, worship leaders, and software developers 
                  who understand both the technical and ministry sides of church operations. 
                  We've experienced the frustration of juggling multiple tools and processes, 
                  and we're passionate about creating a better way.
                </Text>
                <Text color={textColor} fontSize="md" lineHeight="1.7">
                  Today, Spirit Lead serves churches of all sizes, from small community congregations 
                  to large multi-campus organizations. Our commitment remains the same: to provide 
                  simple, reliable tools that help churches thrive in their mission.
                </Text>
              </VStack>
            </Box>
          </VStack>

          {/* Values Section */}
          <VStack spacing={8} align="stretch">
            <Heading as="h2" size="lg" color={headingColor} textAlign="center">
              Our Values
            </Heading>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
              {teamValues.map((value, index) => (
                <Box
                  key={index}
                  bg={cardBg}
                  borderRadius="lg"
                  p={6}
                  border="1px"
                  borderColor={borderColor}
                  _hover={{ boxShadow: 'md' }}
                  transition="box-shadow 0.2s"
                >
                  <VStack spacing={4} align="flex-start">
                    <Text fontSize="2xl">{value.icon}</Text>
                    <Heading as="h3" size="md" color={headingColor}>
                      {value.title}
                    </Heading>
                    <Text color={textColor} lineHeight="1.6">
                      {value.description}
                    </Text>
                  </VStack>
                </Box>
              ))}
            </SimpleGrid>
          </VStack>

          {/* CTA Section */}
          <Box
            bg="blue.600"
            borderRadius="xl"
            p={8}
            textAlign="center"
            color="white"
          >
            <VStack spacing={6}>
              <Heading as="h2" size="lg">
                Ready to Simplify Your Church Management?
              </Heading>
              <Text fontSize="lg" color="blue.100">
                Join thousands of churches already using Spirit Lead to streamline 
                their worship and team coordination.
              </Text>
              <HStack spacing={4} justify="center" flexWrap="wrap">
                <Button
                  as={Link}
                  to="/signup"
                  bg="white"
                  color="blue.600"
                  size="lg"
                  px={8}
                  fontWeight="semibold"
                  _hover={{ bg: 'gray.50' }}
                >
                  Start Free Trial
                </Button>
                <Button
                  as="a"
                  href="https://calendly.com/thejuan-codes/30min"
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outline"
                  color="white"
                  borderColor="white"
                  size="lg"
                  px={8}
                  fontWeight="semibold"
                  _hover={{ bg: 'whiteAlpha.200' }}
                >
                  Schedule Demo
                </Button>
              </HStack>
            </VStack>
          </Box>

          {/* Contact Info */}
          <Box textAlign="center">
            <VStack spacing={4}>
              <Text color={mutedTextColor} fontSize="sm">
                Have questions or want to learn more?
              </Text>
              <Text color={textColor}>
                Email us at{' '}
                <Text as="span" color="blue.600" fontWeight="semibold">
                  thejuan.codes@gmail.com
                </Text>
              </Text>
            </VStack>
          </Box>
        </VStack>
      </Container>
    </Box>
  )
}
