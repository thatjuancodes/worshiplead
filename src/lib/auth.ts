import { supabase } from './supabase'
import { AuthError } from '@supabase/supabase-js'

export interface SignupData {
  email: string
  password: string
  firstName: string
  lastName: string
}

export interface OrganizationData {
  name: string
  slug: string
}

export interface InviteSignupData {
  email: string
  password: string
  firstName: string
  lastName: string
  organizationSlug: string
}

export interface LoginData {
  email: string
  password: string
}

export interface UserProfile {
  id: string
  email: string
  first_name: string
  last_name: string
  created_at: string
  updated_at: string
}

export interface OrganizationMembership {
  id: string
  organization_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  status: 'active' | 'inactive' | 'suspended'
  joined_at: string
  left_at: string | null
  invited_by: string | null
  accepted_at: string
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  created_at: string
  updated_at: string
}

// Create user account only (no organization)
export async function createUserAccount({ email, password, firstName, lastName }: SignupData, skipEmailConfirmation = false) {
  try {
    // Sign up the user with Supabase Auth
    const signUpOptions: any = {
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
        emailRedirectTo: `${window.location.origin}/dashboard`
      }
    }

    // If skipEmailConfirmation is true, we'll handle email confirmation differently
    if (skipEmailConfirmation) {
      signUpOptions.options.emailConfirm = true
    }

    const { data: authData, error: authError } = await supabase.auth.signUp(signUpOptions)

    if (authError) {
      throw authError
    }

    // If signup is successful, create profile record only
    if (authData.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          email: email,
          first_name: firstName,
          last_name: lastName,
        }, {
          onConflict: 'id'
        })

      if (profileError) {
        console.error('Error creating profile:', profileError)
        throw new Error('Failed to create user profile')
      }
    }

    return { user: authData.user, session: authData.session }
  } catch (error) {
    if (error instanceof AuthError) {
      throw new Error(getAuthErrorMessage(error.message))
    }
    throw error
  }
}

// Step 2a: Create organization and membership for new user
export async function createOrganizationAndMembership(userId: string, { name, slug }: OrganizationData) {
  // Check if organization slug is unique
  const { data: existingOrg, error: slugCheckError } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single()

  if (slugCheckError && slugCheckError.code !== 'PGRST116') {
    throw slugCheckError
  }

  if (existingOrg) {
    throw new Error('Organization slug already exists. Please choose a different name.')
  }

  // Create organization
  const { data: orgData, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: name,
      slug: slug,
    })
    .select()
    .single()

  if (orgError) {
    console.error('Error creating organization:', orgError)
    throw new Error('Failed to create organization')
  }

  // Create membership record
  const { error: membershipError } = await supabase
    .from('organization_memberships')
    .insert({
      organization_id: orgData.id,
      user_id: userId,
      role: 'owner',
      status: 'active',
    })

  if (membershipError) {
    console.error('Error creating membership:', membershipError)
    // Try to clean up the organization if membership creation fails
    await supabase.from('organizations').delete().eq('id', orgData.id)
    throw new Error('Failed to create organization membership')
  }

  return orgData
}

// Step 2b: Join existing organization via invite
export async function joinOrganizationViaInvite(userId: string, organizationSlug: string) {
  // Find organization by slug
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', organizationSlug)
    .single()

  if (orgError || !org) {
    throw new Error('Invalid organization invite link')
  }

  // Get user's email from profile
  const { data: userProfile, error: profileError } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single()

  if (profileError || !userProfile) {
    throw new Error('User profile not found')
  }

  // Check if user is already invited
  const { data: invite, error: inviteError } = await supabase
    .from('organization_invites')
    .select('*')
    .eq('organization_id', org.id)
    .eq('email', userProfile.email)
    .eq('status', 'pending')
    .single()

  if (inviteError || !invite) {
    throw new Error('No valid invite found for this email and organization')
  }

  // Check if invite is expired
  if (new Date(invite.expires_at) < new Date()) {
    throw new Error('Invite has expired')
  }

  // Create membership record
  const { error: membershipError } = await supabase
    .from('organization_memberships')
    .insert({
      organization_id: org.id,
      user_id: userId,
      role: 'member',
      status: 'active',
      invited_by: invite.invited_by,
    })

  if (membershipError) {
    console.error('Error creating membership:', membershipError)
    throw new Error('Failed to join organization')
  }

  // Mark invite as accepted
  const { error: inviteUpdateError } = await supabase
    .from('organization_invites')
    .update({ 
      status: 'accepted',
      accepted_at: new Date().toISOString()
    })
    .eq('id', invite.id)

  if (inviteUpdateError) {
    console.error('Error updating invite:', inviteUpdateError)
    // Don't throw here as the membership was created successfully
  }

  return org
}

// Legacy signup function (for backward compatibility)
export async function signUp({ email, password, firstName, lastName, organizationName, organizationSlug }: SignupData & { organizationName: string; organizationSlug: string }) {
  try {
    // Step 1: Create user account
    const { user, session } = await createUserAccount({ email, password, firstName, lastName })
    
    if (!user) {
      throw new Error('Failed to create user account')
    }

    // Step 2: Create organization and membership
    const org = await createOrganizationAndMembership(user.id, { name: organizationName, slug: organizationSlug })

    return { user, session, organization: org }
  } catch (error) {
    if (error instanceof AuthError) {
      throw new Error(getAuthErrorMessage(error.message))
    }
    throw error
  }
}

export async function signIn({ email, password }: LoginData) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw error
    }

    return data
  } catch (error) {
    if (error instanceof AuthError) {
      throw new Error(getAuthErrorMessage(error.message))
    }
    throw error
  }
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw error
    }
  } catch (error) {
    if (error instanceof AuthError) {
      throw new Error(getAuthErrorMessage(error.message))
    }
    throw error
  }
}

export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
      throw error
    }
    return user
  } catch (error) {
    if (error instanceof AuthError) {
      throw new Error(getAuthErrorMessage(error.message))
    }
    throw error
  }
}

export async function getCurrentSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) {
      throw error
    }
    return session
  } catch (error) {
    if (error instanceof AuthError) {
      throw new Error(getAuthErrorMessage(error.message))
    }
    throw error
  }
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null
      }
      throw error
    }

    return data
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return null
  }
}

// Helper function to convert Supabase auth error messages to user-friendly messages
function getAuthErrorMessage(message: string): string {
  const errorMessages: Record<string, string> = {
    'Invalid login credentials': 'Invalid email or password',
    'Email not confirmed': 'Please check your email and confirm your account',
    'User already registered': 'An account with this email already exists',
    'Password should be at least 6 characters': 'Password must be at least 6 characters long',
    'Unable to validate email address: invalid format': 'Please enter a valid email address',
    'Signup is disabled': 'Signup is currently disabled',
    'Signup is disabled for this user': 'Signup is currently disabled',
  }

  return errorMessages[message] || message
}

// Invite signup for existing organizations (legacy function)
export async function signUpWithInvite({ email, password, firstName, lastName, organizationSlug }: InviteSignupData) {
  try {
    // Step 1: Create user account
    const { user, session } = await createUserAccount({ email, password, firstName, lastName })
    
    if (!user) {
      throw new Error('Failed to create user account')
    }

    // Step 2: Join organization via invite
    const org = await joinOrganizationViaInvite(user.id, organizationSlug)

    return { user, session, organization: org }
  } catch (error) {
    if (error instanceof AuthError) {
      throw new Error(getAuthErrorMessage(error.message))
    }
    throw error
  }
}

// Check organization slug availability
export async function checkSlugAvailability(slug: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .single()

    if (error && error.code === 'PGRST116') {
      // No rows returned - slug is available
      return true
    }

    if (error) {
      throw error
    }

    // Slug exists - not available
    return false
  } catch (error) {
    console.error('Error checking slug availability:', error)
    return false
  }
}

// Get organization by slug
export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw error
    }

    return data
  } catch (error) {
    console.error('Error fetching organization:', error)
    return null
  }
}

// Listen to auth state changes
export function onAuthStateChange(callback: (event: string, session: unknown) => void) {
  return supabase.auth.onAuthStateChange(callback)
}

// ===== MEMBERSHIP MANAGEMENT FUNCTIONS =====

// Get user's organizations
export async function getUserOrganizations(userId: string) {
  try {
    const { data, error } = await supabase
      .from('organization_memberships')
      .select(`
        organization_id,
        role,
        status,
        joined_at,
        organizations (name, slug)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')

    if (error) {
      throw error
    }

    return data
  } catch (error) {
    console.error('Error fetching user organizations:', error)
    return []
  }
}

// Get organization members
export async function getOrganizationMembers(organizationId: string) {
  try {
    const { data, error } = await supabase
      .from('organization_memberships')
      .select(`
        user_id,
        role,
        status,
        joined_at,
        profiles (first_name, last_name, email)
      `)
      .eq('organization_id', organizationId)
      .eq('status', 'active')

    if (error) {
      throw error
    }

    return data
  } catch (error) {
    console.error('Error fetching organization members:', error)
    return []
  }
}

// Update membership status
export async function updateMembershipStatus(membershipId: string, status: 'active' | 'inactive' | 'suspended') {
  try {
    const { data, error } = await supabase
      .from('organization_memberships')
      .update({ 
        status,
        left_at: status === 'inactive' ? new Date().toISOString() : null
      })
      .eq('id', membershipId)
      .select()

    if (error) {
      throw error
    }

    return { data, error: null }
  } catch (error) {
    console.error('Error updating membership status:', error)
    return { data: null, error }
  }
}

// Get user's primary organization (first active membership)
export async function getUserPrimaryOrganization(userId: string) {
  try {
    const { data, error } = await supabase
      .from('organization_memberships')
      .select(`
        organization_id,
        role,
        organizations (name, slug)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('joined_at', { ascending: true })
      .limit(1)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw error
    }

    return data
  } catch (error) {
    console.error('Error fetching user primary organization:', error)
    return null
  }
}

// Check if user has access to organization
export async function checkOrganizationAccess(userId: string, organizationId: string) {
  try {
    const { data, error } = await supabase
      .from('organization_memberships')
      .select('role, status')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw error
    }

    return data
  } catch (error) {
    console.error('Error checking organization access:', error)
    return null
  }
} 