import type { ReactElement, ReactNode } from 'react'

import { PageTitle } from '@grocery/ui/components/app'

interface BackOfficePageHeadProps {
  title: ReactNode
  description?: ReactNode
  /** `BackOfficeFigureCard`s shown on the right of the title. */
  figures?: ReactNode
  /** Buttons shown on the right of the title. */
  actions?: ReactNode
  /** Forwarded to the title (the product detail page keeps `product-detail-name`). */
  titleTestId?: string
}

/** The head of a back office page: Lora title, its explanation, figure cards, page actions. */
export function BackOfficePageHead({
  title,
  description,
  figures,
  actions,
  titleTestId,
}: BackOfficePageHeadProps): ReactElement {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div>
        <PageTitle className="text-[3.25rem] leading-[1.1]" data-testid={titleTestId}>
          {title}
        </PageTitle>
        {description != null && (
          <p className="mt-2 max-w-3xl text-lg text-muted-foreground">{description}</p>
        )}
      </div>
      {(figures != null || actions != null) && (
        <div className="flex flex-wrap items-center gap-3">
          {figures != null && <div className="flex flex-wrap gap-3">{figures}</div>}
          {actions != null && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
    </header>
  )
}
