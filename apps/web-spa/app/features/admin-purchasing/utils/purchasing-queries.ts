import {
  adminPurchasingControllerClose,
  adminPurchasingControllerExport,
  adminPurchasingControllerGet,
  adminPurchasingControllerList,
  adminPurchasingControllerRecordReception,
  adminPurchasingControllerSend,
  adminSupplierPurchasingControllerAggregate,
} from '@grocery/openapi-generator/client/sdk.gen'
import type { AdminPurchasingControllerRecordReceptionData } from '@grocery/openapi-generator/client/types.gen'
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

export const sendSupplierOrder = async (id: string, version: number) =>
  unwrap(await adminPurchasingControllerSend({ path: { id }, body: { version } }))

export const closeSupplierOrder = async (id: string, version: number) =>
  unwrap(await adminPurchasingControllerClose({ path: { id }, body: { version } }))

type RecordReceptionBody = AdminPurchasingControllerRecordReceptionData['body']

export const recordReception = async (id: string, body: RecordReceptionBody) =>
  unwrap(await adminPurchasingControllerRecordReception({ path: { id }, body }))

/** Fetches the CSV summary and hands it to the browser as a download. */
export async function downloadSupplierOrderExport(id: string) {
  const { filename, content } = unwrap(await adminPurchasingControllerExport({ path: { id } }))
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
