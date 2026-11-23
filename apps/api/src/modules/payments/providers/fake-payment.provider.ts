import {
  type CreatedPaymentRequest,
  type CreatePaymentRequestInput,
  type PaymentProvider,
  PaymentProviderError,
  type PaymentResult,
} from './payment-provider'

const REQUEST_VALIDITY_MS = 15 * 60 * 1000

/**
 * In-memory provider for unit tests, controller tests and the Playwright run. A request starts
 * as `pending`; a test decides its outcome with `settle`. It returns the return URL as the
 * redirect URL, so the browser lands on our return page as a real payer would after paying.
 */
export class FakePaymentProvider implements PaymentProvider {
  readonly isEnabled = true

  private requests: CreatePaymentRequestInput[] = []
  private results = new Map<string, PaymentResult>()
  private failNextCall: Error | null = null

  async createPaymentRequest(input: CreatePaymentRequestInput): Promise<CreatedPaymentRequest> {
    this.throwIfBroken()
    const providerRequestId = `fake-request-${this.requests.length + 1}`
    this.requests.push(input)
    this.results.set(providerRequestId, { status: 'pending' })
    return {
      providerRequestId,
      redirectUrl: input.returnUrl,
      expiresAt: new Date(Date.now() + REQUEST_VALIDITY_MS),
    }
  }

  async getPaymentResult(providerRequestId: string): Promise<PaymentResult> {
    this.throwIfBroken()
    const result = this.results.get(providerRequestId)
    if (!result) throw new PaymentProviderError(`Unknown fake request ${providerRequestId}`)
    return result
  }

  /** Test control: decide the outcome of a request. Without an id, the latest request. */
  settle(result: PaymentResult, providerRequestId?: string): void {
    const id = providerRequestId ?? this.lastProviderRequestId()
    if (!id) throw new Error('No fake payment request to settle')
    this.results.set(id, result)
  }

  /** Test control: what the provider was asked to create last. */
  lastRequest(): CreatePaymentRequestInput | undefined {
    return this.requests[this.requests.length - 1]
  }

  lastProviderRequestId(): string | undefined {
    return this.requests.length > 0 ? `fake-request-${this.requests.length}` : undefined
  }

  /** Test control: the next call, create or read, throws a provider error. */
  breakNextCall(): void {
    this.failNextCall = new PaymentProviderError('The fake provider is down')
  }

  reset(): void {
    this.requests = []
    this.results.clear()
    this.failNextCall = null
  }

  private throwIfBroken(): void {
    if (!this.failNextCall) return
    const error = this.failNextCall
    this.failNextCall = null
    throw error
  }
}
