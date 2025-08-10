import { 
  Box, 
  Container, 
  Text,
  useColorModeValue
} from '@chakra-ui/react'

export function Footer() {
  const currentYear = new Date().getFullYear()
  const footerBg = useColorModeValue('gray.100', 'gray.800')
  const textColor = useColorModeValue('gray.600', 'gray.400')

  return (
    <Box
      as="footer"
      bg={footerBg}
      py={8}
      mt="auto"
    >
      <Container maxW="1200px" px={6}>
        <Text
          textAlign="center"
          color={textColor}
          fontSize="sm"
        >
          &copy; {currentYear} Worship Lead. All rights reserved.
        </Text>
      </Container>
    </Box>
  )
} 