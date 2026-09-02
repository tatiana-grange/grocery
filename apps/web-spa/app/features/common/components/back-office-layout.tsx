import { AppLayout, AppLoader } from '@grocery/ui/components/app'
import { Button } from '@grocery/ui/components/primitives/button'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@grocery/ui/components/primitives/sidebar'
import { Toaster } from '@grocery/ui/components/primitives/sonner'
import { Boxes, LogOut, ShieldCheck, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import { useRoles } from '@/features/common/hooks/use-session'
import { authClient } from '@/lib/auth-client'

function BackOfficeSidebar() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  const navItems = [
    { label: t('adminMembers.nav.members'), to: '/admin/members', icon: Users },
    { label: t('catalog.nav.catalog'), to: '/admin/catalog', icon: Boxes },
  ]

  const handleLogout = async () => {
    await authClient.signOut()
    navigate('/login')
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/admin/members" />}>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary">
                <ShieldCheck className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="font-black tracking-tight text-foreground uppercase text-sm">
                {t('adminMembers.backOffice')}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('adminMembers.nav.section')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    tooltip={item.label}
                    isActive={location.pathname.startsWith(item.to)}
                    render={<Link to={item.to} />}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarGroup className="mt-auto">
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link to="/account" />}>
                <Users className="h-4 w-4" />
                <span>{t('members.nav.myAccount')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout} className="text-destructive">
                <LogOut className="h-4 w-4" />
                <span>{t('members.nav.logOut')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
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
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
        <ShieldCheck className="size-10 text-muted-foreground" />
        <p className="text-lg font-semibold">{t('adminMembers.accessDenied')}</p>
        <Button render={<Link to="/account" />}>{t('members.nav.myAccount')}</Button>
      </div>
    )
  }

  return (
    <>
      <AppLayout sidebar={<BackOfficeSidebar />}>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </AppLayout>
      <Toaster position="bottom-right" richColors />
    </>
  )
}
