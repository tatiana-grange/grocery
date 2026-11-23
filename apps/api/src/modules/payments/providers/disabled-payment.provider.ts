import {
  type CreatedPaymentRequest,
  type PaymentProvider,
  PaymentProviderError,
  type PaymentResult,
} from './payment-provider'

/**
 * Used when no provider is configured. The service checks `isEnabled` first, so these methods
 * are never reached in normal flow.
 */
export class DisabledPaymentProvider implements PaymentProvider {
  readonly isEnabled = false

  createPaymentRequest(): Promise<CreatedPaymentRequest> {
    return Promise.reject(new PaymentProviderError('Online payment is not configured'))
  }

  getPaymentResult(): Promise<PaymentResult> {
    return Promise.reject(new PaymentProviderError('Online payment is not configured'))
  }
}
