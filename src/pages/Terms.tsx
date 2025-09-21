import { Link } from 'react-router-dom'
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  Button,
  useColorModeValue,
  Divider
} from '@chakra-ui/react'
import { Header } from '../components'

export function Terms() {
  const bgColor = useColorModeValue('gray.50', 'gray.900')
  const cardBg = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')
  const textColor = useColorModeValue('gray.700', 'gray.200')
  const headingColor = useColorModeValue('gray.900', 'white')
  const mutedTextColor = useColorModeValue('gray.600', 'gray.400')

  const lastUpdated = "December 1, 2024"

  return (
    <Box minH="100vh" bg={bgColor}>
      <Header />
      
      <Container maxW="4xl" px={{ base: 4, sm: 6, lg: 8 }} py={20}>
        <VStack spacing={8} align="stretch">
          {/* Header */}
          <Box textAlign="center">
            <Heading
              as="h1"
              fontSize={{ base: '3xl', md: '4xl' }}
              fontWeight="bold"
              color={headingColor}
              mb={4}
            >
              Terms of Service
            </Heading>
            <Text color={mutedTextColor} fontSize="md">
              Last updated: {lastUpdated}
            </Text>
          </Box>

          {/* Content */}
          <Box
            bg={cardBg}
            borderRadius="xl"
            p={8}
            border="1px"
            borderColor={borderColor}
          >
            <VStack spacing={6} align="stretch">
              
              <Box>
                <Heading as="h2" size="md" color={headingColor} mb={4}>
                  1. Acceptance of Terms
                </Heading>
                <Text color={textColor} lineHeight="1.7">
                  By accessing and using Spirit Lead ("the Service"), you accept and agree to be 
                  bound by the terms and provision of this agreement. If you do not agree to abide 
                  by the above, please do not use this service.
                </Text>
              </Box>

              <Divider borderColor={borderColor} />

              <Box>
                <Heading as="h2" size="md" color={headingColor} mb={4}>
                  2. Description of Service
                </Heading>
                <Text color={textColor} lineHeight="1.7">
                  Spirit Lead is a cloud-based platform designed to help churches manage worship 
                  services, coordinate teams, and organize song libraries. The service includes 
                  features for scheduling, team management, song organization, and communication 
                  tools specifically designed for church workflows.
                </Text>
              </Box>

              <Divider borderColor={borderColor} />

              <Box>
                <Heading as="h2" size="md" color={headingColor} mb={4}>
                  3. User Accounts and Registration
                </Heading>
                <Text color={textColor} lineHeight="1.7" mb={4}>
                  To use our service, you must:
                </Text>
                <VStack align="stretch" spacing={2} pl={4}>
                  <Text color={textColor}>• Provide accurate and complete registration information</Text>
                  <Text color={textColor}>• Maintain the security of your account credentials</Text>
                  <Text color={textColor}>• Be at least 16 years of age</Text>
                  <Text color={textColor}>• Use the service in compliance with applicable laws</Text>
                  <Text color={textColor}>• Notify us immediately of any unauthorized use of your account</Text>
                </VStack>
              </Box>

              <Divider borderColor={borderColor} />

              <Box>
                <Heading as="h2" size="md" color={headingColor} mb={4}>
                  4. Acceptable Use Policy
                </Heading>
                <Text color={textColor} lineHeight="1.7" mb={4}>
                  You agree not to use the service to:
                </Text>
                <VStack align="stretch" spacing={2} pl={4}>
                  <Text color={textColor}>• Upload, post, or transmit any unlawful, harmful, or offensive content</Text>
                  <Text color={textColor}>• Violate any applicable local, state, national, or international law</Text>
                  <Text color={textColor}>• Impersonate any person or entity or misrepresent your affiliation</Text>
                  <Text color={textColor}>• Interfere with or disrupt the service or servers</Text>
                  <Text color={textColor}>• Attempt to gain unauthorized access to any part of the service</Text>
                </VStack>
              </Box>

              <Divider borderColor={borderColor} />

              <Box>
                <Heading as="h2" size="md" color={headingColor} mb={4}>
                  5. Subscription and Payment Terms
                </Heading>
                <Text color={textColor} lineHeight="1.7" mb={4}>
                  Spirit Lead offers both free and paid subscription plans:
                </Text>
                <VStack align="stretch" spacing={2} pl={4}>
                  <Text color={textColor}>• Free trial periods are available for new users</Text>
                  <Text color={textColor}>• Paid subscriptions are billed monthly or annually</Text>
                  <Text color={textColor}>• You may cancel your subscription at any time</Text>
                  <Text color={textColor}>• Refunds are provided according to our refund policy</Text>
                  <Text color={textColor}>• Price changes will be communicated with 30 days notice</Text>
                </VStack>
              </Box>

              <Divider borderColor={borderColor} />

              <Box>
                <Heading as="h2" size="md" color={headingColor} mb={4}>
                  6. Data Ownership and Privacy
                </Heading>
                <Text color={textColor} lineHeight="1.7">
                  You retain ownership of all data you upload to Spirit Lead. We do not claim any 
                  intellectual property rights over your content. Your data is protected according 
                  to our Privacy Policy. You are responsible for maintaining appropriate backups 
                  of your data and ensuring you have the necessary rights to use any copyrighted 
                  material you upload.
                </Text>
              </Box>

              <Divider borderColor={borderColor} />

              <Box>
                <Heading as="h2" size="md" color={headingColor} mb={4}>
                  7. Service Availability
                </Heading>
                <Text color={textColor} lineHeight="1.7">
                  While we strive to provide reliable service, we cannot guarantee 100% uptime. 
                  We may temporarily suspend the service for maintenance, updates, or due to 
                  circumstances beyond our control. We will provide reasonable notice when possible.
                </Text>
              </Box>

              <Divider borderColor={borderColor} />

              <Box>
                <Heading as="h2" size="md" color={headingColor} mb={4}>
                  8. Limitation of Liability
                </Heading>
                <Text color={textColor} lineHeight="1.7">
                  Spirit Lead is provided "as is" without warranties of any kind. We shall not be 
                  liable for any indirect, incidental, special, consequential, or punitive damages, 
                  including but not limited to loss of profits, data, or other intangible losses 
                  resulting from your use of the service.
                </Text>
              </Box>

              <Divider borderColor={borderColor} />

              <Box>
                <Heading as="h2" size="md" color={headingColor} mb={4}>
                  9. Termination
                </Heading>
                <Text color={textColor} lineHeight="1.7">
                  Either party may terminate this agreement at any time. Upon termination, your 
                  access to the service will cease, and your data may be deleted according to our 
                  data retention policy. We reserve the right to terminate accounts that violate 
                  these terms or engage in prohibited activities.
                </Text>
              </Box>

              <Divider borderColor={borderColor} />

              <Box>
                <Heading as="h2" size="md" color={headingColor} mb={4}>
                  10. Changes to Terms
                </Heading>
                <Text color={textColor} lineHeight="1.7">
                  We may modify these terms from time to time. We will provide notice of material 
                  changes by posting the updated terms on our website and updating the "last updated" 
                  date. Your continued use of the service after such changes constitutes acceptance 
                  of the new terms.
                </Text>
              </Box>

              <Divider borderColor={borderColor} />

              <Box>
                <Heading as="h2" size="md" color={headingColor} mb={4}>
                  11. Contact Information
                </Heading>
                <Text color={textColor} lineHeight="1.7">
                  If you have any questions about these Terms of Service, please contact us at:
                </Text>
                <Text color={textColor} mt={4}>
                  Email:{' '}
                  <Text as="span" color="blue.600" fontWeight="semibold">
                    thejuan.codes@gmail.com
                  </Text>
                </Text>
              </Box>

            </VStack>
          </Box>

          {/* Back to Home */}
          <Box textAlign="center">
            <Button
              as={Link}
              to="/"
              colorScheme="blue"
              size="lg"
              px={8}
            >
              Back to Home
            </Button>
          </Box>
        </VStack>
      </Container>
    </Box>
  )
}
