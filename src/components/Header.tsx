import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { getCurrentUser } from '../lib/auth'
import type { User } from '@supabase/supabase-js'

export function Header() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await getCurrentUser()
        setUser(currentUser)
      } catch (error) {
        console.error('Error checking user:', error)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkUser()
  }, [])

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <Link to={user ? "/dashboard" : "/"} className="logo-link">
            <h1>Worship Lead</h1>
          </Link>
        </div>

        <nav className="nav">
          {!loading && (
            <>
              {user ? (
                <Link to="/dashboard" className="btn btn-primary">
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/login" className="btn btn-secondary">
                    Login
                  </Link>

                  <Link to="/signup" className="btn btn-primary">
                    Try for free
                  </Link>
                </>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  )
} 