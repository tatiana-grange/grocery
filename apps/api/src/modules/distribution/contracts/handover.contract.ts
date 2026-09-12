import { z } from 'zod'

/** Placeholder id used only in the OpenAPI examples below. */
const EXAMPLE_UUID = '00000000-0000-4000-8000-000000000000'

export const HANDOVER_KINDS = ['handover', 'reversal'] as const
export const handoverKindSchema = z.enum(HANDOVER_KINDS).meta({
  title: 'HandoverKind',
  description:
    'handover is goods going out; reversal is the row that undoes one. A reversal never ' +
    'edits the handover it undoes — it points at it.',
  examples: ['handover'],
})
export type HandoverKind = z.infer<typeof handoverKindSchema>

export const handoverLineSchema = z
  .object({
    id: z.string().uuid(),
    orderLineId: z.string().uuid(),
    productName: z.string(),
    orderedQuantity: z.number(),
    handedQuantity: z.number(),
    /** handed − ordered, computed at read time so it can never drift (FR-012). */
    differenceQuantity: z.number(),
    unitPriceEur: z.number().nonnegative(),
    lineTotalEur: z.number(),
  })
  .meta({ title: 'HandoverLine', description: 'One product actually given, written once' })
export type HandoverLine = z.infer<typeof handoverLineSchema>

export const handoverSchema = z
  .object({
    id: z.string().uuid(),
    orderId: z.string().uuid(),
    memberId: z.string().uuid(),
    kind: handoverKindSchema,
    totalEur: z.number(),
    reversesHandoverId: z.string().uuid().nullish(),
    isReversed: z.boolean(),
    recordedBy: z.string().nullish(),
    note: z.string().nullish(),
    createdAt: z.date(),
    lines: z.array(handoverLineSchema),
    /** So the table can show the receipt without a second call. */
    balanceAfterEur: z.number(),
  })
  .meta({
    title: 'Handover',
    description: 'A record of goods physically given to a member at a point in time',
  })
export type Handover = z.infer<typeof handoverSchema>

export const recordHandoverSchema = z
  .object({
    /** The Order.version the screen loaded — a stale one is refused (FR-011). */
    version: z.number().int(),
    lines: z
      .array(
        z.object({
          orderLineId: z.string().uuid(),
          /** 0 = the member declined it (FR-006); may exceed what was ordered (FR-012). */
          handedQuantity: z.number().nonnegative(),
        }),
      )
      .min(1),
    note: z.string().max(500).optional(),
  })
  .meta({
    title: 'RecordHandoverInput',
    description:
      'What was actually handed over. Lines left out stay outstanding for a later ' +
      'distribution.',
    examples: [{ version: 1, lines: [{ orderLineId: EXAMPLE_UUID, handedQuantity: 2 }] }],
  })
export type RecordHandoverInput = z.infer<typeof recordHandoverSchema>

export const createExpressOrderSchema = z
  .object({
    lines: z
      .array(
        z.object({
          productId: z.string().uuid(),
          quantity: z.number().positive(),
        }),
      )
      .min(1),
    note: z.string().max(500).optional(),
  })
  .meta({
    title: 'CreateExpressOrderInput',
    description:
      'Built at the table and sent once. Nothing is persisted before this call (FR-016).',
    examples: [{ lines: [{ productId: EXAMPLE_UUID, quantity: 1 }] }],
  })
export type CreateExpressOrderInput = z.infer<typeof createExpressOrderSchema>

export const reverseHandoverSchema = z
  .object({
    note: z.string().min(1).max(500),
  })
  .meta({
    title: 'ReverseHandoverInput',
    description: 'The reason for the correction, kept with the reversing entry (FR-029).',
    examples: [{ note: 'Wrong member' }],
  })
export type ReverseHandoverInput = z.infer<typeof reverseHandoverSchema>

/** Why a refusal happened — the frontend maps this to a translated message. */
export const HANDOVER_REFUSAL_CODES = [
  'insufficient_balance',
  'order_not_pending',
  'stale_version',
  'line_not_ready',
  'member_terminated',
  'nothing_handed_over',
  'product_not_sellable',
  'already_reversed',
  'cannot_reverse_reversal',
] as const
export const handoverRefusalCodeSchema = z.enum(HANDOVER_REFUSAL_CODES).meta({
  title: 'HandoverRefusalCode',
  description: 'Carried in the 409 body alongside statusCode, so the client can branch on it.',
})
export type HandoverRefusalCode = z.infer<typeof handoverRefusalCodeSchema>
