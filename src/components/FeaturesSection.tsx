import { forwardRef } from 'react'
import { 
  Box, 
  Container, 
  Heading, 
  Text, 
  SimpleGrid,
  useColorModeValue
} from '@chakra-ui/react'

interface FeatureCardProps {
  title: string
  description: string
  icon: string
}

function FeatureCard({ title, description, icon }: FeatureCardProps) {
  const cardBg = useColorModeValue('white', 'gray.700')
  const cardBorder = useColorModeValue('gray.200', 'gray.600')
  const cardHoverBg = useColorModeValue('gray.50', 'gray.600')
  const titleColor = useColorModeValue('gray.800', 'white')
  const textColor = useColorModeValue('gray.600', 'gray.300')

  return (
    <Box
      p={8}
      bg={cardBg}
      border="1px"
      borderColor={cardBorder}
      borderRadius="lg"
      textAlign="center"
      transition="all 0.2s ease"
      _hover={{
        bg: cardHoverBg,
        transform: 'translateY(-2px)',
        boxShadow: 'lg'
      }}
    >
      <Box fontSize="4xl" mb={4}>
        {icon}
      </Box>

      <Heading
        as="h3"
        size="md"
        color={titleColor}
        mb={3}
        fontWeight="semibold"
      >
        {title}
      </Heading>

      <Text color={textColor} lineHeight="1.6">
        {description}
      </Text>
    </Box>
  )
}

export const FeaturesSection = forwardRef<HTMLElement>((_, ref) => {
  const sectionBg = useColorModeValue('white', 'gray.800')
  const titleColor = useColorModeValue('gray.800', 'white')

  const features = [
    {
      title: 'Scheduling',
      description: 'Easily schedule your worship team volunteers and coordinate rehearsals with our intuitive calendar system.',
      icon: '📅'
    },
    {
      title: 'Song Bank',
      description: 'Build and manage your church\'s song library with lyrics, chords, and arrangement notes all in one place.',
      icon: '🎵'
    },
    {
      title: 'Team Management',
      description: 'Keep track of your team members, their skills, and availability to build the perfect worship team.',
      icon: '👥'
    }
  ]

  return (
    <Box
      as="section"
      ref={ref}
      id="features"
      py={20}
      bg={sectionBg}
    >
      <Container maxW="1200px" px={6}>
        <Box textAlign="center" mb={16}>
          <Heading
            as="h2"
            size="xl"
            color={titleColor}
            fontWeight="bold"
            mb={4}
          >
            Features
          </Heading>
        </Box>

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8}>
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              title={feature.title}
              description={feature.description}
              icon={feature.icon}
            />
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  )
}) 