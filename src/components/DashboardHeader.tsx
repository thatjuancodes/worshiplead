import { useLocation, useNavigate } from 'react-router-dom'
import { signOut } from '../lib/auth'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../hooks/useLanguage'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useOrganizationAccess } from '../hooks/useOrganizationAccess'
import logoImage from '../assets/images/logo.png'

interface OrganizationData {
  organization_id: string
  role: string
  organizations: {
    name: string
    slug: string
  } | {
    name: string
    slug: string
  }[]
}

interface UserProfile {
  id: string
  first_name: string
  last_name: string
  email: string
}

interface DashboardHeaderProps {
  user: User | null
  organization: OrganizationData | null
}

type NavIcon = 'dashboard' | 'services' | 'volunteers' | 'songbank'
type NavItem = { path: string; label: string; exact: boolean; icon: NavIcon }

function getOrganizationName(organization: OrganizationData | null): string {
  if (!organization?.organizations) {
    return 'Loading...'
  }

  return Array.isArray(organization.organizations)
    ? organization.organizations[0]?.name || 'Loading...'
    : organization.organizations.name || 'Loading...'
}

function getOrganizationSlug(organization: OrganizationData | null): string {
  if (!organization?.organizations) {
    return ''
  }

  return Array.isArray(organization.organizations)
    ? organization.organizations[0]?.slug || ''
    : organization.organizations.slug || ''
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function SidebarIcon({ icon }: { icon: NavIcon }) {
  const commonProps = {
    className: 'h-4 w-4 shrink-0',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
    viewBox: '0 0 24 24'
  }

  if (icon === 'dashboard') {
    return (
      <svg {...commonProps}>
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <rect x="13" y="3" width="8" height="5" rx="2" />
        <rect x="13" y="10" width="8" height="11" rx="2" />
        <rect x="3" y="13" width="8" height="8" rx="2" />
      </svg>
    )
  }

  if (icon === 'services') {
    return (
      <svg {...commonProps}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 11h18" />
      </svg>
    )
  }

  if (icon === 'volunteers') {
    return (
      <svg {...commonProps}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
        <circle cx="9.5" cy="7" r="3.5" />
        <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 4.13a4 4 0 0 1 0 7.75" />
      </svg>
    )
  }

  return (
    <svg {...commonProps}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

function SignOutIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  )
}

export function DashboardHeader({ user, organization }: DashboardHeaderProps) {
  const { t } = useTranslation()
  const { currentLanguage, changeLanguage, availableLanguages } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const { canManagePrimary } = useOrganizationAccess()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [desktopUserMenuOpen, setDesktopUserMenuOpen] = useState(false)
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false)
  const desktopUserMenuRef = useRef<HTMLDivElement | null>(null)
  const mobileUserMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) {
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('id', user.id)
        .single()

      if (!error) {
        setUserProfile(data)
      }
    }

    fetchUserProfile().catch(() => {
      setUserProfile(null)
    })
  }, [user?.id])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node

      if (desktopUserMenuRef.current && !desktopUserMenuRef.current.contains(target)) {
        setDesktopUserMenuOpen(false)
      }

      if (mobileUserMenuRef.current && !mobileUserMenuRef.current.contains(target)) {
        setMobileUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [])

  const displayName = userProfile
    ? `${userProfile.first_name} ${userProfile.last_name}`.trim()
    : user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'User'

  const navItems = useMemo(() => {
    const items: NavItem[] = [
      { path: '/dashboard', label: t('header.dashboard', 'Dashboard'), exact: true, icon: 'dashboard' },
      { path: '/schedule', label: t('header.scheduleService', 'Services'), exact: false, icon: 'services' },
      { path: '/songbank', label: t('header.songbank', 'Songs'), exact: false, icon: 'songbank' },
    ]

    if (canManagePrimary) {
      items.splice(2, 0, { path: '/team', label: t('header.teamManagement', 'Volunteers'), exact: false, icon: 'volunteers' })
    }

    return items
  }, [canManagePrimary, t])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const isActive = (path: string, exact: boolean) => {
    if (exact) {
      return location.pathname === path
    }

    return location.pathname.startsWith(path)
  }

  const avatar = getInitials(displayName)
  const organizationName = getOrganizationName(organization)
  const organizationSlug = getOrganizationSlug(organization)
  const userEmail = userProfile?.email || user?.email || ''

  const renderUserMenu = (mobile = false) => {
    const isOpen = mobile ? mobileUserMenuOpen : desktopUserMenuOpen
    const setOpen = mobile ? setMobileUserMenuOpen : setDesktopUserMenuOpen
    const containerRef = mobile ? mobileUserMenuRef : desktopUserMenuRef

    return (
      <div className="relative" ref={containerRef}>
        {isOpen ? (
          <div
            className={`absolute left-0 right-0 z-20 rounded-2xl border border-border bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)] ${
              mobile ? 'bottom-[calc(100%+12px)]' : 'bottom-[calc(100%+10px)]'
            }`}
          >
            <div className="border-b border-border px-3 py-2.5">
              <p className="truncate text-sm font-semibold text-text-primary">{displayName}</p>
              <p className="truncate text-xs text-text-muted">{userEmail}</p>
            </div>
            <div className="px-1 py-2">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                Language
              </p>
              <div className="space-y-1">
                {availableLanguages.map((language) => {
                  const active = currentLanguage === language.code

                  return (
                    <button
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${
                        active
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-text-primary hover:bg-gray-50'
                      }`}
                      key={language.code}
                      onClick={() => {
                        changeLanguage(language.code)
                        setOpen(false)
                      }}
                      type="button"
                    >
                      <span>{language.name}</span>
                      {active ? <span className="text-xs font-semibold">Active</span> : null}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="border-t border-border px-1 pt-2">
              <button
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-danger-700 transition-colors hover:bg-danger-50"
                onClick={handleSignOut}
                type="button"
              >
                <SignOutIcon />
                <span>{t('header.signOut', 'Sign Out')}</span>
              </button>
            </div>
          </div>
        ) : null}

        <button
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-gray-50"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
            {avatar}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary">{displayName}</p>
            <p className="truncate text-xs text-text-muted">{organizationName}</p>
          </div>
        </button>
      </div>
    )
  }

  const renderNav = (mobile = false) => (
    <nav className={`space-y-1 ${mobile ? '' : 'px-3 py-4'}`}>
      {navItems.map((item) => (
        <button
          className={`flex w-full items-center rounded-lg py-2.5 text-sm font-medium transition-colors ${
            mobile ? 'gap-3 px-3' : 'gap-3 px-3'
          } ${
            isActive(item.path, item.exact)
              ? 'bg-primary-50 text-primary-700'
              : 'text-text-muted hover:bg-gray-50 hover:text-text-primary'
          }`}
          key={item.path}
          onClick={() => {
            navigate(item.path === '/team' && organization?.organization_id
              ? `/team?organizationId=${encodeURIComponent(organization.organization_id)}`
              : item.path)
            setMobileSidebarOpen(false)
          }}
          type="button"
        >
          <SidebarIcon icon={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[240px] border-r border-border bg-white lg:flex lg:flex-col">
        <button
          className="flex items-center gap-3 border-b border-border px-5 py-5 text-left transition-colors hover:bg-gray-50"
          onClick={() => navigate('/dashboard')}
          type="button"
        >
          <img alt="Spirit Lead Logo" className="h-8 w-auto object-contain" src={logoImage} />
          <div>
            <p className="sl-brand-wordmark text-lg font-bold tracking-tight text-text-primary">
              <span>{t('header.appName', 'Spirit Lead')}</span>
              <span className="sl-beta-badge">Beta</span>
            </p>
          </div>
        </button>

        {renderNav()}

        <div className="mt-auto border-t border-border p-3">
          <div className="rounded-xl border border-border bg-gray-50">
            {renderUserMenu()}
          </div>
        </div>
      </aside>

      <header className="fixed left-0 right-0 top-0 z-30 border-b border-border bg-white/95 backdrop-blur lg:hidden">
        <div className="flex h-[72px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-primary transition-colors hover:bg-gray-50 lg:hidden"
              onClick={() => setMobileSidebarOpen(true)}
              type="button"
            >
              <span className="text-lg leading-none">☰</span>
            </button>
            <div>
              <p className="text-sm font-semibold text-text-primary">{organizationName}</p>
              <p className="text-xs text-text-muted">{organizationSlug ? `/${organizationSlug}` : 'Primary organization'}</p>
            </div>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <div className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
              {organization?.role || 'member'}
            </div>
            <div className="flex items-center gap-3 rounded-full border border-border bg-white px-2 py-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
                {avatar}
              </div>
              <div className="pr-2">
                <p className="text-sm font-medium text-text-primary">{displayName}</p>
                <p className="text-xs text-text-muted">{userProfile?.email || user?.email}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
            type="button"
          />
          <div className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-white shadow-drawer">
            <div className="flex items-center justify-between border-b border-border px-5 py-5">
              <button
                className="flex items-center gap-3 text-left"
                onClick={() => {
                  navigate('/dashboard')
                  setMobileSidebarOpen(false)
                }}
                type="button"
              >
                <img alt="Spirit Lead Logo" className="h-8 w-auto object-contain" src={logoImage} />
                <span className="sl-brand-wordmark text-lg font-bold tracking-tight text-text-primary">
                  <span>{t('header.appName', 'Spirit Lead')}</span>
                  <span className="sl-beta-badge">Beta</span>
                </span>
              </button>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-50"
                onClick={() => setMobileSidebarOpen(false)}
                type="button"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>

            <div className="border-b border-border px-4 py-4">
              <p className="text-sm font-semibold text-text-primary">{organizationName}</p>
              <p className="text-xs text-text-muted">{organizationSlug ? `/${organizationSlug}` : 'Primary organization'}</p>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              {renderNav(true)}
            </div>

            <div className="border-t border-border p-3">
              <div className="rounded-xl border border-border bg-gray-50">
                {renderUserMenu(true)}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
