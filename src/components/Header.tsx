import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { 
  Box, 
  Flex, 
  Heading, 
  Button, 
  Container,
  useColorModeValue
} from '@chakra-ui/react'
import { getCurrentUser } from '../lib/auth'
import type { User } from '@supabase/supabase-js'

export function Header() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const headerBg = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')
  const logoColor = useColorModeValue('gray.800', 'white')
  const logoHoverColor = useColorModeValue('blue.500', 'blue.300')

  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await getCurrentUser()
        setUser(currentUser)
      } catch (error) {
        console.error('Error checking user:', error)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkUser()
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
                Worship Lead
              </Heading>
            </Link>
          </Box>

          <Flex gap={3} alignItems="center">
            {!loading && (
              <>
                {user ? (
                  <Button as={Link} to="/dashboard" colorScheme="blue" size="md">
                    Dashboard
                  </Button>
                ) : (
                  <>
                    <Button as={Link} to="/login" variant="outline" size="md">
                      Login
                    </Button>

                    <Button as={Link} to="/signup" colorScheme="blue" size="md">
                      Try for free
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