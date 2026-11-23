import { createPaginationQuerySchema, paginatedSchema } from '@lonestone/nzoth/server'
import { z } from 'zod'

export const WALLET_ENTRY_REASONS = [
  'handover_charge',
  'payment_received',
  'handover_reversal',
  'online_topup',
  'payment_correction',
  'refund',
] as const
export const walletEntryReasonSchema = z.enum(WALLET_ENTRY_REASONS).meta({
  title: 'WalletEntryReason',
  description:
    'Why the money moved. handover_charge, payment_correction and refund are negative; the ' +
    'others are positive. online_topup is money paid through the online payment provider. ' +
    'payment_correction reverses a payment staff recorded by mistake. refund is money given ' +
    'back to the member by hand and only recorded here.',
  examples: ['handover_charge'],
})
export type WalletEntryReason = z.infer<typeof walletEntryReasonSchema>

/** What staff can type in by hand. `online` is only ever written by a verified online payment. */
export const MANUAL_PAYMENT_METHODS = ['cash', 'cheque', 'transfer'] as const
export const manualPaymentMethodSchema = z.enum(MANUAL_PAYMENT_METHODS).meta({
  title: 'ManualPaymentMethod',
  description: 'How money reached the cooperative by hand.',
  examples: ['cash'],
})
export type ManualPaymentMethod = z.infer<typeof manualPaymentMethodSchema>

export const PAYMENT_METHODS = [...MANUAL_PAYMENT_METHODS, 'online'] as const
export const paymentMethodSchema = z.enum(PAYMENT_METHODS).meta({
  title: 'PaymentMethod',
  description:
    'How money reached the cooperative: by hand (cash, cheque, transfer) or online through ' +
    'the payment provider.',
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
    /** The provider's payment id, set on an online top-up. */
    providerPaymentId: z.string().nullish(),
    /** Set on a `payment_correction` row: the payment it reverses. */
    correctsEntryId: z.string().uuid().nullish(),
    /** Set on a payment that was corrected: the correction row that reverses it. */
    correctedByEntryId: z.string().uuid().nullish(),
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
    /** Always SUM(entries), never a stored field. Negative after a payment correction. */
    balanceEur: z.number(),
    entries: walletEntryListSchema,
  })
  .meta({
    title: 'Wallet',
    description:
      'A member’s balance and the movements behind it. A member with no movements reads 0. ' +
      'The balance is negative when a payment correction took back money already spent.',
  })
export type Wallet = z.infer<typeof walletSchema>

export const recordPaymentSchema = z
  .object({
    amountEur: z.number().positive(),
    paymentMethod: manualPaymentMethodSchema,
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

/** Refusal codes of a payment correction, read by the client from the 409 body. */
export const PAYMENT_CORRECTION_REFUSALS = ['not_a_manual_payment', 'already_corrected'] as const
export const paymentCorrectionRefusalSchema = z.enum(PAYMENT_CORRECTION_REFUSALS).meta({
  title: 'PaymentCorrectionRefusal',
  description: 'Carried in the 409 body alongside statusCode, so the client can branch on it.',
})
export type PaymentCorrectionRefusal = z.infer<typeof paymentCorrectionRefusalSchema>

/** Refusal codes of a purchase blocked by the balance, read by the client from the 409 body. */
export const PURCHASE_REFUSALS = ['insufficient_balance', 'negative_balance'] as const
export const purchaseRefusalSchema = z.enum(PURCHASE_REFUSALS).meta({
  title: 'PurchaseRefusal',
  description:
    'insufficient_balance at the counter, negative_balance in the online shop. Carried in the ' +
    '409 body alongside statusCode.',
})
export type PurchaseRefusal = z.infer<typeof purchaseRefusalSchema>

export const correctPaymentSchema = z
  .object({
    reason: z.string().trim().min(1).max(500),
  })
  .meta({
    title: 'CorrectPaymentInput',
    description:
      'Why a recorded payment is being corrected. The reason is kept on the correction row and ' +
      'the member can read it in their history.',
    examples: [{ reason: 'The cheque bounced' }],
  })
export type CorrectPaymentInput = z.infer<typeof correctPaymentSchema>

/** Refusal code of a refund, read by the client from the 409 body. */
export const REFUND_REFUSALS = ['refund_exceeds_balance'] as const
export const refundRefusalSchema = z.enum(REFUND_REFUSALS).meta({
  title: 'RefundRefusal',
  description:
    'Carried in the 409 body alongside statusCode, balanceEur and amountEur. It covers a refund ' +
    'larger than the balance and any refund on a balance of zero or below.',
})
export type RefundRefusal = z.infer<typeof refundRefusalSchema>

export const refundSchema = z
  .object({
    amountEur: z
      .number()
      .positive()
      .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
        message: 'The amount has at most two decimals',
      }),
    paymentMethod: manualPaymentMethodSchema,
    reason: z.string().trim().min(1).max(500),
  })
  .meta({
    title: 'RefundInput',
    description:
      'Money the cooperative gave back to a member by hand. Only recorded: nothing is sent to ' +
      'the payment provider. The reason is kept on the entry and the member can read it.',
    examples: [{ amountEur: 10, paymentMethod: 'cash', reason: 'Left the cooperative' }],
  })
export type RefundInput = z.infer<typeof refundSchema>

export const walletPaginationSchema = createPaginationQuerySchema()
export type WalletPagination = z.infer<typeof walletPaginationSchema>
