# Organization Access System

This document explains how to use the global organization access system for authenticated users.

## Overview

The organization access system provides global access to a user's organization memberships and role-based permissions throughout the application. This allows you to restrict features based on a user's role in their organization.

## Architecture

The system consists of three main parts:

1. **AuthContext** - Manages user authentication state
2. **OrganizationMembershipsContext** - Provides access to organization memberships
3. **useOrganizationAccess Hook** - Simplified interface for common use cases

## Setup

The contexts are automatically set up in your app hierarchy:

```tsx
<AuthProvider>
  <AuthenticatedApp />
</AuthProvider>
```

The `AuthenticatedApp` component automatically wraps the `OrganizationMembershipsProvider` around your routes, providing access to organization data throughout the app.

## Basic Usage

### Using the useOrganizationAccess Hook

```tsx
import { useOrganizationAccess } from '@/hooks/useOrganizationAccess'

function MyComponent() {
  const {
    hasPrimaryAccess,
    primaryOrganizationId,
    primaryRole,
    isPrimaryOwner,
    isPrimaryAdmin,
    isPrimaryMember,
    canManagePrimary,
    canManageAny
  } = useOrganizationAccess()

  if (!hasPrimaryAccess) {
    return <div>You don't have access to any organizations</div>
  }

  return (
    <div>
      <h1>Welcome to {primaryOrganizationId}</h1>
      
      {isPrimaryOwner && (
        <button>Manage Organization Settings</button>
      )}
      
      {canManagePrimary && (
        <button>Manage Team Members</button>
      )}
      
      {isPrimaryMember && (
        <button>View Services</button>
      )}
    </div>
  )
}
```

### Using the Context Directly

```tsx
import { useOrganizationMemberships } from '@/contexts'

function MyComponent() {
  const { memberships, hasRole, isOwner, isAdmin } = useOrganizationMemberships()

  // Check specific organization access
  const canManageOrg = (orgId: string) => hasRole(orgId, 'admin')

  // Check if user owns any organization
  const ownsAnyOrg = memberships.some(m => isOwner(m.organization_id))

  return (
    <div>
      {memberships.map(membership => (
        <div key={membership.id}>
          {membership.organizations.name} - {membership.role}
        </div>
      ))}
    </div>
  )
}
```

## Role Hierarchy

The system supports three roles with hierarchical permissions:

- **Owner** (highest) - Full access to organization
- **Admin** - Can manage members and most settings
- **Member** (lowest) - Basic access to organization features

### Role Checking Functions

```tsx
const { hasRole, hasAnyRole, isOwner, isAdmin, isMember } = useOrganizationAccess()

// Check if user has at least the specified role
const canManage = hasRole(organizationId, 'admin')

// Check if user has any of the specified roles
const canEdit = hasAnyRole(organizationId, ['owner', 'admin'])

// Direct role checks
const isOrgOwner = isOwner(organizationId)
const isOrgAdmin = isAdmin(organizationId)
const isOrgMember = isMember(organizationId)
```

## Available Properties

### From useOrganizationAccess

- `hasPrimaryAccess` - Boolean indicating if user has access to any organization
- `primaryOrganizationId` - ID of user's primary organization
- `primaryRole` - User's role in primary organization
- `isPrimaryOwner` - Boolean for primary organization ownership
- `isPrimaryAdmin` - Boolean for primary organization admin status
- `isPrimaryMember` - Boolean for primary organization membership
- `canManagePrimary` - Boolean indicating if user can manage primary organization
- `canManageAny` - Boolean indicating if user can manage any organization

### From useOrganizationMemberships

- `memberships` - Array of all organization memberships
- `primaryMembership` - User's primary organization membership
- `isLoading` - Boolean indicating if data is being fetched
- `error` - Any error that occurred during data fetching
- `refreshMemberships` - Function to refresh membership data

## Example Use Cases

### Feature Restriction

```tsx
function TeamManagementPage() {
  const { canManagePrimary } = useOrganizationAccess()

  if (!canManagePrimary) {
    return (
      <Alert status="warning">
        You don't have permission to manage team members.
      </Alert>
    )
  }

  return <TeamManagementComponent />
}
```

### Conditional Rendering

```tsx
function ServiceCard({ service }) {
  const { hasRole } = useOrganizationAccess()
  const canEdit = hasRole(service.organization_id, 'admin')

  return (
    <Card>
      <CardBody>
        <Text>{service.title}</Text>
        {canEdit && (
          <Button size="sm" colorScheme="blue">
            Edit Service
          </Button>
        )}
      </CardBody>
    </Card>
  )
}
```

### Navigation Guards

```tsx
function ProtectedRoute({ children, requiredRole = 'member' }) {
  const { hasRole, primaryOrganizationId } = useOrganizationAccess()
  
  if (!primaryOrganizationId || !hasRole(primaryOrganizationId, requiredRole)) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}

// Usage
<Route 
  path="/admin" 
  element={
    <ProtectedRoute requiredRole="admin">
      <AdminPage />
    </ProtectedRoute>
  } 
/>
```

## Performance Considerations

- Organization memberships are fetched once when the user logs in
- Data is cached in context and only refreshed when explicitly called
- Use `refreshMemberships()` when you need to update the data (e.g., after role changes)
- The context automatically handles loading states and errors

## Error Handling

The system includes built-in error handling:

```tsx
function MyComponent() {
  const { error, isLoading } = useOrganizationAccess()

  if (isLoading) {
    return <Spinner />
  }

  if (error) {
    return (
      <Alert status="error">
        Failed to load organization data: {error}
      </Alert>
    )
  }

  // Your component logic
}
```

## Best Practices

1. **Always check access before rendering protected content**
2. **Use the hook for common use cases, context for advanced scenarios**
3. **Handle loading and error states gracefully**
4. **Cache role checks when possible to avoid repeated calculations**
5. **Use role hierarchy for permission checks (e.g., `hasRole(orgId, 'admin')` includes owners)**

## Troubleshooting

### Common Issues

1. **No memberships showing**: Check if user is properly authenticated and has organization memberships
2. **Role checks failing**: Verify the organization ID is correct and user has active membership
3. **Context not available**: Ensure component is wrapped within the provider hierarchy

### Debug Information

Use the `OrganizationAccessExample` component to see all available data and debug your setup.
