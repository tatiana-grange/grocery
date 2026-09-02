import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import dotenvx from '@dotenvx/dotenvx'
import { z } from 'zod'

// Load environment variables
const nodeEnv = process.env.NODE_ENV || 'development'
if (nodeEnv === 'test') {
  dotenvx.config({ path: join(process.cwd(), '.env.example') })
} else {
  dotenvx.config()
}

function getVersion() {
  const packageJson = readFileSync(join(process.cwd(), 'package.json'), 'utf8')

  if (!packageJson) {
    console.warn('Failed to read package.json')
    return 'Unknown version'
  }

  try {
    const packageJsonData = JSON.parse(packageJson)

    return packageJsonData.version ?? 'Unknown version'
  } catch {
    console.warn('Failed to parse package.json version')
    return 'Unknown version'
  }
}

export const configValidationSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // API
  API_BASE_URL: z.url(),
  API_PORT: z.coerce.number(),

  // Database
  DATABASE_PASSWORD: z.string(),
  DATABASE_USER: z.string(),
  DATABASE_NAME: z.string(),
  DATABASE_HOST: z.string(),
  DATABASE_PORT: z.coerce.number(),

  // BetterAuth
  BETTER_AUTH_SECRET: z.string(),
  TRUSTED_ORIGINS: z.string().transform((val) => val.split(',')),

  // Clients
  CLIENTS_WEB_APP_URL: z.string(),

  // Email
  EMAIL_HOST: z.string().default('localhost'),
  EMAIL_PORT: z.coerce.number().default(1025),
  EMAIL_SECURE: z.stringbool().default(false),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().email().default('noreply@lonestone.io'),

  // Sentry
  SENTRY_DSN: z.string().optional(),
})

export type ConfigSchema = z.infer<typeof configValidationSchema>

const configParsed = configValidationSchema.safeParse(process.env)

if (!configParsed.success) {
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(z.treeifyError(configParsed.error), null, 4)}`,
  )
}

export const config = {
  env: configParsed.data.NODE_ENV,
  api: {
    baseUrl: configParsed.data.API_BASE_URL,
    port: configParsed.data.API_PORT,
  },
  version: getVersion(),
  betterAuth: {
    secret: configParsed.data.BETTER_AUTH_SECRET,
    trustedOrigins: configParsed.data.TRUSTED_ORIGINS,
  },
  database: {
    password: configParsed.data.DATABASE_PASSWORD,
    user: configParsed.data.DATABASE_USER,
    name: configParsed.data.DATABASE_NAME,
    host: configParsed.data.DATABASE_HOST,
    port: configParsed.data.DATABASE_PORT,
    connectionStringUrl: `postgresql://${configParsed.data.DATABASE_USER}:${configParsed.data.DATABASE_PASSWORD}@${configParsed.data.DATABASE_HOST}:${configParsed.data.DATABASE_PORT}/${configParsed.data.DATABASE_NAME}`,
  },
  email: {
    host: configParsed.data.EMAIL_HOST,
    port: configParsed.data.EMAIL_PORT,
    secure: configParsed.data.EMAIL_SECURE,
    user: configParsed.data.EMAIL_USER,
    password: configParsed.data.EMAIL_PASSWORD,
    from: configParsed.data.EMAIL_FROM,
  },
  clients: {
    webApp: {
      url: configParsed.data.CLIENTS_WEB_APP_URL,
    },
  },
  sentry: {
    dsn: configParsed.data.SENTRY_DSN,
  },
} as const
