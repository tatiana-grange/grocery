import { afterEach, describe, expect, it, vi } from 'vitest'
import { Logger } from '@nestjs/common'
import { resolvePaymentsConfig, type PaymentsEnv } from './payments.config'

const HELLOASSO_COMPLETE = {
  HELLOASSO_CLIENT_ID: 'client-id',
  HELLOASSO_CLIENT_SECRET: 'client-secret',
  HELLOASSO_ORGANIZATION_SLUG: 'my-coop',
  HELLOASSO_API_URL: 'https://api.helloasso-sandbox.com/v5',
}

function env(overrides: Partial<PaymentsEnv> = {}): PaymentsEnv {
  return { NODE_ENV: 'development', ...overrides }
}

describe('resolvePaymentsConfig', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('is disabled when nothing is set, without a warning', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})

    expect(resolvePaymentsConfig(env())).toEqual({ provider: null, helloasso: null })
    expect(warn).not.toHaveBeenCalled()
  })

  it('enables helloasso when client id, secret and slug are all present', () => {
    const result = resolvePaymentsConfig(env(HELLOASSO_COMPLETE))

    expect(result).toEqual({
      provider: 'helloasso',
      helloasso: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        organizationSlug: 'my-coop',
        apiUrl: 'https://api.helloasso-sandbox.com/v5',
      },
    })
  })

  it('also enables helloasso when the provider is named explicitly', () => {
    const result = resolvePaymentsConfig(
      env({ ...HELLOASSO_COMPLETE, PAYMENT_PROVIDER: 'helloasso' }),
    )

    expect(result.provider).toBe('helloasso')
  })

  it('is disabled with one warning that names the missing variables on a partial set', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})

    const result = resolvePaymentsConfig(
      env({
        HELLOASSO_CLIENT_ID: 'client-id',
        HELLOASSO_API_URL: HELLOASSO_COMPLETE.HELLOASSO_API_URL,
      }),
    )

    expect(result).toEqual({ provider: null, helloasso: null })
    expect(warn).toHaveBeenCalledTimes(1)
    const message = String(warn.mock.calls[0]?.[0])
    expect(message).toContain('HELLOASSO_CLIENT_SECRET')
    expect(message).toContain('HELLOASSO_ORGANIZATION_SLUG')
    expect(message).not.toContain('HELLOASSO_CLIENT_ID')
  })

  it('is disabled with a warning when helloasso is named but nothing else is set', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})

    const result = resolvePaymentsConfig(env({ PAYMENT_PROVIDER: 'helloasso' }))

    expect(result.provider).toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('never throws on a partial set', () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
    expect(() => resolvePaymentsConfig(env({ HELLOASSO_CLIENT_SECRET: 'only-this' }))).not.toThrow()
  })

  it('honours fake under NODE_ENV=test', () => {
    const result = resolvePaymentsConfig(env({ NODE_ENV: 'test', PAYMENT_PROVIDER: 'fake' }))

    expect(result).toEqual({ provider: 'fake', helloasso: null })
  })

  it('ignores fake under production and logs a warning', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})

    const result = resolvePaymentsConfig(env({ NODE_ENV: 'production', PAYMENT_PROVIDER: 'fake' }))

    expect(result).toEqual({ provider: null, helloasso: null })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('fake'))
  })

  it('falls back to helloasso when fake is ignored in production and the set is complete', () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})

    const result = resolvePaymentsConfig(
      env({ ...HELLOASSO_COMPLETE, NODE_ENV: 'production', PAYMENT_PROVIDER: 'fake' }),
    )

    expect(result.provider).toBe('helloasso')
  })
})
