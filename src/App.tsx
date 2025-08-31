import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { 
  Box, 
  useColorModeValue
} from '@chakra-ui/react'

import { AuthProvider, OrganizationMembershipsProvider } from './contexts'
import { AuthenticatedApp } from './AuthenticatedApp'

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
