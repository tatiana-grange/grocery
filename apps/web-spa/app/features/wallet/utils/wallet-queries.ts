import {
  memberTopupControllerGet,
  memberTopupControllerGetOptions,
  memberTopupControllerStart,
  memberTopupControllerVerify,
  memberWalletControllerGetOwnWallet,
  staffWalletControllerCorrectPayment,
  staffWalletControllerGetWallet,
  staffWalletControllerRecordPayment,
  staffWalletControllerRecordRefund,
} from '@grocery/openapi-generator/client/sdk.gen'
import type {
  CorrectPaymentInput,
  RecordPaymentInput,
  RefundInput,
} from '@grocery/openapi-generator/client/types.gen'
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

/**
 * Reverses a payment recorded by mistake. Resolves with the member's updated wallet, which may
 * now be below zero.
 */
export async function correctPayment(memberId: string, entryId: string, body: CorrectPaymentInput) {
  return unwrap(
    await staffWalletControllerCorrectPayment({ path: { memberId, entryId }, body, query: page }),
  )
}

/**
 * Records money given back to a member (admin only). Resolves with the member's updated wallet.
 * Nothing is sent to the payment provider: the admin gives the money back by hand.
 */
export async function recordRefund(memberId: string, body: RefundInput) {
  return unwrap(await staffWalletControllerRecordRefund({ path: { memberId }, body, query: page }))
}

/** Whether online top-up is on, and the amounts the form offers. */
export function topupOptionsQueryOptions() {
  return {
    queryKey: ['wallet', 'topup-options'],
    queryFn: async () => unwrap(await memberTopupControllerGetOptions()),
  }
}

/** Starts an online top-up. Resolves with the top-up, whose `redirectUrl` is where to send the payer. */
export async function startTopup(amountEur: number) {
  return unwrap(await memberTopupControllerStart({ body: { amountEur } }))
}

/** Asks the provider for the result and credits the account if it was paid. */
export async function verifyTopup(topupId: string) {
  return unwrap(await memberTopupControllerVerify({ path: { topupId } }))
}

/** The stored state of one top-up. It asks nobody. */
export function topupQueryOptions(topupId: string) {
  return {
    queryKey: ['topup', topupId],
    queryFn: async () => unwrap(await memberTopupControllerGet({ path: { topupId } })),
  }
}
