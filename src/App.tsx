import { Box, useColorModeValue } from '@chakra-ui/react'
import { AuthProvider } from './contexts'
import { AuthenticatedApp } from './AuthenticatedApp'
import './index.css'

function App() {
  return (
    <Box minH="100vh" bg={useColorModeValue('white', 'gray.900')}>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </Box>
  )
}

export default App
