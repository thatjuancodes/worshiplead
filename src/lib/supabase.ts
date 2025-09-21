import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Database types for multi-tenant SaaS
export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          first_name: string
          last_name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          first_name: string
          last_name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          first_name?: string
          last_name?: string
          created_at?: string
          updated_at?: string
        }
      }
      organization_memberships: {
        Row: {
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
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role?: 'owner' | 'admin' | 'member'
          status?: 'active' | 'inactive' | 'suspended'
          joined_at?: string
          left_at?: string | null
          invited_by?: string | null
          accepted_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'member'
          joined_at?: string
          left_at?: string | null
          invited_by?: string | null
          accepted_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      organization_invites: {
        Row: {
          id: string
          organization_id: string
          email: string
          invited_by: string
          status: 'pending' | 'accepted' | 'expired' | 'declined'
          expires_at: string
          accepted_at: string | null
          declined_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          email: string
          invited_by: string
          status?: 'pending' | 'accepted' | 'expired' | 'declined'
          expires_at: string
          accepted_at?: string | null
          declined_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          email?: string
          invited_by?: string
          status?: 'pending' | 'accepted' | 'expired' | 'declined'
          expires_at?: string
          accepted_at?: string | null
          declined_at?: string | null
          created_at?: string
        }
      }
      songs: {
        Row: {
          id: string
          organization_id: string
          title: string
          artist: string
          youtube_url: string | null
          spotify_url: string | null
          key: string | null
          bpm: number | null
          ccli_number: string | null
          tags: string[]
          lyrics: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          title: string
          artist: string
          youtube_url?: string | null
          spotify_url?: string | null
          key?: string | null
          bpm?: number | null
          ccli_number?: string | null
          tags?: string[]
          lyrics?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          title?: string
          artist?: string
          youtube_url?: string | null
          spotify_url?: string | null
          key?: string | null
          bpm?: number | null
          ccli_number?: string | null
          tags?: string[]
          lyrics?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      worship_services: {
        Row: {
          id: string
          organization_id: string
          title: string
          service_date: string
          service_time: string | null // TIMESTAMPTZ in UTC - full ISO timestamp string
          description: string | null
          status: 'draft' | 'published' | 'completed'
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          title: string
          service_date: string
          service_time?: string | null // TIMESTAMPTZ in UTC - full ISO timestamp string
          description?: string | null
          status?: 'draft' | 'published' | 'completed'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          title?: string
          service_date?: string
          service_time?: string | null // TIMESTAMPTZ in UTC - full ISO timestamp string
          description?: string | null
          status?: 'draft' | 'published' | 'completed'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      service_songs: {
        Row: {
          id: string
          service_id: string
          song_id: string
          position: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          service_id: string
          song_id: string
          position: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          service_id?: string
          song_id?: string
          position?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      organization_volunteer_links: {
        Row: {
          id: string
          organization_id: string
          public_url: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          public_url: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          public_url?: string
          created_at?: string
          updated_at?: string
        }
      }
      worship_service_volunteers: {
        Row: {
          id: string
          worship_service_id: string
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          worship_service_id: string
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          worship_service_id?: string
          user_id?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
} 