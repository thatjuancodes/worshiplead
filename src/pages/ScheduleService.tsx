import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCurrentUser, getUserPrimaryOrganization } from '../lib/auth'
import { DashboardHeader, EmptyState } from '../components'
import { useOrganizationAccess } from '../hooks/useOrganizationAccess'
import { formatServiceDate, getServiceTimeDisplay, formatForDateTimeInput } from '../utils/dateTime'
import { 
  Box, 
  VStack, 
  HStack,
  Heading, 
  Text, 
  Button, 
  useColorModeValue,
  Skeleton,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  Badge,
  Flex,
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
  InputGroup,
  InputLeftElement,
} from '@chakra-ui/react'
import { ArrowForwardIcon, CalendarIcon, SearchIcon, TimeIcon } from '@chakra-ui/icons'
import type { User } from '@supabase/supabase-js'

interface Song {
  id: string
  title: string
  artist: string
  key?: string
  bpm?: number
}

interface ServiceSong {
  id: string
  position: number
  notes?: string
  songs: Song
}

interface ServiceVolunteer {
  id: string
  user_id: string
  worship_service_id?: string
  profiles: {
    first_name: string
    last_name: string
    email: string
  }
}

const serviceAvatarColors = ['#2563EB', '#7C3AED', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444']

function getNameInitials(firstName?: string, lastName?: string, email?: string) {
  const initials = `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.trim()
  if (initials) return initials.toUpperCase()
  return (email || 'U').slice(0, 2).toUpperCase()
}

function getAvatarColor(seed: string) {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = seed.charCodeAt(index) + ((hash << 5) - hash)
  }
  return serviceAvatarColors[Math.abs(hash) % serviceAvatarColors.length]
}

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
  const SERVICES_PER_PAGE = 20
  const navigate = useNavigate()
  const toast = useToast()
  const { canManagePrimary, isPrimaryAdmin } = useOrganizationAccess()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [services, setServices] = useState<WorshipService[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  
  // Drawer states
  const { isOpen: isAddDrawerOpen, onOpen: onAddDrawerOpen, onClose: onAddDrawerClose } = useDisclosure()
  const { isOpen: isEditDrawerOpen, onOpen: onEditDrawerOpen, onClose: onEditDrawerClose } = useDisclosure()
  const { isOpen: isDetailDrawerOpen, onOpen: onDetailDrawerOpen, onClose: onDetailDrawerClose } = useDisclosure()
  const [editingService, setEditingService] = useState<WorshipService | null>(null)
  const [selectedService, setSelectedService] = useState<WorshipService | null>(null)
  const [detailSongs, setDetailSongs] = useState<ServiceSong[]>([])
  const [detailVolunteers, setDetailVolunteers] = useState<ServiceVolunteer[]>([])
  const [serviceIdToVolunteers, setServiceIdToVolunteers] = useState<Record<string, ServiceVolunteer[]>>({})
  const [detailLoading, setDetailLoading] = useState(false)
  
  // Delete modal state
  const [deleteService, setDeleteService] = useState<WorshipService | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  
  // Form data
  const [formData, setFormData] = useState({
    title: '',
    service_time: '',
    description: '',
    status: 'published' as 'draft' | 'published' | 'completed'
  })

  // Color mode values
  const bgColor = useColorModeValue('gray.50', 'gray.900')
  const cardBg = useColorModeValue('white', 'gray.800')
  const cardBorderColor = useColorModeValue('gray.200', 'gray.600')
  const titleColor = useColorModeValue('gray.800', 'white')
  const textColor = useColorModeValue('gray.700', 'gray.200')
  const mutedTextColor = useColorModeValue('gray.500', 'gray.400')

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

  const loadVolunteersForServices = useCallback(async (serviceIds: string[]) => {
    if (serviceIds.length === 0) {
      setServiceIdToVolunteers({})
      return
    }

    try {
      const { data: volunteerRecords, error: volunteerError } = await supabase
        .from('worship_service_volunteers')
        .select('*')
        .in('worship_service_id', serviceIds)
        .order('created_at', { ascending: true })

      if (volunteerError) {
        console.error('Error loading volunteers for services:', volunteerError)
        return
      }

      if (!volunteerRecords || volunteerRecords.length === 0) {
        const emptyMapping: Record<string, ServiceVolunteer[]> = {}
        serviceIds.forEach((serviceId) => {
          emptyMapping[serviceId] = []
        })
        setServiceIdToVolunteers(emptyMapping)
        return
      }

      const userIds = [...new Set(volunteerRecords.map((volunteer) => volunteer.user_id))]
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', userIds)

      if (profilesError) {
        console.error('Error loading volunteer profiles for services:', profilesError)
        return
      }

      const mapping: Record<string, ServiceVolunteer[]> = {}
      serviceIds.forEach((serviceId) => {
        mapping[serviceId] = []
      })

      volunteerRecords.forEach((volunteer) => {
        const profile = profiles?.find((item) => item.id === volunteer.user_id)
        const svcId = volunteer.worship_service_id as string
        if (!mapping[svcId]) mapping[svcId] = []
        mapping[svcId].push({
          ...(volunteer as Omit<ServiceVolunteer, 'profiles'>),
          profiles: profile || { first_name: 'Unknown', last_name: 'User', email: 'N/A' }
        })
      })

      setServiceIdToVolunteers(mapping)
    } catch (error) {
      console.error('Error loading volunteers for services:', error)
    }
  }, [])

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
      await loadVolunteersForServices(sortedServices.map((service) => service.id))
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
        status: 'published'
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
        status: 'published'
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

  const loadServiceDetail = async (service: WorshipService) => {
    try {
      setDetailLoading(true)
      setSelectedService(service)
      setDetailSongs([])
      setDetailVolunteers([])
      onDetailDrawerOpen()

      const [{ data: songsData, error: songsError }, { data: volunteerRecords, error: volunteersError }] = await Promise.all([
        supabase
          .from('service_songs')
          .select(`
            id,
            position,
            notes,
            songs (
              id,
              title,
              artist,
              key,
              bpm
            )
          `)
          .eq('service_id', service.id)
          .order('position', { ascending: true }),
        supabase
          .from('worship_service_volunteers')
          .select('id, user_id')
          .eq('worship_service_id', service.id)
      ])

      if (songsError) throw songsError
      if (volunteersError) throw volunteersError

      setDetailSongs((songsData as unknown as ServiceSong[]) || [])

      if (!volunteerRecords || volunteerRecords.length === 0) {
        setDetailVolunteers([])
        return
      }

      const userIds = [...new Set(volunteerRecords.map((volunteer) => volunteer.user_id))]
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', userIds)

      if (profilesError) throw profilesError

      const volunteersWithProfiles = volunteerRecords.map((volunteer) => {
        const profile = profiles?.find((item) => item.id === volunteer.user_id)
        return {
          ...volunteer,
          profiles: profile || { first_name: 'Unknown', last_name: 'User', email: 'N/A' }
        }
      })

      setDetailVolunteers(volunteersWithProfiles as ServiceVolunteer[])
    } catch (error) {
      console.error('Error loading service detail:', error)
      toast({
        title: 'Error',
        description: 'Failed to load service details',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setDetailLoading(false)
    }
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

    if (!isPrimaryAdmin) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to delete services. Only admins can delete services.',
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
  const totalPages = Math.max(1, Math.ceil(filteredServices.length / SERVICES_PER_PAGE))
  const visiblePageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1).filter((page) => (
    page === 1 ||
    page === totalPages ||
    Math.abs(page - currentPage) <= 1
  ))
  const paginatedServices = filteredServices.slice(
    (currentPage - 1) * SERVICES_PER_PAGE,
    currentPage * SERVICES_PER_PAGE
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedStatus])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const getStatusBadge = (status: string) => {
    const statusColorScheme = {
      draft: 'yellow',
      published: 'green',
      completed: 'blue'
    }
    return statusColorScheme[status as keyof typeof statusColorScheme] || 'yellow'
  }

  const getStatusDotClass = (status: WorshipService['status']) => {
    if (status === 'published') return 'bg-success-500'
    if (status === 'completed') return 'bg-primary-500'
    return 'bg-warning-500'
  }


  return (
    <Box className="sl-dashboard-page" minH="100vh" bg={bgColor}>
      <DashboardHeader user={user} organization={organization} />

      <Box as="main" maxW="1200px" mx="auto" px={{ base: 6, md: 8 }} pt={{ base: 2, md: 3 }} pb={{ base: 6, md: 8 }}>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
                Services
              </h1>
              <p className="mt-1 text-sm text-text-muted">
                Manage worship services and volunteer assignments
              </p>
            </div>
            {canManagePrimary ? (
              <Button className="btn-primary" disabled={loading} onClick={onAddDrawerOpen} size="sm" type="button">
                <span aria-hidden="true">＋</span>
                <span className="hidden sm:inline">New Service</span>
                <span className="sm:hidden">New</span>
              </Button>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Box w="100%" maxW={{ base: 'full', sm: '320px' }}>
              {loading ? (
                <Skeleton borderRadius="lg" height="44px" />
              ) : (
                <InputGroup>
                  <InputLeftElement color="gray.400" pointerEvents="none">
                    <SearchIcon />
                  </InputLeftElement>
                  <Input
                    className="input-field"
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search services..."
                    pl="40px"
                    value={searchTerm}
                  />
                </InputGroup>
              )}
            </Box>
            <div className="sl-chip-row">
              {[
                { label: 'All', value: '' },
                { label: 'Published', value: 'published' },
                { label: 'Draft', value: 'draft' },
                { label: 'Completed', value: 'completed' },
              ].map((status) => (
                <button
                  className={`sl-chip ${selectedStatus === status.value ? 'sl-chip-active' : ''}`}
                  key={status.label}
                  onClick={() => setSelectedStatus(status.value)}
                  type="button"
                >
                  {status.label}
                </button>
              ))}
            </div>
          </div>

        {/* Services Table */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, index) => (
              <div className="rounded-xl bg-white p-3 card-shadow" key={index}>
                <Skeleton height="18px" mb={2} />
                <Skeleton height="12px" width="60%" />
              </div>
            ))}
          </div>
        ) : filteredServices.length === 0 ? (
          <EmptyState
            description={services.length === 0 ? 'Create your first service to start planning.' : 'Try adjusting your search or status filters.'}
            icon={<span className="text-2xl">📅</span>}
            title={services.length === 0 ? 'No services yet' : 'No services found'}
            action={
              searchTerm || selectedStatus ? (
                <Button
                  className="btn-primary"
                  onClick={() => {
                    setSearchTerm('')
                    setSelectedStatus('')
                  }}
                  size="sm"
                  type="button"
                >
                  Clear Filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-2">
            {paginatedServices.map((service) => (
              <div
                className="flex cursor-pointer items-center gap-3 rounded-xl bg-white p-3 card-shadow card-hover"
                key={service.id}
                onClick={() => loadServiceDetail(service)}
              >
                {(() => {
                  const volunteers = serviceIdToVolunteers[service.id] || []
                  return (
                    <>
                <div className={`h-2 w-2 rounded-full ${getStatusDotClass(service.status)}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-text-primary">{service.title}</span>
                    <Badge colorScheme={getStatusBadge(service.status)} variant="subtle" textTransform="capitalize">
                      {service.status}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                    <span>{formatServiceDate(service.service_time)}</span>
                    <span>•</span>
                    <span>{getServiceTimeDisplay(service.service_time)}</span>
                  </div>
                </div>
                <div className="hidden shrink-0 md:block">
                  <Text fontSize="xs" maxW="240px" noOfLines={2} color="gray.500">
                    {service.description || 'No description'}
                  </Text>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="hidden items-center sm:flex">
                    {volunteers.slice(0, 5).map((volunteer, index) => {
                      const fullName = `${volunteer.profiles.first_name || ''} ${volunteer.profiles.last_name || ''}`.trim() || volunteer.profiles.email
                      const isCurrentUser = user?.id === volunteer.user_id

                      return (
                        <Box
                          key={volunteer.id}
                          alignItems="center"
                          bg={isCurrentUser ? '#2563EB' : getAvatarColor(fullName)}
                          border="2px solid white"
                          borderRadius="full"
                          color="white"
                          display="flex"
                          fontSize="10px"
                          fontWeight="700"
                          h="28px"
                          justifyContent="center"
                          ml={index === 0 ? 0 : '-8px'}
                          title={fullName}
                          w="28px"
                        >
                          {getNameInitials(volunteer.profiles.first_name, volunteer.profiles.last_name, volunteer.profiles.email)}
                        </Box>
                      )
                    })}
                    {volunteers.length > 5 ? (
                      <Box
                        alignItems="center"
                        bg="gray.100"
                        border="2px solid white"
                        borderRadius="full"
                        color={mutedTextColor}
                        display="flex"
                        fontSize="10px"
                        fontWeight="700"
                        h="28px"
                        justifyContent="center"
                        ml="-8px"
                        w="28px"
                      >
                        +{volunteers.length - 5}
                      </Box>
                    ) : null}
                  </div>
                  <span className="text-text-muted">›</span>
                </div>
                    </>
                  )
                })()}
              </div>
            ))}

            {filteredServices.length > SERVICES_PER_PAGE ? (
              <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-text-muted">
                  Showing {(currentPage - 1) * SERVICES_PER_PAGE + 1}-{Math.min(currentPage * SERVICES_PER_PAGE, filteredServices.length)} of {filteredServices.length} services
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="btn-secondary px-3"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    type="button"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {visiblePageNumbers.map((page, index) => {
                      const previousPage = visiblePageNumbers[index - 1]
                      const showGap = previousPage && page - previousPage > 1

                      return (
                        <React.Fragment key={page}>
                          {showGap ? <span className="px-1 text-sm text-text-muted">…</span> : null}
                          <button
                            className={page === currentPage ? 'btn-primary px-3' : 'btn-secondary px-3'}
                            onClick={() => setCurrentPage(page)}
                            type="button"
                          >
                            {page}
                          </button>
                        </React.Fragment>
                      )
                    })}
                  </div>
                  <button
                    className="btn-secondary px-3"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
        </div>
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
                    className="btn-primary-size"
                    type="submit"
                    colorScheme="blue"
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

      <Drawer
        isOpen={isDetailDrawerOpen}
        placement="right"
        onClose={onDetailDrawerClose}
        size={{ base: 'full', md: 'md', lg: 'lg' }}
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px" bg={cardBg}>
            <Heading as="h3" size="md" color={titleColor} fontWeight="700">
              Service Details
            </Heading>
          </DrawerHeader>

          <DrawerBody bg={bgColor} p={6}>
            {selectedService ? (
              detailLoading ? (
                <VStack align="stretch" spacing={4}>
                  <Skeleton h="28px" w="70%" />
                  <Skeleton h="18px" w="60%" />
                  <Skeleton h="88px" />
                  <Skeleton h="120px" />
                  <Skeleton h="120px" />
                </VStack>
              ) : (
                <VStack align="stretch" spacing={6}>
                  <Box>
                    <HStack align="center" gap={2} mb={1} flexWrap="wrap">
                      <Text color={titleColor} fontSize="xl" fontWeight="700" m={0}>
                        {selectedService.title}
                      </Text>
                      <Badge colorScheme={getStatusBadge(selectedService.status)} textTransform="capitalize" variant="subtle">
                        {selectedService.status}
                      </Badge>
                    </HStack>
                    <HStack color={mutedTextColor} fontSize="sm" spacing={3} flexWrap="wrap">
                      <HStack spacing={1}>
                        <CalendarIcon boxSize={4} />
                        <Text m={0}>
                          {new Date(selectedService.service_time).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </Text>
                      </HStack>
                      <HStack spacing={1}>
                        <TimeIcon boxSize={4} />
                        <Text m={0}>{getServiceTimeDisplay(selectedService.service_time)}</Text>
                      </HStack>
                    </HStack>
                  </Box>

                  <Box
                    bg={useColorModeValue('gray.50', 'gray.700')}
                    border="1px"
                    borderColor={cardBorderColor}
                    borderRadius="xl"
                    p={4}
                  >
                    <Text color={titleColor} fontSize="sm" fontWeight="600" mb={selectedService.description ? 3 : 0}>
                      Description
                    </Text>
                    <Text color={selectedService.description ? textColor : mutedTextColor} fontSize="sm" fontStyle={selectedService.description ? 'normal' : 'italic'} m={0}>
                      {selectedService.description || 'No description available.'}
                    </Text>
                  </Box>

                  <Box>
                    <HStack justify="space-between" align="center" mb={3}>
                      <HStack spacing={2}>
                        <Text color={titleColor} fontSize="sm" fontWeight="600">Setlist</Text>
                        <Text color={mutedTextColor} fontSize="xs">({detailSongs.length} songs)</Text>
                      </HStack>
                    </HStack>

                    {detailSongs.length === 0 ? (
                      <Text color={mutedTextColor} fontSize="sm">No songs added yet.</Text>
                    ) : (
                      <VStack spacing={2} align="stretch">
                        {detailSongs.map((serviceSong) => (
                          <Box
                            key={serviceSong.id}
                            bg={useColorModeValue('gray.50', 'gray.700')}
                            borderRadius="lg"
                            p={3}
                            display="flex"
                            alignItems="center"
                            gap={3}
                          >
                            <Box
                              bg={useColorModeValue('gray.200', 'gray.600')}
                              color={mutedTextColor}
                              borderRadius="md"
                              w={6}
                              h={6}
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                              fontWeight="600"
                              fontSize="xs"
                              flexShrink={0}
                            >
                              {serviceSong.position}
                            </Box>
                            <Box flex="1" minW={0}>
                              <Text fontWeight="600" color={textColor} fontSize="sm" m={0} noOfLines={1}>
                                {serviceSong.songs.title}
                              </Text>
                              <Text color={mutedTextColor} fontSize="xs" m={0} noOfLines={1}>
                                {serviceSong.songs.artist}
                                {serviceSong.songs.key || serviceSong.songs.bpm ? ` · ${serviceSong.songs.key || '-'}${serviceSong.songs.bpm ? ` · ${serviceSong.songs.bpm} BPM` : ''}` : ''}
                              </Text>
                              {serviceSong.notes ? (
                                <Text color={mutedTextColor} fontSize="xs" fontStyle="italic" mt={1} noOfLines={2}>
                                  {serviceSong.notes}
                                </Text>
                              ) : null}
                            </Box>
                          </Box>
                        ))}
                      </VStack>
                    )}
                  </Box>

                  <Box>
                    <HStack justify="space-between" align="center" mb={3}>
                      <HStack spacing={2}>
                        <Text color={titleColor} fontSize="sm" fontWeight="600">Volunteers</Text>
                        <Text color={mutedTextColor} fontSize="xs">({detailVolunteers.length})</Text>
                      </HStack>
                    </HStack>

                    {detailVolunteers.length === 0 ? (
                      <Text color={mutedTextColor} fontSize="sm">No volunteers assigned yet.</Text>
                    ) : (
                      <VStack spacing={2} align="stretch">
                        {detailVolunteers.map((volunteer) => {
                          const fullName = `${volunteer.profiles?.first_name || ''} ${volunteer.profiles?.last_name || ''}`.trim() || volunteer.profiles?.email
                          const initials = `${volunteer.profiles?.first_name?.charAt(0) || ''}${volunteer.profiles?.last_name?.charAt(0) || ''}`.trim().toUpperCase() || (volunteer.profiles?.email || 'U').slice(0, 2).toUpperCase()

                          return (
                            <Box
                              key={volunteer.id}
                              bg={useColorModeValue('gray.50', 'gray.700')}
                              borderRadius="lg"
                              p={3}
                              display="flex"
                              alignItems="center"
                              gap={3}
                            >
                              <Box
                                bg="blue.100"
                                color="blue.700"
                                borderRadius="full"
                                w="28px"
                                h="28px"
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                                fontSize="xs"
                                fontWeight="700"
                                flexShrink={0}
                              >
                                {initials}
                              </Box>
                              <Box flex="1" minW={0}>
                                <Text color={textColor} fontWeight="600" fontSize="sm" m={0} noOfLines={1}>
                                  {fullName}
                                </Text>
                                <Text color={mutedTextColor} fontSize="xs" m={0} noOfLines={1}>
                                  {volunteer.profiles?.email}
                                </Text>
                              </Box>
                            </Box>
                          )
                        })}
                      </VStack>
                    )}
                  </Box>

                  {canManagePrimary || isPrimaryAdmin ? (
                    <HStack spacing={3} w="100%">
                      {canManagePrimary ? (
                        <Button
                          variant="outline"
                          size="sm"
                          flex="1"
                          onClick={() => {
                            onDetailDrawerClose()
                            openEditForm(selectedService)
                          }}
                        >
                          Edit Service
                        </Button>
                      ) : null}
                      {isPrimaryAdmin ? (
                        <Button
                          variant="outline"
                          colorScheme="red"
                          size="sm"
                          flex="1"
                          onClick={() => {
                            onDetailDrawerClose()
                            openDeleteModal(selectedService)
                          }}
                        >
                          Delete Service
                        </Button>
                      ) : null}
                    </HStack>
                  ) : null}

                  <Button
                    className="btn-primary"
                    onClick={() => {
                      onDetailDrawerClose()
                      navigate(`/service/${selectedService.id}`)
                    }}
                    rightIcon={<ArrowForwardIcon />}
                    size="sm"
                    w="100%"
                  >
                    Open Full Page
                  </Button>
                </VStack>
              )
            ) : null}
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
                    className="btn-primary-size"
                    type="submit"
                    colorScheme="blue"
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
