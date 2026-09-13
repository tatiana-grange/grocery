import { Injectable } from '@nestjs/common'
import { centsToEur } from '../catalog/catalog.util'
import type { Member } from '../members/entities/member.entity'
import type { OrderLine } from '../orders/entities/order-line.entity'
import type { Order } from '../orders/entities/order.entity'
import type {
  Handover as HandoverContract,
  HandoverLine as HandoverLineContract,
} from './contracts/handover.contract'
import type { Handover } from './entities/handover.entity'
import type { HandoverLine } from './entities/handover-line.entity'
import type {
  DistributionLine as DistributionLineContract,
  DistributionMemberList as DistributionMemberListContract,
  DistributionMemberScreen as DistributionMemberScreenContract,
  DistributionMemberSummary as DistributionMemberSummaryContract,
  DistributionOrder as DistributionOrderContract,
  DistributionProduct as DistributionProductContract,
  DistributionProductList as DistributionProductListContract,
  WaitingOrder as WaitingOrderContract,
  WaitingOrderList as WaitingOrderListContract,
} from './contracts/distribution-screen.contract'
import type {
  MemberScreen,
  MemberSearchRow,
  SellableProduct,
  WaitingOrderRow,
} from './distribution.service'
import { lineReadiness } from './distribution.util'

@Injectable()
export class DistributionMapper {
  toMemberSummary(
    member: Member,
    balanceCents: number,
    outstandingOrderCount: number,
  ): DistributionMemberSummaryContract {
    return {
      id: member.id,
      membershipNumber: member.membershipNumber,
      name: member.user.name,
      status: member.status,
      balanceEur: centsToEur(balanceCents),
      outstandingOrderCount,
    }
  }

  toMemberList(
    items: MemberSearchRow[],
    total: number,
    pagination: { pageSize: number; offset: number },
  ): DistributionMemberListContract {
    return {
      data: items.map((row) =>
        this.toMemberSummary(row.member, row.balanceCents, row.outstandingOrderCount),
      ),
      meta: {
        itemCount: total,
        pageSize: pagination.pageSize,
        offset: pagination.offset,
        hasMore: pagination.offset + pagination.pageSize < total,
      },
    }
  }

  toLine(
    line: OrderLine,
    orderingMode: Order['orderingMode'],
    availableQuantity: number,
    isHandedOver: boolean,
  ): DistributionLineContract {
    const { isReady, notReadyReason } = lineReadiness(orderingMode, line.fulfilledAt)
    return {
      orderLineId: line.id,
      productId: line.product.id,
      // The checkout snapshot, so the line still reads sensibly after a rename.
      productName: line.productNameSnapshot,
      saleMode: line.product.saleMode,
      selectionUnit: line.product.selectionUnit ?? null,
      quantityStepGrams: line.product.quantityStepGrams ?? null,
      orderedQuantity: Number(line.quantity),
      availableQuantity,
      unitPriceEur: centsToEur(line.unitPriceAmountCents),
      lineTotalEur: centsToEur(line.lineTotalAmountCents),
      isReady,
      notReadyReason,
      isHandedOver,
    }
  }

  toOrder(
    order: Order,
    stockByProduct: Map<string, number>,
    settledOrderLineIds: Set<string>,
  ): DistributionOrderContract {
    const lines = order.lines
      .getItems()
      .map((line) =>
        this.toLine(
          line,
          order.orderingMode,
          stockByProduct.get(line.product.id) ?? 0,
          settledOrderLineIds.has(line.id),
        ),
      )
    // Both figures ignore the lines already handed over: they are on screen for the record,
    // not for this handover, so they must not make the order look unready or handable.
    const stillToHand = lines.filter((line) => !line.isHandedOver)
    return {
      id: order.id,
      orderingMode: order.orderingMode,
      placedAt: order.placedAt,
      totalEur: centsToEur(order.totalAmountCents),
      isReady: stillToHand.every((line) => line.isReady),
      hasHandableLine: stillToHand.some((line) => line.isReady),
      version: order.version,
      lines,
    }
  }

  toMemberScreen(screen: MemberScreen): DistributionMemberScreenContract {
    return {
      ...this.toMemberSummary(screen.member, screen.balanceCents, screen.orders.length),
      orders: screen.orders.map((order) =>
        this.toOrder(order, screen.stockByProduct, screen.settledOrderLineIds),
      ),
    }
  }

  toHandoverLine(line: HandoverLine): HandoverLineContract {
    const handedQuantity = Number(line.handedQuantity)
    const orderedQuantity = Number(line.orderLine.quantity)
    return {
      id: line.id,
      orderLineId: line.orderLine.id,
      productName: line.orderLine.productNameSnapshot,
      orderedQuantity,
      handedQuantity,
      // Computed here rather than stored, so it can never drift from the two it derives from.
      differenceQuantity: Math.round((handedQuantity - orderedQuantity) * 1000) / 1000,
      unitPriceEur: centsToEur(line.unitPriceAmountCents),
      lineTotalEur: centsToEur(line.lineTotalAmountCents),
    }
  }

  toHandover(handover: Handover, balanceAfterCents: number, isReversed: boolean): HandoverContract {
    return {
      id: handover.id,
      orderId: handover.order.id,
      memberId: handover.member.id,
      kind: handover.kind,
      totalEur: centsToEur(handover.totalAmountCents),
      reversesHandoverId: handover.reversesHandover?.id ?? null,
      isReversed,
      recordedBy: handover.recordedByUser?.name ?? null,
      note: handover.note ?? null,
      createdAt: handover.createdAt,
      lines: handover.lines.isInitialized()
        ? handover.lines.getItems().map((line) => this.toHandoverLine(line))
        : [],
      balanceAfterEur: centsToEur(balanceAfterCents),
    }
  }

  toSellableProduct(item: SellableProduct): DistributionProductContract {
    return {
      id: item.product.id,
      name: item.product.name,
      barcode: item.product.barcode ?? null,
      saleMode: item.product.saleMode,
      selectionUnit: item.product.selectionUnit ?? null,
      quantityStepGrams: item.product.quantityStepGrams ?? null,
      unitPriceEur: centsToEur(item.unitPriceAmountCents),
      quantityOnHand: item.quantityOnHand,
    }
  }

  toSellableProductList(
    items: SellableProduct[],
    total: number,
    pagination: { pageSize: number; offset: number },
  ): DistributionProductListContract {
    return {
      data: items.map((item) => this.toSellableProduct(item)),
      meta: {
        itemCount: total,
        pageSize: pagination.pageSize,
        offset: pagination.offset,
        hasMore: pagination.offset + pagination.pageSize < total,
      },
    }
  }

  toWaitingOrder(row: WaitingOrderRow): WaitingOrderContract {
    return {
      orderId: row.order.id,
      member: {
        id: row.order.member.id,
        membershipNumber: row.order.member.membershipNumber,
        name: row.order.member.user.name,
      },
      orderingMode: row.order.orderingMode,
      placedAt: row.order.placedAt,
      totalEur: centsToEur(row.order.totalAmountCents),
      lineCount: row.order.lines.isInitialized() ? row.order.lines.count() : 0,
      isReady: row.isReady,
    }
  }

  toWaitingOrderList(
    items: WaitingOrderRow[],
    total: number,
    pagination: { pageSize: number; offset: number },
  ): WaitingOrderListContract {
    return {
      data: items.map((row) => this.toWaitingOrder(row)),
      meta: {
        itemCount: total,
        pageSize: pagination.pageSize,
        offset: pagination.offset,
        hasMore: pagination.offset + pagination.pageSize < total,
      },
    }
  }
}
