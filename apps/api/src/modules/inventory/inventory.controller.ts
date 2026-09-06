import {
  FilteringParams,
  PaginationParams,
  TypedController,
  TypedParam,
  TypedRoute,
} from '@lonestone/nzoth/server'
import { UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { AdminOnly } from '../auth/auth.decorator'
import { AuthGuard } from '../auth/auth.guard'
import {
  type StockFiltering,
  stockFilteringSchema,
  type StockPagination,
  stockPaginationSchema,
  stockDetailSchema,
  stockListSchema,
} from './contracts/stock.contract'
import { InventoryMapper } from './inventory.mapper'
import { InventoryService } from './inventory.service'

/**
 * Read-only stock and cost price. Every write to stock happens as a side effect of recording
 * a reception (see the purchasing module), never through this controller.
 */
@TypedController('admin/inventory', undefined, { tags: ['Admin Inventory'] })
@UseGuards(AuthGuard)
@AdminOnly()
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly mapper: InventoryMapper,
  ) {}

  @TypedRoute.Get('stock', stockListSchema)
  async list(
    @PaginationParams(stockPaginationSchema) pagination: StockPagination,
    @FilteringParams(stockFilteringSchema) filter?: StockFiltering,
  ) {
    const filters: { search?: string; categoryId?: string } = {}
    for (const item of filter ?? []) {
      if (item.property === 'search') filters.search = item.value
      if (item.property === 'categoryId') filters.categoryId = item.value
    }
    const { items, total } = await this.inventory.listProductsWithStock(pagination, filters)
    return this.mapper.toStockList(items, total, pagination)
  }

  @TypedRoute.Get('products/:productId/stock', stockDetailSchema)
  async detail(@TypedParam('productId', z.string()) productId: string) {
    // A never-received product is a normal state: `0` / `null` / no movements, not a 404
    // (FR-020). `getProduct` still 404s a product id that does not exist at all.
    const product = await this.inventory.getProduct(productId)
    const [level, movements] = await Promise.all([
      this.inventory.getStockLevel(productId),
      this.inventory.listMovements(productId),
    ])
    return this.mapper.toStockDetail(product, level, movements)
  }
}
