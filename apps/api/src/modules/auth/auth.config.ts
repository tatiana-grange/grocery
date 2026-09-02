import type { MikroORM } from '@mikro-orm/core'
import type { BetterAuthOptions, User } from 'better-auth'
import type { BetterAuthType } from './auth.client-types'
import { betterAuth } from 'better-auth'
import { admin, openAPI, phoneNumber } from 'better-auth/plugins'
import { mikroOrmAdapter } from './auth-db.adapter'

/**
 * Access roles in lot 1. `admin` is a strict superset of `member`.
 * `grocer` is added in lot 4 (distribution).
 */
export const USER_ROLES = ['member', 'admin'] as const
export type UserRole = (typeof USER_ROLES)[number]
export const DEFAULT_USER_ROLE: UserRole = 'member'
export const ADMIN_USER_ROLES: UserRole[] = ['admin']

type BetterAuthHooks = NonNullable<BetterAuthOptions['hooks']>

interface BetterAuthOptionsDynamic {
  orm: MikroORM
  secret: string
  trustedOrigins: string[]
  sendResetPassword?: (
    data: { user: User; url: string; token: string },
    request: Request | undefined,
  ) => Promise<void>
  sendVerificationEmail?: (
    data: { user: User; url: string; token: string },
    request: Request | undefined,
  ) => Promise<void>
  sendPhoneOtp?: (data: { phoneNumber: string; code: string }) => Promise<void>
  sendPhonePasswordResetOtp?: (data: { phoneNumber: string; code: string }) => Promise<void>
  beforeHook?: BetterAuthHooks['before']
  afterHook?: BetterAuthHooks['after']
  databaseHooks?: BetterAuthOptions['databaseHooks']
  baseUrl: string
}

// We should use this, but sadly we do not have our custom fields in the session object (only the plugin added fields)
// https://github.com/better-auth/better-auth/issues/2818
// export type BetterAuthSession = ReturnType<typeof createAuth>['$Infer']['Session']

// My workaround to get the session type
export type BetterAuthSession = Awaited<
  ReturnType<ReturnType<typeof createBetterAuth>['api']['getSession']>
>
export type LoggedInBetterAuthSession = NonNullable<BetterAuthSession>

export type { BetterAuthType }
/**
 * The context type for BetterAuth middleware.
 * This type is derived from the first parameter of the $context method of BetterAuthType.
 */
export type BetterAuthContext = ReturnType<typeof createBetterAuth>['$context']

export function createBetterAuth(options: BetterAuthOptionsDynamic): BetterAuthType {
  const authOptions = {
    baseURL: options.baseUrl,
    secret: options.secret,
    trustedOrigins: options.trustedOrigins,
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      sendResetPassword: async (data, request) => {
        if (!options?.sendResetPassword) return
        return options?.sendResetPassword?.(data, request)
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      expiresIn: 60 * 60 * 24 * 10, // 10 days
      sendVerificationEmail: async (data, request) => {
        if (!options?.sendVerificationEmail) return
        return options?.sendVerificationEmail?.(data, request)
      },
    },
    database: mikroOrmAdapter(options.orm),
    databaseHooks: options.databaseHooks,
    advanced: {
      database: {
        generateId: false, // Fix pour Better Auth 1.2.7 - nouvelle syntaxe
      },
    },
    rateLimit: {
      window: 50,
      max: 100,
    },
    hooks: {
      before: options?.beforeHook,
      after: options?.afterHook,
    },
    plugins: [
      openAPI(),
      admin({
        defaultRole: DEFAULT_USER_ROLE,
        adminRoles: ADMIN_USER_ROLES,
      }),
      phoneNumber({
        requireVerification: true,
        sendOTP: async ({ phoneNumber: phone, code }) => {
          if (!options?.sendPhoneOtp) return
          return options.sendPhoneOtp({ phoneNumber: phone, code })
        },
        sendPasswordResetOTP: async ({ phoneNumber: phone, code }) => {
          if (!options?.sendPhonePasswordResetOtp) return
          return options.sendPhonePasswordResetOtp({ phoneNumber: phone, code })
        },
      }),
    ],
  } satisfies BetterAuthOptions

  // We need to pass the options to the customSession plugin to infer the type correctly
  // If you don't do this, you will not have the properties added by plugins (ex. session.activeOrganizationId for the organization plugin)
  // See https://www.better-auth.com/docs/concepts/session-management#customizing-session-response
  return betterAuth({
    ...authOptions,
    plugins: [...(authOptions.plugins ?? [])],
  })
}
