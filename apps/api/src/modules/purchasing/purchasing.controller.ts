import {
  FilteringParams,
  PaginationParams,
  TypedBody,
  TypedController,
  TypedParam,
  TypedRoute,
} from '@lonestone/nzoth/server'
import { HttpCode, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { AdminOnly } from '../auth/auth.decorator'
import { AuthGuard } from '../auth/auth.guard'
import { InventoryService } from '../inventory/inventory.service'
import type { CostLevels } from './purchasing.mapper'
import { PurchasingMapper } from './purchasing.mapper'
import { PurchasingService } from './purchasing.service'
import {
  type RecordReceptionInput,
  recordReceptionSchema,
  receptionSchema,
} from './contracts/reception.contract'
import {
  aggregateResultSchema,
  type CloseSupplierOrderInput,
  closeSupplierOrderSchema,
  type SendSupplierOrderInput,
  sendSupplierOrderSchema,
  type SupplierOrderFiltering,
  supplierOrderFilteringSchema,
  type SupplierOrderPagination,
  supplierOrderPaginationSchema,
  supplierOrderDetailSchema,
  supplierOrderExportSchema,
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

  @TypedRoute.Get('supplier-orders/:id/export', supplierOrderExportSchema)
  async export(@TypedParam('id', z.string()) id: string) {
    const order = await this.purchasing.getSupplierOrderDetail(id)
    return this.mapper.toExport(order)
  }

  @TypedRoute.Post('supplier-orders/:id/send', supplierOrderDetailSchema)
  @HttpCode(200)
  async send(
    @TypedParam('id', z.string()) id: string,
    @TypedBody(sendSupplierOrderSchema) body: SendSupplierOrderInput,
  ) {
    await this.purchasing.send(id, body.version)
    const order = await this.purchasing.getSupplierOrderDetail(id)
    const costs = await costLevelsFor(this.inventory, [order])
    return this.mapper.toSupplierOrderDetail(order, costs)
  }

  @TypedRoute.Post('supplier-orders/:id/close', supplierOrderDetailSchema)
  @HttpCode(200)
  async close(
    @TypedParam('id', z.string()) id: string,
    @TypedBody(closeSupplierOrderSchema) body: CloseSupplierOrderInput,
  ) {
    await this.purchasing.close(id, body.version)
    const order = await this.purchasing.getSupplierOrderDetail(id)
    const costs = await costLevelsFor(this.inventory, [order])
    return this.mapper.toSupplierOrderDetail(order, costs)
  }

  @TypedRoute.Post('supplier-orders/:id/receptions', receptionSchema)
  async recordReception(
    @TypedParam('id', z.string()) id: string,
    @TypedBody(recordReceptionSchema) body: RecordReceptionInput,
  ) {
    const reception = await this.purchasing.recordReception(id, body)
    const full = await this.purchasing.getReception(reception.id)
    return this.mapper.toReception(full)
  }
}
