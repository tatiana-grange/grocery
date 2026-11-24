import type { Rel } from '@mikro-orm/core'
import {
  Entity,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy'
import { User } from '../../auth/auth.entity'
import type {
  ExpenseCategory,
  ExpenseKind,
  ExpensePaymentMethod,
} from '../contracts/expense.contract'

/**
 * An association expense, rent or insurance for example. An append-only ledger row, like
 * `WalletEntry` and `StockMovement` (constitution, "Immutable Money and Stock Ledgers"):
 * `createdAt` only, never edited, never deleted. A mistake is cancelled by a second row with a
 * negative amount that points at the first. The profit-and-loss account sums the column.
 */
@Entity({ tableName: 'expense' })
export class Expense {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  /**
   * The calendar day the money was spent, `YYYY-MM-DD`. No time and no time zone. On a
   * cancellation row it is the Paris day the expense was cancelled.
   */
  @Property({ type: 'date' })
  @Index()
  spentOn!: string

  /** Positive on an expense, negative on a cancellation. Never zero. */
  @Property()
  amountCents!: number

  @Property()
  category!: ExpenseCategory

  @Property({ length: 200 })
  label!: string

  @Property()
  paymentMethod!: ExpensePaymentMethod

  @Property()
  kind: ExpenseKind = 'expense'

  /**
   * Set only on a cancellation row: the expense it cancels. Unique, so an expense is cancelled
   * at most once, whatever the code path.
   */
  @ManyToOne(() => Expense, { fieldName: 'cancelsExpenseId', nullable: true })
  @Unique()
  cancelsExpense?: Rel<Expense>

  /** Set only on a cancellation row: why the expense was cancelled. */
  @Property({ length: 500, nullable: true })
  reason?: string

  @ManyToOne(() => User, { fieldName: 'recordedByUserId' })
  recordedByUser!: Rel<User>

  @Property()
  createdAt: Date = new Date()
}
