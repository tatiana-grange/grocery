import {
  cartControllerAddLine,
  cartControllerCheckout,
  cartControllerGetCart,
  cartControllerRemoveLine,
  cartControllerUpdateLine,
} from '@grocery/openapi-generator/client/sdk.gen'
import type {
  CartControllerAddLineData,
  CartControllerUpdateLineData,
  CheckoutResult,
} from '@grocery/openapi-generator/client/types.gen'
import { unwrap } from '@/lib/api-client'

export type { CheckoutResult } from '@grocery/openapi-generator/client/types.gen'

export const checkout = async (): Promise<CheckoutResult> => unwrap(await cartControllerCheckout())

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
