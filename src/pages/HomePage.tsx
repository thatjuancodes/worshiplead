import { useRef } from 'react'
import { Header, HeroSection, FeaturesSection, Footer } from '../components'

export function HomePage() {
  const featuresRef = useRef<HTMLElement>(null)

  return (
    <div className="app">
      <Header />

      <main>
        <HeroSection />

        <FeaturesSection ref={featuresRef} />
      </main>

      <Footer />
    </div>
  )
} 