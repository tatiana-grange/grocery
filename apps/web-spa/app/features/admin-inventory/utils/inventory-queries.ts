import {
  inventoryControllerDetail,
  inventoryControllerList,
} from '@grocery/openapi-generator/client/sdk.gen'
import type { InventoryControllerListData } from '@grocery/openapi-generator/client/types.gen'
import { FilterRule } from '@lonestone/nzoth/client'
import { unwrap } from '@/lib/api-client'

export const STOCK_PAGE_SIZE = 20

type StockFilter = NonNullable<InventoryControllerListData['query']['filter']>[number]

export interface StockListParams {
  page: number
  search?: string
  categoryId?: string
}

export function stockListQueryOptions({ page, search, categoryId }: StockListParams) {
  return {
    queryKey: ['admin-inventory', 'stock', page, search ?? '', categoryId ?? ''],
    queryFn: async () => {
      const filter: StockFilter[] = [
        ...(search ? [{ property: 'search' as const, rule: FilterRule.LIKE, value: search }] : []),
        ...(categoryId
          ? [{ property: 'categoryId' as const, rule: FilterRule.EQUALS, value: categoryId }]
          : []),
      ]
      return unwrap(
        await inventoryControllerList({
          query: {
            offset: (page - 1) * STOCK_PAGE_SIZE,
            pageSize: STOCK_PAGE_SIZE,
            filter,
          },
        }),
      )
    },
  }
}

export function stockDetailQueryOptions(productId: string) {
  return {
    queryKey: ['admin-inventory', 'stock', 'detail', productId],
    queryFn: async () => unwrap(await inventoryControllerDetail({ path: { productId } })),
  }
}
