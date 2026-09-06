import { Button } from '@grocery/ui/components/primitives/button'
import { Input } from '@grocery/ui/components/primitives/input'
import { Skeleton } from '@grocery/ui/components/primitives/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@grocery/ui/components/primitives/table'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import {
  STOCK_PAGE_SIZE,
  stockListQueryOptions,
} from '@/features/admin-inventory/utils/inventory-queries'
import { useListSearchParams } from '@/hooks/use-list-search-params'

export default function StockListPage() {
  const { t } = useTranslation()
  const { searchParams, page, updateParams } = useListSearchParams()
  const committedSearch = searchParams.get('q') ?? ''
  const [search, setSearch] = useState(committedSearch)

  const { data, isLoading } = useQuery(
    stockListQueryOptions({ page, search: committedSearch || undefined }),
  )

  const total = data?.meta.itemCount ?? 0
  const pageCount = Math.max(1, Math.ceil(total / STOCK_PAGE_SIZE))

  return (
    <div className="space-y-6" data-testid="page-stock-list">
      <div>
        <h1 className="text-2xl font-black tracking-tight">{t('inventory.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('inventory.subtitle')}</p>
      </div>

      <Input
        className="w-64"
        data-testid="stock-search"
        placeholder={t('inventory.searchPlaceholder')}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') updateParams({ q: search || undefined, page: undefined })
        }}
      />

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('inventory.columns.product')}</TableHead>
              <TableHead className="text-right">{t('inventory.columns.onHand')}</TableHead>
              <TableHead className="text-right">{t('inventory.columns.costPrice')}</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && data?.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  {t('inventory.empty')}
                </TableCell>
              </TableRow>
            )}

            {data?.data.map((row) => (
              <TableRow key={row.product.id} data-testid={`stock-row-${row.product.name}`}>
                <TableCell className="font-medium">{row.product.name}</TableCell>
                <TableCell className="text-right tabular-nums" data-testid="stock-row-on-hand">
                  {row.quantityOnHand}
                </TableCell>
                <TableCell className="text-right tabular-nums" data-testid="stock-row-cost">
                  {row.costPriceEur == null
                    ? t('inventory.noCostPrice')
                    : t('inventory.costValue', { value: row.costPriceEur.toFixed(2) })}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid="stock-row-open"
                    render={<Link to={`/admin/inventory/products/${row.product.id}`} />}
                  >
                    {t('inventory.open')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
        <Button
          variant="outline"
          size="icon"
          disabled={page <= 1}
          onClick={() => updateParams({ page: String(page - 1) })}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span data-testid="stock-page-indicator">
          {page} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="icon"
          disabled={page >= pageCount}
          onClick={() => updateParams({ page: String(page + 1) })}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
