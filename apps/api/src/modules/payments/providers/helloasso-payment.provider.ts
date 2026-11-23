import type { HelloAssoConfig } from '../../../config/payments.config'
import {
  type CreatedPaymentRequest,
  type CreatePaymentRequestInput,
  type PaymentProvider,
  PaymentProviderError,
  type PaymentResult,
} from './payment-provider'

const REQUEST_TIMEOUT_MS = 10_000
const TOKEN_MARGIN_MS = 60_000
/** The HelloAsso docs say the redirect URL is valid 15 minutes. The answer carries no expiry. */
const REQUEST_VALIDITY_MS = 15 * 60 * 1000
const ITEM_NAME_MAX = 250

interface CachedToken {
  value: string
  expiresAt: number
}

/**
 * HelloAsso Checkout. The field names and states used below come from the HelloAsso developer
 * pages (see the research file of the slice), not from a live sandbox answer. The two mapping
 * functions at the bottom are the only place that knows those names.
 *
 * HelloAsso requires https for the three return URLs. The code does not check it: a real run
 * needs an https address for the web app.
 */
export class HelloAssoPaymentProvider implements PaymentProvider {
  readonly isEnabled = true

  private token: CachedToken | null = null

  constructor(private readonly config: HelloAssoConfig) {}

  async createPaymentRequest(input: CreatePaymentRequestInput): Promise<CreatedPaymentRequest> {
    const answer = await this.call('POST', this.intentsUrl(), {
      totalAmount: input.amountCents,
      initialAmount: input.amountCents,
      itemName: input.description.slice(0, ITEM_NAME_MAX),
      backUrl: input.backUrl,
      errorUrl: input.errorUrl,
      returnUrl: input.returnUrl,
      containsDonation: false,
      metadata: { topupId: input.topupId },
    })
    return mapCreateAnswer(answer)
  }

  async getPaymentResult(providerRequestId: string): Promise<PaymentResult> {
    const answer = await this.call(
      'GET',
      `${this.intentsUrl()}/${encodeURIComponent(providerRequestId)}`,
    )
    return mapReadAnswer(answer)
  }

  private intentsUrl(): string {
    const base = this.config.apiUrl.replace(/\/+$/, '')
    return `${base}/organizations/${encodeURIComponent(this.config.organizationSlug)}/checkout-intents`
  }

  /** The token URL is on the same host as the API, at /oauth2/token (not under /v5). */
  private tokenUrl(): string {
    return `${new URL(this.config.apiUrl).origin}/oauth2/token`
  }

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt - TOKEN_MARGIN_MS) return this.token.value
    const response = await this.send(this.tokenUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'client_credentials',
      }).toString(),
    })
    if (!response.ok) {
      throw new PaymentProviderError(`HelloAsso token request failed (${response.status})`)
    }
    const body = (await this.readJson(response)) as { access_token?: unknown; expires_in?: unknown }
    if (typeof body.access_token !== 'string' || typeof body.expires_in !== 'number') {
      throw new PaymentProviderError('HelloAsso token answer is not usable')
    }
    this.token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 }
    return body.access_token
  }

  /** Calls the API with the token. On a 401 it drops the token and retries once. */
  private async call(method: 'GET' | 'POST', url: string, payload?: unknown): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      const token = await this.getToken()
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
      if (payload !== undefined) headers['Content-Type'] = 'application/json'
      const response = await this.send(url, {
        method,
        headers,
        body: payload === undefined ? undefined : JSON.stringify(payload),
      })
      if (response.status === 401 && attempt === 0) {
        this.token = null
        continue
      }
      if (!response.ok) {
        throw new PaymentProviderError(`HelloAsso answered ${response.status} on ${method} ${url}`)
      }
      return this.readJson(response)
    }
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    } catch (cause) {
      throw new PaymentProviderError('HelloAsso could not be reached', { cause })
    }
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return await response.json()
    } catch (cause) {
      throw new PaymentProviderError('HelloAsso answer is not JSON', { cause })
    }
  }
}

function mapCreateAnswer(answer: unknown): CreatedPaymentRequest {
  const { id, redirectUrl } = (answer ?? {}) as { id?: unknown; redirectUrl?: unknown }
  if ((typeof id !== 'number' && typeof id !== 'string') || typeof redirectUrl !== 'string') {
    throw new PaymentProviderError('HelloAsso creation answer is not usable')
  }
  return {
    providerRequestId: String(id),
    redirectUrl,
    expiresAt: new Date(Date.now() + REQUEST_VALIDITY_MS),
  }
}

interface HelloAssoPayment {
  id?: number | string
  amount?: number
  state?: string
}

/** Payment states that mean no money is coming (HelloAsso payment states page). */
const DEAD_END_STATES = ['Refused', 'Refunded', 'Refunding', 'Contested']

function mapReadAnswer(answer: unknown): PaymentResult {
  const order = (answer as { order?: { payments?: HelloAssoPayment[] } } | null)?.order
  // HelloAsso returns an order only once a payment was authorized. No order means pending.
  if (!order) return { status: 'pending' }
  const payments = order.payments ?? []

  const authorized = payments.find((payment) => payment.state === 'Authorized')
  if (authorized) {
    if (authorized.id === undefined || typeof authorized.amount !== 'number') {
      throw new PaymentProviderError('HelloAsso payment answer is not usable')
    }
    return {
      status: 'paid',
      providerPaymentId: String(authorized.id),
      paidAmountCents: authorized.amount,
    }
  }

  // `failed` is final in the service, so only states the documentation names as a dead end
  // may lead there. Any other state, known or not, stays pending and is asked about again.
  const states = payments.map((payment) => payment.state ?? '')
  const isDeadEnd = states.length > 0 && states.every((state) => DEAD_END_STATES.includes(state))
  return { status: isDeadEnd ? 'failed' : 'pending' }
}
