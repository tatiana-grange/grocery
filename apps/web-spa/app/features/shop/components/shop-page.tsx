import { EmptyState } from '@grocery/ui/components/app'
import { Button } from '@grocery/ui/components/primitives/button'
import { Input } from '@grocery/ui/components/primitives/input'
import { Skeleton } from '@grocery/ui/components/primitives/skeleton'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { PackageSearch } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CategoryRail, CategoryRailSheet } from '@/features/shop/components/category-rail'
import { ProductCard } from '@/features/shop/components/product-card'
import { ShopViewToggle } from '@/features/shop/components/shop-view-toggle'
import { useShopView } from '@/features/shop/hooks/use-shop-view'
import {
  shopCategoriesQueryOptions,
  shopProductsInfiniteQueryOptions,
} from '@/features/shop/utils/shop-queries'
import { useListSearchParams } from '@/hooks/use-list-search-params'

const SORT_OPTIONS = [
  { value: 'name:asc', property: 'name' as const, direction: 'asc' as const },
  { value: 'createdAt:desc', property: 'createdAt' as const, direction: 'desc' as const },
]

const LAYOUT_BY_VIEW = {
  large: 'grid grid-cols-2 gap-4 sm:grid-cols-3',
  compact: 'grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5',
  list: 'flex flex-col gap-2',
} as const

export default function ShopPage() {
  const { t } = useTranslation()
  const { searchParams, updateParams } = useListSearchParams()
  const categoryId = searchParams.get('categoryId') ?? undefined
  const sortValue = searchParams.get('sort') ?? 'name:asc'
  const sortOption = SORT_OPTIONS.find((option) => option.value === sortValue) ?? SORT_OPTIONS[0]!
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [view, setView] = useShopView()
  const layoutClass = LAYOUT_BY_VIEW[view]

  const { data: categories } = useQuery(shopCategoriesQueryOptions())
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery(
    shopProductsInfiniteQueryOptions({
      search: searchParams.get('q') ?? undefined,
      categoryId,
      sort: sortOption.property,
      direction: sortOption.direction,
    }),
  )

  const products = data?.pages.flatMap((entry) => entry.data) ?? []
  const total = data?.pages[0]?.meta.itemCount ?? 0
  const hasCategories = Boolean(categories && categories.length > 0)
  const onSelectCategory = (value?: string) => updateParams({ categoryId: value })

  // Load the next slice as its anchor scrolls into view, so reaching the bottom is enough —
  // the button below stays as an explicit fallback (keyboard, observer not yet fired).
  const loadMoreRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const anchor = loadMoreRef.current
    if (!anchor || !hasNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) fetchNextPage()
      },
      { rootMargin: '600px 0px' },
    )
    observer.observe(anchor)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div className="space-y-6" data-testid="page-shop">
      <div>
        <h1 className="text-2xl font-black tracking-tight" data-testid="shop-title">
          {t('shop.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('shop.subtitle')}</p>
      </div>

      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        {hasCategories && (
          <aside className="hidden self-start lg:sticky lg:top-6 lg:block">
            <p className="mb-2 px-2 text-xs font-medium tracking-widest text-muted-foreground uppercase">
              {t('shop.categories.heading')}
            </p>
            <CategoryRail
              categories={categories!}
              selectedCategoryId={categoryId}
              onSelect={onSelectCategory}
            />
          </aside>
        )}

        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            {hasCategories && (
              <div className="lg:hidden">
                <CategoryRailSheet
                  categories={categories!}
                  selectedCategoryId={categoryId}
                  onSelect={onSelectCategory}
                />
              </div>
            )}
            <Input
              className="w-full sm:w-64"
              data-testid="shop-search"
              placeholder={t('shop.searchPlaceholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') updateParams({ q: search || undefined })
              }}
            />
            <div className="ml-auto flex items-center gap-2">
              <ShopViewToggle view={view} onChange={setView} />
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                data-testid="shop-sort"
                value={sortValue}
                onChange={(event) => updateParams({ sort: event.target.value })}
              >
                <option value="name:asc">{t('shop.sort.nameAsc')}</option>
                <option value="createdAt:desc">{t('shop.sort.newest')}</option>
              </select>
            </div>
          </div>

          {!isLoading && products.length > 0 && (
            <div className="border-b border-border pb-3">
              <span className="text-sm text-muted-foreground" data-testid="shop-count">
                {t('shop.count', { count: total })}
              </span>
            </div>
          )}

          {isLoading && (
            <div className={layoutClass}>
              {Array.from({ length: 9 }, (_, index) => (
                <Skeleton
                  key={`shop-skeleton-${index}`}
                  className={view === 'list' ? 'h-20 w-full' : 'aspect-square w-full'}
                />
              ))}
            </div>
          )}

          {!isLoading && products.length === 0 && (
            <div data-testid="shop-empty">
              <EmptyState
                icon={<PackageSearch className="size-6 text-muted-foreground" />}
                title={t('shop.empty')}
              />
            </div>
          )}

          {!isLoading && products.length > 0 && (
            <div className={layoutClass} data-testid="shop-product-grid" data-view={view}>
              {products.map((product) => (
                <ProductCard key={product.id} product={product} view={view} />
              ))}
            </div>
          )}

          {!isLoading && products.length > 0 && (
            <div ref={loadMoreRef} className="flex flex-col items-center gap-3 py-8">
              {hasNextPage && (
                <Button
                  variant="outline"
                  data-testid="shop-load-more"
                  disabled={isFetchingNextPage}
                  onClick={() => fetchNextPage()}
                >
                  {t('shop.pagination.loadMore')}
                </Button>
              )}
              <span className="text-xs text-muted-foreground tabular-nums">
                {t('shop.pagination.showing', { shown: products.length, total })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
