import {
  FilteringParams,
  PaginationParams,
  SortingParams,
  TypedBody,
  TypedController,
  TypedParam,
  TypedRoute,
} from '@lonestone/nzoth/server'
import { HttpCode, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { LoggedInBetterAuthSession } from '../auth/auth.config'
import { AdminOnly, Session } from '../auth/auth.decorator'
import { AuthGuard } from '../auth/auth.guard'
import {
  type MemberDetail,
  type MemberFiltering,
  memberDetailSchema,
  memberFilteringSchema,
  type MemberPagination,
  memberPaginationSchema,
  type MemberSorting,
  memberSortingSchema,
  type MemberValidationInput,
  memberValidationSchema,
  membersListSchema,
  type MembershipIntakeInput,
  membershipIntakeSchema,
} from './contracts/member.contract'
import { MembersMapper } from './members.mapper'
import { MembersService } from './members.service'

@TypedController('admin/members', undefined, { tags: ['Admin Members'] })
@UseGuards(AuthGuard)
@AdminOnly()
export class AdminMembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly membersMapper: MembersMapper,
  ) {}

  @TypedRoute.Get('', membersListSchema)
  async list(
    @PaginationParams(memberPaginationSchema) pagination: MemberPagination,
    @SortingParams(memberSortingSchema) sort?: MemberSorting,
    @FilteringParams(memberFilteringSchema) filter?: MemberFiltering,
  ) {
    const result = await this.membersService.listMembers(pagination, sort, filter)
    const feeStates = await this.membersService.feeStatesFor(result.members.map((m) => m.id))
    return this.membersMapper.toMembersList(result, feeStates)
  }

  @TypedRoute.Get(':id', memberDetailSchema)
  async detail(@TypedParam('id', z.string()) id: string): Promise<MemberDetail> {
    const member = await this.membersService.getMemberDetail(id)
    const fee = await this.membersService.getFeeForMember(member.id)
    return this.membersMapper.toMemberDetail(member, fee)
  }

  @TypedRoute.Post(':id/validation', memberDetailSchema)
  @HttpCode(200)
  async decide(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('id', z.string()) id: string,
    @TypedBody(memberValidationSchema) body: MemberValidationInput,
  ): Promise<MemberDetail> {
    const member =
      body.decision === 'validate'
        ? await this.membersService.validateMember(id, body.version, session.user.id)
        : await this.membersService.rejectMember(id, body.version, body.reason, session.user.id)
    const fee = await this.membersService.getFeeForMember(member.id)
    return this.membersMapper.toMemberDetail(member, fee)
  }
}

@TypedController('admin/membership-intake', undefined, { tags: ['Admin Members'] })
@UseGuards(AuthGuard)
@AdminOnly()
export class MembershipIntakeController {
  constructor(private readonly membersService: MembersService) {}

  @TypedRoute.Get('', membershipIntakeSchema)
  async get(): Promise<MembershipIntakeInput> {
    const setting = await this.membersService.getIntakeSetting()
    return { open: setting.open }
  }

  @TypedRoute.Put('', membershipIntakeSchema)
  async set(
    @TypedBody(membershipIntakeSchema) body: MembershipIntakeInput,
  ): Promise<MembershipIntakeInput> {
    const setting = await this.membersService.setIntakeOpen(body.open)
    return { open: setting.open }
  }
}
