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

function unwrap<T>(response: { data?: T; error?: unknown }): T {
  if (response.error) throw response.error
  return response.data as T
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
