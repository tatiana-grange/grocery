import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HelloAssoPaymentProvider } from '../providers/helloasso-payment.provider'
import { PaymentProviderError } from '../providers/payment-provider'

/**
 * The answers stubbed here come from the research file `01-online-topup.research.md`, which
 * reads the HelloAsso developer pages. They are not real sandbox answers. The live sandbox
 * check by the human is still open: if it differs, fix the provider and the answers below.
 */
const config = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  organizationSlug: 'my-asso',
  apiUrl: 'https://api.helloasso-sandbox.com/v5',
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const tokenAnswer = (token = 'token-1', expiresIn = 1799) =>
  jsonResponse({
    access_token: token,
    refresh_token: 'r',
    token_type: 'bearer',
    expires_in: expiresIn,
  })

const input = {
  topupId: 'topup-1',
  amountCents: 2500,
  description: 'Rechargement du compte',
  returnUrl: 'https://app.example/return',
  backUrl: 'https://app.example/back',
  errorUrl: 'https://app.example/error',
}

describe('HelloAssoPaymentProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let provider: HelloAssoPaymentProvider

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-23T10:00:00Z'))
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    provider = new HelloAssoPaymentProvider(config)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const readWith = async (answer: unknown) => {
    fetchMock.mockResolvedValueOnce(tokenAnswer()).mockResolvedValueOnce(jsonResponse(answer))
    return provider.getPaymentResult('42')
  }

  describe('token', () => {
    it('asks for a client-credentials token on the host root, as a form', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenAnswer())
        .mockResolvedValueOnce(jsonResponse({ id: 1, redirectUrl: 'https://pay' }))
      await provider.createPaymentRequest(input)

      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://api.helloasso-sandbox.com/oauth2/token')
      expect(init.method).toBe('POST')
      expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
      const body = new URLSearchParams(init.body as string)
      expect(body.get('client_id')).toBe('client-id')
      expect(body.get('client_secret')).toBe('client-secret')
      expect(body.get('grant_type')).toBe('client_credentials')
      expect(init.signal).toBeInstanceOf(AbortSignal)
    })

    it('keeps the token for the next call', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenAnswer())
        .mockResolvedValueOnce(jsonResponse({}))
        .mockResolvedValueOnce(jsonResponse({}))
      await provider.getPaymentResult('1')
      await provider.getPaymentResult('2')

      const tokenCalls = fetchMock.mock.calls.filter(([url]) =>
        String(url).endsWith('/oauth2/token'),
      )
      expect(tokenCalls).toHaveLength(1)
      expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer token-1')
    })

    it('asks for a new token one minute before the old one expires', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenAnswer('token-1', 1799))
        .mockResolvedValueOnce(jsonResponse({}))
        .mockResolvedValueOnce(tokenAnswer('token-2', 1799))
        .mockResolvedValueOnce(jsonResponse({}))
      await provider.getPaymentResult('1')
      vi.setSystemTime(new Date(Date.now() + (1799 - 59) * 1000))
      await provider.getPaymentResult('2')

      expect(fetchMock.mock.calls[3][1].headers.Authorization).toBe('Bearer token-2')
    })

    it('drops the token on a 401 and retries the call once', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenAnswer('token-1'))
        .mockResolvedValueOnce(jsonResponse({}, 401))
        .mockResolvedValueOnce(tokenAnswer('token-2'))
        .mockResolvedValueOnce(jsonResponse({}))
      await expect(provider.getPaymentResult('1')).resolves.toEqual({ status: 'pending' })
      expect(fetchMock.mock.calls[3][1].headers.Authorization).toBe('Bearer token-2')
    })

    it('gives up after a second 401', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenAnswer('token-1'))
        .mockResolvedValueOnce(jsonResponse({}, 401))
        .mockResolvedValueOnce(tokenAnswer('token-2'))
        .mockResolvedValueOnce(jsonResponse({}, 401))
      await expect(provider.getPaymentResult('1')).rejects.toBeInstanceOf(PaymentProviderError)
      expect(fetchMock).toHaveBeenCalledTimes(4)
    })
  })

  describe('createPaymentRequest', () => {
    it('posts the checkout intent and maps the answer', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenAnswer())
        .mockResolvedValueOnce(jsonResponse({ id: 123, redirectUrl: 'https://pay.example/x' }))
      const created = await provider.createPaymentRequest(input)

      const [url, init] = fetchMock.mock.calls[1]
      expect(url).toBe(
        'https://api.helloasso-sandbox.com/v5/organizations/my-asso/checkout-intents',
      )
      expect(init.method).toBe('POST')
      expect(init.headers['Content-Type']).toBe('application/json')
      expect(JSON.parse(init.body as string)).toEqual({
        totalAmount: 2500,
        initialAmount: 2500,
        itemName: 'Rechargement du compte',
        backUrl: input.backUrl,
        errorUrl: input.errorUrl,
        returnUrl: input.returnUrl,
        containsDonation: false,
        metadata: { topupId: 'topup-1' },
      })
      expect(created.providerRequestId).toBe('123')
      expect(created.redirectUrl).toBe('https://pay.example/x')
      expect(created.expiresAt).toEqual(new Date('2026-11-23T10:15:00Z'))
    })

    it('cuts the item name to 250 characters', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenAnswer())
        .mockResolvedValueOnce(jsonResponse({ id: 1, redirectUrl: 'https://pay' }))
      await provider.createPaymentRequest({ ...input, description: 'x'.repeat(300) })
      expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).itemName).toHaveLength(250)
    })

    it('fails when the answer has no redirect URL', async () => {
      fetchMock.mockResolvedValueOnce(tokenAnswer()).mockResolvedValueOnce(jsonResponse({ id: 1 }))
      await expect(provider.createPaymentRequest(input)).rejects.toBeInstanceOf(
        PaymentProviderError,
      )
    })

    it.each([400, 401, 403, 409])('maps a %i answer to a provider error', async (status) => {
      fetchMock.mockResolvedValue(jsonResponse({}, status))
      fetchMock.mockResolvedValueOnce(tokenAnswer())
      await expect(provider.createPaymentRequest(input)).rejects.toBeInstanceOf(
        PaymentProviderError,
      )
    })
  })

  describe('getPaymentResult', () => {
    it('reads the intent with a GET', async () => {
      await readWith({ id: 42 })
      const [url, init] = fetchMock.mock.calls[1]
      expect(url).toBe(
        'https://api.helloasso-sandbox.com/v5/organizations/my-asso/checkout-intents/42',
      )
      expect(init.method).toBe('GET')
    })

    it('is pending when there is no order', async () => {
      await expect(readWith({ id: 42, redirectUrl: 'https://pay' })).resolves.toEqual({
        status: 'pending',
      })
    })

    it('is paid when a payment is authorized', async () => {
      const order = { payments: [{ id: 999, amount: 2500, amountTip: 0, state: 'Authorized' }] }
      await expect(readWith({ id: 42, order })).resolves.toEqual({
        status: 'paid',
        providerPaymentId: '999',
        paidAmountCents: 2500,
      })
    })

    it('reports the larger amount when the payer added a contribution', async () => {
      const order = { payments: [{ id: 7, amount: 2750, amountTip: 250, state: 'Authorized' }] }
      await expect(readWith({ id: 42, order })).resolves.toEqual({
        status: 'paid',
        providerPaymentId: '7',
        paidAmountCents: 2750,
      })
    })

    it('is failed when every payment is refused', async () => {
      const order = { payments: [{ id: 1, amount: 2500, state: 'Refused' }] }
      await expect(readWith({ id: 42, order })).resolves.toEqual({ status: 'failed' })
    })

    it.each(['Pending', 'WaitingBankValidation', 'Registered', 'Unknow', 'ASomethingNew'])(
      'is pending when the payment is %s',
      async (state) => {
        const order = { payments: [{ id: 1, amount: 2500, state }] }
        await expect(readWith({ id: 42, order })).resolves.toEqual({ status: 'pending' })
      },
    )

    it.each(['Refunded', 'Refunding', 'Contested'])(
      'is failed when the payment is %s and none is authorized',
      async (state) => {
        const order = { payments: [{ id: 1, amount: 2500, state }] }
        await expect(readWith({ id: 42, order })).resolves.toEqual({ status: 'failed' })
      },
    )
  })

  describe('failures', () => {
    it('maps a network failure to a provider error', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'))
      await expect(provider.getPaymentResult('1')).rejects.toBeInstanceOf(PaymentProviderError)
    })

    it('maps a timeout to a provider error', async () => {
      fetchMock.mockRejectedValue(new DOMException('The operation timed out', 'TimeoutError'))
      await expect(provider.createPaymentRequest(input)).rejects.toBeInstanceOf(
        PaymentProviderError,
      )
    })

    it('maps a failed token request to a provider error', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'invalid_client' }, 400))
      await expect(provider.getPaymentResult('1')).rejects.toBeInstanceOf(PaymentProviderError)
    })

    it('maps a server error on read to a provider error', async () => {
      fetchMock.mockResolvedValueOnce(tokenAnswer()).mockResolvedValueOnce(jsonResponse({}, 500))
      await expect(provider.getPaymentResult('1')).rejects.toBeInstanceOf(PaymentProviderError)
    })
  })
})
