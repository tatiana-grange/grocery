import { Injectable } from '@nestjs/common'
import { centsToEur } from '../catalog/catalog.util'
import type { StockLevel } from '../inventory/inventory.util'
import type {
  Reception as ReceptionContract,
  ReceptionLine as ReceptionLineContract,
} from './contracts/reception.contract'
import type {
  AggregateResult as AggregateResultContract,
  SupplierOrder as SupplierOrderContract,
  SupplierOrderDetail as SupplierOrderDetailContract,
  SupplierOrderLine as SupplierOrderLineContract,
  SupplierOrdersList as SupplierOrdersListContract,
} from './contracts/supplier-order.contract'
import type { AggregateResult } from './purchasing.service'
import type { Reception } from './entities/reception.entity'
import type { ReceptionLine } from './entities/reception-line.entity'
import type { SupplierOrder } from './entities/supplier-order.entity'
import type { SupplierOrderLine } from './entities/supplier-order-line.entity'
import { discrepancyFor } from './purchasing.util'

/**
 * Cost estimates keyed by product id. `estimatedUnitCostEur` is the product's current
 * weighted average cost price if it has ever been received, else `null` (research.md §8).
 */
export type CostLevels = Map<string, StockLevel>

@Injectable()
export class PurchasingMapper {
  toSupplierOrderLine(line: SupplierOrderLine, costs: CostLevels): SupplierOrderLineContract {
    const orderedQuantity = Number(line.quantity)
    const receivedQuantity = this.receivedSoFar(line)
    const estimate = costs.get(line.product.id)?.costPriceEur ?? null

    return {
      id: line.id,
      product: {
        id: line.product.id,
        name: line.product.name,
        saleMode: line.product.saleMode,
      },
      quantity: orderedQuantity,
      receivedQuantity,
      discrepancy: discrepancyFor(
        line.product.saleMode,
        orderedQuantity,
        receivedQuantity,
        line.product.weightTolerancePercent,
      ),
      contributingMemberCount: line.sourceOrderLines.isInitialized()
        ? new Set(line.sourceOrderLines.getItems().map((ol) => ol.order.id)).size
        : 0,
      estimatedUnitCostEur: estimate,
    }
  }

  toSupplierOrder(order: SupplierOrder, costs: CostLevels): SupplierOrderContract {
    const lines = order.lines.isInitialized() ? order.lines.getItems() : []

    let estimatedTotalEur = 0
    let hasUnknownCostLines = false
    for (const line of lines) {
      const estimate = costs.get(line.product.id)?.costPriceEur ?? null
      if (estimate === null) hasUnknownCostLines = true
      else estimatedTotalEur += estimate * Number(line.quantity)
    }

    return {
      id: order.id,
      supplier: { id: order.supplier.id, name: order.supplier.name },
      status: order.status,
      sentAt: order.sentAt ?? null,
      closedAt: order.closedAt ?? null,
      estimatedTotalEur: Math.round(estimatedTotalEur * 100) / 100,
      hasUnknownCostLines,
      lineCount: lines.length,
      version: order.version,
      createdAt: order.createdAt,
    }
  }

  toSupplierOrdersList(
    orders: SupplierOrder[],
    total: number,
    pagination: { pageSize: number; offset: number },
    costs: CostLevels,
  ): SupplierOrdersListContract {
    return {
      data: orders.map((order) => this.toSupplierOrder(order, costs)),
      meta: {
        itemCount: total,
        pageSize: pagination.pageSize,
        offset: pagination.offset,
        hasMore: pagination.offset + pagination.pageSize < total,
      },
    }
  }

  toAggregateResult(result: AggregateResult, costs: CostLevels): AggregateResultContract {
    return {
      supplierOrder: this.toSupplierOrderDetail(result.supplierOrder, costs),
      skippedLines: result.skippedLines,
    }
  }

  toSupplierOrderDetail(order: SupplierOrder, costs: CostLevels): SupplierOrderDetailContract {
    const lines = order.lines.isInitialized() ? order.lines.getItems() : []
    const receptions = order.receptions.isInitialized() ? order.receptions.getItems() : []
    return {
      ...this.toSupplierOrder(order, costs),
      lines: lines.map((line) => this.toSupplierOrderLine(line, costs)),
      receptions: receptions
        .slice()
        .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
        .map((reception) => this.toReception(reception)),
    }
  }

  toReceptionLine(line: ReceptionLine): ReceptionLineContract {
    const soLine = line.supplierOrderLine
    const orderedQuantity = Number(soLine.quantity)
    const receivedQuantity = Number(line.receivedQuantity)
    return {
      id: line.id,
      supplierOrderLineId: soLine.id,
      productName: soLine.product.name,
      orderedQuantity,
      receivedQuantity,
      discrepancy: discrepancyFor(
        soLine.product.saleMode,
        orderedQuantity,
        receivedQuantity,
        soLine.product.weightTolerancePercent,
      ),
      unitCostEur: centsToEur(line.unitCostAmountCents),
    }
  }

  toReception(reception: Reception): ReceptionContract {
    const lines = reception.lines.isInitialized() ? reception.lines.getItems() : []
    return {
      id: reception.id,
      receivedAt: reception.receivedAt,
      lines: lines.map((line) => this.toReceptionLine(line)),
    }
  }

  private receivedSoFar(line: SupplierOrderLine): number {
    if (!line.receptionLines.isInitialized()) return 0
    const total = line.receptionLines
      .getItems()
      .reduce((sum, rl) => sum + Number(rl.receivedQuantity), 0)
    return Math.round(total * 1000) / 1000
  }
}
