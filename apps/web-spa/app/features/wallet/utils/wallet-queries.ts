import {
  memberWalletControllerGetOwnWallet,
  staffWalletControllerGetWallet,
  staffWalletControllerRecordPayment,
} from '@grocery/openapi-generator/client/sdk.gen'
import type { RecordPaymentInput } from '@grocery/openapi-generator/client/types.gen'
import { unwrap } from '@/lib/api-client'

export const WALLET_PAGE_SIZE = 20

const page = { offset: 0, pageSize: WALLET_PAGE_SIZE }

/** A member's account, as the distribution table sees it. */
export function staffWalletQueryOptions(memberId: string) {
  return {
    queryKey: ['wallet', 'staff', memberId],
    queryFn: async () =>
      unwrap(await staffWalletControllerGetWallet({ path: { memberId }, query: page })),
  }
}

/** The signed-in member's own account. There is no id to pass — that is the point. */
export function ownWalletQueryOptions() {
  return {
    queryKey: ['wallet', 'me'],
    queryFn: async () => unwrap(await memberWalletControllerGetOwnWallet({ query: page })),
  }
}

/**
 * Records money received. Resolves with the updated wallet, so a refused handover can be
 * retried without refetching anything (SC-011).
 */
export async function recordPayment(memberId: string, body: RecordPaymentInput) {
  return unwrap(await staffWalletControllerRecordPayment({ path: { memberId }, body, query: page }))
}
