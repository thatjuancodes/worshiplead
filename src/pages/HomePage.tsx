import { useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  Box, 
  Container, 
  Heading, 
  Text, 
  Button, 
  VStack,
  HStack,
  SimpleGrid,
  Flex,
  Image,
  Badge,
  Collapse,
  IconButton,
  useColorModeValue,
  useDisclosure
} from '@chakra-ui/react'
import { ChevronDownIcon, ChevronUpIcon, HamburgerIcon, CloseIcon } from '@chakra-ui/icons'
import { useTranslation } from 'react-i18next'
import logoImage from '../assets/images/logo.png'

export function HomePage() {
  const { t } = useTranslation()
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const { isOpen: isMenuOpen, onToggle: onMenuToggle } = useDisclosure()

  // Smooth scroll to section
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
    // Close mobile menu if open
    if (isMenuOpen) {
      onMenuToggle()
    }
  }

  // Scroll to top (hero section)
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
    // Close mobile menu if open
    if (isMenuOpen) {
      onMenuToggle()
    }
  }

  // Color mode values
  const bgColor = useColorModeValue('white', 'gray.900')
  const borderColor = useColorModeValue('gray.200', 'gray.700')
  const textColor = useColorModeValue('gray.700', 'gray.200')
  const mutedTextColor = useColorModeValue('gray.600', 'gray.400')
  const headingColor = useColorModeValue('gray.900', 'white')
  const cardBg = useColorModeValue('gray.50', 'gray.800')
  const featureBg = useColorModeValue('white', 'gray.800')
  const heroGradient = useColorModeValue(
    'linear(to-br, blue.50, white, purple.50)',
    'linear(to-br, gray.900, gray.800, gray.900)'
  )

  const features = [
    {
      icon: '📅',
      title: t('homePage.features.scheduling.title', 'Service Scheduling'),
      description: t('homePage.features.scheduling.description', 'Plan services, assign roles, keep everyone organized.')
    },
    {
      icon: '🎵',
      title: t('homePage.features.songbank.title', 'Song Library'),
      description: t('homePage.features.songbank.description', 'Store and share your church songs instantly.')
    },
    {
      icon: '👥',
      title: t('homePage.features.team.title', 'Team Management'),
      description: t('homePage.features.team.description', 'Track availability, send reminders, stay coordinated.')
    }
  ]


  const faqs = [
    {
      question: t('homePage.faq.quickStart.question', 'How quickly can we start?'),
      answer: t('homePage.faq.quickStart.answer', 'Set up your church and start planning in 15 minutes.')
    },
    {
      question: t('homePage.faq.importSongs.question', 'Can we import our songs?'),
      answer: t('homePage.faq.importSongs.answer', 'Yes! Import from SongSelect, Planning Center, or spreadsheets.')
    },
    {
      question: t('homePage.faq.scheduling.question', 'How does scheduling work?'),
      answer: t('homePage.faq.scheduling.answer', 'Team sets availability, you assign roles, everyone gets notified.')
    },
    {
      question: t('homePage.faq.mobile.question', 'Is there a mobile version?'),
      answer: t('homePage.faq.mobile.answer', 'Works perfectly on any mobile browser.')
    },
    {
      question: t('homePage.faq.support.question', 'Need help setting up?'),
      answer: t('homePage.faq.support.answer', 'We provide tutorials, chat support, and setup calls.')
    }
  ]

  return (
    <Box minH="100vh" bg={bgColor}>
      {/* Navigation */}
      <Box
        as="nav"
        bg={bgColor}
        borderBottom="1px"
        borderColor={borderColor}
        position="sticky"
        top={0}
        zIndex={50}
      >
        <Container maxW="7xl" px={{ base: 4, sm: 6, lg: 8 }}>
          <Flex justify="space-between" align="center" h={16}>
            {/* Logo */}
            <Flex align="center">
              <HStack 
                spacing={3} 
                align="center" 
                cursor="pointer"
                onClick={scrollToTop}
                _hover={{ opacity: 0.8 }}
                transition="opacity 0.2s"
              >
                <Image
                  src={logoImage}
                  alt="Spirit Lead Logo"
                  h="32px"
                  w="auto"
                  objectFit="contain"
                />
                <Heading
                  as="h1"
                  size="lg"
                  color="blue.600"
                  fontWeight="bold"
                  m={0}
                >
                  Spirit Lead
                </Heading>
              </HStack>
            </Flex>
            
            {/* Desktop Navigation & CTA */}
            <HStack spacing={6} display={{ base: 'none', md: 'flex' }}>
              <Text
                color={textColor}
                _hover={{ color: 'blue.600' }}
                px={3}
                py={2}
                fontSize="sm"
                fontWeight="medium"
                transition="colors 0.2s"
                cursor="pointer"
                onClick={() => scrollToSection('features')}
              >
                Features
              </Text>
              <Text
                color={textColor}
                _hover={{ color: 'blue.600' }}
                px={3}
                py={2}
                fontSize="sm"
                fontWeight="medium"
                transition="colors 0.2s"
                cursor="pointer"
                onClick={() => scrollToSection('pricing')}
              >
                Pricing
              </Text>
              <Text
                color={textColor}
                _hover={{ color: 'blue.600' }}
                px={3}
                py={2}
                fontSize="sm"
                fontWeight="medium"
                transition="colors 0.2s"
                cursor="pointer"
                onClick={() => scrollToSection('faq')}
              >
                FAQ
              </Text>
              <Button
                as={Link}
                to="/login"
                variant="outline"
                px={6}
                py={2}
                fontWeight="medium"
                _hover={{ bg: 'gray.50' }}
                transition="colors 0.2s"
              >
                Login
              </Button>
              <Button
                as={Link}
                to="/signup"
                colorScheme="blue"
                px={6}
                py={2}
                fontWeight="medium"
                _hover={{ bg: 'blue.700' }}
                transition="colors 0.2s"
              >
                Start Free Trial
              </Button>
            </HStack>

            {/* Mobile menu button */}
            <IconButton
              display={{ base: 'block', md: 'none' }}
              aria-label="Toggle menu"
              icon={isMenuOpen ? <CloseIcon /> : <HamburgerIcon />}
              variant="ghost"
              onClick={onMenuToggle}
            />
          </Flex>
        </Container>

        {/* Mobile menu */}
        <Collapse in={isMenuOpen} animateOpacity>
          <Box
            display={{ base: 'block', md: 'none' }}
            bg={bgColor}
            borderTop="1px"
            borderColor={borderColor}
          >
            <Container maxW="7xl" px={4}>
              <VStack spacing={1} py={4} align="stretch">
                <Text
                  color={textColor}
                  _hover={{ color: 'blue.600' }}
                  px={3}
                  py={2}
                  fontSize="base"
                  fontWeight="medium"
                  cursor="pointer"
                  onClick={() => scrollToSection('features')}
                >
                  Features
                </Text>
                <Text
                  color={textColor}
                  _hover={{ color: 'blue.600' }}
                  px={3}
                  py={2}
                  fontSize="base"
                  fontWeight="medium"
                  cursor="pointer"
                  onClick={() => scrollToSection('pricing')}
                >
                  Pricing
                </Text>
                <Text
                  color={textColor}
                  _hover={{ color: 'blue.600' }}
                  px={3}
                  py={2}
                  fontSize="base"
                  fontWeight="medium"
                  cursor="pointer"
                  onClick={() => scrollToSection('faq')}
                >
                  FAQ
                </Text>
                <Button
                  as={Link}
                  to="/login"
                  variant="outline"
                  mt={4}
                  w="full"
                  fontWeight="medium"
                  _hover={{ bg: 'gray.50' }}
                >
                  Login
                </Button>
                <Button
                  as={Link}
                  to="/signup"
                  colorScheme="blue"
                  mt={2}
                  w="full"
                  fontWeight="medium"
                >
                  Start Free Trial
                </Button>
              </VStack>
            </Container>
          </Box>
        </Collapse>
      </Box>

      {/* Hero Section */}
      <Box
        as="section"
        position="relative"
        bgGradient={heroGradient}
        py={{ base: 20, lg: 32 }}
        overflow="hidden"
      >
        {/* Hero Background Image */}
        <Box
          position="absolute"
          inset={0}
          bgImage="url('https://readdy.ai/api/search-image?query=Modern%20contemporary%20church%20sanctuary%20with%20worship%20team%20on%20stage%2C%20soft%20warm%20lighting%2C%20people%20raising%20hands%20in%20worship%2C%20guitars%20and%20keyboards%20visible%2C%20peaceful%20atmosphere%2C%20architectural%20details%20like%20wooden%20beams%20or%20modern%20design%20elements%2C%20inspiring%20and%20uplifting%20scene%20with%20warm%20golden%20hour%20lighting%20filtering%20through%20windows&width=1920&height=1080&seq=hero1&orientation=landscape')"
          bgSize="cover"
          bgPosition="center"
          bgRepeat="no-repeat"
          opacity={0.1}
        />
        <Container maxW="7xl" px={{ base: 4, sm: 6, lg: 8 }}>
          <VStack spacing={8} textAlign="center">
            <Heading
              as="h1"
              fontSize={{ base: '4xl', md: '6xl' }}
              fontWeight="bold"
              color={headingColor}
              lineHeight="0.9"
              mb={6}
            >
              Simplify Worship &<br />
              <Text as="span" color="blue.600">
                Team Management
              </Text>
            </Heading>
            
            <Text
              fontSize={{ base: 'xl', md: '2xl' }}
              color={mutedTextColor}
              maxW="3xl"
              mb={8}
            >
              Schedule services, manage your songbank, coordinate volunteers. 
              All in one simple dashboard.
            </Text>
            
            <Flex
              direction={{ base: 'column', sm: 'row' }}
              gap={4}
              justify="center"
              align="center"
              mb={12}
            >
              <Button
                as={Link}
                to="/signup"
                colorScheme="blue"
                size="lg"
                px={8}
                py={4}
                fontSize="lg"
                fontWeight="semibold"
                _hover={{ bg: 'blue.700' }}
                transition="colors 0.2s"
                boxShadow="lg"
              >
                Start Free Trial
              </Button>
              <Button
                as="a"
                href="https://calendly.com/thejuan-codes/30min"
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                size="lg"
                px={8}
                py={4}
                fontSize="lg"
                fontWeight="semibold"
                borderWidth="2px"
                borderColor="gray.300"
                color={textColor}
                _hover={{ borderColor: 'blue.600', color: 'blue.600' }}
                transition="all 0.2s"
              >
                Schedule Demo
              </Button>
            </Flex>
            
            <Text color={mutedTextColor} fontSize="sm">
              ✓ 14-day free trial ✓ No credit card required
            </Text>
          </VStack>
        </Container>
      </Box>

      {/* Features Section */}
      <Box id="features" as="section" py={20} bg={bgColor}>
        <Container maxW="7xl" px={{ base: 4, sm: 6, lg: 8 }}>
          <VStack spacing={16} textAlign="center">
            <Box>
              <Heading
                as="h2"
                fontSize={{ base: '3xl', md: '4xl' }}
                fontWeight="bold"
                color={headingColor}
                mb={4}
              >
                Everything You Need
              </Heading>
            </Box>
            
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8} w="full">
              {features.map((feature, index) => (
                <Box
                  key={index}
                  bg={featureBg}
                  borderRadius="xl"
                  p={8}
                  _hover={{ boxShadow: 'lg' }}
                  transition="box-shadow 0.2s"
                  border="1px"
                  borderColor={borderColor}
                >
                  <VStack spacing={6}>
                    <Box
                      w={16}
                      h={16}
                      bg="blue.100"
                      borderRadius="lg"
      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Text fontSize="2xl">{feature.icon}</Text>
                    </Box>
                    <Heading
                      as="h3"
                      size="lg"
                      fontWeight="semibold"
                      color={headingColor}
                    >
                      {feature.title}
                    </Heading>
                    <Text color={mutedTextColor} textAlign="center">
                      {feature.description}
                    </Text>
                  </VStack>
                </Box>
              ))}
            </SimpleGrid>
          </VStack>
        </Container>
      </Box>

      {/* Dashboard Preview Section */}
      <Box as="section" py={20} bgGradient="linear(to-r, blue.50, purple.50)">
        <Container maxW="7xl" px={{ base: 4, sm: 6, lg: 8 }}>
          <VStack spacing={16} textAlign="center">
            <Box>
              <Heading
                as="h2"
                fontSize={{ base: '3xl', md: '4xl' }}
                fontWeight="bold"
                color={headingColor}
                mb={4}
              >
                See It In Action
              </Heading>
            </Box>
            
            <Box
              bg="white"
              borderRadius="2xl"
              boxShadow="2xl"
              overflow="hidden"
              w="full"
            >
              <Image
                src="https://readdy.ai/api/search-image?query=Modern%20clean%20web%20application%20dashboard%20interface%20for%20church%20management%2C%20showing%20worship%20service%20scheduling%20calendar%2C%20song%20library%20grid%2C%20team%20member%20profiles%2C%20clean%20white%20background%20with%20blue%20and%20purple%20accent%20colors%2C%20professional%20SaaS%20design%2C%20multiple%20sections%20visible%20including%20upcoming%20services%2C%20team%20availability%2C%20and%20song%20search%20functionality&width=1200&height=800&seq=dashboard1&orientation=landscape"
                alt="Spirit Lead Dashboard"
                w="full"
                h="auto"
                objectFit="cover"
                objectPosition="top"
              />
            </Box>
          </VStack>
        </Container>
      </Box>

      {/* Pricing Section */}
      <Box id="pricing" as="section" py={20} bg={bgColor}>
        <Container maxW="7xl" px={{ base: 4, sm: 6, lg: 8 }}>
          <VStack spacing={16} textAlign="center">
            <Box>
              <Heading
                as="h2"
                fontSize={{ base: '3xl', md: '4xl' }}
                fontWeight="bold"
                color={headingColor}
                mb={4}
              >
                Simple Pricing
              </Heading>
            </Box>
            
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8} maxW="5xl" w="full">
              {/* Starter Plan */}
              <Box
                bg={featureBg}
                borderRadius="xl"
                p={8}
                boxShadow="lg"
                border="1px"
                borderColor={borderColor}
              >
                <VStack spacing={6}>
                  <Box textAlign="center">
                    <Text fontSize="xl" fontWeight="semibold" color={headingColor} mb={2}>
                      Starter
                    </Text>
                    <Text color={mutedTextColor} mb={6}>
                      Small churches
                    </Text>
                    <Box mb={6}>
                      <Text fontSize="4xl" fontWeight="bold" color={headingColor}>
                        $29
                      </Text>
                      <Text color={mutedTextColor}>/month</Text>
                    </Box>
                  </Box>
                  <VStack spacing={3} w="full">
                    <HStack>
                      <Text color="green.500">✓</Text>
                      <Text color={textColor}>25 team members</Text>
                    </HStack>
                    <HStack>
                      <Text color="green.500">✓</Text>
                      <Text color={textColor}>Unlimited songs</Text>
                    </HStack>
                    <HStack>
                      <Text color="green.500">✓</Text>
                      <Text color={textColor}>Basic scheduling</Text>
                    </HStack>
                  </VStack>
                  <Button
                    as={Link}
                    to="/signup"
                    w="full"
                    variant="outline"
                    colorScheme="gray"
                    py={3}
                    fontWeight="semibold"
                    _hover={{ bg: 'gray.200' }}
                    transition="colors 0.2s"
                  >
                    Start Free Trial
                  </Button>
                </VStack>
              </Box>

              {/* Growth Plan - Featured */}
              <Box
                bg="blue.600"
                borderRadius="xl"
                p={8}
                boxShadow="xl"
                color="white"
                position="relative"
              >
                <Badge
                  position="absolute"
                  top="-4"
                  left="50%"
                  transform="translateX(-50%)"
                  bg="yellow.400"
                  color="yellow.900"
                  px={4}
                  py={1}
                  borderRadius="full"
                  fontSize="sm"
                  fontWeight="semibold"
                >
                  Popular
                </Badge>
                <VStack spacing={6}>
                  <Box textAlign="center">
                    <Text fontSize="xl" fontWeight="semibold" mb={2}>
                      Growth
                    </Text>
                    <Text color="blue.100" mb={6}>
                      Growing churches
                    </Text>
                    <Box mb={6}>
                      <Text fontSize="4xl" fontWeight="bold">
                        $59
                      </Text>
                      <Text color="blue.100">/month</Text>
                    </Box>
                  </Box>
                  <VStack spacing={3} w="full">
                    <HStack>
                      <Text color="green.400">✓</Text>
                      <Text>100 team members</Text>
                    </HStack>
                    <HStack>
                      <Text color="green.400">✓</Text>
                      <Text>Advanced scheduling</Text>
                    </HStack>
                    <HStack>
                      <Text color="green.400">✓</Text>
                      <Text>Song arrangements</Text>
                    </HStack>
                    <HStack>
                      <Text color="green.400">✓</Text>
                      <Text>Priority support</Text>
                    </HStack>
                  </VStack>
                  <Button
                    as={Link}
                    to="/signup"
                    w="full"
                    bg="white"
                    color="blue.600"
                    py={3}
                    fontWeight="semibold"
                    _hover={{ bg: 'gray.50' }}
                    transition="colors 0.2s"
                  >
                    Start Free Trial
                  </Button>
                </VStack>
              </Box>

              {/* Enterprise Plan */}
              <Box
                bg={featureBg}
                borderRadius="xl"
                p={8}
                boxShadow="lg"
                border="1px"
                borderColor={borderColor}
              >
                <VStack spacing={6}>
                  <Box textAlign="center">
                    <Text fontSize="xl" fontWeight="semibold" color={headingColor} mb={2}>
                      Enterprise
                    </Text>
                    <Text color={mutedTextColor} mb={6}>
                      Large churches
                    </Text>
                    <Box mb={6}>
                      <Text fontSize="4xl" fontWeight="bold" color={headingColor}>
                        $149
                      </Text>
                      <Text color={mutedTextColor}>/month</Text>
                    </Box>
                  </Box>
                  <VStack spacing={3} w="full">
                    <HStack>
                      <Text color="green.500">✓</Text>
                      <Text color={textColor}>Unlimited members</Text>
                    </HStack>
                    <HStack>
                      <Text color="green.500">✓</Text>
                      <Text color={textColor}>Multi-campus</Text>
                    </HStack>
                    <HStack>
                      <Text color="green.500">✓</Text>
                      <Text color={textColor}>Advanced analytics</Text>
                    </HStack>
                    <HStack>
                      <Text color="green.500">✓</Text>
                      <Text color={textColor}>Dedicated support</Text>
                    </HStack>
                  </VStack>
                  <Button
                    w="full"
                    variant="outline"
                    colorScheme="gray"
                    py={3}
                    fontWeight="semibold"
                    _hover={{ bg: 'gray.200' }}
                    transition="colors 0.2s"
                  >
                    Contact Sales
                  </Button>
                </VStack>
              </Box>
            </SimpleGrid>
          </VStack>
        </Container>
      </Box>

      {/* FAQ Section */}
      <Box id="faq" as="section" py={20} bg={cardBg}>
        <Container maxW="4xl" px={{ base: 4, sm: 6, lg: 8 }}>
          <VStack spacing={16}>
            <Box textAlign="center">
              <Heading
                as="h2"
                fontSize={{ base: '3xl', md: '4xl' }}
                fontWeight="bold"
                color={headingColor}
                mb={4}
              >
                FAQ
              </Heading>
            </Box>
            
            <VStack spacing={4} w="full">
              {faqs.map((faq, index) => (
                <Box
                  key={index}
                  border="1px"
                  borderColor={borderColor}
                  borderRadius="lg"
                  w="full"
                >
                  <Button
                    w="full"
                    px={6}
                    py={4}
                    textAlign="left"
                    variant="ghost"
                    justifyContent="space-between"
                    rightIcon={
                      openFaq === index ? <ChevronUpIcon /> : <ChevronDownIcon />
                    }
                    _hover={{ bg: cardBg }}
                    transition="colors 0.2s"
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    borderRadius="lg"
                  >
                    <Text fontWeight="semibold" color={headingColor}>
                      {faq.question}
                    </Text>
                  </Button>
                  <Collapse in={openFaq === index} animateOpacity>
                    <Box px={6} pb={4}>
                      <Text color={mutedTextColor}>{faq.answer}</Text>
                    </Box>
                  </Collapse>
                </Box>
              ))}
            </VStack>
          </VStack>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box as="section" py={20} bg="blue.600">
        <Container maxW="4xl" px={{ base: 4, sm: 6, lg: 8 }} textAlign="center">
          <VStack spacing={8}>
            <Heading
              as="h2"
              fontSize={{ base: '3xl', md: '4xl' }}
              fontWeight="bold"
              color="white"
              mb={4}
            >
              Ready to Get Started?
            </Heading>
            <Text
              fontSize="xl"
              color="blue.100"
              mb={8}
              maxW="2xl"
            >
              Join thousands of churches using Spirit Lead. Start your free trial today.
            </Text>
            <Flex
              direction={{ base: 'column', sm: 'row' }}
              gap={4}
              justify="center"
            >
              <Button
                as={Link}
                to="/signup"
                bg="white"
                color="blue.600"
                size="lg"
                px={8}
                py={4}
                fontSize="lg"
                fontWeight="semibold"
                _hover={{ bg: 'gray.50' }}
                transition="colors 0.2s"
                boxShadow="lg"
              >
                Start Free Trial
              </Button>
              <Button
                as="a"
                href="https://calendly.com/thejuan-codes/30min"
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                size="lg"
                px={8}
                py={4}
                fontSize="lg"
                fontWeight="semibold"
                borderWidth="2px"
                borderColor="white"
                color="white"
                _hover={{ bg: 'white', color: 'blue.600' }}
                transition="all 0.2s"
              >
                Schedule Demo
              </Button>
            </Flex>
            <Text color="blue.200" fontSize="sm" mt={6}>
              No credit card required • Cancel anytime
            </Text>
          </VStack>
        </Container>
      </Box>

      {/* Footer */}
      <Box as="footer" bg={useColorModeValue('gray.900', 'gray.950')} color="white" py={16}>
        <Container maxW="7xl" px={{ base: 4, sm: 6, lg: 8 }}>
          <SimpleGrid columns={{ base: 1, md: 4 }} spacing={8}>
            <Box>
              <HStack 
                spacing={3} 
                align="center" 
                mb={4}
                cursor="pointer"
                onClick={scrollToTop}
                _hover={{ opacity: 0.8 }}
                transition="opacity 0.2s"
              >
                <Image
                  src={logoImage}
                  alt="Spirit Lead Logo"
                  h="24px"
                  w="auto"
                  objectFit="contain"
                  filter="brightness(0) invert(1)"
                />
                <Heading
                  as="h3"
                  size="lg"
                  color="white"
                  fontWeight="bold"
                  m={0}
                >
                  Spirit Lead
                </Heading>
              </HStack>
              <Text color="gray.400" mb={6}>
                Simplifying worship for churches everywhere.
              </Text>
            </Box>
            
            <Box>
              <Text fontWeight="semibold" mb={4}>Product</Text>
              <VStack spacing={2} align="start">
                <Text 
                  color="gray.400" 
                  _hover={{ color: 'white' }} 
                  cursor="pointer"
                  onClick={() => scrollToSection('features')}
                >
                  Features
                </Text>
                <Text 
                  color="gray.400" 
                  _hover={{ color: 'white' }} 
                  cursor="pointer"
                  onClick={() => scrollToSection('pricing')}
                >
                  Pricing
                </Text>
              </VStack>
            </Box>
            
            <Box>
              <Text fontWeight="semibold" mb={4}>Support</Text>
              <VStack spacing={2} align="start">
                <Text 
                  as="a"
                  href="https://docs.google.com/forms/d/e/1FAIpQLScWrA1M10R2R8wbco9BtCbWhQHNlsxRQOJzUTDjv0wx8LkoPA/viewform?usp=header"
                  target="_blank"
                  rel="noopener noreferrer"
                  color="gray.400" 
                  _hover={{ color: 'white' }} 
                  cursor="pointer"
                >
                  Waitlist
                </Text>
                <Text 
                  as="a"
                  href="https://calendly.com/thejuan-codes/30min"
                  target="_blank"
                  rel="noopener noreferrer"
                  color="gray.400" 
                  _hover={{ color: 'white' }} 
                  cursor="pointer"
                >
                  Schedule Demo
                </Text>
              </VStack>
            </Box>
            
            <Box>
              <Text fontWeight="semibold" mb={4}>Company</Text>
              <VStack spacing={2} align="start">
                <Link to="/about">
                  <Text color="gray.400" _hover={{ color: 'white' }} cursor="pointer">
                    About
                  </Text>
                </Link>
                <Link to="/privacy">
                  <Text color="gray.400" _hover={{ color: 'white' }} cursor="pointer">
                    Privacy
                  </Text>
                </Link>
                <Link to="/terms">
                  <Text color="gray.400" _hover={{ color: 'white' }} cursor="pointer">
                    Terms
                  </Text>
                </Link>
              </VStack>
            </Box>
          </SimpleGrid>
          
          <Flex
            direction={{ base: 'column', md: 'row' }}
            justify="space-between"
            align="center"
            borderTop="1px"
            borderColor="gray.800"
            mt={12}
            pt={8}
          >
            <Text color="gray.400" fontSize="sm">
              © 2024 Spirit Lead. All rights reserved.
            </Text>
            <Text color="gray.400" fontSize="sm" mt={{ base: 4, md: 0 }}>
              Made with ❤️ for churches
            </Text>
          </Flex>
        </Container>
      </Box>
    </Box>
  )
} 
