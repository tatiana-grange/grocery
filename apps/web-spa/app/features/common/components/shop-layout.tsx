import { Outlet } from 'react-router'
import { MemberShell } from '@/features/common/components/member-shell'

/**
 * Public shell for the shop: no session redirect, reachable signed out. The chrome is the
 * shared MemberShell, so the menu is the same one the member area shows.
 */
export default function ShopLayout() {
  return (
    <MemberShell contentClassName="max-w-7xl">
      <Outlet />
    </MemberShell>
  )
}
