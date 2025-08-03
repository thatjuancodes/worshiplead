interface HeaderProps {
  onFeaturesClick?: () => void
}

export function Header({ onFeaturesClick }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <h1>Worship Lead</h1>
        </div>

        <nav className="nav">
          <button className="btn btn-secondary">
            Login
          </button>

          <button className="btn btn-primary">
            Try for free
          </button>
        </nav>
      </div>
    </header>
  )
} 