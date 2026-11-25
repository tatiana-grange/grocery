import { AwningBand } from '@grocery/ui/components/app/awning-band'
import { Toaster } from '@grocery/ui/components/primitives/sonner'
import { cn } from '@grocery/ui/lib/utils'
import type { ReactElement, ReactNode } from 'react'
import { MemberTabBar } from '@/features/common/components/member-tab-bar'
import { SiteHeader } from '@/features/common/components/site-header'

/** The chrome of the shop and the member area: awning, top bar, page, phone tab bar, toasts. */
export function MemberShell({
  contentClassName,
  children,
}: {
  /** The width of the page: `max-w-5xl` for the shop, `max-w-3xl` for the member area. */
  contentClassName: string
  children: ReactNode
}): ReactElement {
  return (
    <div className="min-h-svh bg-background [--tab-bar-height:5rem] [--page-bottom-space:calc(var(--tab-bar-height)+env(safe-area-inset-bottom)+1.5rem)] md:[--page-bottom-space:1.5rem]">
      <AwningBand />
      <SiteHeader />
      <main className={cn('mx-auto px-4 pt-6 pb-(--page-bottom-space) md:px-6', contentClassName)}>
        {children}
      </main>
      <MemberTabBar />
      <Toaster
        position="bottom-right"
        richColors
        offset={{ bottom: 'var(--page-bottom-space)' }}
        mobileOffset={{ bottom: 'var(--page-bottom-space)' }}
      />
    </div>
  )
}
