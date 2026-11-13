# Contract: Member Account Ledger (new `wallet` module)

Two controller classes in one `wallet.controller.ts`, following the `catalog.controller.ts`
precedent of more than one controller per file:

- **`StaffWalletController`** at `wallet`, `@StaffOnly()` — what the table needs (FR-024,
  FR-026).
- **`MemberWalletController`** at `me/wallet`, `@MemberScoped()` — a member reading their own
  account and nobody else's (FR-023).

The balance is always `SUM(amountCents)` over the member's entries, summed by the database and
never stored (research.md §3). It is returned in euros and is never negative (SC-010).

---

## Staff routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/wallet/members/:memberId` | A member's balance and movement history, from the distribution screen (FR-024). Paginated entries. |
| POST | `/wallet/members/:memberId/payments` | Record money received from a member (FR-026). |

```ts
walletEntrySchema = z.object({
  id: z.string().uuid(),
  amountEur: z.number(),                    // signed: negative charges, positive credits
  reason: walletEntryReasonSchema,
  paymentMethod: paymentMethodSchema.nullish(),  // set only on payment_received
  handoverId: z.string().uuid().nullish(),  // set on both handover reasons (SC-002)
  recordedBy: z.string().nullish(),         // staff name
  note: z.string().nullish(),
  createdAt: z.date(),
}).meta({ title: 'WalletEntry' })

walletEntryReasonSchema = z.enum([
  'handover_charge',
  'payment_received',
  'handover_reversal',
]).meta({
  title: 'WalletEntryReason',
  description:
    'Why the money moved. handover_charge is negative; the other two are positive. ' +
    'Lot 5 adds online_topup to this same field.',
})

paymentMethodSchema = z.enum(['cash', 'cheque', 'transfer']).meta({
  title: 'PaymentMethod',
  description: 'How money reached the cooperative by hand. "online" is reserved for lot 5.',
})

walletSchema = z.object({
  memberId: z.string().uuid(),
  balanceEur: z.number(),
  entries: paginatedSchema(walletEntrySchema),
}).meta({
  title: 'Wallet',
  description: 'A member’s balance and the movements behind it. A member with no movements reads 0 (FR-025).',
})

recordPaymentSchema = z.object({
  amountEur: z.number().positive(),
  paymentMethod: paymentMethodSchema,
  note: z.string().max(500).optional(),     // e.g. a cheque number
}).meta({
  title: 'RecordPaymentInput',
  description: 'Money the member has actually handed over. Entered by a human after the fact — no reconciliation (research.md §12).',
})
```

`POST …/payments` returns the updated `walletSchema` so the table screen can retry the
handover straight away (FR-028, SC-011). `400` for a non-positive amount; `404` for an unknown
member.

---

## Member route

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/me/wallet` | The signed-in member's own balance and history (FR-023, FR-025). Paginated entries. |

Returns `walletSchema` for the caller's own member record only — there is no member-facing
route that takes another member's id.

---

## Not in this contract

- **Correcting a mistyped payment.** The spec has no requirement for it and the enum above has
  no `payment_reversal` value. See research.md §12 — this is a recorded gap, not an oversight.
- **Online top-up** (`online_topup`, provider webhooks, invoices) — lot 5. The enum comment
  above marks where it lands so lot 5 adds a value rather than reshaping the table.
- **Membership fees.** They stay on the lot 1 `MembershipPayment` entity and are not merged
  into this ledger (spec Assumptions).
