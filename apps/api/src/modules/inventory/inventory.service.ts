import type { FilterQuery } from '@mikro-orm/core'
import { EntityManager, QueryOrder } from '@mikro-orm/core'
import { Injectable, NotFoundException } from '@nestjs/common'
import { Product } from '../catalog/entities/product.entity'
import { buildSearchFilter } from '../db/search.util'
import { ReceptionLine } from '../purchasing/entities/reception-line.entity'
import { StockMovement } from './entities/stock-movement.entity'
import type { StockLevel } from './inventory.util'
import { deriveStockLevel, emptyStockLevel } from './inventory.util'

/** Where a free-text search looks on the stock list. */
const STOCK_SEARCH_PATHS = ['name', 'barcode', 'category.name'] as const

export interface ProductStockListItem {
  product: Product
  level: StockLevel
}

export interface RecordReceiptInput {
  productId: string
  /** Positive decimal string, same unit convention as the reception line. */
  quantity: string
  unitCostAmountCents: number
  currency: string
  receptionLine: ReceptionLine
}

@Injectable()
export class InventoryService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Appends one `StockMovement` for a confirmed reception line. Takes the transaction's
   * `EntityManager` explicitly so it joins the caller's reception transaction rather than the
   * ambient request context.
   */
  recordReceipt(em: EntityManager, input: RecordReceiptInput): StockMovement {
    const movement = new StockMovement()
    movement.product = em.getReference(Product, input.productId)
    movement.quantity = input.quantity
    movement.unitCostAmountCents = input.unitCostAmountCents
    movement.currency = input.currency
    movement.reason = 'reception'
    movement.receptionLine = input.receptionLine
    em.persist(movement)
    return movement
  }

  /** One product's current stock level and cost price. */
  async getStockLevel(productId: string): Promise<StockLevel> {
    const movements = await this.em.find(StockMovement, { product: productId })
    return deriveStockLevel(movements)
  }

  /**
   * Stock level and cost price for many products in one query. Products with no movements
   * are absent from the map — callers fall back to {@link emptyStockLevel}.
   */
  async getStockLevels(productIds: string[]): Promise<Map<string, StockLevel>> {
    const result = new Map<string, StockLevel>()
    if (productIds.length === 0) return result

    const movements = await this.em.find(StockMovement, { product: { $in: productIds } })
    const byProduct = new Map<string, StockMovement[]>()
    for (const movement of movements) {
      const key = movement.product.id
      const bucket = byProduct.get(key)
      if (bucket) bucket.push(movement)
      else byProduct.set(key, [movement])
    }
    for (const [productId, rows] of byProduct) {
      result.set(productId, deriveStockLevel(rows))
    }
    return result
  }

  /** The product's movements, newest first — each traceable to its reception line (SC-003). */
  async listMovements(productId: string): Promise<StockMovement[]> {
    return this.em.find(
      StockMovement,
      { product: productId },
      { orderBy: { createdAt: QueryOrder.DESC }, populate: ['receptionLine'] },
    )
  }

  async getProduct(productId: string): Promise<Product> {
    const product = await this.em.findOne(Product, { id: productId })
    if (!product) throw new NotFoundException('Product not found')
    return product
  }

  /**
   * A page of non-archived products with their derived stock level and cost price. A
   * never-received product is included with `quantityOnHand: 0`, `costPriceEur: null`.
   */
  async listProductsWithStock(
    pagination: { pageSize: number; offset: number },
    filters: { search?: string; categoryId?: string } = {},
  ): Promise<{ items: ProductStockListItem[]; total: number }> {
    const where: FilterQuery<Product> = { archivedAt: null }
    if (filters.categoryId) Object.assign(where, { category: filters.categoryId })
    if (filters.search) {
      Object.assign(where, buildSearchFilter<Product>(filters.search, STOCK_SEARCH_PATHS))
    }

    const [products, total] = await this.em.findAndCount(Product, where, {
      orderBy: { name: QueryOrder.ASC },
      limit: pagination.pageSize,
      offset: pagination.offset,
    })

    const levels = await this.getStockLevels(products.map((p) => p.id))
    const items = products.map((product) => ({
      product,
      level: levels.get(product.id) ?? emptyStockLevel(),
    }))
    return { items, total }
  }
}
