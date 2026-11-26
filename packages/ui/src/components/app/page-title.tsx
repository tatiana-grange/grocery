import type { ComponentProps } from 'react'

import { cn } from '@grocery/ui/lib/utils'

/** The `<h1>` at the top of a page. Keeps the page-title type scale in one place. */
function PageTitle({ className, children, ...props }: ComponentProps<'h1'>) {
  return (
    <h1 className={cn('font-serif text-3xl font-bold tracking-tight', className)} {...props}>
      {children}
    </h1>
  )
}

/** A serif `<h2>` that labels a section within a page. */
function SectionTitle({ className, children, ...props }: ComponentProps<'h2'>) {
  return (
    <h2 className={cn('font-serif text-xl font-semibold text-foreground', className)} {...props}>
      {children}
    </h2>
  )
}

export { PageTitle, SectionTitle }
