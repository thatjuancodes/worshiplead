import { useRef } from 'react'
import './App.css'

import { Header, HeroSection, FeaturesSection, Footer } from './components'

function App() {
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

export default App
