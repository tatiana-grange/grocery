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
import { AdminOnly, MemberScoped, Session } from '../auth/auth.decorator'
import { AuthGuard } from '../auth/auth.guard'
import {
  feePaymentsListSchema,
  feeSummarySchema,
  type MemberDetail,
  type MemberFiltering,
  memberDetailSchema,
  memberFilteringSchema,
  type MemberPagination,
  memberPaginationSchema,
  memberSelfSchema,
  type MemberSorting,
  memberSortingSchema,
  type MemberValidationInput,
  memberValidationSchema,
  membersListSchema,
  type MembershipIntakeInput,
  membershipIntakeSchema,
  type RecordFeePaymentInput,
  recordFeePaymentSchema,
  type SetFeeInput,
  setFeeSchema,
  type UpdateProfileInput,
  updateProfileSchema,
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

  @TypedRoute.Put(':id/profile', memberDetailSchema)
  async updateProfile(
    @TypedParam('id', z.string()) id: string,
    @TypedBody(updateProfileSchema) body: UpdateProfileInput,
  ): Promise<MemberDetail> {
    await this.membersService.updateMemberProfile(id, body)
    const member = await this.membersService.getMemberDetail(id)
    return this.membersMapper.toMemberDetail(member, await this.membersService.getFeeForMember(id))
  }

  @TypedRoute.Put(':id/fee', feeSummarySchema)
  async setFee(
    @TypedParam('id', z.string()) id: string,
    @TypedBody(setFeeSchema) body: SetFeeInput,
  ) {
    const fee = await this.membersService.setExpectedFee(id, body)
    return this.membersMapper.toFeeSummary(fee)
  }

  @TypedRoute.Get(':id/fee/payments', feePaymentsListSchema)
  async listFeePayments(@TypedParam('id', z.string()) id: string) {
    return this.membersMapper.toFeePayments(await this.membersService.listFeePayments(id))
  }

  @TypedRoute.Post(':id/fee/payments', feeSummarySchema)
  @HttpCode(200)
  async recordFeePayment(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('id', z.string()) id: string,
    @TypedBody(recordFeePaymentSchema) body: RecordFeePaymentInput,
  ) {
    const fee = await this.membersService.recordFeePayment(id, body, session.user.id)
    return this.membersMapper.toFeeSummary(fee)
  }
}

@TypedController('members/me', undefined, { tags: ['Member self-service'] })
@UseGuards(AuthGuard)
@MemberScoped()
export class MemberSelfController {
  constructor(
    private readonly membersService: MembersService,
    private readonly membersMapper: MembersMapper,
  ) {}

  @TypedRoute.Get('', memberSelfSchema)
  async me(@Session() session: LoggedInBetterAuthSession) {
    const { member, fee } = await this.membersService.getMyAccount(session.user.id)
    return this.membersMapper.toMemberSelf(member, fee)
  }

  @TypedRoute.Put('profile', memberSelfSchema)
  async updateProfile(
    @Session() session: LoggedInBetterAuthSession,
    @TypedBody(updateProfileSchema) body: UpdateProfileInput,
  ) {
    await this.membersService.updateMyProfile(session.user.id, body)
    const { member, fee } = await this.membersService.getMyAccount(session.user.id)
    return this.membersMapper.toMemberSelf(member, fee)
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
