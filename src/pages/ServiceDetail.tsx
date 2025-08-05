import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCurrentUser, getUserPrimaryOrganization } from '../lib/auth'
import type { User } from '@supabase/supabase-js'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import './ServiceDetail.css'
import './Dashboard.css'

interface WorshipService {
  id: string
  organization_id: string
  title: string
  service_date: string
  service_time?: string
  description?: string
  status: 'draft' | 'published' | 'completed'
  created_at: string
  updated_at: string
}

interface Song {
  id: string
  title: string
  artist: string
  key?: string
  bpm?: number
  ccli_number?: string
  tags?: string[]
}

interface ServiceSong {
  id: string
  service_id: string
  song_id: string
  position: number
  notes?: string
  created_at: string
  updated_at: string
  songs: Song
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

// Helper function to get organization name
const getOrganizationName = (organization: OrganizationData | null): string => {
  if (!organization?.organizations) return 'Loading...'
  
  if (Array.isArray(organization.organizations)) {
    return organization.organizations[0]?.name || 'Loading...'
  }
  
  return organization.organizations.name || 'Loading...'
}

// Sortable Song Item Component
function SortableSongItem({ 
  serviceSong, 
  onRemove,
  isRemoving
}: { 
  serviceSong: ServiceSong
  onRemove: (id: string) => void 
  isRemoving: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: serviceSong.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="service-song-item"
      {...attributes}
    >
      <div className="song-position" {...listeners}>
        {serviceSong.position}
      </div>
      <div className="song-info" {...listeners}>
        <div className="song-title">
          {serviceSong.songs.title} - {serviceSong.songs.artist}
        </div>
        {serviceSong.notes && (
          <div className="song-notes">
            {serviceSong.notes}
          </div>
        )}
        {serviceSong.songs.key && (
          <span className="song-key">Key: {serviceSong.songs.key}</span>
        )}
      </div>
      <div className="song-actions">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onRemove(serviceSong.id)
          }}
          className="btn btn-danger btn-small"
          title="Remove song from service"
          disabled={isRemoving}
        >
          {isRemoving ? (
            <>
              <span className="spinner-small"></span>
              Removing...
            </>
          ) : (
            <>
              ✕ Remove
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export function ServiceDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [service, setService] = useState<WorshipService | null>(null)
  const [serviceSongs, setServiceSongs] = useState<ServiceSong[]>([])
  const [availableSongs, setAvailableSongs] = useState<Song[]>([])
  const [showAddSongForm, setShowAddSongForm] = useState(false)
  const [selectedSongId, setSelectedSongId] = useState('')
  const [songNotes, setSongNotes] = useState('')
  const [addingSong, setAddingSong] = useState(false)
  const [removingSong, setRemovingSong] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<string>('')

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
    } catch (error) {
      console.error('Error checking user and organization:', error)
      navigate('/login')
    }
  }, [navigate])

  const loadService = useCallback(async () => {
    if (!id || !organization) return

    try {
      const { data, error } = await supabase
        .from('worship_services')
        .select('*')
        .eq('id', id)
        .eq('organization_id', organization.organization_id)
        .single()

      if (error) {
        console.error('Error loading service:', error)
        if (error.code === 'PGRST116') {
          setError('Service not found or you do not have access to it.')
        } else {
          setError('Failed to load service details.')
        }
        return
      }

      setService(data)
    } catch (error) {
      console.error('Error loading service:', error)
      setError('Failed to load service details.')
    } finally {
      setLoading(false)
    }
  }, [id, organization])

  useEffect(() => {
    checkUserAndOrganization()
  }, [checkUserAndOrganization])

  useEffect(() => {
    if (organization) {
      loadService()
    }
  }, [organization, loadService])

  const loadServiceSongs = useCallback(async () => {
    if (!service) return

    try {
      const { data, error } = await supabase
        .from('service_songs')
        .select(`
          *,
          songs (
            id,
            title,
            artist,
            key,
            bpm,
            ccli_number,
            tags
          )
        `)
        .eq('service_id', service.id)
        .order('position', { ascending: true })

      if (error) {
        console.error('Error loading service songs:', error)
        return
      }

      setServiceSongs(data || [])
    } catch (error) {
      console.error('Error loading service songs:', error)
    }
  }, [service])

  const loadAvailableSongs = useCallback(async () => {
    if (!organization) return

    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('organization_id', organization.organization_id)
        .order('title', { ascending: true })

      if (error) {
        console.error('Error loading available songs:', error)
        return
      }

      setAvailableSongs(data || [])
    } catch (error) {
      console.error('Error loading available songs:', error)
    }
  }, [organization])

  const handleAddSong = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!service || !selectedSongId) {
      setError('Please select a song to add.')
      return
    }

    try {
      setAddingSong(true)
      setError('')

      // Get the next position number
      const nextPosition = serviceSongs.length + 1

      const { error } = await supabase
        .from('service_songs')
        .insert({
          service_id: service.id,
          song_id: selectedSongId,
          position: nextPosition,
          notes: songNotes.trim() || null
        })
        .select()
        .single()

      if (error) {
        console.error('Error adding song to service:', error)
        setError('Failed to add song to service. Please try again.')
        return
      }

      setSuccess('Song added to service successfully!')
      setSelectedSongId('')
      setSongNotes('')
      setShowAddSongForm(false)
      
      await loadServiceSongs()
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error adding song to service:', error)
      setError('Failed to add song to service. Please try again.')
    } finally {
      setAddingSong(false)
    }
  }

  const handleRemoveSong = async (serviceSongId: string) => {
    if (!confirm('Are you sure you want to remove this song from the service?')) return

    try {
      setRemovingSong(serviceSongId)
      setError('')
      setSuccess('')
      
      const { error } = await supabase
        .from('service_songs')
        .delete()
        .eq('id', serviceSongId)

      if (error) {
        console.error('Error removing song from service:', error)
        setError('Failed to remove song from service. Please try again.')
        return
      }

      setSuccess('Song removed from service successfully!')
      await loadServiceSongs()
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error removing song from service:', error)
      setError('Failed to remove song from service. Please try again.')
    } finally {
      setRemovingSong(null)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = serviceSongs.findIndex(song => song.id === active.id)
      const newIndex = serviceSongs.findIndex(song => song.id === over?.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        // Store original order for potential rollback
        const originalSongs = [...serviceSongs]
        
        // Update local state immediately for smooth UX with new positions
        const newSongs = arrayMove(serviceSongs, oldIndex, newIndex).map((song, index) => ({
          ...song,
          position: index + 1
        }))
        setServiceSongs(newSongs)

        // Update positions in Supabase using temporary positions to avoid conflicts
        try {
          // First, set all positions to temporary negative values to avoid conflicts
          for (let i = 0; i < newSongs.length; i++) {
            const song = newSongs[i]
            const tempPosition = -(i + 1) // Use negative values as temporary positions
            
            const { error } = await supabase
              .from('service_songs')
              .update({ position: tempPosition })
              .eq('id', song.id)

            if (error) {
              console.error('Error setting temporary position:', error)
              setError('Failed to save new song order.')
              // Revert to original order immediately
              setServiceSongs(originalSongs)
              return
            }
          }

          // Then, set the final positions
          for (let i = 0; i < newSongs.length; i++) {
            const song = newSongs[i]
            const finalPosition = i + 1
            
            const { error } = await supabase
              .from('service_songs')
              .update({ position: finalPosition })
              .eq('id', song.id)

            if (error) {
              console.error('Error setting final position:', error)
              setError('Failed to save new song order.')
              // Revert to original order immediately
              setServiceSongs(originalSongs)
              return
            }
          }

          setSuccess('Song order updated successfully!')
          setTimeout(() => setSuccess(''), 3000)
        } catch (error) {
          console.error('Error updating song positions:', error)
          setError('Failed to save new song order.')
          // Revert to original order immediately
          setServiceSongs(originalSongs)
        }
      }
    }
  }

  useEffect(() => {
    if (service) {
      loadServiceSongs()
      loadAvailableSongs()
    }
  }, [service, loadServiceSongs, loadAvailableSongs])

  const handleSignOut = async () => {
    try {
      const { signOut } = await import('../lib/auth')
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      draft: 'status-draft',
      published: 'status-published',
      completed: 'status-completed'
    }
    return `status-badge ${statusClasses[status as keyof typeof statusClasses] || 'status-draft'}`
  }

  if (loading) {
    return (
      <div className="service-detail">
        <div className="service-loading">
          <div className="loading-spinner">
            <div className="spinner"></div>
          </div>
          <p>Loading service details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="service-detail">
        <header className="dashboard-header">
          <div className="dashboard-header-content">
            <div className="dashboard-logo">
              <h1>Worship Lead</h1>
            </div>
            
            <div className="dashboard-user-info">
              <span className="user-name">
                {user?.user_metadata?.first_name} {user?.user_metadata?.last_name}
              </span>
              <span className="organization-name">
                {getOrganizationName(organization)}
              </span>
              <button onClick={handleSignOut} className="btn btn-secondary btn-small">
                Sign Out
              </button>
            </div>
          </div>
        </header>

        <main className="service-main">
          <div className="service-container">
            <div className="error-section">
              <h2>Error</h2>
              <p>{error}</p>
              <button onClick={() => navigate('/schedule')} className="btn btn-primary">
                Back to Services
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!service) {
    return (
      <div className="service-detail">
        <div className="service-loading">
          <p>Service not found</p>
          <button onClick={() => navigate('/schedule')} className="btn btn-primary">
            Back to Services
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="service-detail">
      <header className="dashboard-header">
        <div className="dashboard-header-content">
          <div className="dashboard-logo">
            <h1>Worship Lead</h1>
          </div>
          
          <div className="dashboard-user-info">
            <span className="user-name">
              {user?.user_metadata?.first_name} {user?.user_metadata?.last_name}
            </span>
            <span className="organization-name">
              {getOrganizationName(organization)}
            </span>
            <button onClick={handleSignOut} className="btn btn-secondary btn-small">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="service-main">
        <div className="service-container">
          <div className="service-header-section">
            <div className="service-title">
              <h2>Service Details</h2>
              <p>View and manage your worship service</p>
            </div>
            <div className="service-actions">
              <button
                onClick={() => navigate(`/service/${service.id}/edit`)}
                className="btn btn-primary"
              >
                Edit Service
              </button>
              <button
                onClick={() => navigate('/schedule')}
                className="btn btn-secondary"
              >
                Back to Services
              </button>
            </div>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {success && (
            <div className="success-message">
              {success}
            </div>
          )}

          <div className="service-content">
            <div className="service-info-section">
              <div className="service-header-info">
                <h3>{service.title}</h3>
                <span className={getStatusBadge(service.status)}>
                  {service.status}
                </span>
              </div>

              <div className="service-details-grid">
                <div className="detail-item">
                  <label>Service Date</label>
                  <span>{formatDate(service.service_date)}</span>
                </div>

                {service.service_time && (
                  <div className="detail-item">
                    <label>Service Time</label>
                    <span>{service.service_time}</span>
                  </div>
                )}

                <div className="detail-item">
                  <label>Created</label>
                  <span>{formatDate(service.created_at)}</span>
                </div>

                <div className="detail-item">
                  <label>Last Updated</label>
                  <span>{formatDate(service.updated_at)}</span>
                </div>
              </div>

              {service.description && (
                <div className="service-description">
                  <label>Description</label>
                  <p>{service.description}</p>
                </div>
              )}
            </div>

            <div className="service-songs-section">
              <div className="section-header">
                <h3>Service Songs</h3>
                <button 
                  onClick={() => setShowAddSongForm(!showAddSongForm)}
                  className="btn btn-primary btn-small"
                >
                  {showAddSongForm ? 'Cancel' : 'Add Songs'}
                </button>
              </div>

              {showAddSongForm && (
                <div className="add-song-form">
                  <h4>Add Song to Service</h4>
                  <form onSubmit={handleAddSong}>
                    <div className="form-group">
                      <label htmlFor="songSelect">Select Song</label>
                      <select
                        id="songSelect"
                        value={selectedSongId}
                        onChange={(e) => setSelectedSongId(e.target.value)}
                        required
                      >
                        <option value="">Choose a song...</option>
                        {availableSongs.map(song => (
                          <option key={song.id} value={song.id}>
                            {song.title} - {song.artist}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="songNotes">Notes (optional)</label>
                      <input
                        type="text"
                        id="songNotes"
                        value={songNotes}
                        onChange={(e) => setSongNotes(e.target.value)}
                        placeholder="e.g., special number, ending song"
                      />
                    </div>
                    <div className="form-actions">
                      <button 
                        type="submit" 
                        className="btn btn-primary"
                        disabled={addingSong || !selectedSongId}
                      >
                        {addingSong ? 'Adding Song...' : 'Add Song'}
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={() => setShowAddSongForm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
              
              {serviceSongs.length === 0 ? (
                <div className="no-songs">
                  <p>No songs added to this service yet</p>
                  <p>Add songs from your songbank to create a setlist</p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={serviceSongs.map(song => song.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="service-songs-list">
                      {serviceSongs.map((serviceSong) => (
                        <SortableSongItem
                          key={serviceSong.id}
                          serviceSong={serviceSong}
                          onRemove={handleRemoveSong}
                          isRemoving={removingSong === serviceSong.id}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>

            <div className="service-notes-section">
              <div className="section-header">
                <h3>Service Notes</h3>
                <button className="btn btn-secondary btn-small">
                  Add Notes
                </button>
              </div>
              
              <div className="no-notes">
                <p>No notes added yet</p>
                <p>Add notes for the worship team, announcements, or special instructions</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 