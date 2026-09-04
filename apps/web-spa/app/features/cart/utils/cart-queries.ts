import {
  cartControllerAddLine,
  cartControllerGetCart,
  cartControllerRemoveLine,
  cartControllerUpdateLine,
} from '@grocery/openapi-generator/client/sdk.gen'
import type {
  CartControllerAddLineData,
  CartControllerUpdateLineData,
} from '@grocery/openapi-generator/client/types.gen'
import { client } from '@grocery/openapi-generator/client/client.gen'
import type { OrderingModeChoice } from '@grocery/openapi-generator/client/types.gen'

function unwrap<T>(response: { data?: T; error?: unknown }): T {
  if (response.error) throw response.error
  return response.data as T
}

// `POST /cart/checkout` isn't in the generated SDK yet — the checked-in client couldn't be
// regenerated cleanly while another in-progress catalog feature shares the same dev API
// (its uncommitted routes would leak into the generated file too). Hand-written against the
// same low-level client and the checkoutResultSchema shape; replace with the generated
// cartControllerCheckout call once a clean `pnpm generate` is possible.
export interface CheckoutOrderLine {
  id: string
  productName: string
  quantity: number
  unitPriceEur: number
  lineTotalEur: number
}

export interface CheckoutOrder {
  id: string
  orderingMode: OrderingModeChoice
  status: 'pending' | 'cancelled'
  totalEur: number
  placedAt: string
  cancelledAt: string | null
  version: number
  lines: CheckoutOrderLine[]
}

export interface CheckoutResult {
  orders: CheckoutOrder[]
  droppedLines: Array<{ productName: string; reason: string }>
}

export const checkout = async (): Promise<CheckoutResult> => {
  // Wrapped as a { 201: ... } status map, matching how RequestResult resolves TData for every
  // generated SDK call (TData[keyof TData]) — passing the plain shape would resolve to a union
  // of its property types instead.
  const response = await client.post<{ 201: CheckoutResult }>({ url: '/api/cart/checkout' })
  if (response.error) throw response.error
  return response.data as CheckoutResult
}

export function cartQueryOptions() {
  return {
    queryKey: ['cart'],
    queryFn: async () => unwrap(await cartControllerGetCart()),
  }
}

export const addCartLine = async (body: CartControllerAddLineData['body']) =>
  unwrap(await cartControllerAddLine({ body }))

export const updateCartLine = async (lineId: string, body: CartControllerUpdateLineData['body']) =>
  unwrap(await cartControllerUpdateLine({ path: { lineId }, body }))

export const removeCartLine = async (lineId: string) =>
  unwrap(await cartControllerRemoveLine({ path: { lineId } }))
