import { createPaginationQuerySchema, paginatedSchema } from '@lonestone/nzoth/server'
import { z } from 'zod'

export const WALLET_ENTRY_REASONS = [
  'handover_charge',
  'payment_received',
  'handover_reversal',
] as const
export const walletEntryReasonSchema = z.enum(WALLET_ENTRY_REASONS).meta({
  title: 'WalletEntryReason',
  description:
    'Why the money moved. handover_charge is negative; the other two are positive. ' +
    'Lot 5 adds online_topup to this same field.',
  examples: ['handover_charge'],
})
export type WalletEntryReason = z.infer<typeof walletEntryReasonSchema>

export const PAYMENT_METHODS = ['cash', 'cheque', 'transfer'] as const
export const paymentMethodSchema = z.enum(PAYMENT_METHODS).meta({
  title: 'PaymentMethod',
  description: 'How money reached the cooperative by hand. "online" is reserved for lot 5.',
  examples: ['cash'],
})
export type PaymentMethod = z.infer<typeof paymentMethodSchema>

export const walletEntrySchema = z
  .object({
    id: z.string().uuid(),
    /** Signed: negative charges the member, positive credits them. */
    amountEur: z.number(),
    reason: walletEntryReasonSchema,
    paymentMethod: paymentMethodSchema.nullish(),
    handoverId: z.string().uuid().nullish(),
    recordedBy: z.string().nullish(),
    note: z.string().nullish(),
    createdAt: z.date(),
  })
  .meta({
    title: 'WalletEntry',
    description: 'One movement on a member account. Written once, never edited or deleted.',
  })
export type WalletEntry = z.infer<typeof walletEntrySchema>

export const walletEntryListSchema = paginatedSchema(walletEntrySchema).meta({
  title: 'WalletEntryList',
  description: 'A paginated page of a member’s account movements, newest first',
})
export type WalletEntryList = z.infer<typeof walletEntryListSchema>

export const walletSchema = z
  .object({
    memberId: z.string().uuid(),
    /** Always SUM(entries), never a stored field. Never negative (SC-010). */
    balanceEur: z.number(),
    entries: walletEntryListSchema,
  })
  .meta({
    title: 'Wallet',
    description:
      'A member’s balance and the movements behind it. A member with no movements reads 0.',
  })
export type Wallet = z.infer<typeof walletSchema>

export const recordPaymentSchema = z
  .object({
    amountEur: z.number().positive(),
    paymentMethod: paymentMethodSchema,
    note: z.string().max(500).optional(),
  })
  .meta({
    title: 'RecordPaymentInput',
    description:
      'Money the member has actually handed over. Entered by a human after the fact — the ' +
      'system does not reconcile against a bank feed.',
    examples: [{ amountEur: 20, paymentMethod: 'cash' }],
  })
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>

export const walletPaginationSchema = createPaginationQuerySchema()
export type WalletPagination = z.infer<typeof walletPaginationSchema>
