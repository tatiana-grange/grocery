import type { ReactElement, ReactNode } from 'react'

import { cn } from '@grocery/ui/lib/utils'

interface BackOfficeTableFrameProps {
  children: ReactNode
  className?: string
}

/** The frame of a back office table: 2 px border, rounded, heading row tinted, scrolls inside. */
export function BackOfficeTableFrame({
  children,
  className,
}: BackOfficeTableFrameProps): ReactElement {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border-2 border-border bg-card [&_[data-slot=table-head]]:text-sm [&_[data-slot=table-head]]:font-bold [&_[data-slot=table-cell]]:whitespace-normal',
        className,
      )}
    >
      {children}
    </div>
  )
}
