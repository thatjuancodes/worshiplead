interface LogoSectionProps {
  viteLogo: string
  reactLogo: string
}

export function LogoSection({ viteLogo, reactLogo }: LogoSectionProps) {
  return (
    <div>
      <a href="https://vite.dev" target="_blank">
        <img src={viteLogo} className="logo" alt="Vite logo" />
      </a>

      <a href="https://react.dev" target="_blank">
        <img src={reactLogo} className="logo react" alt="React logo" />
      </a>
    </div>
  )
} 