import { Injectable } from '@nestjs/common'
import { centsToEur } from '../catalog/catalog.util'
import type { Product } from '../catalog/entities/product.entity'
import type { Cart as CartContract, CartLine as CartLineContract } from './contracts/cart.contract'
import type { CartLine } from './entities/cart-line.entity'
import type { Cart } from './entities/cart.entity'

@Injectable()
export class OrdersMapper {
  private currentPriceCents(product: Product): number {
    if (!product.prices.isInitialized()) return 0
    const current = product.prices.getItems().find((price) => !price.validTo)
    return current ? current.amountCents : 0
  }

  toCartLine(line: CartLine): CartLineContract {
    const unitPriceCents = this.currentPriceCents(line.product)
    const quantity = Number(line.quantity)
    const isArchived = Boolean(line.product.archivedAt)
    const offersOrderingMode =
      line.product.orderingMode === 'both' || line.product.orderingMode === line.orderingMode
    const isValid = !isArchived && offersOrderingMode

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
      invalidReason: isValid
        ? null
        : isArchived
          ? 'This product is no longer available'
          : 'This product no longer offers this ordering type',
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
}
