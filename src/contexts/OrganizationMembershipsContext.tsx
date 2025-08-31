import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { OrganizationMembership, Organization } from '../lib/auth'

interface OrganizationMembershipWithOrg extends OrganizationMembership {
  organizations: Organization
}

interface OrganizationMembershipsContextType {
  memberships: OrganizationMembershipWithOrg[]
  primaryMembership: OrganizationMembershipWithOrg | null
  isLoading: boolean
  error: string | null
  refreshMemberships: () => Promise<void>
  hasRole: (organizationId: string, role: 'owner' | 'admin' | 'member') => boolean
  hasAnyRole: (organizationId: string, roles: ('owner' | 'admin' | 'member')[]) => boolean
  isOwner: (organizationId: string) => boolean
  isAdmin: (organizationId: string) => boolean
  isMember: (organizationId: string) => boolean
}

const OrganizationMembershipsContext = createContext<OrganizationMembershipsContextType | undefined>(undefined)

interface OrganizationMembershipsProviderProps {
  children: ReactNode
  userId: string | null
}

export function OrganizationMembershipsProvider({ children, userId }: OrganizationMembershipsProviderProps) {
  const [memberships, setMemberships] = useState<OrganizationMembershipWithOrg[]>([])
  const [primaryMembership, setPrimaryMembership] = useState<OrganizationMembershipWithOrg | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMemberships = async () => {
    if (!userId) {
      setMemberships([])
      setPrimaryMembership(null)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('organization_memberships')
        .select(`
          *,
          organizations (*)
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('joined_at', { ascending: true })

      if (fetchError) {
        throw fetchError
      }

      const typedData = data as OrganizationMembershipWithOrg[]
      setMemberships(typedData)
      
      // Set primary membership (first active membership)
      if (typedData.length > 0) {
        setPrimaryMembership(typedData[0])
      } else {
        setPrimaryMembership(null)
      }
    } catch (err) {
      console.error('Error fetching organization memberships:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch organization memberships')
    } finally {
      setIsLoading(false)
    }
  }

  const refreshMemberships = async () => {
    await fetchMemberships()
  }

  // Helper functions for role checking
  const hasRole = (organizationId: string, role: 'owner' | 'admin' | 'member'): boolean => {
    const membership = memberships.find(m => m.organization_id === organizationId)
    if (!membership) return false
    
    const roleHierarchy = { owner: 3, admin: 2, member: 1 }
    return roleHierarchy[membership.role] >= roleHierarchy[role]
  }

  const hasAnyRole = (organizationId: string, roles: ('owner' | 'admin' | 'member')[]): boolean => {
    return roles.some(role => hasRole(organizationId, role))
  }

  const isOwner = (organizationId: string): boolean => hasRole(organizationId, 'owner')
  const isAdmin = (organizationId: string): boolean => hasRole(organizationId, 'admin')
  const isMember = (organizationId: string): boolean => hasRole(organizationId, 'member')

  useEffect(() => {
    // Add a timeout fallback to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setIsLoading(false)
    }, 10000) // 10 second timeout
    
    fetchMemberships()
    
    return () => {
      clearTimeout(timeoutId)
    }
  }, [userId])

  const value: OrganizationMembershipsContextType = {
    memberships,
    primaryMembership,
    isLoading,
    error,
    refreshMemberships,
    hasRole,
    hasAnyRole,
    isOwner,
    isAdmin,
    isMember,
  }

  return (
    <OrganizationMembershipsContext.Provider value={value}>
      {children}
    </OrganizationMembershipsContext.Provider>
  )
}

export function useOrganizationMemberships() {
  const context = useContext(OrganizationMembershipsContext)
  if (context === undefined) {
    throw new Error('useOrganizationMemberships must be used within an OrganizationMembershipsProvider')
  }
  return context
}
