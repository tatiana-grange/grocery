import { EntityManager } from '@mikro-orm/core'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Member } from '../members/entities/member.entity'
import type { OrderingModeChoice } from './contracts/order.contract'
import { CartLine } from './entities/cart-line.entity'
import { Cart } from './entities/cart.entity'
import { OrderLine } from './entities/order-line.entity'
import { Order } from './entities/order.entity'

export interface DroppedLine {
  productName: string
  reason: string
}

export interface CheckoutResult {
  orders: Order[]
  droppedLines: DroppedLine[]
}

@Injectable()
export class OrdersService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Reads the cart's lines, drops any that became unorderable since they were added, groups
   * the rest by ordering type, and creates one Order + its OrderLines per group with a price
   * snapshot taken now (not the price the line showed in the cart) — then empties the cart.
   * All in one transaction (data-model.md "Cross-entity rules").
   */
  async checkout(userId: string): Promise<CheckoutResult> {
    return this.em.transactional(async (em) => {
      const member = await em.findOne(Member, { user: userId })
      if (!member) throw new NotFoundException('Member not found')

      const cart = await em.findOne(
        Cart,
        { member: member.id },
        { populate: ['lines', 'lines.product', 'lines.product.prices'] },
      )
      if (!cart) throw new ConflictException('Your cart is empty')

      const lines = cart.lines.getItems()
      const droppedLines: DroppedLine[] = []
      const groups = new Map<OrderingModeChoice, CartLine[]>()

      for (const line of lines) {
        const product = line.product
        const isArchived = Boolean(product.archivedAt)
        const offersOrderingMode =
          product.orderingMode === 'both' || product.orderingMode === line.orderingMode

        if (isArchived || !offersOrderingMode) {
          droppedLines.push({
            productName: product.name,
            reason: isArchived
              ? 'This product is no longer available'
              : 'This product no longer offers this ordering type',
          })
          continue
        }

        const group = groups.get(line.orderingMode) ?? []
        group.push(line)
        groups.set(line.orderingMode, group)
      }

      if (groups.size === 0) {
        throw new ConflictException('Your cart has nothing left to check out')
      }

      const orders: Order[] = []
      for (const [orderingMode, groupLines] of groups) {
        const order = new Order()
        order.member = member
        order.orderingMode = orderingMode
        order.placedAt = new Date()

        let totalAmountCents = 0
        for (const line of groupLines) {
          const product = line.product
          const currentPrice = product.prices.getItems().find((price) => !price.validTo)
          const unitPriceAmountCents = currentPrice ? currentPrice.amountCents : 0
          const quantity = Number(line.quantity)
          const lineTotalAmountCents = Math.round(quantity * unitPriceAmountCents)

          const orderLine = new OrderLine()
          orderLine.order = order
          orderLine.product = product
          orderLine.productNameSnapshot = product.name
          orderLine.quantity = line.quantity
          orderLine.unitPriceAmountCents = unitPriceAmountCents
          orderLine.lineTotalAmountCents = lineTotalAmountCents
          order.lines.add(orderLine)
          em.persist(orderLine)

          totalAmountCents += lineTotalAmountCents
        }

        order.totalAmountCents = totalAmountCents
        em.persist(order)
        orders.push(order)
      }

      for (const line of cart.lines.getItems()) cart.lines.remove(line)

      await em.flush()
      return { orders, droppedLines }
    })
  }
}
