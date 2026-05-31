import type { ReactNode } from 'react'

export function PageHeaderCard({
  title,
  subtitle,
  actions,
  kicker,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  kicker?: ReactNode
}) {
  return (
    <div className="sl-page-header">
      <div className="sl-page-header__copy">
        {kicker ? <div className="sl-page-header__kicker">{kicker}</div> : null}
        <h1 className="sl-page-header__title">{title}</h1>
        {subtitle ? <p className="sl-page-header__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="sl-page-header__actions">{actions}</div> : null}
    </div>
  )
}

export function ToolbarCard({ children }: { children: ReactNode }) {
  return <div className="sl-toolbar-card">{children}</div>
}

export function SurfaceCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`sl-surface-card ${className}`.trim()}>{children}</div>
}

export function SectionHeading({
  title,
  meta,
  action,
}: {
  title: string
  meta?: string
  action?: ReactNode
}) {
  return (
    <div className="sl-section-heading">
      <div>
        <h2 className="section-title">{title}</h2>
        {meta ? <p className="sl-section-heading__meta">{meta}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function MetricCard({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper?: string
}) {
  return (
    <div className="sl-metric-card">
      <p className="sl-metric-card__label">{label}</p>
      <p className="sl-metric-card__value">{value}</p>
      {helper ? <p className="sl-metric-card__helper">{helper}</p> : null}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="sl-empty-state">
      {icon ? <div className="sl-empty-state__icon">{icon}</div> : null}
      <h3 className="sl-empty-state__title">{title}</h3>
      <p className="sl-empty-state__description">{description}</p>
      {action ? <div className="sl-empty-state__action">{action}</div> : null}
    </div>
  )
}
