import type { EntityManager } from '@mikro-orm/core'
import type { User } from '../../auth/auth.entity'
import { createSupplierData } from '../../catalog/catalog.factory'
import type { Product } from '../../catalog/entities/product.entity'
import { HandoverLine } from '../../distribution/entities/handover-line.entity'
import { Handover } from '../../distribution/entities/handover.entity'
import { StockMovement } from '../../inventory/entities/stock-movement.entity'
import type { Member } from '../../members/entities/member.entity'
import type { MembershipFee } from '../../members/entities/membership-fee.entity'
import { MembershipPayment } from '../../members/entities/membership-payment.entity'
import { OrderLine } from '../../orders/entities/order-line.entity'
import { Order } from '../../orders/entities/order.entity'
import { ReceptionLine } from '../../purchasing/entities/reception-line.entity'
import { Reception } from '../../purchasing/entities/reception.entity'
import { SupplierOrderLine } from '../../purchasing/entities/supplier-order-line.entity'
import { SupplierOrder } from '../../purchasing/entities/supplier-order.entity'
import type { PaymentMethod, WalletEntryReason } from '../../wallet/contracts/wallet.contract'
import { WalletEntry } from '../../wallet/entities/wallet-entry.entity'
import type { ExpenseCategory, ExpensePaymentMethod } from '../contracts/expense.contract'
import { Expense } from '../entities/expense.entity'

/**
 * Rows written straight to the database at a time the test chooses, so a row can sit 1 ms inside
 * or outside a period bound. They mimic what the distribution, purchasing and wallet modules
 * write, with the same signs.
 */

export interface SaleLineInput {
  product: Product
  /** Plain decimal, e.g. `'1.333'`. `0` is a declined line: no stock movement is written. */
  quantity: string
  unitPriceCents: number
  /** The unit cost the stock movement carries. */
  unitCostCents: number
}

export interface InsertedSale {
  handover: Handover
  order: Order
  orderLines: OrderLine[]
  lines: HandoverLine[]
  movements: StockMovement[]
}

/**
 * A handover with its lines and their stock movements. Every row is stamped `at`, except the
 * stock movements when `movementAt` is given: the real code writes them a few milliseconds
 * later, and the P&L must still count them on the handover's time.
 */
export async function insertSale(
  em: EntityManager,
  p: {
    member: Member
    recordedBy: User
    at: Date
    lines: SaleLineInput[]
    movementAt?: Date
  },
): Promise<InsertedSale> {
  const order = new Order()
  order.member = p.member
  order.orderingMode = 'in_store'
  order.status = 'handed_over'
  order.placedAt = p.at
  order.createdAt = p.at

  const orderLines: OrderLine[] = []
  const lines: HandoverLine[] = []
  const movements: StockMovement[] = []
  let total = 0

  const handover = new Handover()
  handover.order = order
  handover.member = p.member
  handover.recordedByUser = p.recordedBy
  handover.kind = 'handover'
  handover.createdAt = p.at

  for (const input of p.lines) {
    const lineTotal = Math.round(Number(input.quantity) * input.unitPriceCents)
    total += lineTotal

    const orderLine = new OrderLine()
    orderLine.order = order
    orderLine.product = input.product
    orderLine.productNameSnapshot = input.product.name
    orderLine.quantity = input.quantity
    orderLine.unitPriceAmountCents = input.unitPriceCents
    orderLine.lineTotalAmountCents = lineTotal
    orderLine.createdAt = p.at
    order.lines.add(orderLine)
    orderLines.push(orderLine)

    const line = new HandoverLine()
    line.handover = handover
    line.orderLine = orderLine
    line.handedQuantity = input.quantity
    line.unitPriceAmountCents = input.unitPriceCents
    line.lineTotalAmountCents = lineTotal
    line.createdAt = p.at
    lines.push(line)

    if (Number(input.quantity) > 0) {
      const movement = new StockMovement()
      movement.product = input.product
      movement.quantity = `-${input.quantity}`
      movement.unitCostAmountCents = input.unitCostCents
      movement.reason = 'distribution'
      movement.handoverLine = line
      movement.createdAt = p.movementAt ?? p.at
      movements.push(movement)
    }
  }
  order.totalAmountCents = total
  handover.totalAmountCents = total

  em.persist([order, ...orderLines, handover, ...lines, ...movements])
  await em.flush()
  return { handover, order, orderLines, lines, movements }
}

/** What `DistributionService.reverseHandover` writes: negative lines, positive stock back. */
export async function insertSaleReversal(
  em: EntityManager,
  p: { sale: InsertedSale; recordedBy: User; at: Date },
): Promise<InsertedSale> {
  const reversal = new Handover()
  reversal.order = p.sale.order
  reversal.member = p.sale.handover.member
  reversal.recordedByUser = p.recordedBy
  reversal.kind = 'reversal'
  reversal.reversesHandover = p.sale.handover
  reversal.totalAmountCents = -p.sale.handover.totalAmountCents
  reversal.createdAt = p.at

  const lines: HandoverLine[] = []
  const movements: StockMovement[] = []
  p.sale.lines.forEach((original) => {
    const line = new HandoverLine()
    line.handover = reversal
    line.orderLine = original.orderLine
    line.handedQuantity = String(-Number(original.handedQuantity))
    line.unitPriceAmountCents = original.unitPriceAmountCents
    line.lineTotalAmountCents = -original.lineTotalAmountCents
    line.createdAt = p.at
    lines.push(line)

    const originalMovement = p.sale.movements.find((m) => m.handoverLine === original)
    if (originalMovement) {
      const movement = new StockMovement()
      movement.product = originalMovement.product
      movement.quantity = original.handedQuantity
      movement.unitCostAmountCents = originalMovement.unitCostAmountCents
      movement.reason = 'distribution_reversal'
      movement.handoverLine = line
      movement.createdAt = p.at
      movements.push(movement)
    }
  })

  em.persist([reversal, ...lines, ...movements])
  await em.flush()
  return {
    handover: reversal,
    order: p.sale.order,
    orderLines: p.sale.orderLines,
    lines,
    movements,
  }
}

/** A supplier order, a reception on it, one line and the stock movement it writes. */
export async function insertReception(
  em: EntityManager,
  p: {
    product: Product
    quantity: string
    unitCostCents: number
    at: Date
    supplierName?: string
  },
): Promise<{ reception: Reception; line: ReceptionLine; supplierOrder: SupplierOrder }> {
  const supplier = await createSupplierData(em, { name: p.supplierName })
  const supplierOrder = new SupplierOrder()
  supplierOrder.supplier = supplier
  const supplierOrderLine = new SupplierOrderLine()
  supplierOrderLine.supplierOrder = supplierOrder
  supplierOrderLine.product = p.product
  supplierOrderLine.quantity = p.quantity

  const reception = new Reception()
  reception.supplierOrder = supplierOrder
  reception.receivedAt = p.at
  reception.createdAt = p.at

  const line = new ReceptionLine()
  line.reception = reception
  line.supplierOrderLine = supplierOrderLine
  line.receivedQuantity = p.quantity
  line.unitCostAmountCents = p.unitCostCents
  line.createdAt = p.at

  const movement = new StockMovement()
  movement.product = p.product
  movement.quantity = p.quantity
  movement.unitCostAmountCents = p.unitCostCents
  movement.reason = 'reception'
  movement.receptionLine = line
  movement.createdAt = p.at

  em.persist([supplierOrder, supplierOrderLine, reception, line, movement])
  await em.flush()
  return { reception, line, supplierOrder }
}

export async function insertFeePayment(
  em: EntityManager,
  p: {
    fee: MembershipFee
    recordedBy: User
    amountCents: number
    paidAt: Date
    kind?: 'payment' | 'adjustment'
    method?: 'cash' | 'transfer' | 'other'
    note?: string
  },
): Promise<MembershipPayment> {
  const payment = new MembershipPayment()
  payment.fee = p.fee
  payment.kind = p.kind ?? 'payment'
  payment.amountCents = p.amountCents
  payment.method = p.method ?? 'cash'
  payment.paidAt = p.paidAt
  payment.note = p.note
  payment.recordedByUser = p.recordedBy
  await em.persist(payment).flush()
  return payment
}

export async function insertWalletEntry(
  em: EntityManager,
  p: {
    member: Member
    reason: WalletEntryReason
    amountCents: number
    at: Date
    paymentMethod?: PaymentMethod
    recordedBy?: User
    note?: string
    handover?: Handover
  },
): Promise<WalletEntry> {
  const entry = new WalletEntry()
  entry.member = p.member
  entry.reason = p.reason
  entry.amountCents = p.amountCents
  entry.paymentMethod = p.paymentMethod
  entry.recordedByUser = p.recordedBy
  entry.note = p.note
  entry.handover = p.handover
  entry.createdAt = p.at
  await em.persist(entry).flush()
  return entry
}

export async function insertExpense(
  em: EntityManager,
  p: {
    recordedBy: User
    spentOn: string
    amountCents: number
    category: ExpenseCategory
    label?: string
    paymentMethod?: ExpensePaymentMethod
    createdAt?: Date
  },
): Promise<Expense> {
  const expense = new Expense()
  expense.spentOn = p.spentOn
  expense.amountCents = p.amountCents
  expense.category = p.category
  expense.label = p.label ?? 'An expense'
  expense.paymentMethod = p.paymentMethod ?? 'transfer'
  expense.recordedByUser = p.recordedBy
  if (p.createdAt) expense.createdAt = p.createdAt
  await em.persist(expense).flush()
  return expense
}

/** A cancellation row written by hand, for an expense that cancels in a chosen period. */
export async function insertExpenseCancellation(
  em: EntityManager,
  p: { original: Expense; recordedBy: User; spentOn: string; reason?: string },
): Promise<Expense> {
  const row = new Expense()
  row.spentOn = p.spentOn
  row.amountCents = -p.original.amountCents
  row.category = p.original.category
  row.label = p.original.label
  row.paymentMethod = p.original.paymentMethod
  row.kind = 'cancellation'
  row.cancelsExpense = p.original
  row.reason = p.reason ?? 'Cancelled'
  row.recordedByUser = p.recordedBy
  await em.persist(row).flush()
  return row
}
