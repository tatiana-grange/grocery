import { z } from 'zod'

// `discrepancyKind` lives here (not in supplier-order.contract) so the two contract files
// form a one-way dependency — supplier-order.contract imports from reception.contract, never
// the reverse — avoiding a module-eval cycle between the Zod schema objects.
export const DISCREPANCY_KINDS = ['short', 'over', 'none'] as const
export const discrepancyKindSchema = z.enum(DISCREPANCY_KINDS).meta({
  title: 'DiscrepancyKind',
  description:
    "Comparison of a supplier-order line's received-so-far total against its ordered " +
    'quantity, computed at read time — never stored (research.md §5).',
})
export type DiscrepancyKind = z.infer<typeof discrepancyKindSchema>

export const recordReceptionSchema = z
  .object({
    lines: z
      .array(
        z.object({
          supplierOrderLineId: z.string().uuid(),
          receivedQuantity: z.number().nonnegative(),
          unitCostEur: z.number().nonnegative(),
        }),
      )
      .min(1),
  })
  .meta({
    title: 'RecordReception',
    description:
      'One entry per supplier-order line being received in this shipment. A line not ' +
      'included here is simply not part of this reception — it can be received later. ' +
      'Record it explicitly with receivedQuantity: 0 to flag it fully short.',
  })
export type RecordReceptionInput = z.infer<typeof recordReceptionSchema>

export const receptionLineSchema = z
  .object({
    id: z.string().uuid(),
    supplierOrderLineId: z.string().uuid(),
    productName: z.string(),
    orderedQuantity: z.number().positive(),
    receivedQuantity: z.number().nonnegative(),
    discrepancy: discrepancyKindSchema,
    unitCostEur: z.number().nonnegative(),
  })
  .meta({ title: 'ReceptionLine' })
export type ReceptionLine = z.infer<typeof receptionLineSchema>

export const receptionSchema = z
  .object({
    id: z.string().uuid(),
    receivedAt: z.date(),
    lines: z.array(receptionLineSchema),
  })
  .meta({ title: 'Reception' })
export type Reception = z.infer<typeof receptionSchema>
