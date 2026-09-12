import {
  FilteringParams,
  PaginationParams,
  TypedController,
  TypedParam,
  TypedRoute,
} from '@lonestone/nzoth/server'
import { UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { StaffOnly } from '../auth/auth.decorator'
import { AuthGuard } from '../auth/auth.guard'
import {
  type DistributionMemberFiltering,
  distributionMemberFilteringSchema,
  distributionMemberListSchema,
  distributionMemberScreenSchema,
  type DistributionPagination,
  distributionPaginationSchema,
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
}
