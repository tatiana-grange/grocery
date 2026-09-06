import { Injectable } from '@nestjs/common'
import { centsToEur } from '../catalog/catalog.util'
import type { Product } from '../catalog/entities/product.entity'
import type {
  StockDetail as StockDetailContract,
  StockList as StockListContract,
  StockMovement as StockMovementContract,
  StockSummary as StockSummaryContract,
} from './contracts/stock.contract'
import type { StockMovement } from './entities/stock-movement.entity'
import type { ProductStockListItem } from './inventory.service'
import type { StockLevel } from './inventory.util'

@Injectable()
export class InventoryMapper {
  toStockSummary(product: Product, level: StockLevel): StockSummaryContract {
    return {
      product: { id: product.id, name: product.name, saleMode: product.saleMode },
      quantityOnHand: level.quantityOnHand,
      costPriceEur: level.costPriceEur,
    }
  }

  toStockList(
    items: ProductStockListItem[],
    total: number,
    pagination: { pageSize: number; offset: number },
  ): StockListContract {
    return {
      data: items.map(({ product, level }) => this.toStockSummary(product, level)),
      meta: {
        itemCount: total,
        pageSize: pagination.pageSize,
        offset: pagination.offset,
        hasMore: pagination.offset + pagination.pageSize < total,
      },
    }
  }

  toStockMovement(movement: StockMovement): StockMovementContract {
    return {
      id: movement.id,
      quantity: Number(movement.quantity),
      unitCostEur: centsToEur(movement.unitCostAmountCents),
      reason: movement.reason,
      receptionLineId: movement.receptionLine?.id ?? null,
      createdAt: movement.createdAt,
    }
  }

  toStockDetail(
    product: Product,
    level: StockLevel,
    movements: StockMovement[],
  ): StockDetailContract {
    return {
      ...this.toStockSummary(product, level),
      movements: movements
        .slice()
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((movement) => this.toStockMovement(movement)),
    }
  }
}
