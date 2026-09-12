import { Injectable } from '@nestjs/common'
import { centsToEur } from '../catalog/catalog.util'
import type { Member } from '../members/entities/member.entity'
import type { OrderLine } from '../orders/entities/order-line.entity'
import type { Order } from '../orders/entities/order.entity'
import type {
  DistributionLine as DistributionLineContract,
  DistributionMemberList as DistributionMemberListContract,
  DistributionMemberScreen as DistributionMemberScreenContract,
  DistributionMemberSummary as DistributionMemberSummaryContract,
  DistributionOrder as DistributionOrderContract,
} from './contracts/distribution-screen.contract'
import type { MemberScreen, MemberSearchRow } from './distribution.service'
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
    }
  }

  toOrder(order: Order, stockByProduct: Map<string, number>): DistributionOrderContract {
    const lines = order.lines
      .getItems()
      .map((line) =>
        this.toLine(line, order.orderingMode, stockByProduct.get(line.product.id) ?? 0),
      )
    return {
      id: order.id,
      orderingMode: order.orderingMode,
      placedAt: order.placedAt,
      totalEur: centsToEur(order.totalAmountCents),
      isReady: lines.every((line) => line.isReady),
      version: order.version,
      lines,
    }
  }

  toMemberScreen(screen: MemberScreen): DistributionMemberScreenContract {
    return {
      ...this.toMemberSummary(screen.member, screen.balanceCents, screen.orders.length),
      orders: screen.orders.map((order) => this.toOrder(order, screen.stockByProduct)),
    }
  }
}
