import type { SupportedLocale } from '@grocery/i18n/config'
import { SUPPORTED_LOCALES } from '@grocery/i18n/config'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@grocery/ui/components/primitives/dropdown-menu'
import { Check, Moon, Settings, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import useTheme from '@/hooks/useTheme'
import { useI18nStore } from '@/lib/i18n/i18n-client'

/**
 * Theme toggle and language switch. Sits in every shell's chrome (shop, member area, back
 * office) so a signed-out shopper and a signed-in member reach the same two controls — they
 * used to live only in the old dashboard sidebar. The languages are listed flat rather than
 * in a submenu: two of them, and a submenu adds an open/close race for no gain.
 */
export function AppSettingsMenu() {
  const { t, i18n } = useTranslation()
  const { setLanguage } = useI18nStore()
  const [theme, setTheme] = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="app-settings-trigger"
        aria-label={t('settings.menu')}
        className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground"
      >
        <Settings className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          data-testid="app-settings-theme"
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
                data-testid={`app-settings-lang-${key}`}
                onClick={() => setLanguage(key)}
              >
                <span className="mr-2">{config.flag}</span>
                <span>{config.name}</span>
                {i18n.language === key && <Check className="ml-auto size-4" />}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
