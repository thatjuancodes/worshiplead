import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

import { Counter, LogoSection, InfoSection } from './components'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <LogoSection viteLogo={viteLogo} reactLogo={reactLogo} />

      <h1>Vite + React</h1>

      <Counter count={count} onIncrement={() => setCount((count) => count + 1)} />

      <InfoSection />
    </>
  )
}

export default App
