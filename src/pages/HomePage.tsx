import { useRef } from 'react'
import { Box } from '@chakra-ui/react'
import { Header, HeroSection, FeaturesSection, Footer } from '../components'

export function HomePage() {
  const featuresRef = useRef<HTMLElement>(null)

  return (
    <Box
      as="div"
      minH="100vh"
      display="flex"
      flexDirection="column"
    >
      <Header />

      <Box as="main" flex="1">
        <HeroSection />

        <FeaturesSection ref={featuresRef} />
      </Box>

      <Footer />
    </Box>
  )
} 