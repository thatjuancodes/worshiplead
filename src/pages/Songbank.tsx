import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser, getUserPrimaryOrganization } from '../lib/auth'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import './Songbank.css'

interface Song {
  id: string
  title: string
  artist: string
  youtube_url?: string
  spotify_url?: string
  key?: string
  bpm?: number
  ccli_number?: string
  tags: string[]
  lyrics?: string
  created_at: string
}

interface OrganizationData {
  organization_id: string
  role: string
  organizations: {
    name: string
    slug: string
  }[]
}

export function Songbank() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [songs, setSongs] = useState<Song[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedKey, setSelectedKey] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    youtube_url: '',
    spotify_url: '',
    key: '',
    bpm: '',
    ccli_number: '',
    tags: '',
    lyrics: ''
  })

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
      await loadSongs(userOrg.organization_id)
      setLoading(false)
    } catch (error) {
      console.error('Error checking user and organization:', error)
      navigate('/login')
    }
  }, [navigate])

  useEffect(() => {
    checkUserAndOrganization()
  }, [checkUserAndOrganization])

  const loadSongs = async (organizationId: string) => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('organization_id', organizationId)
        .order('title', { ascending: true })

      if (error) {
        console.error('Error loading songs:', error)
        return
      }

      setSongs(data || [])
    } catch (error) {
      console.error('Error loading songs:', error)
    }
  }

  const handleAddSong = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization) return

    try {
      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)

      const { error } = await supabase
        .from('songs')
        .insert({
          organization_id: organization.organization_id,
          title: formData.title,
          artist: formData.artist,
          youtube_url: formData.youtube_url || null,
          spotify_url: formData.spotify_url || null,
          key: formData.key || null,
          bpm: formData.bpm ? parseInt(formData.bpm) : null,
          ccli_number: formData.ccli_number || null,
          tags: tagsArray,
          lyrics: formData.lyrics || null,
          created_by: user?.id
        })

      if (error) {
        console.error('Error adding song:', error)
        return
      }

      // Reset form and reload songs
      setFormData({
        title: '',
        artist: '',
        youtube_url: '',
        spotify_url: '',
        key: '',
        bpm: '',
        ccli_number: '',
        tags: '',
        lyrics: ''
      })
      setShowAddForm(false)
      await loadSongs(organization.organization_id)
    } catch (error) {
      console.error('Error adding song:', error)
    }
  }

  const handleDeleteSong = async (songId: string) => {
    if (!confirm('Are you sure you want to delete this song?')) return

    try {
      const { error } = await supabase
        .from('songs')
        .delete()
        .eq('id', songId)

      if (error) {
        console.error('Error deleting song:', error)
        return
      }

      await loadSongs(organization!.organization_id)
    } catch (error) {
      console.error('Error deleting song:', error)
    }
  }

  const filteredSongs = songs.filter(song => {
    const matchesSearch = song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         song.artist.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesKey = !selectedKey || song.key === selectedKey
    const matchesTag = !selectedTag || song.tags.includes(selectedTag)
    
    return matchesSearch && matchesKey && matchesTag
  })

  const uniqueKeys = [...new Set(songs.map(song => song.key).filter(Boolean))]
  const uniqueTags = [...new Set(songs.flatMap(song => song.tags))]

  const handleSignOut = async () => {
    try {
      const { signOut } = await import('../lib/auth')
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  if (loading) {
    return (
      <div className="songbank-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading your songbank...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="songbank">
      <header className="songbank-header">
        <div className="songbank-header-content">
          <div className="songbank-logo">
            <h1>Worship Lead</h1>
          </div>
          
          <div className="songbank-user-info">
            <span className="user-name">
              {user?.user_metadata?.first_name} {user?.user_metadata?.last_name}
            </span>
            <span className="organization-name">
              {organization?.organizations?.[0]?.name}
            </span>
            <button onClick={handleSignOut} className="btn btn-secondary btn-small">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="songbank-main">
          <div className="songbank-header-section">
            <div className="songbank-title">
              <h2>🎵 Songbank</h2>
              <p>Manage your organization's worship song library</p>
            </div>
            
            <div className="songbank-actions">
              <div className="view-toggle">
                <button
                  onClick={() => setViewMode('cards')}
                  className={`view-btn ${viewMode === 'cards' ? 'active' : ''}`}
                  title="Card View"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
                  title="Table View"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3h18v18H3zM21 9H3M21 15H3M9 3v18"></path>
                  </svg>
                </button>
              </div>
              <button 
                onClick={() => setShowAddForm(!showAddForm)} 
                className="btn btn-primary"
              >
                {showAddForm ? 'Cancel' : '+ Add Song'}
              </button>
            </div>
          </div>

          {showAddForm && (
            <div className="add-song-form">
              <h3>Add New Song</h3>
              <form onSubmit={handleAddSong}>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="title">Title *</label>
                    <input
                      type="text"
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="artist">Artist *</label>
                    <input
                      type="text"
                      id="artist"
                      value={formData.artist}
                      onChange={(e) => setFormData({...formData, artist: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="youtube_url">YouTube URL</label>
                    <input
                      type="url"
                      id="youtube_url"
                      value={formData.youtube_url}
                      onChange={(e) => setFormData({...formData, youtube_url: e.target.value})}
                      placeholder="https://youtube.com/watch?v=..."
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="spotify_url">Spotify URL</label>
                    <input
                      type="url"
                      id="spotify_url"
                      value={formData.spotify_url}
                      onChange={(e) => setFormData({...formData, spotify_url: e.target.value})}
                      placeholder="https://open.spotify.com/track/..."
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="key">Key</label>
                    <input
                      type="text"
                      id="key"
                      value={formData.key}
                      onChange={(e) => setFormData({...formData, key: e.target.value})}
                      placeholder="C, G, D, etc."
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="bpm">BPM</label>
                    <input
                      type="number"
                      id="bpm"
                      value={formData.bpm}
                      onChange={(e) => setFormData({...formData, bpm: e.target.value})}
                      placeholder="120"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="ccli_number">CCLI Number</label>
                    <input
                      type="text"
                      id="ccli_number"
                      value={formData.ccli_number}
                      onChange={(e) => setFormData({...formData, ccli_number: e.target.value})}
                      placeholder="123456"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="tags">Tags</label>
                  <input
                    type="text"
                    id="tags"
                    value={formData.tags}
                    onChange={(e) => setFormData({...formData, tags: e.target.value})}
                    placeholder="praise, reflection, communion (comma-separated)"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="lyrics">Lyrics</label>
                  <textarea
                    id="lyrics"
                    value={formData.lyrics}
                    onChange={(e) => setFormData({...formData, lyrics: e.target.value})}
                    placeholder="Enter song lyrics (markdown supported)"
                    rows={6}
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">
                    Add Song
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowAddForm(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="songbank-filters">
            <div className="search-box">
              <input
                type="text"
                placeholder="Search songs by title or artist..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="filter-controls">
              <select 
                value={selectedKey} 
                onChange={(e) => setSelectedKey(e.target.value)}
                className="filter-select"
              >
                <option value="">All Keys</option>
                {uniqueKeys.map(key => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>

              <select 
                value={selectedTag} 
                onChange={(e) => setSelectedTag(e.target.value)}
                className="filter-select"
              >
                <option value="">All Tags</option>
                {uniqueTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={`songs-list ${viewMode === 'table' ? 'table-view' : 'card-view'}`}>
            {filteredSongs.length === 0 ? (
              <div className="no-songs">
                <p>No songs found. {songs.length === 0 ? 'Add your first song to get started!' : 'Try adjusting your search or filters.'}</p>
              </div>
            ) : viewMode === 'cards' ? (
              // Card View
              filteredSongs.map(song => (
                <div key={song.id} className="song-card">
                  <div className="song-info">
                    <h3 className="song-title">{song.title}</h3>
                    <p className="song-artist">{song.artist}</p>
                    
                    {(song.key || song.bpm || song.ccli_number) && (
                      <div className="song-metadata">
                        {song.key && <span className="song-key">Key: {song.key}</span>}
                        {song.bpm && <span className="song-bpm">BPM: {song.bpm}</span>}
                        {song.ccli_number && <span className="song-ccli">CCLI: {song.ccli_number}</span>}
                      </div>
                    )}

                    {song.tags.length > 0 && (
                      <div className="song-tags">
                        {song.tags.map(tag => (
                          <span key={tag} className="tag">{tag}</span>
                        ))}
                      </div>
                    )}

                    {(song.youtube_url || song.spotify_url) && (
                      <div className="song-links">
                        {song.youtube_url && (
                          <a href={song.youtube_url} target="_blank" rel="noopener noreferrer" className="song-link youtube">
                            🎬
                          </a>
                        )}
                        {song.spotify_url && (
                          <a href={song.spotify_url} target="_blank" rel="noopener noreferrer" className="song-link spotify">
                            🎵
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="song-actions">
                    <button 
                      onClick={() => handleDeleteSong(song.id)}
                      className="btn btn-danger btn-small"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              // Table View
              <div className="songs-table">
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Artist</th>
                      <th>Key</th>
                      <th>BPM</th>
                      <th>Tags</th>
                      <th>Links</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSongs.map(song => (
                      <tr key={song.id}>
                        <td className="song-title-cell">
                          <strong>{song.title}</strong>
                        </td>
                        <td>{song.artist}</td>
                        <td>{song.key || '-'}</td>
                        <td>{song.bpm || '-'}</td>
                        <td>
                          {song.tags.length > 0 ? (
                            <div className="song-tags">
                              {song.tags.map(tag => (
                                <span key={tag} className="tag">{tag}</span>
                              ))}
                            </div>
                          ) : '-'}
                        </td>
                        <td>
                          {(song.youtube_url || song.spotify_url) && (
                            <div className="song-links">
                              {song.youtube_url && (
                                <a href={song.youtube_url} target="_blank" rel="noopener noreferrer" className="song-link youtube">
                                  🎬
                                </a>
                              )}
                              {song.spotify_url && (
                                <a href={song.spotify_url} target="_blank" rel="noopener noreferrer" className="song-link spotify">
                                  🎵
                                </a>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          <button 
                            onClick={() => handleDeleteSong(song.id)}
                            className="btn btn-danger btn-small"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
      </main>
    </div>
  )
} 