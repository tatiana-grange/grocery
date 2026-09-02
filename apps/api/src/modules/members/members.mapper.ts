import { Injectable } from '@nestjs/common'
import {
  MEMBERSHIP_FEE_STATES,
  type FeeSummary,
  type MemberDetail,
  type MemberListItem,
  type MembersList,
  type MemberSelf,
  type MembershipFeeState,
} from './contracts/member.contract'
import { MembershipFee } from './entities/membership-fee.entity'
import { Member } from './entities/member.entity'
import type { MembersListResult } from './members.service'
import { parseRoles } from './members.util'

@Injectable()
export class MembersMapper {
  /** Derives the fee state from the expected amount and the sum of recorded payments. */
  static deriveFeeState(expectedAmountCents: number, paidAmountCents: number): MembershipFeeState {
    if (paidAmountCents <= 0) return MEMBERSHIP_FEE_STATES[0] // unpaid
    if (paidAmountCents < expectedAmountCents) return MEMBERSHIP_FEE_STATES[1] // partly_paid
    return MEMBERSHIP_FEE_STATES[2] // paid
  }

  toFeeSummary(fee: MembershipFee | undefined): FeeSummary {
    const expectedAmountCents = fee?.expectedAmountCents ?? 0
    const paidAmountCents =
      fee && fee.payments.isInitialized()
        ? fee.payments.getItems().reduce((sum, payment) => sum + payment.amountCents, 0)
        : 0

    return {
      expectedAmountCents,
      paidAmountCents,
      state: MembersMapper.deriveFeeState(expectedAmountCents, paidAmountCents),
    }
  }

  toMemberSelf(member: Member, fee: MembershipFee | undefined): MemberSelf {
    const user = member.user
    return {
      id: member.id,
      membershipNumber: member.membershipNumber,
      name: user.name,
      identifiers: {
        email: this.realEmail(user.email),
        emailVerified: user.emailVerified,
        phoneNumber: user.phoneNumber ?? null,
        phoneNumberVerified: user.phoneNumberVerified ?? false,
      },
      status: member.status,
      roles: parseRoles(user.role),
      profile: {
        addressLine1: member.addressLine1 ?? null,
        addressLine2: member.addressLine2 ?? null,
        postalCode: member.postalCode ?? null,
        city: member.city ?? null,
        phone: member.phone ?? null,
      },
      fee: this.toFeeSummary(fee),
      joinedAt: member.joinedAt ?? null,
      version: member.version,
    }
  }

  toMemberDetail(member: Member, fee: MembershipFee | undefined): MemberDetail {
    const changes = member.statusChanges.isInitialized() ? member.statusChanges.getItems() : []
    const payments = fee && fee.payments.isInitialized() ? fee.payments.getItems() : []

    return {
      ...this.toMemberSelf(member, fee),
      statusHistory: [...changes]
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((change) => ({
          fromStatus: change.fromStatus ?? null,
          toStatus: change.toStatus,
          reason: change.reason ?? null,
          changedByName: change.changedByUser?.name ?? null,
          createdAt: change.createdAt,
        })),
      payments: payments.map((payment) => ({
        id: payment.id,
        kind: payment.kind,
        amountCents: payment.amountCents,
        method: payment.method,
        paidAt: payment.paidAt,
        note: payment.note ?? null,
        recordedByName: payment.recordedByUser?.name ?? '',
        createdAt: payment.createdAt,
      })),
    }
  }

  toMemberListItem(member: Member, feeState: MembershipFeeState): MemberListItem {
    const user = member.user
    return {
      id: member.id,
      membershipNumber: member.membershipNumber,
      name: user.name,
      email: this.realEmail(user.email),
      phoneNumber: user.phoneNumber ?? null,
      status: member.status,
      roles: parseRoles(user.role),
      feeState,
      createdAt: member.createdAt,
    }
  }

  toMembersList(
    { members, total, pagination }: MembersListResult,
    feeStateByMemberId: Map<string, MembershipFeeState>,
  ): MembersList {
    return {
      data: members.map((member) =>
        this.toMemberListItem(member, feeStateByMemberId.get(member.id) ?? MEMBERSHIP_FEE_STATES[0]),
      ),
      meta: {
        itemCount: total,
        pageSize: pagination.pageSize,
        offset: pagination.offset,
        hasMore: pagination.offset + pagination.pageSize < total,
      },
    }
  }

  private realEmail(email: string | null | undefined): string | null {
    if (!email || email.endsWith('@phone.grocery.local')) return null
    return email
  }
}
