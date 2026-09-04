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

export const SHOP_PAGE_SIZE = 20

function unwrap<T>(response: { data?: T; error?: unknown }): T {
  if (response.error) throw response.error
  return response.data as T
}

type ShopProductFilter = NonNullable<ShopCatalogControllerListProductsData['query']['filter']>[number]

export function shopCategoriesQueryOptions() {
  return {
    queryKey: ['shop', 'categories'],
    queryFn: async () => unwrap(await shopCatalogControllerListCategories()),
  }
}

export interface ShopProductsParams {
  page: number
  search?: string
  categoryId?: string
  sort?: ShopCatalogControllerListProductsSortItem['property']
  direction?: ShopCatalogControllerListProductsSortItem['direction']
}

export function shopProductsQueryOptions(params: ShopProductsParams) {
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
      params.page,
      params.search ?? '',
      params.categoryId ?? '',
      params.sort ?? '',
      params.direction ?? '',
    ],
    queryFn: async () =>
      unwrap(
        await shopCatalogControllerListProducts({
          query: {
            offset: (params.page - 1) * SHOP_PAGE_SIZE,
            pageSize: SHOP_PAGE_SIZE,
            filter,
            sort,
          },
        }),
      ),
  }
}

export function shopProductDetailQueryOptions(id: string) {
  return {
    queryKey: ['shop', 'products', 'detail', id],
    queryFn: async () => unwrap(await shopCatalogControllerGetProduct({ path: { id } })),
    enabled: Boolean(id),
  }
}
