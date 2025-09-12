import { useTranslation } from 'react-i18next'
import { useCallback } from 'react'

export function useLanguage() {
  const { i18n } = useTranslation()

  const changeLanguage = useCallback((language: string) => {
    i18n.changeLanguage(language)
  }, [i18n])

  const currentLanguage = i18n.language?.split('-')[0] || 'en'

  const availableLanguages = [
    { code: 'en', name: 'English' },
    { code: 'vn', name: 'Tiếng Việt' }
  ]

  return {
    currentLanguage,
    changeLanguage,
    availableLanguages
  }
}
