import { supabase } from './supabase'
import { AuthError } from '@supabase/supabase-js'

export interface SignupData {
  email: string
  password: string
  firstName: string
  lastName: string
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

export async function signUp({ email, password, firstName, lastName }: SignupData) {
  try {
    // Sign up the user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        }
      }
    })

    if (authError) {
      throw authError
    }

    // If signup is successful, create a profile record
    if (authData.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: email,
          first_name: firstName,
          last_name: lastName,
        })

      if (profileError) {
        console.error('Error creating profile:', profileError)
        // Don't throw here as the user is already created in auth
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

// Listen to auth state changes
export function onAuthStateChange(callback: (event: string, session: unknown) => void) {
  return supabase.auth.onAuthStateChange(callback)
} 