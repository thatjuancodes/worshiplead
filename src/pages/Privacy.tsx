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

export function Privacy() {
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
              Privacy Policy
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
                  1. Information We Collect
                </Heading>
                <Text color={textColor} lineHeight="1.7" mb={4}>
                  We collect information you provide directly to us when you:
                </Text>
                <VStack align="stretch" spacing={2} pl={4}>
                  <Text color={textColor}>• Create an account and user profile</Text>
                  <Text color={textColor}>• Set up your church organization</Text>
                  <Text color={textColor}>• Schedule services and manage your songbank</Text>
                  <Text color={textColor}>• Invite team members and volunteers</Text>
                  <Text color={textColor}>• Contact our support team</Text>
                </VStack>
              </Box>

              <Divider borderColor={borderColor} />

              <Box>
                <Heading as="h2" size="md" color={headingColor} mb={4}>
                  2. How We Use Your Information
                </Heading>
                <Text color={textColor} lineHeight="1.7" mb={4}>
                  We use the information we collect to:
                </Text>
                <VStack align="stretch" spacing={2} pl={4}>
                  <Text color={textColor}>• Provide and improve our service</Text>
                  <Text color={textColor}>• Enable team collaboration and communication</Text>
                  <Text color={textColor}>• Send important service updates and notifications</Text>
                  <Text color={textColor}>• Provide customer support</Text>
                  <Text color={textColor}>• Ensure security and prevent fraud</Text>
                </VStack>
              </Box>

              <Divider borderColor={borderColor} />

              <Box>
                <Heading as="h2" size="md" color={headingColor} mb={4}>
                  3. Information Sharing
                </Heading>
                <Text color={textColor} lineHeight="1.7">
                  We do not sell, trade, or otherwise transfer your personal information to third parties. 
                  Your church data remains private and is only accessible to authorized members of your 
                  organization. We may share information only in the following limited circumstances:
                </Text>
                <VStack align="stretch" spacing={2} pl={4} mt={4}>
                  <Text color={textColor}>• With your explicit consent</Text>
                  <Text color={textColor}>• To comply with legal obligations</Text>
                  <Text color={textColor}>• To protect our rights and prevent fraud</Text>
                  <Text color={textColor}>• With trusted service providers who assist in our operations</Text>
                </VStack>
              </Box>

              <Divider borderColor={borderColor} />

              <Box>
                <Heading as="h2" size="md" color={headingColor} mb={4}>
                  4. Data Security
                </Heading>
                <Text color={textColor} lineHeight="1.7">
                  We implement industry-standard security measures to protect your data, including:
                </Text>
                <VStack align="stretch" spacing={2} pl={4} mt={4}>
                  <Text color={textColor}>• Encryption of data in transit and at rest</Text>
                  <Text color={textColor}>• Regular security audits and monitoring</Text>
                  <Text color={textColor}>• Secure authentication and access controls</Text>
                  <Text color={textColor}>• Regular backups and disaster recovery procedures</Text>
                </VStack>
              </Box>

              <Divider borderColor={borderColor} />

              <Box>
                <Heading as="h2" size="md" color={headingColor} mb={4}>
                  5. Your Rights and Choices
                </Heading>
                <Text color={textColor} lineHeight="1.7">
                  You have the right to:
                </Text>
                <VStack align="stretch" spacing={2} pl={4} mt={4}>
                  <Text color={textColor}>• Access and update your personal information</Text>
                  <Text color={textColor}>• Delete your account and associated data</Text>
                  <Text color={textColor}>• Export your church data</Text>
                  <Text color={textColor}>• Opt out of non-essential communications</Text>
                  <Text color={textColor}>• Request information about how we process your data</Text>
                </VStack>
              </Box>

              <Divider borderColor={borderColor} />

              <Box>
                <Heading as="h2" size="md" color={headingColor} mb={4}>
                  6. Data Retention
                </Heading>
                <Text color={textColor} lineHeight="1.7">
                  We retain your information for as long as your account is active or as needed to 
                  provide you services. If you delete your account, we will delete your personal 
                  information within 30 days, except where we are required to retain it for legal purposes.
                </Text>
              </Box>

              <Divider borderColor={borderColor} />

              <Box>
                <Heading as="h2" size="md" color={headingColor} mb={4}>
                  7. Children's Privacy
                </Heading>
                <Text color={textColor} lineHeight="1.7">
                  Spirit Lead is not intended for use by individuals under the age of 16. We do not 
                  knowingly collect personal information from children under 16. If we become aware 
                  that we have collected such information, we will take steps to delete it promptly.
                </Text>
              </Box>

              <Divider borderColor={borderColor} />

              <Box>
                <Heading as="h2" size="md" color={headingColor} mb={4}>
                  8. Changes to This Policy
                </Heading>
                <Text color={textColor} lineHeight="1.7">
                  We may update this privacy policy from time to time. We will notify you of any 
                  material changes by posting the new policy on this page and updating the "last 
                  updated" date. Your continued use of our service after such changes constitutes 
                  acceptance of the updated policy.
                </Text>
              </Box>

              <Divider borderColor={borderColor} />

              <Box>
                <Heading as="h2" size="md" color={headingColor} mb={4}>
                  9. Contact Us
                </Heading>
                <Text color={textColor} lineHeight="1.7">
                  If you have any questions about this privacy policy or our data practices, 
                  please contact us at:
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
