import type { FilterQuery } from '@mikro-orm/core'
import { EntityManager, LockMode, QueryOrder } from '@mikro-orm/core'
import { ConflictException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common'
import { centsToEur } from '../catalog/catalog.util'
import { User } from '../auth/auth.entity'
import { buildSearchFilter } from '../db/search.util'
import { InventoryService } from '../inventory/inventory.service'
import { Member } from '../members/entities/member.entity'
import { Order } from '../orders/entities/order.entity'
import { WalletService } from '../wallet/wallet.service'
import type { RecordHandoverInput } from './contracts/handover.contract'
import { Handover } from './entities/handover.entity'
import { HandoverLine } from './entities/handover-line.entity'
import {
  balanceCovers,
  handoverTotalCents,
  lineReadiness,
  lineTotalCents,
  type PricedHandoverLine,
} from './distribution.util'

/** Where the distribution table's member search looks (FR-001). */
const MEMBER_SEARCH_PATHS = ['membershipNumber', 'user.name'] as const

export interface MemberSearchRow {
  member: Member
  balanceCents: number
  outstandingOrderCount: number
}

export interface HandoverResult {
  handover: Handover
  balanceAfterCents: number
}

export interface MemberScreen {
  member: Member
  balanceCents: number
  orders: Order[]
  /** Current stock on hand per product id — the "available" figure beside each line. */
  stockByProduct: Map<string, number>
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
   * 2. Refuse a stale `version` or an order that is no longer pending — this is what stops
   *    a second charge for the same order (SC-003).
   * 3. Refuse a line whose goods have not arrived (FR-003), and a terminated member (FR-005).
   * 4. Price every line at the order's snapshot price, never today's.
   * 5. Read the balance *before* writing anything, and refuse with the shortfall.
   * 6. Write the handover, the stock movements, and the one wallet entry.
   * 7. Flip the order to `handed_over` only once every line is settled.
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

      const linesById = new Map(order.lines.getItems().map((line) => [line.id, line]))
      const priced: PricedHandoverLine[] = []
      for (const entry of input.lines) {
        const orderLine = linesById.get(entry.orderLineId)
        if (!orderLine) {
          throw new NotFoundException(`Line ${entry.orderLineId} is not on this order`)
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

      const settledNow = new Set(priced.map((line) => line.orderLineId))
      const alreadySettled = await this.settledOrderLineIds(em, order.id)
      const allSettled = order.lines
        .getItems()
        .every((line) => settledNow.has(line.id) || alreadySettled.has(line.id))
      if (allSettled) order.status = 'handed_over'

      await em.flush()
      return {
        handover,
        balanceAfterCents: balanceCents - totalCents,
      }
    })
  }

  /**
   * Order lines already covered by a handover that has not itself been reversed. Derived
   * rather than stored, so a reversal needs no column to un-set (data-model.md).
   */
  private async settledOrderLineIds(em: EntityManager, orderId: string): Promise<Set<string>> {
    const rows: { orderLineId: string }[] = await em.getConnection().execute(
      `select hl."orderLineId"
         from "handoverLine" hl
         join "handover" h on h.id = hl."handoverId"
        where h."orderId" = ?
          and h.kind = 'handover'
          and not exists (select 1 from "handover" r where r."reversesHandoverId" = h.id)`,
      [orderId],
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
