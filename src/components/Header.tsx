import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { 
  Box, 
  Flex, 
  Heading, 
  Button, 
  Container,
  Spinner,
  useColorModeValue,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Text
} from '@chakra-ui/react'
import { ChevronDownIcon } from '@chakra-ui/icons'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../hooks/useLanguage'
import { getCurrentUser } from '../lib/auth'
import type { User } from '@supabase/supabase-js'

export function Header() {
  const { t } = useTranslation()
  const { currentLanguage, changeLanguage, availableLanguages } = useLanguage()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const headerBg = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')
  const logoColor = useColorModeValue('gray.800', 'white')
  const logoHoverColor = useColorModeValue('blue.500', 'blue.300')

  useEffect(() => {
    const checkUser = async () => {
      try {
        setLoading(true)
        console.log('Header: Checking user authentication...')
        const currentUser = await getCurrentUser()
        console.log('Header: User check result:', currentUser ? 'User found' : 'No user')
        setUser(currentUser)
      } catch (error) {
        console.error('Header: Error checking user:', error)
        setUser(null)
      } finally {
        setLoading(false)
        console.log('Header: User check completed')
      }
    }

    // Add a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('Header: Loading timeout reached, setting loading to false')
        setLoading(false)
      }
    }, 5000) // 5 second timeout

    checkUser()

    return () => clearTimeout(timeoutId)
  }, [])

  return (
    <Box
      as="header"
      bg={headerBg}
      borderBottom="1px"
      borderColor={borderColor}
      py={3}
      position="sticky"
      top={0}
      zIndex={100}
    >
      <Container maxW="1200px" px={6}>
        <Flex justify="space-between" align="center" minH="3.5rem">
          <Box display="flex" alignItems="center" minH="2.25rem">
            <Link to={user ? "/dashboard" : "/"} style={{ textDecoration: 'none' }}>
              <Heading
                as="h1"
                size="lg"
                color={logoColor}
                _hover={{ color: logoHoverColor }}
                transition="color 0.2s ease"
                m={0}
                p={0}
                lineHeight={1}
                display="flex"
                alignItems="center"
              >
                {t('header.appName')}
              </Heading>
            </Link>
          </Box>

          <Flex gap={3} alignItems="center">
            {/* Language Selector */}
            <Menu>
              <MenuButton as={Button} variant="outline" size="md" rightIcon={<ChevronDownIcon />}>
                <Text fontSize="sm">{availableLanguages.find(lang => lang.code === currentLanguage)?.name || 'EN'}</Text>
              </MenuButton>
              <MenuList>
                {availableLanguages.map((language) => (
                  <MenuItem
                    key={language.code}
                    onClick={() => changeLanguage(language.code)}
                    bg={currentLanguage === language.code ? useColorModeValue('blue.50', 'blue.900') : 'transparent'}
                  >
                    {language.name}
                  </MenuItem>
                ))}
              </MenuList>
            </Menu>

            {loading ? (
              <Spinner size="sm" color="blue.500" />
            ) : (
              <>
                {user ? (
                  <Button as={Link} to="/dashboard" colorScheme="blue" size="md">
                    {t('header.dashboard')}
                  </Button>
                ) : (
                  <>
                    <Button as={Link} to="/login" variant="outline" size="md">
                      {t('header.login')}
                    </Button>

                    <Button as={Link} to="/signup" colorScheme="blue" size="md">
                      {t('header.tryForFree')}
                    </Button>
                  </>
                )}
              </>
            )}
          </Flex>
        </Flex>
      </Container>
    </Box>
  )
} 