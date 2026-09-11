import { Toaster } from '@grocery/ui/components/primitives/sonner'
import { Outlet } from 'react-router'
import { SiteHeader } from '@/features/common/components/site-header'

/**
 * Public shell for the shop: no session redirect, reachable signed out. The chrome is the
 * shared SiteHeader, so the menu is the same one the member area shows.
 */
export default function ShopLayout() {
  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl p-6">
        <Outlet />
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
