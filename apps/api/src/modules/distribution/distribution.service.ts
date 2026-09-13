import type { FilterQuery } from '@mikro-orm/core'
import { EntityManager, LockMode, QueryOrder } from '@mikro-orm/core'
import { ConflictException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common'
import { centsToEur, currentPrice } from '../catalog/catalog.util'
import { Product } from '../catalog/entities/product.entity'
import { StockMovement } from '../inventory/entities/stock-movement.entity'
import { User } from '../auth/auth.entity'
import { buildSearchFilter } from '../db/search.util'
import { InventoryService } from '../inventory/inventory.service'
import { Member } from '../members/entities/member.entity'
import { Order } from '../orders/entities/order.entity'
import { WalletService } from '../wallet/wallet.service'
import { OrderLine } from '../orders/entities/order-line.entity'
import type { CreateExpressOrderInput, RecordHandoverInput } from './contracts/handover.contract'
import { Handover } from './entities/handover.entity'
import { HandoverLine } from './entities/handover-line.entity'
import {
  balanceCovers,
  findDuplicateLineId,
  handoverTotalCents,
  isOrderFullySettled,
  isSellableAtTable,
  lineReadiness,
  lineTotalCents,
  type PricedHandoverLine,
} from './distribution.util'

/** Where the distribution table's member search looks (FR-001). */
const MEMBER_SEARCH_PATHS = ['membershipNumber', 'user.name'] as const

/** Where the express-order product search looks — barcode included, for the scanner (FR-014). */
const SELLABLE_PRODUCT_SEARCH_PATHS = ['name', 'barcode', 'category.name'] as const

export interface MemberSearchRow {
  member: Member
  balanceCents: number
  outstandingOrderCount: number
}

export interface HandoverResult {
  handover: Handover
  balanceAfterCents: number
}

export interface SellableProduct {
  product: Product
  unitPriceAmountCents: number
  quantityOnHand: number
}

export interface WaitingOrderRow {
  order: Order
  isReady: boolean
}

export interface MemberScreen {
  member: Member
  balanceCents: number
  orders: Order[]
  /** Current stock on hand per product id — the "available" figure beside each line. */
  stockByProduct: Map<string, number>
  /** Lines an earlier, un-reversed handover already covered — shown, never handed again. */
  settledOrderLineIds: Set<string>
}

@Injectable()
export class DistributionService {
  constructor(
    private readonly em: EntityManager,
    private readonly wallet: WalletService,
    private readonly inventory: InventoryService,
  ) {}

  /** Members matching a name or membership number, with what each has waiting (FR-001). */
  async searchMembers(
    pagination: { pageSize: number; offset: number },
    filters: { search?: string } = {},
  ): Promise<{ items: MemberSearchRow[]; total: number }> {
    const where: FilterQuery<Member> = {}
    if (filters.search) {
      Object.assign(where, buildSearchFilter<Member>(filters.search, MEMBER_SEARCH_PATHS))
    }

    const [members, total] = await this.em.findAndCount(Member, where, {
      orderBy: { membershipNumber: QueryOrder.ASC },
      limit: pagination.pageSize,
      offset: pagination.offset,
      populate: ['user'],
    })

    const items = await Promise.all(
      members.map(async (member) => ({
        member,
        balanceCents: await this.wallet.getBalanceCents(this.em, member.id),
        outstandingOrderCount: await this.em.count(Order, {
          member: member.id,
          status: 'pending',
        }),
      })),
    )
    return { items, total }
  }

  /**
   * Everything the table needs for one member in a single call (FR-002, FR-004): their
   * status, their balance, every order not yet handed over, and the current stock behind
   * each line.
   *
   * One call rather than three because the screen has a queue behind it — SC-005 budgets
   * the whole handover at 60 seconds.
   *
   * A member with nothing outstanding is a normal state: an empty order list, not a 404.
   */
  async getMemberScreen(memberId: string): Promise<MemberScreen> {
    const member = await this.em.findOne(Member, { id: memberId }, { populate: ['user'] })
    if (!member) throw new NotFoundException('Member not found')

    const orders = await this.em.find(
      Order,
      { member: member.id, status: 'pending' },
      { orderBy: { placedAt: QueryOrder.ASC }, populate: ['lines', 'lines.product'] },
    )

    const productIds = [
      ...new Set(orders.flatMap((order) => order.lines.getItems().map((line) => line.product.id))),
    ]
    const levels = await this.inventory.getStockLevels(productIds)
    const stockByProduct = new Map(
      productIds.map((id) => [id, levels.get(id)?.quantityOnHand ?? 0]),
    )

    return {
      member,
      balanceCents: await this.wallet.getBalanceCents(this.em, member.id),
      orders,
      stockByProduct,
      settledOrderLineIds: await this.settledOrderLineIds(
        this.em,
        orders.map((order) => order.id),
      ),
    }
  }

  /**
   * Validates a handover: record it, move the stock, charge the member — all of it, or none
   * of it (FR-009). The order of operations is the one data-model.md sets out, and each step
   * is there for a reason:
   *
   * 1. Lock the member row. "Refuse when the total exceeds the balance" is a read then a
   *    write, and two tills validating at the same moment would otherwise each see the same
   *    40 € and each charge 30 €. The lock is on the member, so two staffers serving
   *    different people never wait on each other, and one member is only ever at one table.
   *    Same pattern `PurchasingService.recordReception` uses on the supplier order.
   * 2. Refuse a stale `version` or an order that is no longer pending.
   * 3. Refuse a line an un-reversed handover already settled. This is what stops a second
   *    charge for the same goods (SC-003): a partial handover leaves the order `pending` and
   *    its row untouched, so neither the status nor the version can carry that guarantee on
   *    their own — only the handover lines already written against the order can.
   * 4. Refuse a line whose goods have not arrived (FR-003), and a terminated member (FR-005).
   * 5. Price every line at the order's snapshot price, never today's.
   * 6. Read the balance *before* writing anything, and refuse with the shortfall.
   * 7. Write the handover, the stock movements, and the one wallet entry.
   * 8. Flip the order to `handed_over` only once every line is settled.
   */
  async recordHandover(
    orderId: string,
    input: RecordHandoverInput,
    recordedByUserId: string,
  ): Promise<HandoverResult> {
    return this.em.transactional(async (em) => {
      const order = await em.findOne(
        Order,
        { id: orderId },
        { populate: ['lines', 'lines.product', 'member', 'member.user'] },
      )
      if (!order) throw new NotFoundException('Order not found')

      // Lock the member, not the order: the balance is what needs serialising.
      await em.findOne(Member, { id: order.member.id }, { lockMode: LockMode.PESSIMISTIC_WRITE })

      if (order.status !== 'pending') {
        throw this.refuse('order_not_pending', `This order is ${order.status}, not pending`)
      }
      if (order.version !== input.version) {
        throw this.refuse(
          'stale_version',
          'This order changed since you opened it — reload and try again',
        )
      }
      if (order.member.status === 'terminated') {
        throw this.refuse('member_terminated', 'This member’s membership is terminated')
      }

      const duplicateLineId = findDuplicateLineId(input.lines.map((line) => line.orderLineId))
      if (duplicateLineId) {
        throw this.refuse(
          'duplicate_line',
          'The same line was sent twice in one handover — send each line once',
        )
      }

      const linesById = new Map(order.lines.getItems().map((line) => [line.id, line]))
      const alreadySettled = await this.settledOrderLineIds(em, [order.id])
      const priced: PricedHandoverLine[] = []
      for (const entry of input.lines) {
        const orderLine = linesById.get(entry.orderLineId)
        if (!orderLine) {
          throw new NotFoundException(`Line ${entry.orderLineId} is not on this order`)
        }
        if (alreadySettled.has(orderLine.id)) {
          throw this.refuse(
            'line_already_handed_over',
            `${orderLine.productNameSnapshot} was already handed over`,
            { productName: orderLine.productNameSnapshot },
          )
        }
        const { isReady } = lineReadiness(order.orderingMode, orderLine.fulfilledAt)
        if (!isReady) {
          throw this.refuse(
            'line_not_ready',
            `${orderLine.productNameSnapshot} has not arrived yet`,
            { productName: orderLine.productNameSnapshot },
          )
        }
        priced.push({
          orderLineId: orderLine.id,
          handedQuantity: entry.handedQuantity,
          unitPriceAmountCents: orderLine.unitPriceAmountCents,
          lineTotalAmountCents: lineTotalCents(
            entry.handedQuantity,
            orderLine.unitPriceAmountCents,
          ),
        })
      }

      if (priced.every((line) => line.handedQuantity === 0)) {
        throw this.refuse('nothing_handed_over', 'Every line is zero — nothing to hand over')
      }

      const totalCents = handoverTotalCents(priced)
      const balanceCents = await this.wallet.getBalanceCents(em, order.member.id)
      if (!balanceCovers(totalCents, balanceCents)) {
        throw this.refuse('insufficient_balance', 'This member’s balance does not cover it', {
          shortfallEur: centsToEur(totalCents - balanceCents),
          balanceEur: centsToEur(balanceCents),
          totalEur: centsToEur(totalCents),
        })
      }

      const handover = new Handover()
      handover.order = order
      handover.member = order.member
      handover.totalAmountCents = totalCents
      handover.currency = 'EUR'
      handover.kind = 'handover'
      handover.recordedByUser = em.getReference(User, recordedByUserId)
      handover.note = input.note
      em.persist(handover)

      for (const line of priced) {
        const orderLine = linesById.get(line.orderLineId)!
        const handoverLine = new HandoverLine()
        handoverLine.handover = handover
        handoverLine.orderLine = orderLine
        handoverLine.handedQuantity = String(line.handedQuantity)
        handoverLine.unitPriceAmountCents = line.unitPriceAmountCents
        handoverLine.lineTotalAmountCents = line.lineTotalAmountCents
        em.persist(handoverLine)

        // A declined line records that it was offered and refused; it moves no stock.
        if (line.handedQuantity > 0) {
          await this.inventory.recordIssue(em, {
            productId: orderLine.product.id,
            quantity: String(line.handedQuantity),
            currency: 'EUR',
            handoverLine,
          })
        }
      }

      this.wallet.charge(em, {
        memberId: order.member.id,
        amountCents: totalCents,
        reason: 'handover_charge',
        handover,
        recordedByUserId,
      })

      const allSettled = isOrderFullySettled(
        order.lines.getItems().map((line) => line.id),
        alreadySettled,
        new Set(priced.map((line) => line.orderLineId)),
      )
      if (allSettled) order.status = 'handed_over'

      await em.flush()
      // `recordedByUser` was set as a reference; the receipt shows the staffer's name.
      await em.populate(handover, ['recordedByUser', 'lines', 'lines.orderLine'])
      return {
        handover,
        balanceAfterCents: balanceCents - totalCents,
      }
    })
  }

  /**
   * Orders still waiting to be handed over (FR-031–FR-033), newest last so the queue reads in
   * the order people placed them. An order leaves this list the moment its status stops being
   * `pending`, which is what "a handed-over order is no longer waiting" means (FR-032) — no
   * second flag to keep in step.
   */
  async listWaiting(
    pagination: { pageSize: number; offset: number },
    filters: {
      orderingMode?: string
      readyOnly?: boolean
      placedFrom?: string
      placedTo?: string
    } = {},
  ): Promise<{ items: WaitingOrderRow[]; total: number }> {
    const where: FilterQuery<Order> = { status: 'pending' }
    if (filters.orderingMode) Object.assign(where, { orderingMode: filters.orderingMode })
    // Asked of the database rather than filtered afterwards: filtering the page in memory
    // would drop rows the limit had already granted, leaving short pages and a `total` that
    // counted the ones it just removed. An in-store order is ready by definition; a pre-order
    // is ready once no line of it is still waiting on a delivery.
    if (filters.readyOnly) {
      Object.assign(where, {
        $or: [{ orderingMode: 'in_store' }, { lines: { $none: { fulfilledAt: null } } }],
      })
    }
    if (filters.placedFrom || filters.placedTo) {
      const placedAt: Record<string, Date> = {}
      if (filters.placedFrom) placedAt.$gte = new Date(filters.placedFrom)
      // An end date means "up to the end of that day", not midnight at its start.
      if (filters.placedTo)
        placedAt.$lt = new Date(new Date(filters.placedTo).getTime() + 86_400_000)
      Object.assign(where, { placedAt })
    }

    const [orders, total] = await this.em.findAndCount(Order, where, {
      orderBy: { placedAt: QueryOrder.ASC },
      limit: pagination.pageSize,
      offset: pagination.offset,
      populate: ['member', 'member.user', 'lines'],
    })

    const items = orders.map((order) => ({
      order,
      isReady: order.lines
        .getItems()
        .every((line) => lineReadiness(order.orderingMode, line.fulfilledAt).isReady),
    }))
    return { items, total }
  }

  /**
   * Products a staffer can sell at the table (FR-014): not archived, orderable from stock,
   * searchable by name or barcode so a scanner works with no extra plumbing. Each row
   * carries its current price and current stock, so the screen can warn before the call
   * rather than after it.
   */
  async listSellableProducts(
    pagination: { pageSize: number; offset: number },
    filters: { search?: string; categoryId?: string } = {},
  ): Promise<{ items: SellableProduct[]; total: number }> {
    const where: FilterQuery<Product> = {
      archivedAt: null,
      orderingMode: { $in: ['in_store', 'both'] },
    }
    if (filters.categoryId) Object.assign(where, { category: filters.categoryId })
    if (filters.search) {
      Object.assign(
        where,
        buildSearchFilter<Product>(filters.search, SELLABLE_PRODUCT_SEARCH_PATHS),
      )
    }

    const [products, total] = await this.em.findAndCount(Product, where, {
      orderBy: { name: QueryOrder.ASC },
      limit: pagination.pageSize,
      offset: pagination.offset,
      populate: ['prices'],
    })

    const levels = await this.inventory.getStockLevels(products.map((p) => p.id))
    const items = products.map((product) => ({
      product,
      unitPriceAmountCents: currentPrice(product)?.amountCents ?? 0,
      quantityOnHand: levels.get(product.id)?.quantityOnHand ?? 0,
    }))
    return { items, total }
  }

  /**
   * An express sale: create the order and hand it over in one motion (FR-017).
   *
   * The order is a real `Order` with real `OrderLine`s, priced by the same `currentPrice`
   * helper checkout uses. That keeps one shape downstream — the member's own order history,
   * the reversal path and lot 7's exports all work on an express sale without a special
   * case (research.md §8).
   *
   * Everything then runs through the same guarded path as a planned handover: same member
   * lock, same balance refusal, same stock and wallet writes.
   */
  async createExpressOrder(
    memberId: string,
    input: CreateExpressOrderInput,
    recordedByUserId: string,
  ): Promise<HandoverResult> {
    return this.em.transactional(async (em) => {
      const member = await em.findOne(
        Member,
        { id: memberId },
        { lockMode: LockMode.PESSIMISTIC_WRITE, populate: ['user'] },
      )
      if (!member) throw new NotFoundException('Member not found')
      if (member.status === 'terminated') {
        throw this.refuse('member_terminated', 'This member’s membership is terminated')
      }

      const products = await em.find(
        Product,
        { id: { $in: input.lines.map((line) => line.productId) } },
        { populate: ['prices'] },
      )
      const productsById = new Map(products.map((product) => [product.id, product]))

      const order = new Order()
      order.member = member
      order.orderingMode = 'in_store'
      order.status = 'pending'
      order.placedAt = new Date()
      order.isExpress = true
      em.persist(order)

      const priced: PricedHandoverLine[] = []
      // Parallel to `priced`. Keyed by position, not by product: the order lines have no id
      // until the flush below, and two lines for the same product are two distinct lines.
      const orderLines: OrderLine[] = []
      let orderTotalCents = 0
      for (const entry of input.lines) {
        const product = productsById.get(entry.productId)
        if (!product) throw new NotFoundException(`Product ${entry.productId} not found`)
        if (!isSellableAtTable(product)) {
          throw this.refuse('product_not_sellable', `${product.name} cannot be sold at the table`, {
            productName: product.name,
          })
        }

        const unitPriceAmountCents = currentPrice(product)?.amountCents ?? 0
        const lineTotalAmountCents = lineTotalCents(entry.quantity, unitPriceAmountCents)

        const orderLine = new OrderLine()
        orderLine.order = order
        orderLine.product = product
        orderLine.productNameSnapshot = product.name
        orderLine.quantity = String(entry.quantity)
        orderLine.unitPriceAmountCents = unitPriceAmountCents
        orderLine.lineTotalAmountCents = lineTotalAmountCents
        order.lines.add(orderLine)
        em.persist(orderLine)

        orderTotalCents += lineTotalAmountCents
        orderLines.push(orderLine)
        priced.push({
          orderLineId: String(orderLines.length - 1),
          handedQuantity: entry.quantity,
          unitPriceAmountCents,
          lineTotalAmountCents,
        })
      }
      order.totalAmountCents = orderTotalCents

      if (priced.every((line) => line.handedQuantity === 0)) {
        throw this.refuse('nothing_handed_over', 'Every line is zero — nothing to sell')
      }

      const totalCents = handoverTotalCents(priced)
      const balanceCents = await this.wallet.getBalanceCents(em, member.id)
      if (!balanceCovers(totalCents, balanceCents)) {
        throw this.refuse('insufficient_balance', 'This member’s balance does not cover it', {
          shortfallEur: centsToEur(totalCents - balanceCents),
          balanceEur: centsToEur(balanceCents),
          totalEur: centsToEur(totalCents),
        })
      }

      const handover = new Handover()
      handover.order = order
      handover.member = member
      handover.totalAmountCents = totalCents
      handover.currency = 'EUR'
      handover.kind = 'handover'
      handover.recordedByUser = em.getReference(User, recordedByUserId)
      handover.note = input.note
      em.persist(handover)

      for (const [index, line] of priced.entries()) {
        const orderLine = orderLines[index]
        const handoverLine = new HandoverLine()
        handoverLine.handover = handover
        handoverLine.orderLine = orderLine
        handoverLine.handedQuantity = String(line.handedQuantity)
        handoverLine.unitPriceAmountCents = line.unitPriceAmountCents
        handoverLine.lineTotalAmountCents = line.lineTotalAmountCents
        em.persist(handoverLine)

        // Stock may go below zero here, on purpose: the shelf is what the member is holding,
        // and refusing a real sale over a stale number would be worse (FR-018).
        if (line.handedQuantity > 0) {
          await this.inventory.recordIssue(em, {
            productId: orderLine.product.id,
            quantity: String(line.handedQuantity),
            currency: 'EUR',
            handoverLine,
          })
        }
      }

      this.wallet.charge(em, {
        memberId: member.id,
        amountCents: totalCents,
        reason: 'handover_charge',
        handover,
        recordedByUserId,
      })

      // An express order is created and settled in the same breath.
      order.status = 'handed_over'

      await em.flush()
      await em.populate(handover, ['recordedByUser', 'lines', 'lines.orderLine'])
      return { handover, balanceAfterCents: balanceCents - totalCents }
    })
  }

  /**
   * Undoes a validated handover (FR-028–FR-030).
   *
   * Nothing on the original is written. The reversing handover carries a forward link to it,
   * and "has this been reversed?" is answered by looking for that link — which is what lets
   * the original stay genuinely write-once (research.md §9).
   *
   * The stock movements are put back **at the unit cost of the rows they undo**, not at
   * today's average. That is the difference between the weighted average landing exactly
   * where it was and merely landing close to it.
   */
  async reverseHandover(
    handoverId: string,
    note: string,
    recordedByUserId: string,
  ): Promise<HandoverResult> {
    return this.em.transactional(async (em) => {
      const original = await em.findOne(
        Handover,
        { id: handoverId },
        { populate: ['lines', 'lines.orderLine', 'lines.orderLine.product', 'order', 'member'] },
      )
      if (!original) throw new NotFoundException('Handover not found')
      if (original.kind === 'reversal') {
        throw this.refuse('cannot_reverse_reversal', 'A reversal cannot itself be reversed')
      }

      // Lock the member for the same reason a handover does: the balance is about to move.
      await em.findOne(Member, { id: original.member.id }, { lockMode: LockMode.PESSIMISTIC_WRITE })

      const existing = await em.count(Handover, { reversesHandover: original.id })
      if (existing > 0) {
        throw this.refuse('already_reversed', 'This handover has already been reversed')
      }

      const reversal = new Handover()
      reversal.order = original.order
      reversal.member = original.member
      reversal.totalAmountCents = -original.totalAmountCents
      reversal.currency = original.currency
      reversal.kind = 'reversal'
      reversal.reversesHandover = original
      reversal.recordedByUser = em.getReference(User, recordedByUserId)
      reversal.note = note
      em.persist(reversal)

      // The outbound rows this handover created, so each can be put back at its own cost.
      const originalLineIds = original.lines.getItems().map((line) => line.id)
      const outbound = await em.find(StockMovement, {
        handoverLine: { $in: originalLineIds },
        reason: 'distribution',
      })
      const costByHandoverLine = new Map(
        outbound.map((movement) => [movement.handoverLine!.id, movement.unitCostAmountCents]),
      )

      for (const line of original.lines.getItems()) {
        const handedQuantity = Number(line.handedQuantity)
        const reversalLine = new HandoverLine()
        reversalLine.handover = reversal
        reversalLine.orderLine = line.orderLine
        reversalLine.handedQuantity = String(-handedQuantity)
        reversalLine.unitPriceAmountCents = line.unitPriceAmountCents
        reversalLine.lineTotalAmountCents = -line.lineTotalAmountCents
        em.persist(reversalLine)

        if (handedQuantity > 0) {
          this.inventory.recordIssueReversal(em, {
            productId: line.orderLine.product.id,
            quantity: String(handedQuantity),
            unitCostAmountCents: costByHandoverLine.get(line.id) ?? 0,
            currency: 'EUR',
            handoverLine: reversalLine,
          })
        }
      }

      this.wallet.credit(em, {
        memberId: original.member.id,
        amountCents: original.totalAmountCents,
        reason: 'handover_reversal',
        handover: reversal,
        recordedByUserId,
        note,
      })

      // The order can be handed over again (FR-030). `Order` is mutable, so moving its status
      // back is an ordinary edit, not a ledger write.
      //
      // An express order is the exception: it was created to carry this sale and nothing else,
      // so there is nothing left for the member to collect. Returning it to `pending` would
      // park it in the waiting list and in the member's outstanding count for ever, with no
      // way out but charging them again. Undoing the sale therefore cancels the order.
      if (original.order.isExpress) {
        original.order.status = 'cancelled'
        original.order.cancelledAt = new Date()
      } else {
        original.order.status = 'pending'
      }

      await em.flush()
      await em.populate(reversal, ['recordedByUser', 'lines', 'lines.orderLine'])
      const balanceAfterCents = await this.wallet.getBalanceCents(em, original.member.id)
      return { handover: reversal, balanceAfterCents }
    })
  }

  /** One handover, for the on-screen receipt and the reversal confirmation. */
  async getHandover(
    id: string,
  ): Promise<{ handover: Handover; isReversed: boolean; balanceCents: number }> {
    const handover = await this.em.findOne(
      Handover,
      { id },
      {
        populate: [
          'lines',
          'lines.orderLine',
          'lines.orderLine.product',
          'order',
          'member',
          'recordedByUser',
          'reversesHandover',
        ],
      },
    )
    if (!handover) throw new NotFoundException('Handover not found')
    const [reversalCount, balanceCents] = await Promise.all([
      this.em.count(Handover, { reversesHandover: handover.id }),
      this.wallet.getBalanceCents(this.em, handover.member.id),
    ])
    return { handover, isReversed: reversalCount > 0, balanceCents }
  }

  /**
   * Order lines already covered by a handover that has not itself been reversed, across the
   * orders given. Derived rather than stored, so a reversal needs no column to un-set
   * (data-model.md).
   */
  private async settledOrderLineIds(em: EntityManager, orderIds: string[]): Promise<Set<string>> {
    if (orderIds.length === 0) return new Set()
    const placeholders = orderIds.map(() => '?').join(', ')
    const rows: { orderLineId: string }[] = await em.getConnection().execute(
      `select hl."orderLineId"
         from "handoverLine" hl
         join "handover" h on h.id = hl."handoverId"
        where h."orderId" in (${placeholders})
          and h.kind = 'handover'
          and not exists (select 1 from "handover" r where r."reversesHandoverId" = h.id)`,
      orderIds,
      'all',
      em.getTransactionContext(),
    )
    return new Set(rows.map((row) => row.orderLineId))
  }

  /**
   * A refusal the generated client can branch on. `statusCode` is set explicitly because
   * passing an object body to `ConflictException` replaces Nest's default shape, and the
   * client's `isConflict` helper keys off that field (same reason as lot 3's aggregation).
   */
  private refuse(code: string, message: string, extra: Record<string, unknown> = {}) {
    return new ConflictException({
      statusCode: HttpStatus.CONFLICT,
      message,
      code,
      ...extra,
    })
  }
}
