import type { SupportedLocale } from '@grocery/i18n/config'
import { SUPPORTED_LOCALES } from '@grocery/i18n/config'
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@grocery/ui/components/primitives/dropdown-menu'
import { Check, Moon, Sun } from 'lucide-react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import useTheme from '@/hooks/useTheme'
import { useI18nStore } from '@/lib/i18n/i18n-client'

/** The theme switch and the language list, shared by the settings menu and the phone menu. */
export function AppSettingsItems({ testIdPrefix }: { testIdPrefix: string }): ReactElement {
  const { t, i18n } = useTranslation()
  const { setLanguage } = useI18nStore()
  const [theme, setTheme] = useTheme()

  return (
    <>
      <DropdownMenuItem
        data-testid={`${testIdPrefix}-theme`}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? <Sun className="mr-2 size-4" /> : <Moon className="mr-2 size-4" />}
        <span>{theme === 'dark' ? t('settings.lightMode') : t('settings.darkMode')}</span>
      </DropdownMenuItem>

      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>{t('settings.language')}</DropdownMenuLabel>
        {(Object.keys(SUPPORTED_LOCALES) as SupportedLocale[]).map((key) => {
          const config = SUPPORTED_LOCALES[key]
          return (
            <DropdownMenuItem
              key={key}
              data-testid={`${testIdPrefix}-lang-${key}`}
              onClick={() => setLanguage(key)}
            >
              <span className="mr-2">{config.flag}</span>
              <span>{config.name}</span>
              {i18n.language === key && <Check className="ml-auto size-4" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuGroup>
    </>
  )
}
