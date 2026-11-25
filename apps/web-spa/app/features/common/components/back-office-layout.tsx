import { AppLayout, AppLayoutHeader, AppLoader, AwningBand } from '@grocery/ui/components/app'
import { Button } from '@grocery/ui/components/primitives/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@grocery/ui/components/primitives/sidebar'
import { Toaster } from '@grocery/ui/components/primitives/sonner'
import {
  Boxes,
  Calculator,
  CalendarDays,
  ClipboardList,
  HandCoins,
  LogOut,
  PackageSearch,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import { AppSettingsMenu } from '@/features/common/components/app-settings-menu'
import { useRoles } from '@/features/common/hooks/use-session'
import { authClient } from '@/lib/auth-client'

function BackOfficeSidebar() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  const navItems = [
    { label: t('adminMembers.nav.members'), to: '/admin/members', icon: Users },
    { label: t('catalog.nav.catalog'), to: '/admin/catalog', icon: Boxes },
    { label: t('purchasing.nav.purchasing'), to: '/admin/purchasing', icon: ClipboardList },
    { label: t('inventory.nav.inventory'), to: '/admin/inventory', icon: PackageSearch },
    { label: t('adminParticipation.nav.participation'), to: '/admin/slots', icon: CalendarDays },
    { label: t('adminAccounting.nav.accounting'), to: '/admin/accounting', icon: Calculator },
  ]

  const handleLogout = async () => {
    await authClient.signOut()
    navigate('/login')
  }

  return (
    <Sidebar collapsible="offcanvas" className="border-border group-data-[side=left]:border-r-2">
      <AwningBand />
      <SidebarHeader className="gap-0 px-5 pt-5 pb-3">
        <Link to="/admin/members" className="block rounded-md outline-hidden focus-visible:ring-2">
          <span className="block font-serif text-3xl font-bold text-foreground">
            {t('members.title')}
          </span>
          <span className="block text-base text-muted-foreground">{t('backOffice.subtitle')}</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <nav aria-label={t('backOffice.navigation')} className="px-3 py-2">
          <SidebarMenu className="gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.to)
              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    data-testid={`back-office-nav-${item.to.split('/').pop()}`}
                    isActive={isActive}
                    aria-current={isActive ? 'page' : undefined}
                    className="h-12 gap-3 px-3 font-semibold data-active:bg-sidebar-primary data-active:text-sidebar-primary-foreground hover:data-active:bg-sidebar-primary/90 [&_svg]:size-5"
                    render={<Link to={item.to} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </nav>
      </SidebarContent>

      <SidebarFooter className="mt-auto gap-3 px-3 pb-5">
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-12 gap-3 px-3 font-semibold [&_svg]:size-5"
              render={<Link to="/account" />}
            >
              <Users />
              <span>{t('members.nav.myAccount')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              data-testid="nav-logout"
              onClick={handleLogout}
              className="h-12 gap-3 px-3 font-semibold text-destructive [&_svg]:size-5"
            >
              <LogOut />
              <span>{t('members.nav.logOut')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {/* The table itself lives outside the back office, behind its own layout. An admin holds
            the access implicitly, so this is just the way across. */}
        <Button
          size="lg"
          data-testid="back-office-nav-distribution"
          className="w-full border-border bg-straw text-straw-foreground hover:bg-straw/90"
          render={<Link to="/distribution" />}
        >
          <HandCoins />
          {t('backOffice.openDistribution')}
        </Button>
      </SidebarFooter>
    </Sidebar>
  )
}

export default function BackOfficeLayout() {
  const { t } = useTranslation()
  const { data: sessionData, isPending } = authClient.useSession()
  const { isAdmin } = useRoles()

  if (isPending) return <AppLoader />
  if (!sessionData) return <Navigate to="/login" replace />
  if (!isAdmin) {
    return (
      <div
        className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center"
        data-testid="rbac-access-denied"
      >
        <ShieldCheck className="size-10 text-muted-foreground" />
        <p className="text-lg font-semibold">{t('adminMembers.accessDenied')}</p>
        <Button render={<Link to="/account" />}>{t('members.nav.myAccount')}</Button>
      </div>
    )
  }

  return (
    <>
      <AppLayout sidebar={<BackOfficeSidebar />} className="min-w-0">
        <AppLayoutHeader className="border-b-2 border-rule bg-background">
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              data-testid="back-office-nav-shop"
              render={<Link to="/shop" />}
            >
              <Store />
              {t('shop.nav.backToShop')}
            </Button>
            <AppSettingsMenu />
          </div>
        </AppLayoutHeader>
        <div className="flex-1 overflow-auto px-8 py-8">
          <Outlet />
        </div>
      </AppLayout>
      <Toaster position="bottom-right" richColors />
    </>
  )
}
