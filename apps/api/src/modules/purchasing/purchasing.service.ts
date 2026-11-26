import type { FilterQuery } from '@mikro-orm/core'
import { EntityManager, LockMode, QueryOrder } from '@mikro-orm/core'
import {
  BadGatewayException,
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { conflict } from '../../common/refusal'
import { eurToCents } from '../catalog/catalog.util'
import { Supplier } from '../catalog/entities/supplier.entity'
import { InventoryService } from '../inventory/inventory.service'
import { OrderLine } from '../orders/entities/order-line.entity'
import type { SupplierOrderSentMode } from './contracts/supplier-order.contract'
import type { RecordReceptionInput } from './contracts/reception.contract'
import type {
  SupplierOrderFiltering,
  SupplierOrderPagination,
} from './contracts/supplier-order.contract'
import { Reception } from './entities/reception.entity'
import { ReceptionLine } from './entities/reception-line.entity'
import { SupplierOrder } from './entities/supplier-order.entity'
import { SupplierOrderLine } from './entities/supplier-order-line.entity'
import { checkTransition, coversOrdered, sumQuantities } from './purchasing.util'
import { OrderMailError, SupplierOrderMailService } from './supplier-order-mail.service'
import { SupplierOrderNoticeService } from './supplier-order-notice.service'

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
  constructor(
    private readonly em: EntityManager,
    private readonly inventory: InventoryService,
    private readonly orderMail: SupplierOrderMailService,
    private readonly notices: SupplierOrderNoticeService,
  ) {}

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

      const { orderable, skippedLines } = await this.collectPendingLines(em, supplier)
      if (orderable.length === 0) {
        throw conflict('Nothing pending to aggregate for this supplier', { skippedLines })
      }

      const supplierOrder = this.createDraft(em, supplier, orderable)
      await em.flush()
      return { supplierOrder, skippedLines }
    })
  }

  /**
   * Every still-pending, not-yet-aggregated pre-order line of the supplier's products, split
   * into the lines that can be ordered and the ones skipped with their reason (FR-003).
   */
  async collectPendingLines(
    em: EntityManager,
    supplier: Supplier,
  ): Promise<{ orderable: OrderLine[]; skippedLines: SkippedLine[] }> {
    const candidateLines = await em.find(
      OrderLine,
      {
        order: { orderingMode: 'pre_order', status: 'pending' },
        product: { supplier: supplier.id },
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
    return { orderable, skippedLines }
  }

  /** Persists a draft supplier order for the given lines, quantities summed per product. */
  createDraft(em: EntityManager, supplier: Supplier, orderable: OrderLine[]): SupplierOrder {
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
    return supplierOrder
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
    const failure: { supplierName: string | null } = { supplierName: null }
    try {
      return await this.em.transactional(async (em) => {
        const order = await em.findOne(
          SupplierOrder,
          { id },
          { lockMode: LockMode.PESSIMISTIC_WRITE },
        )
        if (!order) throw new NotFoundException('Supplier order not found')
        this.assertTransition(order, version, 'draft')
        await em.populate(order, [
          'supplier',
          'supplier.referent',
          'supplier.referent.user',
          'lines',
          'lines.product',
        ])

        let result
        try {
          result = await this.orderMail.sendOrder(order)
        } catch (error) {
          if (error instanceof OrderMailError) failure.supplierName = order.supplier.name
          throw error
        }
        this.markSent(order, 'manual', result.sentTo)
        await em.flush()
        return order
      })
    } catch (error) {
      if (error instanceof OrderMailError && failure.supplierName) {
        // The transaction is rolled back: the order is still a draft. Alert after that.
        await this.notices.notifySendFailed({
          supplierName: failure.supplierName,
          orderId: id,
          mode: 'manual',
          reason: 'mail_error',
        })
        throw new BadGatewayException({
          statusCode: HttpStatus.BAD_GATEWAY,
          message: 'The e-mail to the supplier did not leave. The order is still a draft.',
          code: 'order_mail_failed',
        })
      }
      throw error
    }
  }

  /** The one place an order becomes `sent`: the status, the moment, how and to whom. */
  markSent(order: SupplierOrder, mode: SupplierOrderSentMode, sentTo: string | null): void {
    order.status = 'sent'
    order.sentAt = new Date()
    order.sentMode = mode
    order.sentTo = sentTo ?? undefined
  }

  /**
   * `sent → closed`. Optimistic-locked; `409` if the order is not currently `sent` (FR-021)
   * or the caller's `version` is stale. A closed order keeps every reception and every stock
   * movement it already had — closing only stops further deliveries being expected (FR-022);
   * `recordReception` already refuses anything but a `sent` order.
   */
  async close(id: string, version: number): Promise<SupplierOrder> {
    const order = await this.loadForTransition(id, version, 'sent')
    order.status = 'closed'
    order.closedAt = new Date()
    await this.em.flush()
    return order
  }

  private assertTransition(order: SupplierOrder, version: number, from: 'draft' | 'sent'): void {
    const refusal = checkTransition(order, from, version)
    if (refusal === 'wrong_status') {
      throw new ConflictException(`This supplier order is ${order.status}, not ${from}`)
    }
    if (refusal === 'stale_version') {
      throw new ConflictException(
        'This supplier order changed since you opened it — reload and try again',
      )
    }
  }

  private async loadForTransition(
    id: string,
    version: number,
    from: 'draft' | 'sent',
  ): Promise<SupplierOrder> {
    const order = await this.em.findOne(SupplierOrder, { id })
    if (!order) throw new NotFoundException('Supplier order not found')
    this.assertTransition(order, version, from)
    return order
  }

  /**
   * Records what actually arrived against a sent supplier order, in one transaction (matching
   * `orders.service.ts` `checkout`): create the `Reception` and its `ReceptionLine`s, append
   * one `StockMovement` per line (stock level and cost price update immediately), mark every
   * newly-covered pre-order line `fulfilledAt` (first reception of its product wins,
   * research.md §6 / FR-024), then flip the order to `received` once every line's cumulative
   * received quantity reaches what was ordered.
   *
   * `409` unless `status = 'sent'` (FR-015 / FR-022); `404` for a line id not on this order.
   * A discrepancy is never a reason to refuse (FR-012) — it is computed at read time.
   *
   * The supplier-order row is locked for the length of the transaction so two staffers
   * recording a reception against the same order at the same time serialise: the second one
   * waits, then totals received-so-far against the first reception's committed rows before
   * deciding whether every line is now covered. Without the lock, two partial receptions that
   * jointly complete the order could each miss the other and leave it stuck in `sent`, and
   * two completing receptions could collide on the optimistic `version` and roll one back.
   */
  async recordReception(supplierOrderId: string, input: RecordReceptionInput): Promise<Reception> {
    return this.em.transactional(async (em) => {
      const order = await em.findOne(
        SupplierOrder,
        { id: supplierOrderId },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      )
      if (!order) throw new NotFoundException('Supplier order not found')
      if (order.status !== 'sent') {
        throw new ConflictException(`This supplier order is ${order.status}, not sent`)
      }
      await em.populate(order, ['lines', 'lines.product', 'lines.receptionLines'])

      const linesById = new Map(order.lines.getItems().map((line) => [line.id, line]))
      for (const entry of input.lines) {
        if (!linesById.has(entry.supplierOrderLineId)) {
          throw new NotFoundException(`Line ${entry.supplierOrderLineId} is not on this order`)
        }
      }

      // Snapshot received-so-far per line NOW: persisting this reception's lines below adds
      // them to each `line.receptionLines` collection via MikroORM's identity map, so reading
      // that collection afterward would double-count.
      const priorReceivedByLine = new Map<string, number>()
      for (const line of order.lines.getItems()) {
        priorReceivedByLine.set(
          line.id,
          line.receptionLines.getItems().reduce((sum, rl) => sum + Number(rl.receivedQuantity), 0),
        )
      }

      const reception = new Reception()
      reception.supplierOrder = order
      reception.receivedAt = new Date()
      em.persist(reception)

      const touchedLineIds: string[] = []
      for (const entry of input.lines) {
        const soLine = linesById.get(entry.supplierOrderLineId)!
        const receptionLine = new ReceptionLine()
        receptionLine.reception = reception
        receptionLine.supplierOrderLine = soLine
        receptionLine.receivedQuantity = String(entry.receivedQuantity)
        receptionLine.unitCostAmountCents = eurToCents(entry.unitCostEur)
        receptionLine.currency = 'EUR'
        em.persist(receptionLine)

        // A line recorded with nothing received (the product simply did not arrive) is kept
        // as a fully-short record, but it moves no stock, touches no cost price, and fulfils
        // no pre-order — there is nothing on the shelf to hand over (spec "Edge Cases",
        // FR-016 / FR-024).
        if (entry.receivedQuantity > 0) {
          this.inventory.recordReceipt(em, {
            productId: soLine.product.id,
            quantity: String(entry.receivedQuantity),
            unitCostAmountCents: receptionLine.unitCostAmountCents,
            currency: 'EUR',
            receptionLine,
          })
          touchedLineIds.push(soLine.id)
        }
      }

      // Mark newly-covered pre-order lines fulfilled — first reception of the product wins,
      // a later reception never re-touches an already-fulfilled line.
      if (touchedLineIds.length > 0) {
        const orderLines = await em.find(OrderLine, {
          supplierOrderLine: { $in: touchedLineIds },
          fulfilledAt: null,
        })
        for (const orderLine of orderLines) orderLine.fulfilledAt = reception.receivedAt
      }

      // Flip to `received` once every line's cumulative received quantity covers what was
      // ordered. `lines.receptionLines` was populated before this reception's rows were added,
      // so fold this reception's quantities in explicitly.
      const receivedThisTime = new Map<string, number>()
      for (const entry of input.lines) {
        receivedThisTime.set(
          entry.supplierOrderLineId,
          (receivedThisTime.get(entry.supplierOrderLineId) ?? 0) + entry.receivedQuantity,
        )
      }
      const everyLineCovered = order.lines.getItems().every((line) => {
        const total = (priorReceivedByLine.get(line.id) ?? 0) + (receivedThisTime.get(line.id) ?? 0)
        return coversOrdered(Number(line.quantity), total)
      })
      if (everyLineCovered) {
        order.status = 'received'
        order.closedAt = reception.receivedAt
      }

      await em.flush()
      return reception
    })
  }

  /** Loads a reception with the fields the mapper reads. */
  async getReception(id: string): Promise<Reception> {
    const reception = await this.em.findOne(
      Reception,
      { id },
      { populate: ['lines', 'lines.supplierOrderLine', 'lines.supplierOrderLine.product'] },
    )
    if (!reception) throw new NotFoundException('Reception not found')
    return reception
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
