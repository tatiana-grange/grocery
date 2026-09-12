import type { FilterQuery } from '@mikro-orm/core'
import { EntityManager, QueryOrder } from '@mikro-orm/core'
import { Injectable, NotFoundException } from '@nestjs/common'
import { buildSearchFilter } from '../db/search.util'
import { InventoryService } from '../inventory/inventory.service'
import { Member } from '../members/entities/member.entity'
import { Order } from '../orders/entities/order.entity'
import { WalletService } from '../wallet/wallet.service'

/** Where the distribution table's member search looks (FR-001). */
const MEMBER_SEARCH_PATHS = ['membershipNumber', 'user.name'] as const

export interface MemberSearchRow {
  member: Member
  balanceCents: number
  outstandingOrderCount: number
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
}
