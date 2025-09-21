import { Link } from 'react-router-dom'
import { signOut } from '../lib/auth'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../hooks/useLanguage'
import { 
  Box, 
  Flex, 
  Heading, 
  Text, 
  Button, 
  useColorModeValue,
  Container,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  Avatar,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  VStack,
  Divider,
  useDisclosure,
  Image,
  HStack
} from '@chakra-ui/react'
import { ChevronDownIcon, HamburgerIcon } from '@chakra-ui/icons'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useOrganizationAccess } from '../hooks/useOrganizationAccess'
import logoImage from '../assets/images/logo.png'

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

interface UserProfile {
  id: string
  first_name: string
  last_name: string
  email: string
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
  const { t, i18n } = useTranslation()
  const { currentLanguage, changeLanguage, availableLanguages } = useLanguage()
  const navigate = useNavigate()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const { canManagePrimary } = useOrganizationAccess()

  // Debug i18n resources
  if (process.env.NODE_ENV === 'development') {
    console.log('Current language:', currentLanguage)
    console.log('i18n language:', i18n.language)
    console.log('Available resources:', Object.keys(i18n.store?.data || {}))
    console.log('VN header resources:', (i18n.store?.data as any)?.vn?.translation?.header)
  }

  // Create translation helper function that provides fallbacks
  const translate = useCallback((key: string, fallback: string) => {
    const translation = t(key)
    // Debug logging for troubleshooting
    if (process.env.NODE_ENV === 'development') {
      console.log(`Translation for ${key}:`, translation, `(current language: ${currentLanguage})`)
    }
    // Check if translation exists and is not just the key returned
    if (translation && translation !== key && translation.trim() !== '') {
      return translation
    }
    return fallback
  }, [t, currentLanguage])

  // Color mode values
  const headerBg = useColorModeValue('white', 'gray.800')
  const headerBorderColor = useColorModeValue('gray.200', 'gray.600')
  const logoColor = useColorModeValue('gray.800', 'white')
  const userNameColor = useColorModeValue('gray.700', 'gray.200')
  const orgNameBg = useColorModeValue('blue.50', 'blue.900')
  const orgNameColor = useColorModeValue('blue.700', 'blue.200')
  const menuBg = useColorModeValue('white', 'gray.800')
  const menuBorderColor = useColorModeValue('gray.200', 'gray.600')
  const drawerBg = useColorModeValue('white', 'gray.900')
  const drawerHeaderBg = useColorModeValue('blue.500', 'blue.600')
  const drawerHeaderColor = 'white'

  // Fetch user profile from the profiles table
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error fetching user profile:', error)
          return
        }

        setUserProfile(profile)
      } catch (error) {
        console.error('Error fetching user profile:', error)
      }
    }

    fetchUserProfile()
  }, [user?.id])

  // Fallback to user metadata if profile is not available
  const displayName = userProfile 
    ? `${userProfile.first_name} ${userProfile.last_name}`
    : user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'User'



  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/')
      onClose()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleNavigation = (path: string) => {
    navigate(path)
    onClose()
  }


  return (
    <>
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
                <HStack spacing={3} align="center">
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
                    color={logoColor}
                    fontWeight="700"
                    m={0}
                    _hover={{ color: 'blue.500' }}
                    transition="color 0.2s ease"
                  >
                    {t('header.appName')}
                  </Heading>
                </HStack>
              </Link>
            </Box>
            
            {/* User Info and Menu */}
            <Flex align="center" gap={4} flexShrink={0}>
              {/* Organization name - hidden on mobile, shown in dropdown instead */}
              <Box
                bg={orgNameBg}
                color={orgNameColor}
                px={3}
                py={1}
                borderRadius="full"
                fontSize="sm"
                fontWeight="500"
                whiteSpace="nowrap"
                display={{ base: 'none', md: 'block' }}
              >
                {getOrganizationName(organization)}
              </Box>
              
              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="sm"
                px={3}
                py={2}
                display={{ base: 'flex', md: 'none' }}
                onClick={onOpen}
                _hover={{ bg: useColorModeValue('gray.100', 'gray.700') }}
                _active={{ bg: useColorModeValue('gray.200', 'gray.600') }}
              >
                <HamburgerIcon />
              </Button>
              
              {/* Desktop Dropdown Menu */}
              <Box display={{ base: 'none', md: 'block' }}>
                <Menu>
                  <MenuButton
                    as={Button}
                    variant="ghost"
                    size="sm"
                    px={3}
                    py={2}
                    _hover={{ bg: useColorModeValue('gray.100', 'gray.700') }}
                    _active={{ bg: useColorModeValue('gray.200', 'gray.600') }}
                    rightIcon={<ChevronDownIcon />}
                  >
                    <Flex align="center" gap={2}>
                      <Avatar
                        size="sm"
                        name={displayName}
                        bg="blue.500"
                        color="white"
                        fontSize="xs"
                      />
                      <Text
                        fontWeight="500"
                        color={userNameColor}
                        whiteSpace="nowrap"
                        fontSize="sm"
                      >
                        {displayName}
                      </Text>
                    </Flex>
                  </MenuButton>
                  
                  <MenuList
                    bg={menuBg}
                    border="1px"
                    borderColor={menuBorderColor}
                    boxShadow="lg"
                    py={2}
                  >
                    <MenuItem
                      onClick={() => navigate('/dashboard')}
                      _hover={{ bg: useColorModeValue('gray.100', 'gray.700') }}
                    >
                      {translate('header.dashboard', 'Dashboard')}
                    </MenuItem>
                    <MenuItem
                      onClick={() => navigate('/songbank')}
                      _hover={{ bg: useColorModeValue('gray.100', 'gray.700') }}
                    >
                      {translate('header.songbank', 'Songbank')}
                    </MenuItem>
                    {canManagePrimary && (
                      <MenuItem
                        onClick={() => navigate('/team')}
                        _hover={{ bg: useColorModeValue('gray.100', 'gray.700') }}
                      >
                        {translate('header.teamManagement', 'Team Management')}
                      </MenuItem>
                    )}
                    {canManagePrimary && (
                      <MenuItem
                        onClick={() => navigate('/schedule')}
                        _hover={{ bg: useColorModeValue('gray.100', 'gray.700') }}
                      >
                        {translate('header.scheduleService', 'Schedule Service')}
                      </MenuItem>
                    )}
                    <MenuDivider />
                    
                    {/* Language Selector - Simple MenuItems */}
                    {availableLanguages.map((language) => (
                      <MenuItem
                        key={language.code}
                        onClick={() => changeLanguage(language.code)}
                        _hover={{ bg: useColorModeValue('gray.100', 'gray.700') }}
                        bg={currentLanguage === language.code ? useColorModeValue('blue.50', 'blue.900') : 'transparent'}
                        color={currentLanguage === language.code ? 'blue.600' : 'inherit'}
                        fontWeight={currentLanguage === language.code ? '600' : 'normal'}
                      >
                        <Flex justify="space-between" align="center" w="100%">
                          <Text>
                            {language.name}
                          </Text>
                          {currentLanguage === language.code && (
                            <Text fontSize="xs" color="blue.500">
                              ✓
                            </Text>
                          )}
                        </Flex>
                      </MenuItem>
                    ))}
                    
                    <MenuDivider />
                    <MenuItem
                      onClick={handleSignOut}
                      _hover={{ bg: useColorModeValue('red.50', 'red.900') }}
                      color="red.500"
                    >
                      {translate('header.signOut', 'Sign Out')}
                    </MenuItem>
                  </MenuList>
                </Menu>
              </Box>
            </Flex>
          </Flex>
        </Container>
      </Box>

      {/* Mobile Full-Page Menu Overlay */}
      <Drawer isOpen={isOpen} placement="left" onClose={onClose} size="full">
        <DrawerOverlay />
        <DrawerContent bg={drawerBg}>
          <DrawerCloseButton color={drawerHeaderColor} size="lg" />
          
          {/* Header Section */}
          <DrawerHeader bg={drawerHeaderBg} color={drawerHeaderColor} py={8}>
            <VStack spacing={4} align="center">
              <Avatar
                size="xl"
                name={displayName}
                bg="white"
                color="blue.500"
                fontSize="2xl"
                fontWeight="bold"
              />
              <VStack spacing={1}>
                <Text fontSize="lg" fontWeight="600">
                  {displayName}
                </Text>
                <Text fontSize="sm" opacity={0.9}>
                  {userProfile?.email || user?.email}
                </Text>
              </VStack>
              <Box
                bg="white"
                color={drawerHeaderBg}
                px={4}
                py={2}
                borderRadius="full"
                fontSize="sm"
                fontWeight="600"
              >
                {getOrganizationName(organization)}
              </Box>
            </VStack>
          </DrawerHeader>
          
          {/* Navigation Menu */}
          <DrawerBody py={0}>
            <VStack spacing={0} align="stretch">
              <Button
                variant="ghost"
                size="lg"
                justifyContent="flex-start"
                py={6}
                px={6}
                onClick={() => handleNavigation('/dashboard')}
                _hover={{ bg: useColorModeValue('gray.50', 'gray.700') }}
                _active={{ bg: useColorModeValue('gray.100', 'gray.600') }}
              >
                <Text fontSize="lg" fontWeight="500">
                  {translate('header.dashboard', 'Dashboard')}
                </Text>
              </Button>
              
              <Button
                variant="ghost"
                size="lg"
                justifyContent="flex-start"
                py={6}
                px={6}
                onClick={() => handleNavigation('/songbank')}
                _hover={{ bg: useColorModeValue('gray.50', 'gray.700') }}
                _active={{ bg: useColorModeValue('gray.100', 'gray.600') }}
              >
                <Text fontSize="lg" fontWeight="500">
                  {translate('header.songbank', 'Songbank')}
                </Text>
              </Button>
              
              {canManagePrimary && (
                <Button
                  variant="ghost"
                  size="lg"
                  justifyContent="flex-start"
                  py={6}
                  px={6}
                  onClick={() => handleNavigation('/team')}
                  _hover={{ bg: useColorModeValue('gray.50', 'gray.700') }}
                  _active={{ bg: useColorModeValue('gray.100', 'gray.600') }}
                >
                  <Text fontSize="lg" fontWeight="500">
                    {translate('header.teamManagement', 'Team Management')}
                  </Text>
                </Button>
              )}
              
              {canManagePrimary && (
                <Button
                  variant="ghost"
                  size="lg"
                  justifyContent="flex-start"
                  py={6}
                  px={6}
                  onClick={() => handleNavigation('/schedule')}
                  _hover={{ bg: useColorModeValue('gray.50', 'gray.700') }}
                  _active={{ bg: useColorModeValue('gray.100', 'gray.600') }}
                >
                  <Text fontSize="lg" fontWeight="500">
                    {translate('header.scheduleService', 'Schedule Service')}
                  </Text>
                </Button>
              )}
              
              <Divider my={4} />
              
              {/* Language Selector for Mobile */}
              <Box px={6} py={3}>
                <Text fontSize="sm" fontWeight="600" color="gray.500" mb={2}>
                  {translate('header.language', 'Language')}
                </Text>
                <Flex gap={2}>
                  {availableLanguages.map((language) => (
                    <Button
                      key={language.code}
                      size="sm"
                      variant={currentLanguage === language.code ? 'solid' : 'outline'}
                      colorScheme={currentLanguage === language.code ? 'blue' : 'gray'}
                      onClick={() => changeLanguage(language.code)}
                      flex="1"
                    >
                      {language.name}
                    </Button>
                  ))}
                </Flex>
              </Box>
              
              <Divider my={4} />
              
              <Button
                variant="ghost"
                size="lg"
                justifyContent="flex-start"
                py={6}
                px={6}
                onClick={handleSignOut}
                color="red.500"
                _hover={{ bg: useColorModeValue('red.50', 'red.900') }}
                _active={{ bg: useColorModeValue('red.100', 'red.800') }}
              >
                <Text fontSize="lg" fontWeight="500">
                  {translate('header.signOut', 'Sign Out')}
                </Text>
              </Button>
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  )
} 