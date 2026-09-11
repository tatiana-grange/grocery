import { ListPagination } from '@grocery/ui/components/app'
import { Badge } from '@grocery/ui/components/primitives/badge'
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
import { PlusCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CATALOG_PAGE_SIZE, productsQueryOptions } from '@/features/catalog/utils/catalog-queries'
import { useDebouncedSearch } from '@/hooks/use-debounced-search'
import { useListSearchParams } from '@/hooks/use-list-search-params'

export function ProductsTab() {
  const { t } = useTranslation()
  const { searchParams, page, updateParams } = useListSearchParams()
  const committedSearch = searchParams.get('q') ?? ''
  const { search, setSearch, flushSearch } = useDebouncedSearch(committedSearch, (value) =>
    updateParams({ q: value, page: undefined }, { replace: true }),
  )

  const { data, isLoading } = useQuery(
    productsQueryOptions({ page, search: committedSearch || undefined }),
  )

  const total = data?.meta.itemCount ?? 0
  const pageCount = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Input
          className="w-64"
          data-testid="products-search"
          placeholder={t('catalog.products.searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') flushSearch()
          }}
        />
        <Button data-testid="products-new" render={<Link to="/admin/catalog/products/new" />}>
          <PlusCircle className="mr-2 size-4" />
          {t('catalog.products.new')}
        </Button>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('catalog.products.name')}</TableHead>
              <TableHead>{t('catalog.products.supplier')}</TableHead>
              <TableHead>{t('catalog.products.category')}</TableHead>
              <TableHead>{t('catalog.products.price')}</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.data.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-muted-foreground"
                  data-testid="products-empty"
                >
                  {t('catalog.products.empty')}
                </TableCell>
              </TableRow>
            )}
            {data?.data.map((product) => (
              <TableRow key={product.id} data-testid={`product-row-${product.name}`}>
                <TableCell className="font-medium">
                  {product.name}
                  {product.saleMode === 'weight' && (
                    <Badge variant="outline" className="ml-2">
                      {t('catalog.perKg')}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{product.supplier.name}</TableCell>
                <TableCell className="text-muted-foreground">{product.category.name}</TableCell>
                <TableCell>
                  {product.currentPriceEur != null
                    ? `${product.currentPriceEur.toFixed(2)} € / ${t(
                        `catalog.pricingUnit.${product.pricingUnit}`,
                      )}`
                    : '—'}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid="product-row-open"
                    render={<Link to={`/admin/catalog/products/${product.id}`} />}
                  >
                    {t('catalog.open')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ListPagination
        page={page}
        pageCount={pageCount}
        onPageChange={(next) => updateParams({ page: String(next) })}
        testIdPrefix="products"
        count={t('catalog.products.count', { count: total })}
      />
    </div>
  )
}
