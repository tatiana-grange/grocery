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
import { InventoryService } from '../inventory/inventory.service'
import type { CostLevels } from './purchasing.mapper'
import { PurchasingMapper } from './purchasing.mapper'
import { PurchasingService } from './purchasing.service'
import {
  aggregateResultSchema,
  type SupplierOrderFiltering,
  supplierOrderFilteringSchema,
  type SupplierOrderPagination,
  supplierOrderPaginationSchema,
  supplierOrderDetailSchema,
  supplierOrdersListSchema,
} from './contracts/supplier-order.contract'
import type { SupplierOrder } from './entities/supplier-order.entity'

/** Cost estimates for every product appearing on the given supplier orders, in one query. */
async function costLevelsFor(
  inventory: InventoryService,
  orders: SupplierOrder[],
): Promise<CostLevels> {
  const productIds = new Set<string>()
  for (const order of orders) {
    if (!order.lines.isInitialized()) continue
    for (const line of order.lines.getItems()) productIds.add(line.product.id)
  }
  return inventory.getStockLevels([...productIds])
}

/**
 * Aggregation lives under the supplier it acts on, matching the catalog's
 * `/admin/suppliers/:id/*` shape.
 */
@TypedController('admin/suppliers', undefined, { tags: ['Admin Purchasing'] })
@UseGuards(AuthGuard)
@AdminOnly()
export class AdminSupplierPurchasingController {
  constructor(
    private readonly purchasing: PurchasingService,
    private readonly inventory: InventoryService,
    private readonly mapper: PurchasingMapper,
  ) {}

  @TypedRoute.Post(':supplierId/purchasing/aggregate', aggregateResultSchema)
  async aggregate(@TypedParam('supplierId', z.string()) supplierId: string) {
    const result = await this.purchasing.aggregate(supplierId)
    const costs = await costLevelsFor(this.inventory, [result.supplierOrder])
    return this.mapper.toAggregateResult(result, costs)
  }
}

@TypedController('admin/purchasing', undefined, { tags: ['Admin Purchasing'] })
@UseGuards(AuthGuard)
@AdminOnly()
export class AdminPurchasingController {
  constructor(
    private readonly purchasing: PurchasingService,
    private readonly inventory: InventoryService,
    private readonly mapper: PurchasingMapper,
  ) {}

  @TypedRoute.Get('supplier-orders', supplierOrdersListSchema)
  async list(
    @PaginationParams(supplierOrderPaginationSchema) pagination: SupplierOrderPagination,
    @FilteringParams(supplierOrderFilteringSchema) filter?: SupplierOrderFiltering,
  ) {
    const { orders, total } = await this.purchasing.listSupplierOrders(pagination, filter)
    const costs = await costLevelsFor(this.inventory, orders)
    return this.mapper.toSupplierOrdersList(orders, total, pagination, costs)
  }

  @TypedRoute.Get('supplier-orders/:id', supplierOrderDetailSchema)
  async get(@TypedParam('id', z.string()) id: string) {
    const order = await this.purchasing.getSupplierOrderDetail(id)
    const costs = await costLevelsFor(this.inventory, [order])
    return this.mapper.toSupplierOrderDetail(order, costs)
  }
}
