import { useOrganizationMemberships } from '../contexts'

export function useOrganizationAccess() {
  const { 
    memberships, 
    primaryMembership, 
    hasRole, 
    hasAnyRole, 
    isOwner, 
    isAdmin, 
    isMember 
  } = useOrganizationMemberships()

  // Get the primary organization ID
  const primaryOrganizationId = primaryMembership?.organization_id

  // Check if user has access to primary organization
  const hasPrimaryAccess = !!primaryOrganizationId

  // Get user's role in primary organization
  const primaryRole = primaryMembership?.role

  // Check if user can manage the primary organization (owner or admin)
  const canManagePrimary = primaryOrganizationId ? hasAnyRole(primaryOrganizationId, ['owner', 'admin']) : false

  // Check if user can manage any organization
  const canManageAny = memberships.some(membership => 
    hasAnyRole(membership.organization_id, ['owner', 'admin'])
  )

  return {
    // Basic access
    hasPrimaryAccess,
    primaryOrganizationId,
    primaryRole,
    
    // Role checking for primary organization
    isPrimaryOwner: primaryOrganizationId ? isOwner(primaryOrganizationId) : false,
    isPrimaryAdmin: primaryOrganizationId ? isAdmin(primaryOrganizationId) : false,
    isPrimaryMember: primaryOrganizationId ? isMember(primaryOrganizationId) : false,
    
    // Management permissions
    canManagePrimary,
    canManageAny,
    
    // General role checking functions
    hasRole,
    hasAnyRole,
    isOwner,
    isAdmin,
    isMember,
    
    // All memberships
    memberships,
    primaryMembership,
  }
}
