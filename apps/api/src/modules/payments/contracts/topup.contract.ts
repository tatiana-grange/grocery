import { z } from 'zod'

export const TOPUP_MIN_EUR = 5
export const TOPUP_MAX_EUR = 200
export const TOPUP_QUICK_AMOUNTS_EUR = [10, 20, 50]

export const topupOptionsSchema = z
  .object({
    enabled: z.boolean(),
    minAmountEur: z.number(),
    maxAmountEur: z.number(),
    quickAmountsEur: z.array(z.number()),
  })
  .meta({
    title: 'TopupOptions',
    description:
      'Whether online top-up is available, and the amounts the form offers. ' +
      '`enabled` is false when no payment provider is configured.',
    examples: [
      { enabled: true, minAmountEur: 5, maxAmountEur: 200, quickAmountsEur: [10, 20, 50] },
    ],
  })
export type TopupOptions = z.infer<typeof topupOptionsSchema>

export const TOPUP_STATUSES = ['pending', 'paid', 'failed', 'expired'] as const
export const topupStatusSchema = z.enum(TOPUP_STATUSES).meta({
  title: 'TopupStatus',
  description:
    'pending: waiting for the payment result. paid: credited to the account. ' +
    'failed: the payment did not go through. expired: the payment request ran out.',
  examples: ['pending'],
})
export type TopupStatus = z.infer<typeof topupStatusSchema>

export const startTopupSchema = z
  .object({
    amountEur: z.number().positive(),
  })
  .meta({
    title: 'StartTopupInput',
    description:
      'The amount the member wants to add to their account, in euros. At most two decimals, ' +
      'between the bounds given by the options route.',
    examples: [{ amountEur: 20 }],
  })
export type StartTopupInput = z.infer<typeof startTopupSchema>

export const topupSchema = z
  .object({
    id: z.string().uuid(),
    /** The requested amount, which is what a successful payment credits. */
    amountEur: z.number(),
    status: topupStatusSchema,
    /** Where to send the payer. Set once the provider has created the request. */
    redirectUrl: z.string().nullish(),
    expiresAt: z.date(),
    paidAt: z.date().nullish(),
  })
  .meta({
    title: 'Topup',
    description: 'One online top-up of the member account, from the request to its outcome.',
  })
export type Topup = z.infer<typeof topupSchema>

export const notificationAckSchema = z
  .object({
    received: z.literal(true),
  })
  .meta({
    title: 'NotificationAck',
    description:
      'Answer to a provider notification. Sent once our pass over recent top-ups is done.',
    examples: [{ received: true }],
  })
export type NotificationAck = z.infer<typeof notificationAckSchema>
