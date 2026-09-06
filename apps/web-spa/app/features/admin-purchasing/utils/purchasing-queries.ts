import {
  adminPurchasingControllerGet,
  adminPurchasingControllerList,
  adminSupplierPurchasingControllerAggregate,
} from '@grocery/openapi-generator/client/sdk.gen'
import type { AdminPurchasingControllerListData } from '@grocery/openapi-generator/client/types.gen'
import { FilterRule } from '@lonestone/nzoth/client'
import { unwrap } from '@/lib/api-client'

export const SUPPLIER_ORDERS_PAGE_SIZE = 20

type SupplierOrderFilter = NonNullable<AdminPurchasingControllerListData['query']['filter']>[number]

export interface SupplierOrdersListParams {
  page: number
  status?: string
  supplierId?: string
}

export function supplierOrdersListQueryOptions({
  page,
  status,
  supplierId,
}: SupplierOrdersListParams) {
  return {
    queryKey: ['admin-purchasing', 'supplier-orders', page, status ?? '', supplierId ?? ''],
    queryFn: async () => {
      const filter: SupplierOrderFilter[] = [
        ...(status
          ? [{ property: 'status' as const, rule: FilterRule.EQUALS, value: status }]
          : []),
        ...(supplierId
          ? [{ property: 'supplierId' as const, rule: FilterRule.EQUALS, value: supplierId }]
          : []),
      ]
      return unwrap(
        await adminPurchasingControllerList({
          query: {
            offset: (page - 1) * SUPPLIER_ORDERS_PAGE_SIZE,
            pageSize: SUPPLIER_ORDERS_PAGE_SIZE,
            filter,
          },
        }),
      )
    },
  }
}

export function supplierOrderDetailQueryOptions(id: string) {
  return {
    queryKey: ['admin-purchasing', 'supplier-orders', 'detail', id],
    queryFn: async () => unwrap(await adminPurchasingControllerGet({ path: { id } })),
  }
}

export const aggregateSupplierPreOrders = async (supplierId: string) =>
  unwrap(await adminSupplierPurchasingControllerAggregate({ path: { supplierId } }))
