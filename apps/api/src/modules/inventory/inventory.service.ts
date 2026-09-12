import type { FilterQuery } from '@mikro-orm/core'
import { EntityManager, QueryOrder } from '@mikro-orm/core'
import { Injectable, NotFoundException } from '@nestjs/common'
import { Product } from '../catalog/entities/product.entity'
import { buildSearchFilter } from '../db/search.util'
import { HandoverLine } from '../distribution/entities/handover-line.entity'
import { ReceptionLine } from '../purchasing/entities/reception-line.entity'
import { StockMovement } from './entities/stock-movement.entity'
import type { StockLevel } from './inventory.util'
import { buildStockLevel, emptyStockLevel } from './inventory.util'

/** Where a free-text search looks on the stock list. */
const STOCK_SEARCH_PATHS = ['name', 'barcode', 'category.name'] as const

/**
 * One row of the grouped movement query. Postgres hands `sum()` over a `numeric` column back
 * as a string, so both totals arrive as strings and are converted once, here.
 */
interface StockTotalsRow {
  productId: string
  quantity: string
  costNumeratorCents: string
}

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

export interface RecordIssueInput {
  productId: string
  /** Positive magnitude — the movement row stores it negated. */
  quantity: string
  currency: string
  handoverLine: HandoverLine
}

export interface RecordIssueReversalInput {
  productId: string
  /** Positive magnitude — a reversal puts stock back. */
  quantity: string
  /** The unit cost of the outbound row being undone, so the average lands exactly back. */
  unitCostAmountCents: number
  currency: string
  handoverLine: HandoverLine
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

  /**
   * Appends one negative `StockMovement` for a handed-over line, valued at the product's
   * **current** weighted average cost.
   *
   * Valuing the issue at the current average is what leaves that average untouched:
   * (N − q·N/Q) / (Q − q) = N/Q. So `buildStockLevel` keeps serving both directions with one
   * formula over one set of rows, and stock level and cost price can never disagree about
   * which rows count (research.md §5).
   *
   * The average is read here, before the row is appended, or the new row would be part of
   * its own input. A product with no reception history has no average and is issued at `0`:
   * nothing was paid for it that the system knows of.
   *
   * Takes the caller's `EntityManager` so it joins the handover transaction, like
   * {@link recordReceipt}.
   */
  async recordIssue(em: EntityManager, input: RecordIssueInput): Promise<StockMovement> {
    // Flush first so the average below is read over everything this transaction has already
    // written — a handover touching the same product twice must value the second issue
    // against the first. Still inside the caller's transaction, so nothing is committed.
    await em.flush()
    const level = await this.getStockLevels([input.productId], em)
    const costPriceEur = level.get(input.productId)?.costPriceEur ?? null
    const unitCostAmountCents = costPriceEur === null ? 0 : Math.round(costPriceEur * 100)

    const movement = new StockMovement()
    movement.product = em.getReference(Product, input.productId)
    movement.quantity = `-${input.quantity}`
    movement.unitCostAmountCents = unitCostAmountCents
    movement.currency = input.currency
    movement.reason = 'distribution'
    movement.handoverLine = input.handoverLine
    em.persist(movement)
    return movement
  }

  /**
   * Appends one positive `StockMovement` putting back what a reversed handover took, at the
   * **original** outbound row's unit cost rather than today's average — so the weighted
   * average returns exactly where it was, not merely close (research.md §9).
   */
  recordIssueReversal(em: EntityManager, input: RecordIssueReversalInput): StockMovement {
    const movement = new StockMovement()
    movement.product = em.getReference(Product, input.productId)
    movement.quantity = input.quantity
    movement.unitCostAmountCents = input.unitCostAmountCents
    movement.currency = input.currency
    movement.reason = 'distribution_reversal'
    movement.handoverLine = input.handoverLine
    em.persist(movement)
    return movement
  }

  /** One product's current stock level and cost price. */
  async getStockLevel(productId: string, em: EntityManager = this.em): Promise<StockLevel> {
    const levels = await this.getStockLevels([productId], em)
    return levels.get(productId) ?? emptyStockLevel()
  }

  /**
   * Stock level and cost price for many products in one query. Products with no movements
   * are absent from the map — callers fall back to {@link emptyStockLevel}.
   *
   * Pass an `EntityManager` to read inside a caller's transaction; a handover must value its
   * outbound rows against what that same transaction has already written.
   *
   * The ledger is summed by the database rather than read into memory: it is append-only and
   * grows with every reception, while a shop page only ever needs the two totals. The product
   * ids are bound as parameters; nothing from the request reaches the SQL as text.
   */
  async getStockLevels(
    productIds: string[],
    em: EntityManager = this.em,
  ): Promise<Map<string, StockLevel>> {
    const result = new Map<string, StockLevel>()
    if (productIds.length === 0) return result

    const placeholders = productIds.map(() => '?').join(', ')
    const rows: StockTotalsRow[] = await em.getConnection().execute(
      `select "productId",
              sum("quantity") as "quantity",
              sum("quantity" * "unitCostAmountCents") as "costNumeratorCents"
         from "stockMovement"
        where "productId" in (${placeholders})
        group by "productId"`,
      productIds,
    )

    for (const row of rows) {
      result.set(
        row.productId,
        buildStockLevel({
          quantity: Number(row.quantity),
          costNumeratorCents: Number(row.costNumeratorCents),
        }),
      )
    }
    return result
  }

  /** The product's movements, newest first — each traceable to its reception line (SC-003). */
  async listMovements(productId: string): Promise<StockMovement[]> {
    return this.em.find(
      StockMovement,
      { product: productId },
      { orderBy: { createdAt: QueryOrder.DESC }, populate: ['receptionLine', 'handoverLine'] },
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
