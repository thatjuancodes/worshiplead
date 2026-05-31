import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import logoImage from '../assets/images/logo.png'

interface EntryShellProps {
  title: string
  description: string
  children: ReactNode
  footer?: ReactNode
  accentTitle?: string
  accentBody?: string
  accentItems?: string[]
  cardClassName?: string
}

export function EntryShell({
  title,
  description,
  children,
  footer,
  accentTitle = 'Plan services with less friction',
  accentBody = 'Spirit Lead keeps schedules, songs, volunteers, and organization setup in one clean workflow.',
  accentItems = [
    'Publish services and coordinate volunteers from one workspace.',
    'Keep song planning, team coordination, and signups in sync.',
    'Built for churches that need clarity, not admin overhead.',
  ],
  cardClassName = 'max-w-xl',
}: EntryShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-8%] h-72 w-72 rounded-full bg-primary-100 blur-3xl" />
        <div className="absolute bottom-[-12%] right-[-6%] h-80 w-80 rounded-full bg-secondary-100 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-white via-white/70 to-transparent" />
      </div>

      <div className="relative grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section className="hidden border-r border-border bg-white/70 px-10 py-10 backdrop-blur lg:flex lg:flex-col lg:justify-between xl:px-14">
          <div className="space-y-14">
            <Link className="inline-flex items-center gap-3 no-underline" to="/">
              <img alt="Spirit Lead Logo" className="h-10 w-auto object-contain" src={logoImage} />
              <span className="text-xl font-bold tracking-tight text-text-primary">Spirit Lead</span>
            </Link>

            <div className="max-w-xl space-y-6">
              <div className="inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-700">
                Worship Planning
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl font-semibold tracking-tight text-text-primary xl:text-5xl">
                  {accentTitle}
                </h1>
                <p className="max-w-lg text-base leading-7 text-text-muted xl:text-lg">
                  {accentBody}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {accentItems.map((item) => (
              <div
                className="card-shadow rounded-2xl border border-border bg-white/90 px-5 py-4 text-sm leading-6 text-text-muted"
                key={item}
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
          <div className="absolute left-4 top-4 sm:left-6 sm:top-6 lg:hidden">
            <Link className="inline-flex items-center gap-3 no-underline" to="/">
              <img alt="Spirit Lead Logo" className="h-9 w-auto object-contain" src={logoImage} />
              <span className="text-lg font-bold tracking-tight text-text-primary">Spirit Lead</span>
            </Link>
          </div>

          <div className={`w-full ${cardClassName}`}>
            <div className="card-shadow rounded-[28px] border border-border bg-white/95 p-6 backdrop-blur sm:p-8">
              <div className="space-y-2">
                <h2 className="text-3xl font-semibold tracking-tight text-text-primary">{title}</h2>
                <p className="text-sm leading-6 text-text-muted sm:text-base">{description}</p>
              </div>

              <div className="mt-8">{children}</div>

              {footer ? <div className="mt-8 border-t border-border pt-6">{footer}</div> : null}
            </div>

            <p className="mt-5 text-center text-xs text-text-muted">
              &copy; {new Date().getFullYear()} Spirit Lead. Worship planning made simpler.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
