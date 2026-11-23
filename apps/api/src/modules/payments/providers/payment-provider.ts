/** Injection token of the payment provider seam. */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER')

export interface CreatePaymentRequestInput {
  /** Our id, sent as the provider's own reference when it allows one. */
  topupId: string
  /** The requested amount, an integer. */
  amountCents: number
  /** Shown to the payer, for example "Rechargement du compte". */
  description: string
  returnUrl: string
  backUrl: string
  errorUrl: string
}

export interface CreatedPaymentRequest {
  /** The provider's id for the request (the checkout intent id). */
  providerRequestId: string
  /** Where to send the payer. */
  redirectUrl: string
  /** How long the provider keeps the request valid. */
  expiresAt: Date
}

export type PaymentResult =
  | { status: 'pending' }
  | { status: 'failed' }
  | { status: 'paid'; providerPaymentId: string; paidAmountCents: number }

export interface PaymentProvider {
  readonly isEnabled: boolean
  createPaymentRequest(input: CreatePaymentRequestInput): Promise<CreatedPaymentRequest>
  getPaymentResult(providerRequestId: string): Promise<PaymentResult>
}

/** Thrown by a provider on a network failure or an answer it cannot use. */
export class PaymentProviderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'PaymentProviderError'
  }
}
