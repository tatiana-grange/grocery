import {
  FilteringParams,
  PaginationParams,
  TypedBody,
  TypedController,
  TypedParam,
  TypedRoute,
} from '@lonestone/nzoth/server'
import { UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { LoggedInBetterAuthSession } from '../auth/auth.config'
import { Session, StaffOnly } from '../auth/auth.decorator'
import { AuthGuard } from '../auth/auth.guard'
import {
  type CreateExpressOrderInput,
  createExpressOrderSchema,
  handoverSchema,
  type RecordHandoverInput,
  recordHandoverSchema,
} from './contracts/handover.contract'
import {
  type DistributionMemberFiltering,
  distributionMemberFilteringSchema,
  distributionMemberListSchema,
  distributionMemberScreenSchema,
  type DistributionPagination,
  distributionPaginationSchema,
  type DistributionProductFiltering,
  distributionProductFilteringSchema,
  distributionProductListSchema,
  type WaitingFiltering,
  waitingFilteringSchema,
  waitingOrderListSchema,
} from './contracts/distribution-screen.contract'
import { DistributionMapper } from './distribution.mapper'
import { DistributionService } from './distribution.service'

/**
 * The distribution table. `@StaffOnly()` — a distributor or an admin; a plain member is
 * refused. Every write here moves money and stock, so each one runs in a single transaction
 * inside the service, never across two requests.
 */
@TypedController('distribution', undefined, { tags: ['Distribution'] })
@UseGuards(AuthGuard)
@StaffOnly()
export class DistributionController {
  constructor(
    private readonly distribution: DistributionService,
    private readonly mapper: DistributionMapper,
  ) {}

  @TypedRoute.Get('members', distributionMemberListSchema)
  async searchMembers(
    @PaginationParams(distributionPaginationSchema) pagination: DistributionPagination,
    @FilteringParams(distributionMemberFilteringSchema) filter?: DistributionMemberFiltering,
  ) {
    const filters: { search?: string } = {}
    for (const item of filter ?? []) {
      if (item.property === 'search') filters.search = item.value
    }
    const { items, total } = await this.distribution.searchMembers(pagination, filters)
    return this.mapper.toMemberList(items, total, pagination)
  }

  @TypedRoute.Get('members/:memberId', distributionMemberScreenSchema)
  async memberScreen(@TypedParam('memberId', z.string()) memberId: string) {
    // A member with nothing outstanding is a normal state — an empty order list, not a 404.
    return this.mapper.toMemberScreen(await this.distribution.getMemberScreen(memberId))
  }

  /**
   * Validate a handover. One transaction in the service: the order is marked handed over,
   * stock drops, and the member is charged — together, or not at all (FR-009).
   *
   * Every refusal is a 409 carrying a `code` from `handoverRefusalCodeSchema`, so the table
   * can show the right message (and, for `insufficient_balance`, offer to take payment).
   */
  @TypedRoute.Post('orders/:orderId/handovers', handoverSchema)
  async recordHandover(
    @TypedParam('orderId', z.string()) orderId: string,
    @TypedBody(recordHandoverSchema) body: RecordHandoverInput,
    @Session() session: LoggedInBetterAuthSession,
  ) {
    const { handover, balanceAfterCents } = await this.distribution.recordHandover(
      orderId,
      body,
      session.user.id,
    )
    return this.mapper.toHandover(handover, balanceAfterCents, false)
  }

  /** Products a staffer can sell at the table, searchable by name or barcode (FR-014). */
  @TypedRoute.Get('products', distributionProductListSchema)
  async listSellableProducts(
    @PaginationParams(distributionPaginationSchema) pagination: DistributionPagination,
    @FilteringParams(distributionProductFilteringSchema) filter?: DistributionProductFiltering,
  ) {
    const filters: { search?: string; categoryId?: string } = {}
    for (const item of filter ?? []) {
      if (item.property === 'search') filters.search = item.value
      if (item.property === 'categoryId') filters.categoryId = item.value
    }
    const { items, total } = await this.distribution.listSellableProducts(pagination, filters)
    return this.mapper.toSellableProductList(items, total, pagination)
  }

  /** Create the order and hand it over in one step (FR-017). Nothing exists before this. */
  @TypedRoute.Post('members/:memberId/express-orders', handoverSchema)
  async createExpressOrder(
    @TypedParam('memberId', z.string()) memberId: string,
    @TypedBody(createExpressOrderSchema) body: CreateExpressOrderInput,
    @Session() session: LoggedInBetterAuthSession,
  ) {
    const { handover, balanceAfterCents } = await this.distribution.createExpressOrder(
      memberId,
      body,
      session.user.id,
    )
    return this.mapper.toHandover(handover, balanceAfterCents, false)
  }

  /** Orders still to hand over (FR-031–FR-033). */
  @TypedRoute.Get('waiting', waitingOrderListSchema)
  async listWaiting(
    @PaginationParams(distributionPaginationSchema) pagination: DistributionPagination,
    @FilteringParams(waitingFilteringSchema) filter?: WaitingFiltering,
  ) {
    const filters: {
      orderingMode?: string
      readyOnly?: boolean
      placedFrom?: string
      placedTo?: string
    } = {}
    for (const item of filter ?? []) {
      if (item.property === 'orderingMode') filters.orderingMode = item.value
      if (item.property === 'readyOnly') filters.readyOnly = item.value === 'true'
      if (item.property === 'placedFrom') filters.placedFrom = item.value
      if (item.property === 'placedTo') filters.placedTo = item.value
    }
    const { items, total } = await this.distribution.listWaiting(pagination, filters)
    return this.mapper.toWaitingOrderList(items, total, pagination)
  }
}
