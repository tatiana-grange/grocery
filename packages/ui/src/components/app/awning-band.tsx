import type { ComponentProps, ReactElement } from 'react'

import { cn } from '@grocery/ui/lib/utils'

/**
 * A striped market awning with a scalloped edge. Decoration only: hidden from assistive tech.
 * The colours come from `--awning-a` and `--awning-b`, so the band follows light and evening mode.
 */
export function AwningBand({
  className,
  ...props
}: Omit<ComponentProps<'div'>, 'children'>): ReactElement {
  return (
    <div
      aria-hidden="true"
      data-slot="awning-band"
      className={cn('awning h-6 w-full shrink-0', className)}
      {...props}
    />
  )
}
