import * as Sentry from '@sentry/nestjs'
import { config } from './config/env.config'

const sentryConfig: Sentry.NodeOptions = {
  // Uncomment this to enable debug mode (which is REALLY verbose)
  // debug: config.env !== 'production',

  environment: config.env,
  release: config.version,
  dsn: config.sentry.dsn,

  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
  tracesSampleRate: config.env === 'production' ? 0.1 : 1.0,

  // Enable logs to be sent to Sentry
  enableLogs: true,
  integrations: [Sentry.pinoIntegration()],
}

function initialiazeTelemetry() {
  if (!config.sentry.dsn) {
    console.warn(
      'Sentry DSN not configured. Base tracing, logging and error reporting will be disabled.',
    )
    return
  }

  Sentry.init({ ...sentryConfig })
  console.warn('Sentry initialized')
}

export { initialiazeTelemetry }
