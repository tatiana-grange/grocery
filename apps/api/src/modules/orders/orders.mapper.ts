import { Injectable } from '@nestjs/common'
import { centsToEur, currentPrice } from '../catalog/catalog.util'
import type { Product } from '../catalog/entities/product.entity'
import { checkLineValidity } from './cart-line-validity.util'
import type { Cart as CartContract, CartLine as CartLineContract } from './contracts/cart.contract'
import type {
  CheckoutResult as CheckoutResultContract,
  OrderDetail as OrderDetailContract,
  Order as OrderContract,
  OrderLine as OrderLineContract,
} from './contracts/order.contract'
import type { CartLine } from './entities/cart-line.entity'
import type { Cart } from './entities/cart.entity'
import type { OrderLine } from './entities/order-line.entity'
import type { Order } from './entities/order.entity'
import type { CheckoutResult } from './orders.service'

@Injectable()
export class OrdersMapper {
  private currentPriceCents(product: Product): number {
    return currentPrice(product)?.amountCents ?? 0
  }

  toCartLine(line: CartLine): CartLineContract {
    const unitPriceCents = this.currentPriceCents(line.product)
    const quantity = Number(line.quantity)
    const { isValid, reason } = checkLineValidity(line.product, line.orderingMode)

    return {
      id: line.id,
      product: {
        id: line.product.id,
        name: line.product.name,
        saleMode: line.product.saleMode,
        photos: line.product.photos,
      },
      orderingMode: line.orderingMode,
      quantity,
      unitPriceEur: centsToEur(unitPriceCents),
      lineTotalEur: centsToEur(Math.round(quantity * unitPriceCents)),
      isValid,
      invalidReason: reason,
    }
  }

  toCart(cart: Cart): CartContract {
    const lines = cart.lines.isInitialized() ? [...cart.lines.getItems()] : []
    const mappedLines = lines.map((line) => this.toCartLine(line))
    const totalEur = mappedLines
      .filter((line) => line.isValid)
      .reduce((sum, line) => sum + line.lineTotalEur, 0)

    return {
      id: cart.id,
      lines: mappedLines,
      totalEur: Math.round(totalEur * 100) / 100,
      version: cart.version,
    }
  }

  toOrderLine(line: OrderLine): OrderLineContract {
    return {
      id: line.id,
      productName: line.productNameSnapshot,
      quantity: Number(line.quantity),
      unitPriceEur: centsToEur(line.unitPriceAmountCents),
      lineTotalEur: centsToEur(line.lineTotalAmountCents),
    }
  }

  toOrder(order: Order): OrderContract {
    return {
      id: order.id,
      orderingMode: order.orderingMode,
      status: order.status,
      totalEur: centsToEur(order.totalAmountCents),
      placedAt: order.placedAt,
      cancelledAt: order.cancelledAt ?? null,
      version: order.version,
    }
  }

  toOrderDetail(order: Order): OrderDetailContract {
    const lines = order.lines.isInitialized() ? [...order.lines.getItems()] : []
    return {
      ...this.toOrder(order),
      lines: lines.map((line) => this.toOrderLine(line)),
    }
  }

  toCheckoutResult(result: CheckoutResult): CheckoutResultContract {
    return {
      orders: result.orders.map((order) => this.toOrderDetail(order)),
      droppedLines: result.droppedLines,
    }
  }
}
