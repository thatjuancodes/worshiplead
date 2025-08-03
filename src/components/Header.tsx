import { Link } from 'react-router-dom'

export function Header() {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <Link to="/" className="logo-link">
            <h1>Worship Lead</h1>
          </Link>
        </div>

        <nav className="nav">
          <Link to="/login" className="btn btn-secondary">
            Login
          </Link>

          <button className="btn btn-primary">
            Try for free
          </button>
        </nav>
      </div>
    </header>
  )
} 