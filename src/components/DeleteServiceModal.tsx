import { useState } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  Text,
  VStack,
  HStack,
  Box,
  UnorderedList,
  ListItem,
  Input,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useColorModeValue
} from '@chakra-ui/react'

interface DeleteServiceModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  serviceTitle: string
  isLoading?: boolean
}

export function DeleteServiceModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  serviceTitle, 
  isLoading = false 
}: DeleteServiceModalProps) {
  const [confirmationText, setConfirmationText] = useState('')
  const isConfirmed = confirmationText === serviceTitle

  const handleConfirm = () => {
    if (isConfirmed) {
      onConfirm()
    }
  }

  const handleClose = () => {
    setConfirmationText('')
    onClose()
  }

  const modalBg = useColorModeValue('white', 'gray.800')
  const textColor = useColorModeValue('gray.700', 'gray.200')
  const warningBg = useColorModeValue('orange.50', 'orange.900')
  const warningBorder = useColorModeValue('orange.200', 'orange.700')
  const warningText = useColorModeValue('orange.800', 'orange.200')

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered size="lg">
      <ModalOverlay />
      <ModalContent bg={modalBg}>
        <ModalHeader color={textColor}>
          Delete Service
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={6} align="stretch">
            <Alert status="warning" borderRadius="md" bg={warningBg} border="1px" borderColor={warningBorder}>
              <AlertIcon color={warningText} />
              <Box>
                <AlertTitle color={warningText}>Warning</AlertTitle>
                <AlertDescription color={warningText}>
                  This action cannot be undone. Deleting this service will also remove:
                </AlertDescription>
              </Box>
            </Alert>
            
            <UnorderedList spacing={2} color={textColor}>
              <ListItem>All songs assigned to this service</ListItem>
              <ListItem>Service notes and arrangements</ListItem>
              <ListItem>Service history and data</ListItem>
            </UnorderedList>
            
            <Text color={textColor} fontSize="sm">
              <strong>Note:</strong> The songs themselves will not be deleted from your song library.
            </Text>
            
            <Box>
              <Text color={textColor} mb={3}>
                To confirm deletion, please type the service name exactly as shown:
              </Text>
              <Text 
                color="red.500" 
                fontWeight="bold" 
                fontSize="lg" 
                mb={3}
                textAlign="center"
                p={3}
                bg="red.50"
                borderRadius="md"
                border="1px"
                borderColor="red.200"
              >
                "{serviceTitle}"
              </Text>
              <Input
                type="text"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="Type the service name to confirm"
                disabled={isLoading}
                size="lg"
                borderColor={isConfirmed ? "green.500" : "gray.300"}
                _focus={{
                  borderColor: isConfirmed ? "green.500" : "blue.500",
                  boxShadow: isConfirmed ? "0 0 0 1px var(--chakra-colors-green-500)" : "0 0 0 1px var(--chakra-colors-blue-500)"
                }}
              />
            </Box>
          </VStack>
        </ModalBody>
        
        <ModalFooter>
          <HStack spacing={3}>
            <Button
              onClick={handleClose}
              disabled={isLoading}
              variant="outline"
              size="md"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!isConfirmed || isLoading}
              colorScheme="red"
              size="md"
              isLoading={isLoading}
              loadingText="Deleting..."
            >
              Delete Service
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
} 