import type { ReactNode } from 'react'

import { Button } from '@grocery/ui/components/primitives/button'
import { cn } from '@grocery/ui/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ListPaginationProps {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  /** Prefixes the test ids: `${testIdPrefix}-page-prev` / `-page-next` / `-page-indicator` / `-count`. */
  testIdPrefix: string
  /** Optional item-count text shown on the left; when set the row spreads instead of hugging the right. */
  count?: ReactNode
  className?: string
}

/** The prev / "{page} / {pageCount}" / next control shared by every paginated admin list. */
export function ListPagination({
  page,
  pageCount,
  onPageChange,
  testIdPrefix,
  count,
  className,
}: ListPaginationProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 text-sm text-muted-foreground',
        count == null ? 'justify-end' : 'justify-between',
        className,
      )}
    >
      {count != null && <span data-testid={`${testIdPrefix}-count`}>{count}</span>}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          data-testid={`${testIdPrefix}-page-prev`}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span data-testid={`${testIdPrefix}-page-indicator`}>
          {page} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="icon"
          data-testid={`${testIdPrefix}-page-next`}
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
