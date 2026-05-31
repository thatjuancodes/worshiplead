import { AuthProvider } from './contexts'
import { AuthenticatedApp } from './AuthenticatedApp'

function App() {
  return (
    <div className="min-h-screen bg-background font-sans text-text-primary">
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </div>
  )
}

export default App
