import { Logger } from '@nestjs/common'

export const HELLOASSO_SANDBOX_API_URL = 'https://api.helloasso-sandbox.com/v5'

/** The slice of the environment the online payment settings are read from. */
export interface PaymentsEnv {
  NODE_ENV: 'development' | 'test' | 'production'
  PAYMENT_PROVIDER?: 'helloasso' | 'fake'
  HELLOASSO_CLIENT_ID?: string
  HELLOASSO_CLIENT_SECRET?: string
  HELLOASSO_ORGANIZATION_SLUG?: string
  HELLOASSO_API_URL?: string
}

export interface HelloAssoConfig {
  clientId: string
  clientSecret: string
  organizationSlug: string
  apiUrl: string
}

export interface PaymentsConfig {
  provider: 'helloasso' | 'fake' | null
  helloasso: HelloAssoConfig | null
}

const REQUIRED_HELLOASSO_KEYS = [
  'HELLOASSO_CLIENT_ID',
  'HELLOASSO_CLIENT_SECRET',
  'HELLOASSO_ORGANIZATION_SLUG',
] as const

/**
 * Decides which payment provider the app runs with. It never throws, so the app always boots:
 * incomplete settings mean online payment is off, with one warning that names what is missing.
 *
 * `fake` is a test double. It is honoured everywhere except production, so a stray variable
 * can never make a real deployment accept pretend payments.
 */
export function resolvePaymentsConfig(env: PaymentsEnv): PaymentsConfig {
  const logger = new Logger('PaymentsConfig')
  const off: PaymentsConfig = { provider: null, helloasso: null }

  let requested = env.PAYMENT_PROVIDER
  if (requested === 'fake') {
    if (env.NODE_ENV === 'production') {
      logger.warn('PAYMENT_PROVIDER=fake is ignored in production.')
      requested = undefined
    } else {
      return { provider: 'fake', helloasso: null }
    }
  }

  const missing = REQUIRED_HELLOASSO_KEYS.filter((key) => !env[key])
  if (missing.length === 0) {
    return {
      provider: 'helloasso',
      helloasso: {
        clientId: env.HELLOASSO_CLIENT_ID as string,
        clientSecret: env.HELLOASSO_CLIENT_SECRET as string,
        organizationSlug: env.HELLOASSO_ORGANIZATION_SLUG as string,
        apiUrl: env.HELLOASSO_API_URL || HELLOASSO_SANDBOX_API_URL,
      },
    }
  }

  const nothingSet = missing.length === REQUIRED_HELLOASSO_KEYS.length
  if (!(nothingSet && requested === undefined)) {
    logger.warn(`Online payment is off: missing ${missing.join(', ')}.`)
  }
  return off
}
