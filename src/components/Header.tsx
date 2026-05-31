import { Link, useLocation } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { Button, Menu, MenuButton, MenuItem, MenuList, Text } from '@chakra-ui/react'
import { ChevronDownIcon, CloseIcon, HamburgerIcon } from '@chakra-ui/icons'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../hooks/useLanguage'
import { getCurrentUser } from '../lib/auth'
import type { User } from '@supabase/supabase-js'
import logoImage from '../assets/images/logo.png'

export function Header() {
  const { t } = useTranslation()
  const { currentLanguage, changeLanguage, availableLanguages } = useLanguage()
  const location = useLocation()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const translate = useCallback((key: string, fallback: string) => {
    const value = t(key)
    return value && value !== key ? value : fallback
  }, [t])

  useEffect(() => {
    const checkUser = async () => {
      try {
        setLoading(true)
        const currentUser = await getCurrentUser()
        setUser(currentUser)
      } catch {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkUser()
  }, [])

  const publicNav = [
    { href: '#features', label: 'Features' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#faq', label: 'FAQ' },
  ]

  const brandHref = location.pathname === '/' ? '#hero' : '/#hero'

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {user ? (
          <Link className="flex items-center gap-3 no-underline" to="/dashboard">
            <img alt="Spirit Lead Logo" className="h-8 w-auto object-contain" src={logoImage} />
            <span className="text-lg font-bold tracking-tight text-text-primary transition-colors hover:text-primary-600">
              {translate('header.appName', 'Spirit Lead')}
            </span>
          </Link>
        ) : (
          <a
            className="flex items-center gap-3 no-underline"
            href={brandHref}
            onClick={() => setMobileMenuOpen(false)}
          >
            <img alt="Spirit Lead Logo" className="h-8 w-auto object-contain" src={logoImage} />
            <span className="text-lg font-bold tracking-tight text-text-primary transition-colors hover:text-primary-600">
              {translate('header.appName', 'Spirit Lead')}
            </span>
          </a>
        )}

        <div className="hidden items-center gap-3 md:flex">
          {!loading && !user ? (
            <>
              <nav className="mr-2 flex items-center gap-1">
                {publicNav.map((item) => (
                  <a className="btn-ghost no-underline" href={item.href} key={item.href}>
                    {item.label}
                  </a>
                ))}
              </nav>
              <Button as={Link} size="md" to="/login" variant="outline">
                {translate('header.login', 'Login')}
              </Button>
              <Button as={Link} size="md" to="/signup">
                {translate('header.tryForFree', 'Start Free Trial')}
              </Button>
            </>
          ) : null}

          {!loading && user ? (
            <Button as={Link} size="md" to="/dashboard">
              {translate('header.dashboard', 'Dashboard')}
            </Button>
          ) : null}

          <Menu>
            <MenuButton as={Button} rightIcon={<ChevronDownIcon />} size="md" variant="outline">
              <Text fontSize="sm">
                {availableLanguages.find((language) => language.code === currentLanguage)?.name || 'EN'}
              </Text>
            </MenuButton>
            <MenuList>
              {availableLanguages.map((language) => (
                <MenuItem
                  bg={currentLanguage === language.code ? 'blue.50' : 'transparent'}
                  key={language.code}
                  onClick={() => changeLanguage(language.code)}
                >
                  {language.name}
                </MenuItem>
              ))}
            </MenuList>
          </Menu>
        </div>

        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-primary transition-colors hover:bg-gray-50 md:hidden"
          onClick={() => setMobileMenuOpen((current) => !current)}
          type="button"
        >
          {mobileMenuOpen ? <CloseIcon boxSize={3} /> : <HamburgerIcon boxSize={5} />}
        </button>
      </div>

      {mobileMenuOpen ? (
        <div className="border-t border-border bg-white md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 sm:px-6">
            {!loading && !user ? (
              <>
                {publicNav.map((item) => (
                  <a
                    className="btn-ghost justify-start no-underline"
                    href={item.href}
                    key={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                ))}
                <Button as={Link} mt={2} size="md" to="/login" variant="outline" width="full">
                  {translate('header.login', 'Login')}
                </Button>
                <Button as={Link} size="md" to="/signup" width="full">
                  {translate('header.tryForFree', 'Start Free Trial')}
                </Button>
              </>
            ) : null}

            {!loading && user ? (
              <Button as={Link} size="md" to="/dashboard" width="full">
                {translate('header.dashboard', 'Dashboard')}
              </Button>
            ) : null}

            <div className="mt-2 flex flex-wrap gap-2">
              {availableLanguages.map((language) => (
                <Button
                  key={language.code}
                  onClick={() => changeLanguage(language.code)}
                  size="sm"
                  variant={currentLanguage === language.code ? 'solid' : 'outline'}
                >
                  {language.name}
                </Button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  )
}
