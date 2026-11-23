import { expect, request } from '@playwright/test'
import { E2E } from './env'

type FakePaymentResult =
  | { status: 'pending' }
  | { status: 'failed' }
  | { status: 'paid'; providerPaymentId: string; paidAmountCents: number }

async function post(path: string, data: object): Promise<void> {
  const context = await request.newContext({ baseURL: E2E.apiUrl })
  const response = await context.post(path, { data })
  expect(response.ok(), await response.text()).toBeTruthy()
  await context.dispose()
}

/**
 * Decides the outcome of a payment request held by the fake provider (the latest one when no
 * id is given), through `POST /api/test/payments/settle`.
 */
export async function settlePayment(
  result: FakePaymentResult,
  providerRequestId?: string,
): Promise<void> {
  await post('/api/test/payments/settle', { providerRequestId, result })
}

/** Sends the provider notification: the API checks its recent unfinished top-ups. */
export async function notifyPayment(): Promise<void> {
  await post('/api/test/payments/notify', {})
}
