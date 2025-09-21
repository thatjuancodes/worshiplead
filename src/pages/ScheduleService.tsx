import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCurrentUser, getUserPrimaryOrganization } from '../lib/auth'
import { DashboardHeader } from '../components'
import { useOrganizationAccess } from '../hooks/useOrganizationAccess'
import { formatServiceDate, getServiceTimeDisplay, formatForDateTimeInput } from '../utils/dateTime'
import { 
  Box, 
  VStack, 
  HStack, 
  Heading, 
  Text, 
  Button, 
  Spinner, 
  useColorModeValue,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  Badge,
  Flex,
  Center,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useDisclosure,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
} from '@chakra-ui/react'
import type { User } from '@supabase/supabase-js'

interface WorshipService {
  id: string
  organization_id: string
  title: string
  service_time: string // TIMESTAMPTZ - contains both date and time
  description?: string
  status: 'draft' | 'published' | 'completed'
  created_at: string
  updated_at: string
}

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

export function ScheduleService() {
  const navigate = useNavigate()
  const toast = useToast()
  const { canManagePrimary } = useOrganizationAccess()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [services, setServices] = useState<WorshipService[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  
  // Drawer states
  const { isOpen: isAddDrawerOpen, onOpen: onAddDrawerOpen, onClose: onAddDrawerClose } = useDisclosure()
  const { isOpen: isEditDrawerOpen, onOpen: onEditDrawerOpen, onClose: onEditDrawerClose } = useDisclosure()
  const [editingService, setEditingService] = useState<WorshipService | null>(null)
  
  // Delete modal state
  const [deleteService, setDeleteService] = useState<WorshipService | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  
  // Form data
  const [formData, setFormData] = useState({
    title: '',
    service_time: '',
    description: '',
    status: 'draft' as 'draft' | 'published' | 'completed'
  })

  // Color mode values
  const bgColor = useColorModeValue('gray.50', 'gray.900')
  const cardBg = useColorModeValue('white', 'gray.800')
  const cardBorderColor = useColorModeValue('gray.200', 'gray.600')
  const titleColor = useColorModeValue('gray.800', 'white')
  const textColor = useColorModeValue('gray.700', 'gray.200')
  const mutedTextColor = useColorModeValue('gray.500', 'gray.400')
  const tableHeaderBg = useColorModeValue('gray.50', 'gray.700')
  const tableHoverBg = useColorModeValue('gray.50', 'gray.700')

  const checkUserAndOrganization = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        navigate('/login')
        return
      }
      setUser(currentUser)

      const userOrg = await getUserPrimaryOrganization(currentUser.id)
      if (!userOrg) {
        navigate('/organization-setup')
        return
      }
      setOrganization(userOrg)
      await loadServices(userOrg.organization_id)
      setLoading(false)
    } catch (error) {
      console.error('Error checking user and organization:', error)
      navigate('/login')
    }
  }, [navigate])

  useEffect(() => {
    checkUserAndOrganization()
  }, [checkUserAndOrganization])

  const loadServices = async (organizationId: string) => {
    try {
      const { data, error } = await supabase
        .from('worship_services')
        .select('*')
        .eq('organization_id', organizationId)
        .order('service_time', { ascending: true })

      if (error) {
        console.error('Error loading services:', error)
        return
      }

      const now = new Date()
      const services = data || []
      
      // Find services that are past their date/time and not already completed
      const servicesToComplete = services.filter(service => {
        const serviceDate = new Date(service.service_time)
        return serviceDate < now && service.status !== 'completed'
      })

      // Auto-complete past services
      if (servicesToComplete.length > 0) {
        console.log(`Auto-completing ${servicesToComplete.length} past services`)
        
        // Update services in batch
        const updatePromises = servicesToComplete.map(service => 
          supabase
            .from('worship_services')
            .update({ 
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', service.id)
        )

        try {
          await Promise.all(updatePromises)
          
          // Update local data to reflect the changes
          services.forEach(service => {
            if (servicesToComplete.some(s => s.id === service.id)) {
              service.status = 'completed'
              service.updated_at = new Date().toISOString()
            }
          })

          // Show success notification
          if (servicesToComplete.length > 0) {
            toast({
              title: 'Services Updated',
              description: `${servicesToComplete.length} past service${servicesToComplete.length > 1 ? 's' : ''} automatically marked as completed`,
              status: 'info',
              duration: 4000,
              isClosable: true,
            })
          }
        } catch (updateError) {
          console.error('Error auto-completing services:', updateError)
          toast({
            title: 'Auto-completion Warning',
            description: 'Some past services could not be automatically completed. Please check manually.',
            status: 'warning',
            duration: 5000,
            isClosable: true,
          })
        }
      }

      // Sort services: upcoming first (nearest to farthest), then completed (most recent to oldest)
      const sortedServices = services.sort((a, b) => {
        const dateA = new Date(a.service_time)
        const dateB = new Date(b.service_time)
        
        // Separate upcoming and past services
        const aIsUpcoming = dateA >= now
        const bIsUpcoming = dateB >= now
        
        // If both are upcoming, show nearest first (ascending order)
        if (aIsUpcoming && bIsUpcoming) {
          return dateA.getTime() - dateB.getTime()
        }
        
        // If both are past, show most recent first (descending order)
        if (!aIsUpcoming && !bIsUpcoming) {
          return dateB.getTime() - dateA.getTime()
        }
        
        // If one is upcoming and one is past, upcoming comes first
        if (aIsUpcoming && !bIsUpcoming) return -1
        if (!aIsUpcoming && bIsUpcoming) return 1
        
        return 0
      })

      setServices(sortedServices)
    } catch (error) {
      console.error('Error loading services:', error)
    }
  }

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization) return

    if (!canManagePrimary) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to create services. Only admins and owners can create services.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    try {
      const { error } = await supabase
        .from('worship_services')
        .insert({
          organization_id: organization.organization_id,
          title: formData.title,
          service_time: new Date(formData.service_time).toISOString(),
          description: formData.description || null,
          status: formData.status,
          created_by: user?.id
        })

      if (error) {
        console.error('Error adding service:', error)
        toast({
          title: 'Error',
          description: 'Failed to add service',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
        return
      }

      // Reset form and reload services
      setFormData({
        title: '',
        service_time: '',
        description: '',
        status: 'draft'
      })
      onAddDrawerClose()
      await loadServices(organization.organization_id)
      toast({
        title: 'Success',
        description: 'Service added successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch (error) {
      console.error('Error adding service:', error)
      toast({
        title: 'Error',
        description: 'Failed to add service',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  const handleEditService = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization || !editingService) return

    if (!canManagePrimary) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to edit services. Only admins and owners can edit services.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    try {
      const { error } = await supabase
        .from('worship_services')
        .update({
          title: formData.title,
          service_time: new Date(formData.service_time).toISOString(),
          description: formData.description || null,
          status: formData.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingService.id)

      if (error) {
        console.error('Error updating service:', error)
        toast({
          title: 'Error',
          description: 'Failed to update service',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
        return
      }

      // Reset form and reload services
      setFormData({
        title: '',
        service_time: '',
        description: '',
        status: 'draft'
      })
      onEditDrawerClose()
      setEditingService(null)
      await loadServices(organization.organization_id)
      toast({
        title: 'Success',
        description: 'Service updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch (error) {
      console.error('Error updating service:', error)
      toast({
        title: 'Error',
        description: 'Failed to update service',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  const openEditForm = (service: WorshipService) => {
    setEditingService(service)
    setFormData({
      title: service.title,
      service_time: formatForDateTimeInput(service.service_time),
      description: service.description || '',
      status: service.status
    })
    onEditDrawerOpen()
  }

  const openDeleteModal = (service: WorshipService) => {
    setDeleteService(service)
    setDeleteConfirmation('')
    setIsDeleteModalOpen(true)
  }

  const handleDeleteService = async () => {
    if (!deleteService || deleteConfirmation !== deleteService.title) {
      toast({
        title: 'Error',
        description: 'Please type the exact service title to confirm deletion',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    if (!canManagePrimary) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to delete services. Only admins and owners can delete services.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    try {
      // Delete service songs first (cascade delete)
      const { error: songsError } = await supabase
        .from('service_songs')
        .delete()
        .eq('service_id', deleteService.id)

      if (songsError) {
        console.error('Error deleting service songs:', songsError)
        throw new Error('Failed to delete service songs')
      }

      // Delete the service
      const { error: serviceError } = await supabase
        .from('worship_services')
        .delete()
        .eq('id', deleteService.id)
        .eq('organization_id', organization!.organization_id)

      if (serviceError) {
        console.error('Error deleting service:', serviceError)
        throw new Error('Failed to delete service')
      }

      await loadServices(organization!.organization_id)
      setIsDeleteModalOpen(false)
      setDeleteService(null)
      setDeleteConfirmation('')
      toast({
        title: 'Success',
        description: 'Service deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch (error) {
      console.error('Error deleting service:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete service',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  const filteredServices = services.filter(service => {
    const matchesSearch = service.title.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = !selectedStatus || service.status === selectedStatus
    
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    const statusColorScheme = {
      draft: 'yellow',
      published: 'green',
      completed: 'blue'
    }
    return statusColorScheme[status as keyof typeof statusColorScheme] || 'yellow'
  }

  if (loading) {
    return (
      <Box minH="100vh" bg={bgColor}>
        <DashboardHeader user={user} organization={organization} />
        <Box as="main" maxW="1200px" mx="auto" p={{ base: 6, md: 8 }}>
          <Center h="50vh">
            <VStack spacing={4}>
              <Spinner size="xl" color="blue.500" />
              <Text color={textColor}>Loading services...</Text>
            </VStack>
          </Center>
        </Box>
      </Box>
    )
  }

  return (
    <Box minH="100vh" bg={bgColor}>
      <DashboardHeader user={user} organization={organization} />

      <Box as="main" maxW="1200px" mx="auto" p={{ base: 6, md: 8 }}>
        {/* Back Button */}
        <Box mb={4}>
          <Button
            variant="ghost"
            colorScheme="gray"
            onClick={() => navigate('/dashboard')}
            leftIcon={<Text>←</Text>}
            size="sm"
          >
            Back to Dashboard
          </Button>
        </Box>

        {/* Header Section */}
        <Box
          bg={cardBg}
          p={4}
          borderRadius="lg"
          boxShadow="sm"
          border="1px"
          borderColor={cardBorderColor}
          mb={3}
        >
          <Flex
            direction={{ base: 'column', md: 'row' }}
            justify="space-between"
            align={{ base: 'stretch', md: 'center' }}
            gap={4}
          >
            <Box>
              <Heading as="h2" size="lg" color={titleColor} m={0} fontWeight="600">
                📅 Schedule Services
              </Heading>
            </Box>

            {canManagePrimary && (
              <Button
                colorScheme="blue"
                onClick={onAddDrawerOpen}
                size="md"
              >
                + Add Service
              </Button>
            )}
          </Flex>
        </Box>

        {/* Search and Filters */}
        <Box
          bg={cardBg}
          p={4}
          borderRadius="lg"
          boxShadow="sm"
          border="1px"
          borderColor={cardBorderColor}
          mb={4}
        >
          <Flex
            direction={{ base: 'column', lg: 'row' }}
            gap={4}
            align={{ base: 'stretch', lg: 'center' }}
            w="full"
          >
            {/* Search */}
            <Box flex="6" minW="200px">
              <Input
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="md"
                w="full"
              />
            </Box>

            {/* Status Filter */}
            <Box flex="3" minW="120px" maxW="200px">
              <Select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                size="md"
                minW="100px"
                w="full"
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="completed">Completed</option>
              </Select>
            </Box>
          </Flex>
        </Box>

        {/* Services Table */}
        {filteredServices.length === 0 ? (
          <Box
            bg={cardBg}
            p={12}
            borderRadius="lg"
            boxShadow="sm"
            border="1px"
            borderColor={cardBorderColor}
            textAlign="center"
          >
            <Text color={mutedTextColor} fontSize="md">
              {services.length === 0 ? 'No services yet' : 'No services found'}
            </Text>
          </Box>
        ) : (
          <Box
            bg={cardBg}
            borderRadius="lg"
            boxShadow="sm"
            border="1px"
            borderColor={cardBorderColor}
            overflow="hidden"
          >
            <Box overflowX="auto">
              <Table variant="simple" minW="800px">
                <Thead>
                  <Tr>
                    <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="200px">Title</Th>
                    <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="150px">Date</Th>
                    <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="100px">Time</Th>
                    <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="100px">Status</Th>
                    <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="200px">Description</Th>
                    <Th bg={tableHeaderBg} color={textColor} fontSize="sm" fontWeight="600" minW="150px">Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredServices.map(service => (
                    <Tr key={service.id} _hover={{ bg: tableHoverBg }}>
                      <Td fontWeight="500" color={titleColor} minW="200px">
                        {service.title}
                      </Td>
                      <Td minW="150px">
                        {formatServiceDate(service.service_time)}
                      </Td>
                      <Td minW="100px">
                        {getServiceTimeDisplay(service.service_time)}
                      </Td>
                      <Td minW="100px">
                        <Badge
                          colorScheme={getStatusBadge(service.status)}
                          variant="subtle"
                          textTransform="capitalize"
                        >
                          {service.status}
                        </Badge>
                      </Td>
                      <Td minW="200px" maxW="250px">
                        <Text noOfLines={2} fontSize="sm">
                          {service.description || '-'}
                        </Text>
                      </Td>
                      <Td minW="150px">
                        <HStack spacing={2}>
                          <Button
                            size="xs"
                            colorScheme="blue"
                            onClick={() => navigate(`/service/${service.id}`)}
                          >
                            View
                          </Button>
                          {canManagePrimary && (
                            <>
                              <Button
                                size="xs"
                                variant="outline"
                                colorScheme="gray"
                                onClick={() => openEditForm(service)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="xs"
                                colorScheme="red"
                                onClick={() => openDeleteModal(service)}
                              >
                                Delete
                              </Button>
                            </>
                          )}
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </Box>
        )}
      </Box>

      {/* Add Service Drawer */}
      <Drawer
        isOpen={isAddDrawerOpen}
        placement="right"
        onClose={onAddDrawerClose}
        size={{ base: 'full', md: 'md', lg: 'lg' }}
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px" bg={cardBg}>
            <Heading as="h3" size="lg" color={titleColor} fontWeight="600">
              Add New Service
            </Heading>
          </DrawerHeader>
          
          <DrawerBody bg={bgColor} p={6}>
            <Box as="form" onSubmit={handleAddService}>
              <VStack spacing={6} align="stretch">
                <FormControl isRequired>
                  <FormLabel fontWeight="600" color={textColor} fontSize="sm">Service Title</FormLabel>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="e.g., Sunday Morning Service"
                    size="md"
                  />
                </FormControl>
                
                <FormControl isRequired>
                  <FormLabel fontWeight="600" color={textColor} fontSize="sm">Service Date & Time</FormLabel>
                  <Input
                    type="datetime-local"
                    value={formData.service_time}
                    onChange={(e) => setFormData({...formData, service_time: e.target.value})}
                    size="md"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel fontWeight="600" color={textColor} fontSize="sm">Status</FormLabel>
                  <Select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as 'draft' | 'published' | 'completed'})}
                    size="md"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="completed">Completed</option>
                  </Select>
                </FormControl>
                
                <FormControl>
                  <FormLabel fontWeight="600" color={textColor} fontSize="sm">Description</FormLabel>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Add any additional details about this service..."
                    size="md"
                    rows={4}
                  />
                </FormControl>

                <Flex gap={4} justify="flex-end" pt={4}>
                  <Button
                    variant="outline"
                    onClick={onAddDrawerClose}
                    size="md"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    colorScheme="blue"
                    size="md"
                    isLoading={loading}
                  >
                    Add Service
                  </Button>
                </Flex>
              </VStack>
            </Box>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Edit Service Drawer */}
      <Drawer
        isOpen={isEditDrawerOpen}
        placement="right"
        onClose={onEditDrawerClose}
        size={{ base: 'full', md: 'md', lg: 'lg' }}
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px" bg={cardBg}>
            <Heading as="h3" size="lg" color={titleColor} fontWeight="600">
              Edit Service
            </Heading>
          </DrawerHeader>
          
          <DrawerBody bg={bgColor} p={6}>
            <Box as="form" onSubmit={handleEditService}>
              <VStack spacing={6} align="stretch">
                <FormControl isRequired>
                  <FormLabel fontWeight="600" color={textColor} fontSize="sm">Service Title</FormLabel>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="e.g., Sunday Morning Service"
                    size="md"
                  />
                </FormControl>
                
                <FormControl isRequired>
                  <FormLabel fontWeight="600" color={textColor} fontSize="sm">Service Date & Time</FormLabel>
                  <Input
                    type="datetime-local"
                    value={formData.service_time}
                    onChange={(e) => setFormData({...formData, service_time: e.target.value})}
                    size="md"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel fontWeight="600" color={textColor} fontSize="sm">Status</FormLabel>
                  <Select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as 'draft' | 'published' | 'completed'})}
                    size="md"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="completed">Completed</option>
                  </Select>
                </FormControl>
                
                <FormControl>
                  <FormLabel fontWeight="600" color={textColor} fontSize="sm">Description</FormLabel>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Add any additional details about this service..."
                    size="md"
                    rows={4}
                  />
                </FormControl>

                <Flex gap={4} justify="flex-end" pt={4}>
                  <Button
                    variant="outline"
                    onClick={() => {
                      onEditDrawerClose()
                      setEditingService(null)
                    }}
                    size="md"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    colorScheme="blue"
                    size="md"
                    isLoading={loading}
                  >
                    Update Service
                  </Button>
                </Flex>
              </VStack>
            </Box>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader color="red.600">Delete Service</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Text>
                Are you sure you want to delete <strong>"{deleteService?.title}"</strong>?
              </Text>
              
              <Text fontSize="sm" color="orange.600">
                This will also delete all songs and volunteers associated with this service.
              </Text>

              <FormControl>
                <FormLabel>Type the service title to confirm deletion:</FormLabel>
                <Input
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder={deleteService?.title}
                />
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              colorScheme="red"
              onClick={handleDeleteService}
              isDisabled={deleteConfirmation !== deleteService?.title}
            >
              Delete Service
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
} 