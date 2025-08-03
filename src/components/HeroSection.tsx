import { Link } from 'react-router-dom'

export function HeroSection() {
  return (
    <section className="hero">
      <div className="hero-content">
        <h2 className="hero-title">
          Plan. Schedule. Worship.
        </h2>

        <p className="hero-description">
          Worship Lead helps churches organize worship teams with ease.
          Schedule volunteers, plan setlists, and manage your song library — all in one simple, powerful tool.
        </p>

        <div className="hero-actions">
          <Link to="/signup" className="btn btn-primary btn-large">
            Try for free
          </Link>
        </div>

        <p className="hero-login">
          Already have an account? <Link to="/login" className="login-link">Login</Link>
        </p>
      </div>
    </section>
  )
} 