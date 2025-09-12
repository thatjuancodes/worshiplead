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
import { useTranslation } from 'react-i18next'

export function HeroSection() {
  const { t } = useTranslation()
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
            {t('homePage.hero.title')}
          </Heading>

          <Text
            fontSize="xl"
            color={textColor}
            maxW="3xl"
            lineHeight="1.6"
          >
            {t('homePage.hero.subtitle')}
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
              {t('homePage.hero.getStarted')}
            </Button>
          </Box>

          <Text color={textColor}>
            {t('loginPage.noAccount')}{' '}
            <Box
              as={Link}
              to="/login"
              color={linkColor}
              _hover={{ color: linkHoverColor }}
              textDecoration="underline"
              transition="color 0.2s ease"
            >
              {t('header.login')}
            </Box>
          </Text>
        </VStack>
      </Container>
    </Box>
  )
} 