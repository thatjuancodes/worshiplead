import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { UserProfile } from '../lib/auth'

// Define types based on what we get from Supabase auth
type User = Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user']
type Session = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']

interface AuthContextType {
  user: User
  session: Session
  profile: UserProfile | null
  isLoading: boolean
  error: string | null
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User>(null)
  const [session, setSession] = useState<Session>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          // No profile found, create one
          const { error: createError } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              email: user?.email || 'unknown@example.com',
              first_name: user?.user_metadata?.first_name || user?.user_metadata?.name?.split(' ')[0] || 'Unknown',
              last_name: user?.user_metadata?.last_name || user?.user_metadata?.name?.split(' ').slice(1).join(' ') || 'User'
            })

          if (createError) {
            throw createError
          }

          // Fetch the newly created profile
          const { data: newProfile, error: fetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()

          if (fetchError) {
            throw fetchError
          }

          setProfile(newProfile)
        } else {
          throw profileError
        }
      } else {
        setProfile(data)
      }
    } catch (err) {
      console.error('Error fetching/creating user profile:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch/create user profile')
    }
  }

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      setUser(null)
      setSession(null)
      setProfile(null)
    } catch (err) {
      console.error('Error signing out:', err)
      setError(err instanceof Error ? err.message : 'Failed to sign out')
    }
  }

  useEffect(() => {
    // Add a timeout fallback to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setIsLoading(false)
    }, 10000) // 10 second timeout
    
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        
        setSession(session)
        setUser(session?.user ?? null)
        
        if (session?.user) {
          await fetchProfile(session.user.id)
        }
      } catch (err) {
        console.error('Error getting initial session:', err)
        setError(err instanceof Error ? err.message : 'Failed to get initial session')
      } finally {
        clearTimeout(timeoutId)
        setIsLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_, session) => {
        try {
          setSession(session)
          setUser(session?.user ?? null)
          
          if (session?.user) {
            await fetchProfile(session.user.id)
          } else {
            setProfile(null)
          }
        } catch (err) {
          console.error('Error handling auth state change:', err)
          setError(err instanceof Error ? err.message : 'Failed to handle authentication change')
        } finally {
          clearTimeout(timeoutId)
          setIsLoading(false)
        }
      }
    )

    return () => {
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  const value: AuthContextType = {
    user,
    session,
    profile,
    isLoading,
    error,
    signOut,
    refreshProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
