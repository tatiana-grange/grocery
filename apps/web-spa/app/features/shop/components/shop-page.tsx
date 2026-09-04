import { EmptyState } from '@grocery/ui/components/app'
import { Button } from '@grocery/ui/components/primitives/button'
import { Input } from '@grocery/ui/components/primitives/input'
import { Skeleton } from '@grocery/ui/components/primitives/skeleton'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, PackageSearch } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { CategoryFilter } from '@/features/shop/components/category-filter'
import { ProductCard } from '@/features/shop/components/product-card'
import {
  SHOP_PAGE_SIZE,
  shopCategoriesQueryOptions,
  shopProductsQueryOptions,
} from '@/features/shop/utils/shop-queries'

const SORT_OPTIONS = [
  { value: 'name:asc', property: 'name' as const, direction: 'asc' as const },
  { value: 'createdAt:desc', property: 'createdAt' as const, direction: 'desc' as const },
]

export default function ShopPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const pageParam = Number(searchParams.get('page'))
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1
  const categoryId = searchParams.get('categoryId') ?? undefined
  const sortValue = searchParams.get('sort') ?? 'name:asc'
  const sortOption = SORT_OPTIONS.find((option) => option.value === sortValue) ?? SORT_OPTIONS[0]!
  const [search, setSearch] = useState(searchParams.get('q') ?? '')

  const { data: categories } = useQuery(shopCategoriesQueryOptions())
  const { data, isLoading } = useQuery(
    shopProductsQueryOptions({
      page,
      search: searchParams.get('q') ?? undefined,
      categoryId,
      sort: sortOption.property,
      direction: sortOption.direction,
    }),
  )

  const setParam = (key: string, value?: string) => {
    const params = new URLSearchParams(searchParams)
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete('page')
    setSearchParams(params)
  }

  const setPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', String(nextPage))
    setSearchParams(params)
  }

  const total = data?.meta.itemCount ?? 0
  const pageCount = Math.max(1, Math.ceil(total / SHOP_PAGE_SIZE))

  return (
    <div className="space-y-6" data-testid="page-shop">
      <div>
        <h1 className="text-2xl font-black tracking-tight">{t('shop.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('shop.subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          className="w-64"
          data-testid="shop-search"
          placeholder={t('shop.searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') setParam('q', search || undefined)
          }}
        />
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          data-testid="shop-sort"
          value={sortValue}
          onChange={(event) => setParam('sort', event.target.value)}
        >
          <option value="name:asc">{t('shop.sort.nameAsc')}</option>
          <option value="createdAt:desc">{t('shop.sort.newest')}</option>
        </select>
      </div>

      {categories && categories.length > 0 && (
        <CategoryFilter
          categories={categories}
          selectedCategoryId={categoryId}
          onSelect={(value) => setParam('categoryId', value)}
        />
      )}

      {isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={`shop-skeleton-${index}`} className="aspect-square w-full" />
          ))}
        </div>
      )}

      {!isLoading && data?.data.length === 0 && (
        <div data-testid="shop-empty">
          <EmptyState
            icon={<PackageSearch className="size-6 text-muted-foreground" />}
            title={t('shop.empty')}
          />
        </div>
      )}

      {!isLoading && data && data.data.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4" data-testid="shop-product-grid">
          {data.data.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span data-testid="shop-count">{t('shop.count', { count: total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            data-testid="shop-page-prev"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span data-testid="shop-page-indicator">
            {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            data-testid="shop-page-next"
            disabled={page >= pageCount}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
