// Utility functions for handling service_time (TIMESTAMPTZ) values

/**
 * Extract date from service_time timestamp
 */
export const getServiceDate = (serviceTime: string): Date => {
  return new Date(serviceTime)
}

/**
 * Extract time display from service_time timestamp
 */
export const getServiceTimeDisplay = (serviceTime: string): string => {
  return new Date(serviceTime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

/**
 * Format service_time for datetime-local input
 */
export const formatForDateTimeInput = (serviceTime: string): string => {
  const date = new Date(serviceTime)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

/**
 * Create a service_time timestamp from separate date and time values
 */
export const createServiceTime = (date: string, time?: string): string => {
  const serviceDate = new Date(date)
  
  if (time) {
    const [hours, minutes] = time.split(':').map(Number)
    serviceDate.setHours(hours, minutes, 0, 0)
  } else {
    serviceDate.setHours(10, 0, 0, 0) // Default to 10:00 AM if no time provided
  }
  
  return serviceDate.toISOString()
}

/**
 * Check if a service is upcoming (after current time)
 */
export const isServiceUpcoming = (serviceTime: string): boolean => {
  return new Date(serviceTime) >= new Date()
}

/**
 * Format service date for display (without time)
 */
export const formatServiceDate = (serviceTime: string): string => {
  return new Date(serviceTime).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

/**
 * Extract date in YYYY-MM-DD format from service_time
 */
export const getServiceDateISO = (serviceTime: string): string => {
  return new Date(serviceTime).toISOString().split('T')[0]
}
