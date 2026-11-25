import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@grocery/ui/components/primitives/dropdown-menu'
import { Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AppSettingsItems } from '@/features/common/components/app-settings-items'

/**
 * Theme toggle and language switch. Sits in every shell's chrome (shop, member area, back
 * office) so a signed-out shopper and a signed-in member reach the same two controls — they
 * used to live only in the old dashboard sidebar. The languages are listed flat rather than
 * in a submenu: two of them, and a submenu adds an open/close race for no gain.
 */
export function AppSettingsMenu() {
  const { t } = useTranslation()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="app-settings-trigger"
        aria-label={t('settings.menu')}
        title={t('settings.menu')}
        className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground"
      >
        <Settings className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <AppSettingsItems testIdPrefix="app-settings" />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
