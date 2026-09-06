import type { FilterQuery } from '@mikro-orm/core'
import { EntityManager, QueryOrder } from '@mikro-orm/core'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Supplier } from '../catalog/entities/supplier.entity'
import { OrderLine } from '../orders/entities/order-line.entity'
import type {
  SupplierOrderFiltering,
  SupplierOrderPagination,
} from './contracts/supplier-order.contract'
import { SupplierOrder } from './entities/supplier-order.entity'
import { SupplierOrderLine } from './entities/supplier-order-line.entity'
import { checkTransition, sumQuantities } from './purchasing.util'

export interface SkippedLine {
  productName: string
  reason: string
}

export interface AggregateResult {
  supplierOrder: SupplierOrder
  skippedLines: SkippedLine[]
}

@Injectable()
export class PurchasingService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Combines every still-pending, not-yet-aggregated pre-order line for this supplier's
   * products into one new draft supplier order, quantities summed per product. Lines whose
   * product can no longer be ordered from the supplier are skipped and reported (FR-003).
   * Throws `409` when nothing is eligible (FR-004).
   */
  async aggregate(supplierId: string): Promise<AggregateResult> {
    return this.em.transactional(async (em) => {
      const supplier = await em.findOne(Supplier, { id: supplierId })
      if (!supplier) throw new NotFoundException('Supplier not found')

      const candidateLines = await em.find(
        OrderLine,
        {
          order: { orderingMode: 'pre_order', status: 'pending' },
          product: { supplier: supplierId },
          supplierOrderLine: null,
        },
        { populate: ['product', 'product.supplier'] },
      )

      const skippedLines: SkippedLine[] = []
      const orderable: OrderLine[] = []
      for (const line of candidateLines) {
        const product = line.product
        if (product.archivedAt) {
          skippedLines.push({ productName: product.name, reason: 'product_archived' })
        } else if (product.supplier.archivedAt) {
          skippedLines.push({ productName: product.name, reason: 'supplier_archived' })
        } else if (product.orderingMode === 'in_store') {
          skippedLines.push({ productName: product.name, reason: 'no_longer_pre_orderable' })
        } else {
          orderable.push(line)
        }
      }

      if (orderable.length === 0) {
        throw new ConflictException({
          message: 'Nothing pending to aggregate for this supplier',
          skippedLines,
        })
      }

      const byProduct = new Map<string, OrderLine[]>()
      for (const line of orderable) {
        const bucket = byProduct.get(line.product.id)
        if (bucket) bucket.push(line)
        else byProduct.set(line.product.id, [line])
      }

      const supplierOrder = new SupplierOrder()
      supplierOrder.supplier = supplier
      supplierOrder.status = 'draft'
      em.persist(supplierOrder)

      for (const [, lines] of byProduct) {
        const soLine = new SupplierOrderLine()
        soLine.supplierOrder = supplierOrder
        soLine.product = lines[0].product
        soLine.quantity = sumQuantities(lines.map((l) => l.quantity))
        em.persist(soLine)
        for (const orderLine of lines) orderLine.supplierOrderLine = soLine
      }

      await em.flush()
      return { supplierOrder, skippedLines }
    })
  }

  async listSupplierOrders(
    pagination: SupplierOrderPagination,
    filter?: SupplierOrderFiltering,
  ): Promise<{ orders: SupplierOrder[]; total: number }> {
    const where: FilterQuery<SupplierOrder> = {}
    for (const item of filter ?? []) {
      if (item.property === 'status') Object.assign(where, { status: item.value })
      if (item.property === 'supplierId') Object.assign(where, { supplier: item.value })
    }

    const [orders, total] = await this.em.findAndCount(SupplierOrder, where, {
      orderBy: { createdAt: QueryOrder.DESC },
      limit: pagination.pageSize,
      offset: pagination.offset,
      populate: ['supplier', 'lines', 'lines.product', 'lines.receptionLines'],
    })
    return { orders, total }
  }

  /**
   * `draft → sent`. Optimistic-locked on `version`; `409` if the order is no longer `draft`
   * (FR-008 refuses a repeat) or the caller's `version` is stale (FR-007). Once sent, the
   * order's lines are fixed against future aggregation runs — aggregation only ever looks at
   * `OrderLine`s with no `supplierOrderLine` link, and those were set when this order was
   * created.
   */
  async send(id: string, version: number): Promise<SupplierOrder> {
    const order = await this.loadForTransition(id, version, 'draft')
    order.status = 'sent'
    order.sentAt = new Date()
    await this.em.flush()
    return order
  }

  private async loadForTransition(
    id: string,
    version: number,
    from: 'draft' | 'sent',
  ): Promise<SupplierOrder> {
    const order = await this.em.findOne(SupplierOrder, { id })
    if (!order) throw new NotFoundException('Supplier order not found')
    const refusal = checkTransition(order, from, version)
    if (refusal === 'wrong_status') {
      throw new ConflictException(`This supplier order is ${order.status}, not ${from}`)
    }
    if (refusal === 'stale_version') {
      throw new ConflictException(
        'This supplier order changed since you opened it — reload and try again',
      )
    }
    return order
  }

  /** Loads a supplier order with everything the detail view and mapper need. */
  async getSupplierOrderDetail(id: string): Promise<SupplierOrder> {
    const order = await this.em.findOne(
      SupplierOrder,
      { id },
      {
        populate: [
          'supplier',
          'lines',
          'lines.product',
          'lines.sourceOrderLines',
          'lines.receptionLines',
          'receptions',
          'receptions.lines',
          'receptions.lines.supplierOrderLine',
          'receptions.lines.supplierOrderLine.product',
        ],
      },
    )
    if (!order) throw new NotFoundException('Supplier order not found')
    return order
  }
}
