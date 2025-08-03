export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="footer-content">
        <p>&copy; {currentYear} Worship Lead. All rights reserved.</p>
      </div>
    </footer>
  )
} 