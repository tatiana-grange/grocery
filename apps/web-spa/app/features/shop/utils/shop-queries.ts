import {
  shopCatalogControllerGetProduct,
  shopCatalogControllerListCategories,
  shopCatalogControllerListProducts,
} from '@grocery/openapi-generator/client/sdk.gen'
import type {
  ShopCatalogControllerListProductsData,
  ShopCatalogControllerListProductsSortItem,
} from '@grocery/openapi-generator/client/types.gen'
import { FilterRule } from '@lonestone/nzoth/client'
import { unwrap } from '@/lib/api-client'

export const SHOP_PAGE_SIZE = 36

type ShopProductFilter = NonNullable<
  ShopCatalogControllerListProductsData['query']['filter']
>[number]

export function shopCategoriesQueryOptions() {
  return {
    queryKey: ['shop', 'categories'],
    queryFn: async () => unwrap(await shopCatalogControllerListCategories()),
  }
}

export interface ShopProductsParams {
  search?: string
  categoryId?: string
  sort?: ShopCatalogControllerListProductsSortItem['property']
  direction?: ShopCatalogControllerListProductsSortItem['direction']
}

/**
 * The shop list loads more rows in place ("Show more") rather than paging: each fetched
 * page is one `SHOP_PAGE_SIZE` slice, `getNextPageParam` returns the next offset until the
 * accumulated rows reach `meta.itemCount`. Changing a filter changes the query key, so the
 * accumulated pages reset on their own.
 */
export function shopProductsInfiniteQueryOptions(params: ShopProductsParams) {
  const filter: ShopProductFilter[] = []
  if (params.search) filter.push({ property: 'q', rule: FilterRule.LIKE, value: params.search })
  if (params.categoryId) {
    filter.push({ property: 'categoryId', rule: FilterRule.EQUALS, value: params.categoryId })
  }
  const sort = params.sort
    ? [{ property: params.sort, direction: params.direction ?? 'asc' }]
    : undefined

  return {
    queryKey: [
      'shop',
      'products',
      params.search ?? '',
      params.categoryId ?? '',
      params.sort ?? '',
      params.direction ?? '',
    ],
    initialPageParam: 0,
    queryFn: async ({ pageParam }: { pageParam: number }) =>
      unwrap(
        await shopCatalogControllerListProducts({
          query: {
            offset: pageParam * SHOP_PAGE_SIZE,
            pageSize: SHOP_PAGE_SIZE,
            filter,
            sort,
          },
        }),
      ),
    getNextPageParam: (
      lastPage: { data: unknown[]; meta: { itemCount: number } },
      allPages: { data: unknown[] }[],
    ) => {
      const loaded = allPages.reduce((sum, current) => sum + current.data.length, 0)
      return loaded < lastPage.meta.itemCount ? allPages.length : undefined
    },
  }
}

export function shopProductDetailQueryOptions(id: string) {
  return {
    queryKey: ['shop', 'products', 'detail', id],
    queryFn: async () => unwrap(await shopCatalogControllerGetProduct({ path: { id } })),
    enabled: Boolean(id),
  }
}
