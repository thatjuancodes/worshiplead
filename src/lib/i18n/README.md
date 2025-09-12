# Internationalization (i18n) Implementation

This project uses `react-i18next` for internationalization support.

## Structure

```
src/lib/i18n/
├── index.ts              # i18n configuration
├── locales/
│   ├── en.json          # English translations
│   ├── es.json          # Spanish translations
│   └── ...              # Additional language files
└── README.md            # This file
```

## Usage

### In Components

```tsx
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t } = useTranslation()
  
  return (
    <div>
      <h1>{t('dashboard.title')}</h1>
      <p>{t('dashboard.description')}</p>
    </div>
  )
}
```

### With Variables

```tsx
// In translation file
"welcome": "Welcome {{name}}!"

// In component
{t('welcome', { name: 'John' })}
```

### Language Switching

```tsx
import { useLanguage } from '../hooks/useLanguage'

function LanguageSwitcher() {
  const { changeLanguage, currentLanguage, availableLanguages } = useLanguage()
  
  return (
    <select 
      value={currentLanguage} 
      onChange={(e) => changeLanguage(e.target.value)}
    >
      {availableLanguages.map(lang => (
        <option key={lang.code} value={lang.code}>
          {lang.name}
        </option>
      ))}
    </select>
  )
}
```

## Adding New Languages

1. Create a new JSON file in `locales/` (e.g., `fr.json`)
2. Copy the structure from `en.json` and translate the values
3. Import and add to the resources object in `index.ts`:

```ts
import fr from './locales/fr.json'

const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr }
}
```

4. Add to the `availableLanguages` array in `useLanguage.ts`

## Translation Keys Structure

The Dashboard translations are organized by feature:

- `dashboard.upcoming.*` - Upcoming services section
- `dashboard.calendar.*` - Calendar component
- `dashboard.volunteerLink.*` - Volunteer link section  
- `dashboard.songs.*` - Songs management
- `dashboard.services.*` - Service management
- `dashboard.loading.*` - Loading states
- `dashboard.errors.*` - Error messages
- `dashboard.success.*` - Success messages

## Best Practices

1. **Namespace translations** by feature/component
2. **Use descriptive keys** that indicate context
3. **Keep translations consistent** across languages
4. **Test with different languages** to ensure UI layouts work
5. **Use interpolation** for dynamic values
6. **Consider pluralization** for countable items

## Browser Language Detection

The system automatically detects and uses the user's browser language preference. It falls back to English if the detected language is not available.

Language preference is stored in localStorage for persistence across sessions.
