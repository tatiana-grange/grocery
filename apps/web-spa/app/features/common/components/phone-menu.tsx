import { Button } from '@grocery/ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@grocery/ui/components/primitives/dropdown-menu'
import { LogOut, Menu, ShieldCheck } from 'lucide-react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { AppSettingsItems } from '@/features/common/components/app-settings-items'

/** The phone "Menu": settings, back office for admins, sign-out. What the tab bar does not hold. */
export function PhoneMenu({
  isAdmin,
  isSignedIn,
  onSignOut,
}: {
  isAdmin: boolean
  isSignedIn: boolean
  onSignOut: () => void
}): ReactElement {
  const { t } = useTranslation()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" data-testid="phone-menu-trigger" />}
      >
        <Menu className="size-5" aria-hidden="true" />
        {t('shop.nav.menu')}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <AppSettingsItems testIdPrefix="phone-menu" />
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-testid="phone-menu-admin" render={<Link to="/admin/members" />}>
              <ShieldCheck className="mr-2 size-4" />
              {t('adminMembers.backOffice')}
            </DropdownMenuItem>
          </>
        )}
        {isSignedIn && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-testid="phone-menu-logout" onClick={onSignOut}>
              <LogOut className="mr-2 size-4" />
              {t('members.nav.logOut')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
